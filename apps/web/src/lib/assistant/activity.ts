/**
 * WHAT THE MEMBER OPENED, AS THE ASSISTANT MAY REMEMBER IT (1 November 2026).
 *
 * `listing_view_marks` hashes the viewer, so "places you keep opening" cannot
 * be read from it. With the assistant on and Saved preferences granted, a
 * listing the member opens is noted in their own `ai_learned_preferences`, as
 * no more than its kind, its area, its bedrooms and a price band (never the
 * listing, its words or its address), under `seen:` keys so it never overwrites
 * something the member said themselves. Pure, so it is tested without a
 * database; `activity-actions.ts` writes it.
 */

/** At most this many `seen:` keys per member: a new one past the cap is not recorded. */
export const MAX_SEEN_KEYS = 20;
/** A key re-noted within this window is the same visit, not a second one. */
export const SEEN_DEDUPE_MS = 6 * 60 * 60 * 1000;
/** Activity never outweighs what the member said (member keys weigh 3). */
export const SEEN_MAX_WEIGHT = 5;

const clean = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

/** The price band of a figure in kobo, in plain naira steps. */
export function priceBand(minor: number): string | null {
  if (!Number.isFinite(minor) || minor <= 0) return null;
  const naira = minor / 100;
  if (naira < 1_000_000) return "under-1m";
  if (naira < 3_000_000) return "1m-3m";
  if (naira < 6_000_000) return "3m-6m";
  if (naira < 12_000_000) return "6m-12m";
  return "12m-plus";
}

export type Opened = { kind: string; area: string; city: string; bedrooms: number; priceMinor: number };

/** The `seen:` keys one opened listing contributes. Never more than kind, area, bedrooms and band. */
export function seenKeys(l: Opened): string[] {
  const keys: string[] = [];
  const area = clean(l.area || l.city);
  if (area) keys.push(`seen:area:${area}`);
  const kind = clean(l.kind);
  if (kind) keys.push(`seen:kind:${kind}`);
  if (Number.isInteger(l.bedrooms) && l.bedrooms > 0 && l.bedrooms < 20) keys.push(`seen:bedrooms:${l.bedrooms}`);
  const band = priceBand(l.priceMinor);
  if (band) keys.push(`seen:band:${band}`);
  return keys;
}

export type SeenRow = { key: string; weight: number; updatedAt: number };

/** What to write for one key, or null to leave it (a repeat inside the window, or a new key past the cap). */
export function nextSeen(key: string, existing: readonly SeenRow[], now: number): { key: string; weight: number } | null {
  const row = existing.find((r) => r.key === key);
  if (row) {
    if (now - row.updatedAt < SEEN_DEDUPE_MS) return null;
    return { key, weight: Math.min(SEEN_MAX_WEIGHT, row.weight + 1) };
  }
  if (existing.filter((r) => r.key.startsWith("seen:")).length >= MAX_SEEN_KEYS) return null;
  return { key, weight: 1 };
}
