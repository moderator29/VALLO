import { NextRequest, NextResponse } from "next/server";
import { MAX_THREADS_LISTED, cleanDesk, cleanTurns, isThreadId, threadTitle, type ThreadSummary } from "@/lib/admin/copilot/threads";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request-origin";
import { NOT_SET_UP_BODY, NO_STORE, notSetUp, threadsDoor } from "./store";

/**
 * THE COPILOT'S CHAT HISTORY: the list (GET) and saving a conversation (POST).
 * One conversation is read or deleted at `./[id]`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const door = await threadsDoor();
  if (!door.ok) return NextResponse.json({ ok: false, message: door.message }, { status: door.status, headers: NO_STORE });
  const { data, error } = await door.db.from("copilot_threads").select("id, title, desk, updated_at").order("updated_at", { ascending: false }).limit(MAX_THREADS_LISTED);
  if (error) return notSetUp(error) ? NextResponse.json(NOT_SET_UP_BODY, { status: 200, headers: NO_STORE }) : NextResponse.json({ ok: false, message: "Your conversations could not be read just now." }, { status: 502, headers: NO_STORE });
  const threads: ThreadSummary[] = (Array.isArray(data) ? data : []).map((r) => {
    const row = r as { id: string; title: string; desk: string; updated_at: string };
    return { id: row.id, title: row.title, desk: row.desk, updatedAt: row.updated_at };
  });
  return NextResponse.json({ ok: true, threads }, { headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, message: "That request did not come from the console." }, { status: 403 });
  let body: { id?: unknown; desk?: unknown; turns?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "That request could not be read." }, { status: 400 });
  }
  const door = await threadsDoor();
  if (!door.ok) return NextResponse.json({ ok: false, message: door.message }, { status: door.status, headers: NO_STORE });
  const limited = await consume({ bucket: "admin_copilot_threads", subject: subjectForUser(door.userId), limit: 240, windowSeconds: 3600 });
  if (!limited.allowed) return NextResponse.json({ ok: false, message: "Saving paused for a moment." }, { status: 429, headers: NO_STORE });

  const turns = cleanTurns(body.turns);
  if (turns.length === 0) return NextResponse.json({ ok: false, message: "Nothing to save yet." }, { status: 400, headers: NO_STORE });
  const row = { title: threadTitle(turns), desk: cleanDesk(body.desk), turns, updated_at: new Date().toISOString() };

  if (isThreadId(body.id)) {
    const { data, error } = await door.db.from("copilot_threads").update(row).eq("id", body.id).select("id").maybeSingle();
    if (error) return notSetUp(error) ? NextResponse.json(NOT_SET_UP_BODY, { status: 200, headers: NO_STORE }) : NextResponse.json({ ok: false, message: "This conversation could not be saved just now." }, { status: 502, headers: NO_STORE });
    /* Updated: done. No row: it was deleted elsewhere, or is not theirs, so it is saved as a new one. */
    if (data) return NextResponse.json({ ok: true, id: body.id }, { headers: NO_STORE });
  }
  const { data, error } = await door.db.from("copilot_threads").insert(row).select("id").single();
  if (error) return notSetUp(error) ? NextResponse.json(NOT_SET_UP_BODY, { status: 200, headers: NO_STORE }) : NextResponse.json({ ok: false, message: "This conversation could not be saved just now." }, { status: 502, headers: NO_STORE });
  return NextResponse.json({ ok: true, id: (data as { id: string }).id }, { headers: NO_STORE });
}
