/**
 * RECENT PEOPLE SEARCHES, KEPT ON THIS DEVICE ONLY (the founder, 15 November
 * 2026: "add more tools and flow and ux in the search").
 *
 * What a person searched for is theirs: it never leaves the phone, nothing is
 * sent to Vallo, and clearing the browser's data clears it. A search is kept
 * only once it led somewhere (a profile was opened from it), so half-typed
 * fragments never pile up.
 *
 * Every read and write is wrapped: a private window, blocked storage or a full
 * quota all simply mean no recent searches, never a broken page.
 */

export const RECENT_KEY = "nf_people_recent";
export const RECENT_MAX = 6;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Only what a search box could have produced: short, printable, no markup. */
export function cleanRecent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/^@+/, "").replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 40) return null;
  if (/[<>]/.test(text)) return null;
  return text;
}

export function readRecent(from: Store | null = store()): string[] {
  try {
    const raw = from?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      const clean = cleanRecent(item);
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      out.push(clean);
      if (out.length >= RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

function write(list: string[], to: Store | null): string[] {
  try {
    if (list.length === 0) to?.removeItem(RECENT_KEY);
    else to?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* Storage refused: the list still answers for this visit. */
  }
  return list;
}

/** Newest first, no repeats (ignoring case), never more than six. */
export function rememberRecent(query: string, to: Store | null = store()): string[] {
  const clean = cleanRecent(query);
  const current = readRecent(to);
  if (!clean) return current;
  const next = [clean, ...current.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
  return write(next, to);
}

export function forgetRecent(query: string, to: Store | null = store()): string[] {
  return write(
    readRecent(to).filter((q) => q.toLowerCase() !== query.toLowerCase()),
    to,
  );
}

export function clearRecent(to: Store | null = store()): string[] {
  return write([], to);
}
