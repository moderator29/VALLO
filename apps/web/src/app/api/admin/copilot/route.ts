import { NextRequest, NextResponse } from "next/server";
import { STAFF_SCOPES, type StaffScope } from "@/lib/admin/guard";
import { streamAdminCopilot, type AdminCopilotTurn } from "@/lib/admin/copilot/engine";
import { cleanHistory } from "@/lib/admin/copilot/history";
import { toolsForViewer } from "@/lib/admin/copilot/tools/registry";
import { holds } from "@/lib/admin/copilot/tools/common";
import { resolveCopilotViewer } from "@/lib/admin/copilot/viewer";
import { requestSignal } from "@/lib/ai/upstream-deadline";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request-origin";

/**
 * THE ADMIN COPILOT ROUTE, shared by every desk and the full page (v2).
 *
 * The viewer is resolved ONCE here from the console door (`requireConsole`),
 * never from the request body: the position, the scopes and the name come from
 * the database, so a client cannot claim a role it does not hold. The tools
 * offered to the model are only those whose scopes the viewer holds, and each
 * tool re-checks the desk's own guard when it runs. The body's `scope` only
 * says which desk the person is on, and is refused if they do not hold it.
 *
 * The response is a server-sent event stream: `text`, `tool` (a status line),
 * `proposal` (a card for the person to confirm), then `done` or `error`.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Body = {
  scope?: string | null;
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
  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const resolved = await resolveCopilotViewer();
  if (resolved.state === "unconfigured") return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (resolved.state !== "ok") return NextResponse.json({ error: "not_admin" }, { status: 403 });
  const { viewer } = resolved;

  const scope = typeof body.scope === "string" && body.scope ? body.scope : null;
  if (scope && (!isStaffScope(scope) || !holds(viewer, scope))) return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const limited = await consume({ bucket: "admin_copilot", subject: subjectForUser(viewer.userId), limit: 60, windowSeconds: 3600 });
  if (!limited.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const tools = toolsForViewer(viewer);
  const signal = requestSignal(request.signal);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of streamAdminCopilot(
          apiKey,
          {
            viewer,
            positionTitle: resolved.positionTitle,
            roleSummary: resolved.roleSummary,
            scopeLabels: resolved.scopeLabels,
            deskName: (body.deskName ?? "").trim().slice(0, 60) || "the console",
            context: (body.context ?? "").trim().slice(0, 2000) || null,
            history: cleanHistory(body.history),
            message,
            tools,
            now: Date.now(),
          },
          signal,
        )) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === "done" || event.type === "error") break;
        }
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" },
  });
}
