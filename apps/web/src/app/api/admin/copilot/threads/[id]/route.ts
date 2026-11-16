import { NextRequest, NextResponse } from "next/server";
import { cleanTurns, isThreadId } from "@/lib/admin/copilot/threads";
import { isSameOriginRequest } from "@/lib/security/request-origin";
import { NOT_SET_UP_BODY, NO_STORE, notSetUp, threadsDoor } from "../store";

/** One saved conversation: open it (GET) or delete it (DELETE). Only the owner's own, by the table's policies. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  if (!isThreadId(id)) return NextResponse.json({ ok: false, message: "That conversation could not be found." }, { status: 404, headers: NO_STORE });
  const door = await threadsDoor();
  if (!door.ok) return NextResponse.json({ ok: false, message: door.message }, { status: door.status, headers: NO_STORE });
  const { data, error } = await door.db.from("copilot_threads").select("id, title, desk, turns, updated_at").eq("id", id).maybeSingle();
  if (error) return notSetUp(error) ? NextResponse.json(NOT_SET_UP_BODY, { status: 200, headers: NO_STORE }) : NextResponse.json({ ok: false, message: "That conversation could not be read just now." }, { status: 502, headers: NO_STORE });
  if (!data) return NextResponse.json({ ok: false, message: "That conversation could not be found." }, { status: 404, headers: NO_STORE });
  const row = data as { id: string; title: string; desk: string; turns: unknown; updated_at: string };
  return NextResponse.json({ ok: true, thread: { id: row.id, title: row.title, desk: row.desk, updatedAt: row.updated_at, turns: cleanTurns(row.turns, { loading: true }) } }, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, message: "That request did not come from the console." }, { status: 403 });
  const { id } = await params;
  if (!isThreadId(id)) return NextResponse.json({ ok: false, message: "That conversation could not be found." }, { status: 404, headers: NO_STORE });
  const door = await threadsDoor();
  if (!door.ok) return NextResponse.json({ ok: false, message: door.message }, { status: door.status, headers: NO_STORE });
  const { error } = await door.db.from("copilot_threads").delete().eq("id", id);
  if (error) return notSetUp(error) ? NextResponse.json(NOT_SET_UP_BODY, { status: 200, headers: NO_STORE }) : NextResponse.json({ ok: false, message: "That conversation could not be deleted just now." }, { status: 502, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
