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
