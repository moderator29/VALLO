import { NextRequest, NextResponse } from "next/server";
import { confirmProposal } from "@/lib/admin/copilot/act";
import { resolveCopilotViewer } from "@/lib/admin/copilot/viewer";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request-origin";

/**
 * CONFIRM A COPILOT PROPOSAL. Re-authenticates the person, opens the signed
 * token (same person, not expired), re-validates every argument, claims the
 * proposal so it works once, runs the desk's own server action and records
 * the audit row. The body carries the token and nothing else: no argument
 * the browser could change is ever read.
 */
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, message: "That request did not come from the console." }, { status: 403 });
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown }).token;
  } catch {
    return NextResponse.json({ ok: false, message: "That request could not be read." }, { status: 400 });
  }
  const resolved = await resolveCopilotViewer();
  if (resolved.state !== "ok") return NextResponse.json({ ok: false, message: "Sign in to the console again to confirm this." }, { status: resolved.state === "unconfigured" ? 503 : 403 });
  const limited = await consume({ bucket: "admin_copilot_act", subject: subjectForUser(resolved.viewer.userId), limit: 30, windowSeconds: 3600 });
  if (!limited.allowed) return NextResponse.json({ ok: false, message: "That is a lot of changes in a short time. Wait a little and try again." }, { status: 429 });
  const outcome = await confirmProposal({ token, viewer: resolved.viewer, now: Date.now() });
  return NextResponse.json(outcome.body, { status: outcome.status, headers: { "cache-control": "no-store" } });
}
