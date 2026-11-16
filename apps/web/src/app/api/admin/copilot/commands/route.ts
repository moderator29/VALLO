import { NextResponse } from "next/server";
import { commandsFor } from "@/lib/admin/copilot/commands";
import { resolveCopilotViewer } from "@/lib/admin/copilot/viewer";

/**
 * The copilot's quick commands for THIS person (`lib/admin/copilot/commands.ts`):
 * read from the console door, so a command for a desk they do not hold is
 * never listed, whatever the browser asks for.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const resolved = await resolveCopilotViewer();
  if (resolved.state !== "ok") return NextResponse.json({ ok: false, commands: [] }, { status: resolved.state === "unconfigured" ? 503 : 403, headers: { "cache-control": "no-store" } });
  const { viewer } = resolved;
  const commands = commandsFor({ isAdmin: viewer.isAdmin, isSuperAdmin: viewer.isSuperAdmin, scopes: viewer.scopes });
  return NextResponse.json({ ok: true, commands }, { headers: { "cache-control": "private, max-age=300" } });
}
