/**
 * Shared helpers for the desk copilot contexts. Every context is a pure
 * function of figures the desk page already read: counts and ages only, never
 * a name, an email, message text or a document's contents. A figure that was
 * not read is left out of the sentence, never replaced by a guess.
 */

/** "1 listing", "3 listings". */
export function countWord(n: number, one: string, other: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : other}`;
}

/** A plain age from a duration in milliseconds: "40 minutes", "3 hours", "2 days". */
export function ageWords(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return countWord(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return countWord(hours, "hour");
  return countWord(Math.floor(hours / 24), "day");
}

/** The age of the oldest of some ISO timestamps, or null when there is none. */
export function oldestAge(isoTimes: readonly (string | null | undefined)[], nowMs: number): string | null {
  let oldest: number | null = null;
  for (const iso of isoTimes) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    if (oldest === null || t < oldest) oldest = t;
  }
  return oldest === null ? null : ageWords(nowMs - oldest);
}

/** Joins sentence parts (dropping the empty ones) into one string, each ending in a full stop. */
export function sentences(parts: readonly (string | null | false | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => (/[.!?]$/.test(p.trim()) ? p.trim() : `${p.trim()}.`))
    .join(" ");
}

/** What a desk says when its figures could not be read: no number to quote. */
export function notLive(deskName: string): string {
  return `This is the ${deskName} desk. Its live figures could not be read just now, so do not quote any numbers for it.`;
}
