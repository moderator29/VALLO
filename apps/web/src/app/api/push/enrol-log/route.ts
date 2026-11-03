import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginRequest } from "@/lib/security/request-origin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consume, subjectForUser } from "@/lib/security/rate-limit";

/**
 * POST /api/push/enrol-log. A device says how its push enrolment went.
 *
 * Every attempt on a phone used to end on the phone: `push_tokens` stayed
 * empty and the only evidence was a reference on a screen the founder had to
 * photograph. This keeps the REFERENCE (a step and a short error name, never a
 * token, an endpoint or a key) in `push_enrol_log`, which no client can read,
 * so a failure can be read from the database. The account comes from the
 * verified session, never the body, and a person is paced so the table cannot
 * be filled from one account.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  platform: z.enum(["web", "ios", "android"]),
  ok: z.boolean(),
  reason: z.string().max(40).optional(),
  step: z.string().max(20).optional(),
  detail: z.string().max(60).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false }, { status: 401 });

  const paced = await consume({
    bucket: "push_enrol_log",
    subject: subjectForUser(auth.user.id),
    limit: 40,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  /* Letters, digits, dash and underscore only: a reference, not free text. */
  const clean = (value: string | undefined) => (value ? value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60) || null : null);

  /* The table is newer than the generated types; a narrow cast, not `any`. */
  const admin = createAdminClient() as unknown as {
    from(table: string): { insert(row: Record<string, unknown>): Promise<unknown> };
  };
  await admin.from("push_enrol_log").insert({
    user_id: auth.user.id,
    platform: parsed.platform,
    ok: parsed.ok,
    reason: clean(parsed.reason),
    step: clean(parsed.step),
    detail: clean(parsed.detail),
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
