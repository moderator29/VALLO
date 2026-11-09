/**
 * PIN AND MUTE: THE MODEL (Platform Grade 1, inbox polish, job 8).
 *
 * A member's own choices about a conversation (`public.conversation_prefs`,
 * migration `grade1_conversation_pin_and_mute`): pinned to the top of their
 * inbox (at most `PIN_LIMIT`), muted until a time. The other person never
 * sees either. Pure, shared by the inbox and the actions, tested on its own.
 */

export const PIN_LIMIT = 5;

export type ConversationPref = { pinnedAt: string | null; mutedUntil: string | null };

export type MuteFor = "8h" | "week" | "always";

/** "Always" is a date far enough away to mean it, and still a real timestamp. */
const ALWAYS = "2100-01-01T00:00:00.000Z";

/** When a mute chosen now ends. */
export function muteUntil(choice: MuteFor, now = Date.now()): string {
  if (choice === "always") return ALWAYS;
  const ms = choice === "8h" ? 8 * 3600_000 : 7 * 24 * 3600_000;
  return new Date(now + ms).toISOString();
}

/** True while a mute is still running. */
export function isMuted(mutedUntil: string | null | undefined, now = Date.now()): boolean {
  if (!mutedUntil) return false;
  const t = Date.parse(mutedUntil);
  return Number.isFinite(t) && t > now;
}

/**
 * Pinned rows first, the most recently pinned on top, then everything else
 * in the order it came (newest activity first). Stable, so the list does not
 * shuffle under the reader.
 */
export function pinnedFirst<T extends { pinnedAt?: string | null }>(rows: readonly T[]): T[] {
  const pinned = rows
    .map((row, i) => ({ row, i }))
    .filter((x) => Boolean(x.row.pinnedAt))
    .sort((a, b) => (b.row.pinnedAt ?? "").localeCompare(a.row.pinnedAt ?? "") || a.i - b.i)
    .map((x) => x.row);
  return [...pinned, ...rows.filter((row) => !row.pinnedAt)];
}
