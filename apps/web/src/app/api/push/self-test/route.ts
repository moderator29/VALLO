import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/request-origin";

import { createClient } from "@/lib/supabase/server";
import { accountSetupOwed } from "@/lib/actions/session";
import { FINISH_SETUP_PATH } from "@/lib/auth/finish-setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { deliverablePlatforms, describeCredentials } from "@/lib/push/credentials";
import { sendApns } from "@/lib/push/transport/apns";
import { sendFcm } from "@/lib/push/transport/fcm";
import { sendWebPush } from "@/lib/push/transport/webpush";
import type { ProviderReply, PushPayload, PushTarget } from "@/lib/push/types";

/**
 * POST /api/push/self-test. Send to MY OWN devices and tell me exactly what
 * the push service said.
 *
 * ===========================================================================
 * THIS IS THE PROOF TOOL, AND IT EXISTS BECAUSE OF WHAT THIS BUILD COULD NOT
 * DO FROM A CONTAINER.
 *
 * Everything else here is proved: the encryption round trips against an
 * independent implementation of the receiver, the queue's idempotency is
 * proved against the live database, the policy is thirty tests. THE ONE THING
 * THAT CANNOT BE PROVED WITHOUT A HANDSET IS THAT A NOTIFICATION APPEARS ON A
 * SCREEN. No amount of code closes that gap. This route closes it in about a
 * minute, from the device itself, for whoever is holding one.
 *
 * WHAT IT PROVES WHEN IT ANSWERS 201: that the credentials are right, that
 * the VAPID signature was accepted, that the endpoint is live, and that the
 * push service has taken the message. WHAT IT DOES NOT PROVE: that the
 * handset could decrypt it. A push service cannot read the body either, so it
 * accepts a ciphertext no browser can open exactly as cheerfully as a good
 * one. THE SCREEN IS THE ONLY PROOF OF THAT, which is why the response says
 * so in as many words rather than declaring victory on a status code.
 *
 * ===========================================================================
 * IT DELIBERATELY BYPASSES THE QUEUE.
 *
 * A diagnostic that goes through the queue tells you about the queue when
 * what you are asking about is the transport. This calls the transport
 * directly, so a failure has exactly one possible location. It writes no
 * `push_queue` row and no `push_deliveries` row, which also means it cannot
 * leave test rows in a live product table.
 *
 * ONLY EVER TO YOURSELF. There is no parameter naming a recipient and there
 * is no branch that could reach one. It reads the devices of the person in
 * the session and nobody else's, so the worst it can be turned into is a way
 * of notifying yourself.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  /* A diagnostic, so a person needs a handful; every press is a real call to
     APNs, FCM or a push service, so it is counted per account. */
  const paced = await consume({
    bucket: "push_self_test",
    subject: subjectForUser(user.id),
    limit: 5,
    windowSeconds: 600,
  });
  if (!paced.allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited", retryAfterSeconds: paced.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(paced.retryAfterSeconds) } },
    );
  }

  const platforms = deliverablePlatforms();
  if (platforms.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no_credentials",
        /* Variable names and who supplies them. Never a value. */
        credentials: describeCredentials(),
      },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("push_tokens")
    .select("id, platform, token, p256dh, auth, device_ref")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .in("platform", platforms);

  const targets: PushTarget[] = (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    token: row.token,
    p256dh: row.p256dh,
    auth: row.auth,
    deviceRef: row.device_ref,
  }));

  if (targets.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no_devices",
        note: "This account has no live device on a platform this deployment can reach. Grant the permission first.",
        platforms,
      },
      { status: 409 },
    );
  }

  const payload: PushPayload = {
    title: "Vallo",
    body: "Push is working. This is a test you asked for.",
    href: "/notifications",
    tag: "vallo-self-test",
    /* High priority, so it is not batched by the operating system and the
       person testing is not left wondering whether it failed or is late. */
    urgent: true,
  };

  const results: Array<{ deviceRef: string; platform: string; status: number; outcome: string; error?: string }> = [];

  for (const target of targets) {
    const reply: ProviderReply =
      target.platform === "web"
        ? await sendWebPush(target, payload)
        : target.platform === "android"
          ? await sendFcm(target, payload)
          : await sendApns(target, payload);

    /* THE REPLY, VERBATIM, AND NOTHING ELSE. `deviceRef` names the device;
       the token does not appear and cannot. */
    results.push({
      deviceRef: target.deviceRef,
      platform: target.platform,
      status: reply.status,
      outcome: reply.outcome,
      ...(reply.error ? { error: reply.error } : {}),
    });
  }

  const accepted = results.filter((result) => result.outcome === "accepted").length;

  return NextResponse.json(
    {
      ok: accepted > 0,
      accepted,
      attempted: results.length,
      results,
      /* The sentence that stops a green status code being mistaken for a
         delivered notification. */
      note: "A 2xx means the push service accepted the message, not that a handset displayed it. Only a notification appearing on the screen proves delivery end to end.",
    },
    { status: accepted > 0 ? 200 : 502 },
  );
}
