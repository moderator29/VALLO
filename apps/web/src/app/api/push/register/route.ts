import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/request-origin";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { accountSetupOwed } from "@/lib/actions/session";
import { FINISH_SETUP_PATH } from "@/lib/auth/finish-setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAllowedWebPushEndpoint } from "@/lib/push/endpoint";
import { consume, subjectForUser } from "@/lib/security/rate-limit";

/**
 * POST /api/push/register. A device says it can be reached.
 *
 * ===========================================================================
 * WHY THIS IS A ROUTE AND NOT A ROW LEVEL SECURITY POLICY.
 *
 * `push_tokens` gives a signed-in person SELECT on their own rows and nothing
 * else. Every write is here. That looks heavier than an insert policy and it
 * is the only shape that is correct, for one reason:
 *
 * A HANDSET THAT CHANGES HANDS REISSUES THE SAME TOKEN TO ITS NEW OWNER.
 * Registration therefore has to be able to MOVE a token from whoever held it
 * to whoever holds it now. Under row level security that is an UPDATE of a
 * row belonging to somebody else, and there is no way to permit it without
 * permitting a person to update rows that are not theirs. Here, the move is
 * made by the service role, and the new owner is taken from the VERIFIED
 * SESSION rather than from the request body. That is the same rule
 * `lib/notify/junction.ts` states for email addresses, for the same reason: a
 * function that accepts an identity from a caller will eventually be handed
 * one from a form.
 *
 * Without the move, the previous owner keeps receiving the new owner's
 * notifications until the token expires, which can be months. It is the
 * single most common defect in a push implementation.
 *
 * ===========================================================================
 * NOTHING HERE IS LOGGED AND NOTHING HERE IS RETURNED. The token is a
 * capability to reach a handset. The response says `device_ref`, which names
 * the device and cannot be used to notify it, and never the token.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    platform: z.enum(["web", "ios", "android"]),
    /* A Web Push endpoint URL or a native registration token. Bounded
       because both are far shorter than this and an unbounded string from a
       client is a row a client chooses the size of. */
    token: z.string().min(16).max(2048),
    p256dh: z.string().min(1).max(256).optional(),
    auth: z.string().min(1).max(256).optional(),
    /* Shown to the person on the settings screen so they can tell two of
       their own devices apart. Chosen by the client, so it is not trusted
       for anything and is only ever displayed back to its owner. */
    deviceLabel: z.string().max(80).optional(),
    appVersion: z.string().max(40).optional(),
  })
  .superRefine((value, context) => {
    /* The same pair of rules the table's own check constraints enforce,
       stated here so a client gets a 400 that says what is wrong rather than
       a 500 from a constraint violation. */
    if (value.platform === "web" && (!value.p256dh || !value.auth)) {
      context.addIssue({
        code: "custom",
        message: "a web subscription needs both p256dh and auth",
        path: ["p256dh"],
      });
    }
    /* A web token is a URL the server will POST to, so it must name a real
       push service (lib/push/endpoint.ts). */
    if (value.platform === "web" && !isAllowedWebPushEndpoint(value.token)) {
      context.addIssue({ code: "custom", message: "not a push service endpoint", path: ["token"] });
    }
    if (value.platform !== "web" && (value.p256dh || value.auth)) {
      context.addIssue({
        code: "custom",
        message: "a native token carries no subscription keys",
        path: ["p256dh"],
      });
    }
  });

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "unconfigured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  }
  /* B-2: a Google or Apple account that has not finished setting up (terms +
     18+) writes nothing here; the step is at /sign-up/finish. */
  if (await accountSetupOwed(supabase, user)) {
    return NextResponse.json({ ok: false, reason: "setup_owed", next: FINISH_SETUP_PATH }, { status: 403 });
  }

  /* Each call can add a row the drain will then send to, so an account is
     counted: a person registers a few devices and relaunches a few times a
     day, never thirty times an hour. The launch re-register (F-14) upserts
     the same row and spends one count per app open. */
  const paced = await consume({
    bucket: "push_register",
    subject: subjectForUser(user.id),
    limit: 30,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    /* The reason is deliberately not echoed: a validation error message can
       quote the value it rejected, and the value here is a token. */
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  /* A LIVE TOKEN DOES NOT CHANGE HANDS ON A CLAIM (29 September). Upserting
     on the token alone let anybody who learned another person's token move
     that device's notifications onto their own account. A live row owned by
     somebody else moves only with proof of holding the device: for Web Push,
     the subscription's own keys (a leaked endpoint URL does not carry them);
     for a native token, only once its previous owner revoked it or has not
     been seen on it for 30 days. */
  const { data: existing } = await admin
    .from("push_tokens")
    .select("user_id, revoked_at, p256dh, auth, last_seen_at")
    .eq("token", parsed.token)
    .maybeSingle();
  if (existing && existing.user_id !== user.id && !existing.revoked_at) {
    const staleMs = 30 * 86_400_000;
    const stale = existing.last_seen_at ? Date.now() - Date.parse(existing.last_seen_at) > staleMs : true;
    const provesWeb =
      parsed.platform === "web" &&
      Boolean(existing.p256dh) &&
      existing.p256dh === parsed.p256dh &&
      existing.auth === parsed.auth;
    if (!provesWeb && !(parsed.platform !== "web" && stale)) {
      return NextResponse.json({ ok: false, reason: "registered_elsewhere" }, { status: 409 });
    }
  }

  /* ONE ROW PER TOKEN, EVER. `upsert` on the unique token does all three
     cases at once: a new device inserts, the same person relaunching updates
     `last_seen_at`, and a handset that changed hands has `user_id` moved to
     whoever is signed in now.

     `revoked_at` and `revoked_reason` are cleared, which is what makes
     retirement reversible: a person who revoked a device and then granted
     the permission again gets the same row back rather than a duplicate.
     `failure_streak` is reset for the same reason. */
  const { data, error } = await admin
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        platform: parsed.platform,
        token: parsed.token,
        p256dh: parsed.p256dh ?? null,
        auth: parsed.auth ?? null,
        device_label: parsed.deviceLabel ?? null,
        app_version: parsed.appVersion ?? null,
        last_seen_at: nowIso,
        failure_streak: 0,
        revoked_at: null,
        revoked_reason: null,
      },
      { onConflict: "token" },
    )
    .select("device_ref")
    .maybeSingle();

  if (error || !data) {
    /* No detail travels out. A PostgREST error message quotes the offending
       row, and the offending row contains the token. */
    return NextResponse.json({ ok: false, reason: "not_saved" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deviceRef: data.device_ref }, { status: 200 });
}
