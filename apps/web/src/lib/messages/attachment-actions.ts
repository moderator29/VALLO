"use server";

/**
 * A PHOTO OR A VOICE NOTE ARRIVING LIVE (Platform Grade 1, P1.3).
 *
 * Realtime delivers the message row the moment it is written, and the
 * attachment row a moment later, so a photo or a voice note from the other
 * side first lands as its placeholder words ("📷 Photo", "🎤 Voice note").
 * The thread asks this for the attachment, under the reader's own RLS (the
 * attachment and the bucket both answer to members only), and draws the
 * picture or the player as soon as it exists. Nothing written; a read only.
 */

import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { cleanDuration, cleanPeaks } from "./voice-note";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LiveAttachment =
  | { kind: "image"; url: string; width: number | null; height: number | null }
  | { kind: "audio"; url: string; durationMs: number | null; peaks: number[] | null };

export async function readLiveAttachment(input: {
  conversationId: string;
  messageId: string;
}): Promise<ActionResult<LiveAttachment | null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!UUID_RE.test(input?.conversationId ?? "") || !UUID_RE.test(input?.messageId ?? "")) {
    return fail("This message could not be identified.");
  }

  type Row = { storage_path: string; width: number | null; height: number | null; kind?: string; duration_ms?: number | null; peaks?: unknown };
  let row: Row | null = null;
  const voiced = await session.supabase
    .from("message_attachments")
    .select("storage_path, width, height, kind, duration_ms, peaks, messages!inner(conversation_id)")
    .eq("message_id", input.messageId)
    .eq("messages.conversation_id", input.conversationId)
    .limit(1)
    .maybeSingle();
  if (!voiced.error) {
    row = voiced.data as Row | null;
  } else {
    /* No voice-note columns yet (the pending migration): photos only. */
    const plain = await session.supabase
      .from("message_attachments")
      .select("storage_path, width, height, messages!inner(conversation_id)")
      .eq("message_id", input.messageId)
      .eq("messages.conversation_id", input.conversationId)
      .limit(1)
      .maybeSingle();
    if (plain.error) return fail("The attachment could not be read just now.");
    row = plain.data as Row | null;
  }
  if (!row) return ok(null);

  const { data: signed } = await session.supabase.storage
    .from("message-attachments")
    .createSignedUrl(row.storage_path, 3600);
  if (!signed?.signedUrl) return ok(null);

  if (row.kind === "audio") {
    return ok({
      kind: "audio",
      url: signed.signedUrl,
      durationMs: cleanDuration(row.duration_ms),
      peaks: cleanPeaks(row.peaks),
    });
  }
  return ok({ kind: "image", url: signed.signedUrl, width: row.width, height: row.height });
}

/**
 * FRESH LINKS FOR A THREAD LEFT OPEN (Platform Grade 1, P1.3 follow-up).
 *
 * The thread's photos and voice notes are signed for an hour. A thread left
 * open longer (a long negotiation, a phone left on the table) asks for new
 * links before the old ones run out, so a photo never turns into a broken
 * image and a voice note never stops playing mid-conversation. The reader's
 * own RLS decides which attachments come back, exactly as on load.
 */
export async function readThreadMedia(input: {
  conversationId: string;
}): Promise<ActionResult<Record<string, LiveAttachment>>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!UUID_RE.test(input?.conversationId ?? "")) return fail("This conversation could not be identified.");

  type Row = { message_id: string; storage_path: string; width: number | null; height: number | null; kind?: string; duration_ms?: number | null; peaks?: unknown };
  let rows: Row[] = [];
  const voiced = await session.supabase
    .from("message_attachments")
    .select("message_id, storage_path, width, height, kind, duration_ms, peaks, messages!inner(conversation_id, deleted_for_everyone_at)")
    .eq("messages.conversation_id", input.conversationId)
    .is("messages.deleted_for_everyone_at", null)
    .limit(400);
  if (!voiced.error) rows = (voiced.data ?? []) as Row[];
  else {
    const plain = await session.supabase
      .from("message_attachments")
      .select("message_id, storage_path, width, height, messages!inner(conversation_id, deleted_for_everyone_at)")
      .eq("messages.conversation_id", input.conversationId)
      .is("messages.deleted_for_everyone_at", null)
      .limit(400);
    if (plain.error) return fail("The photos could not be refreshed just now.");
    rows = (plain.data ?? []) as Row[];
  }
  if (rows.length === 0) return ok({});

  const { data: signed } = await session.supabase.storage
    .from("message-attachments")
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) urlByPath.set(s.path, s.signedUrl);

  const out: Record<string, LiveAttachment> = {};
  for (const row of rows) {
    const url = urlByPath.get(row.storage_path);
    if (!url || out[row.message_id]) continue;
    out[row.message_id] =
      row.kind === "audio"
        ? { kind: "audio", url, durationMs: cleanDuration(row.duration_ms), peaks: cleanPeaks(row.peaks) }
        : { kind: "image", url, width: row.width, height: row.height };
  }
  return ok(out);
}
