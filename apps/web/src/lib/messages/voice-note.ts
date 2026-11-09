/**
 * VOICE NOTES: THE SHAPE BOTH SIDES AGREE ON (Platform Grade 1, P1.3).
 *
 * Pure and shared by the composer, the server action and the thread read, so
 * the browser and the server can never disagree about what a voice note is:
 *
 *   - it is a message whose body is `VOICE_BODY` and whose one attachment has
 *     `kind = 'audio'`, a length in milliseconds and up to 64 stored bars;
 *   - it lives in the private `message-attachments` bucket at
 *     `<conversationId>/<uuid>.<ext>`, beside the photos, under the same
 *     conversation-folder rule;
 *   - it is at most two minutes long (`VOICE_MAX_MS`). The database allows
 *     five (migration `grade1_voice_notes_and_message_reactions`), so the
 *     product cap can move without a migration.
 */

/** The body a voice-only message carries, the way a photo carries "📷 Photo". */
export const VOICE_BODY = "\u{1F3A4} Voice note";

/** The longest voice note the composer records: two minutes, then it sends by itself. */
export const VOICE_MAX_MS = 120_000;

/** A hold shorter than this is a tap: nothing is sent and the hint is shown. */
export const VOICE_MIN_MS = 500;

/** The server's ceiling: the product cap plus the slack of a timer that stops a frame late. */
export const VOICE_SERVER_MAX_MS = VOICE_MAX_MS + 3_000;

/** Bars stored with a note (`message_attachments.peaks`, at most 64 by the database). */
export const VOICE_STORED_BARS = 40;

/** The file endings the bucket's audio types map to, and the type each is uploaded as. */
export const VOICE_TYPES: Record<string, string> = {
  webm: "audio/webm",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

/** The ending of a stored path, lower case, or null. */
export function extOf(path: string): string | null {
  const m = /\.([a-z0-9]{1,8})$/i.exec(path);
  return m ? m[1]!.toLowerCase() : null;
}

/** True when a stored path names one of the audio types the bucket takes. */
export function isVoicePath(path: string): boolean {
  const ext = extOf(path);
  return ext !== null && ext in VOICE_TYPES;
}

/**
 * Stored bars, made safe to draw: numbers only, clamped to 0..1, at most 64.
 * Anything else (a missing column, a hand-edited row) reads as no bars, so
 * the player falls back to decoding the file, never to invented bars.
 */
export function cleanPeaks(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return null;
  const out: number[] = [];
  for (const v of value) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out.push(Math.min(1, Math.max(0, Math.round(v * 1000) / 1000)));
  }
  return out;
}

/** A stored length, made safe: a whole, non-negative number of ms within the database's range. */
export function cleanDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 300_000) return null;
  return Math.round(value);
}
