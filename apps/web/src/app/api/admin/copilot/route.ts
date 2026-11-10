import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type StaffScope, STAFF_SCOPES } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS, isStaffPosition } from "@/lib/admin/staff-positions";
import { streamAdminCopilot, type AdminCopilotTurn } from "@/lib/admin/copilot/engine";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request-origin";

/**
 * THE ADMIN COPILOT ROUTE, shared by every desk (founder, 10 November 2026).
 *
 * One door for every desk's assistant: it re-checks `requireAdmin(scope)`
 * itself, so a desk's own page never has to decide who may use it, and a
 * hand-typed request against a scope the caller does not hold is refused
 * here exactly as every other admin route refuses it. The position and its
 * job description come from the server's own `JOB_DESCRIPTIONS`, never from
 * the request body, so a client cannot claim a role it does not hold.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Body = {
  scope: string;
  position?: string | null;
  deskName?: string;
  context?: string | null;
  history?: AdminCopilotTurn[];
  message?: string;
};

function isStaffScope(value: string): value is StaffScope {
  return (STAFF_SCOPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!isStaffScope(body.scope)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const access = await requireAdmin(body.scope);
  if (access.state === "unconfigured") return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (access.state === "signed-out" || access.state === "not-admin" || access.state === "step-up") {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const limited = await consume({
    bucket: "admin_copilot",
    subject: subjectForUser(access.user.id),
    limit: 60,
    windowSeconds: 3600,
  });
  if (!limited.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  /* The position comes from what the page says it is showing (its own
     requireAdmin or staff read already proved it), looked up against the
     server's own job descriptions: never free text from the client. */
  const position = body.position && isStaffPosition(body.position) ? body.position : null;
  const job = position ? JOB_DESCRIPTIONS[position] : null;
  const { data: profile } = await access.userClient.from("profiles").select("first_name, display_name").eq("id", access.user.id).maybeSingle();
  const p = profile as { first_name?: string | null; display_name?: string | null } | null;
  const firstName = (p?.first_name ?? p?.display_name ?? "").trim().split(/\s+/)[0] || "there";
  const deskName = (body.deskName ?? "").trim().slice(0, 60) || "the console";
  const context = (body.context ?? "").trim().slice(0, 2000) || null;
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const encoder = new TextEncoder();
      for await (const event of streamAdminCopilot(
        apiKey,
        {
          viewerFirstName: firstName,
          positionTitle: job?.title ?? null,
          roleSummary: job?.summary ?? null,
          deskName,
          context,
          history,
          message,
        },
        controller.signal,
      )) {
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "done" || event.type === "error") break;
      }
      streamController.close();
    },
  });

  return new NextResponse(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" },
  });
}
