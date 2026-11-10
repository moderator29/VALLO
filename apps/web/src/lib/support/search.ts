/**
 * THE ONE SEARCH for Help, Docs, Guides and the legal pages.
 *
 * A pure module: no React, no server imports, so the browser can run it on an
 * index the server built and a unit test can run it with a handful of entries.
 *
 * The matching is deliberately plain. It lowercases, drops filler words ("how
 * do I"), reduces a word to a rough stem ("cancelling", "cancelled" and
 * "cancel" meet), widens a few everyday words to the words this product uses
 * ("free" also finds "fee" and "charge"), and ranks a title hit above a body
 * hit. It never promises more than the entries say: a result is a pointer to
 * the page that holds the answer, with the section it came from.
 */

export type SearchSection = "help" | "docs" | "guides" | "legal";

export const SECTION_LABEL: Record<SearchSection, string> = {
  help: "Help",
  docs: "Docs",
  guides: "Guides",
  legal: "Legal and safety",
};

export type SearchEntry = {
  /** Stable, unique across all sections. */
  id: string;
  section: SearchSection;
  /** The question, chapter heading, guide title or page heading. */
  title: string;
  /** Where it sits: a Help topic, a Docs chapter, a Guide, a legal page. */
  trail: string;
  /** The words searched, and the snippet shown. Plain text. */
  text: string;
  href: string;
};

export type SearchHit = {
  entry: SearchEntry;
  score: number;
  /** A short passage around the first match, for the result row. */
  snippet: string;
  /**
   * The stems this hit matched on (the query's terms and the words they
   * widen to), so the row can mark the matched words in its snippet (R99).
   */
  terms: string[];
};

const STOP = new Set(
  (
    "a an and are as at be by can could do does for from get how i if in is it its me my of on or our should so " +
    "that the their then there these this to us was we what when where which who why will with would you your " +
    "about any am been did into just not now please really than too very want need"
  ).split(" "),
);

/** Everyday word to the words the product uses. Each side finds the other. */
const SYNONYMS: Record<string, string[]> = {
  free: ["fee", "charge", "cost", "price"],
  cost: ["fee", "charge", "price", "pay"],
  price: ["cost", "fee", "charge"],
  fee: ["charge", "cost", "free"],
  charge: ["fee", "cost"],
  cancel: ["cancellation", "refund", "withdraw"],
  refund: ["cancel", "cancellation"],
  book: ["reserve", "reservation", "booking"],
  rent: ["tenancy", "renter", "rental"],
  buy: ["sale", "purchase"],
  sell: ["sale", "list"],
  pay: ["payment", "paid"],
  scam: ["fraud", "safety", "report"],
  safe: ["safety", "trust"],
  verify: ["verification", "verified", "badge"],
  badge: ["verified", "verification", "tick"],
  viewing: ["inspection", "inspect"],
  inspect: ["viewing", "inspection"],
  delete: ["remove", "close"],
  call: ["voice", "video"],
  message: ["chat", "messaging", "inbox"],
  chat: ["message", "messaging"],
  host: ["hotel", "shortlet", "restaurant"],
  agent: ["lister", "landlord"],
  landlord: ["owner", "lister"],
  list: ["listing", "publish"],
  photo: ["picture", "image", "video"],
  money: ["pay", "payment", "escrow"],
};

/** A rough stem: enough for plurals and common endings, never a dictionary. */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  const rules: [string, string][] = [
    ["ations", "ation"],
    ["ing", ""],
    ["ied", "y"],
    ["ies", "y"],
    ["ed", ""],
    ["es", ""],
    ["s", ""],
  ];
  /* Two passes: "bookings" loses the plural, then the "ing". */
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [suffix, keep] of rules) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        w = w.slice(0, w.length - suffix.length) + keep;
        break;
      }
    }
  }
  if (w.endsWith("ation") && w.length > 7) w = w.slice(0, -5);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  /* "cancelling" and "cancellation" both leave a doubled l; fold it. */
  if (w.length > 4 && /([bcdfgklmnprstz])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** The terms of a query: filler dropped, each as its stem plus widening stems. */
export function queryTerms(query: string): { stem: string; also: string[] }[] {
  const words = tokenize(query).filter((w) => !STOP.has(w));
  return words.map((w) => ({
    stem: stem(w),
    also: (SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? []).flatMap((s) => tokenize(s).map(stem)),
  }));
}

function stemmed(text: string): string[] {
  return tokenize(text).map(stem);
}

function count(haystack: string[], needle: string, prefix: boolean): number {
  let n = 0;
  for (const h of haystack) if (h === needle || (prefix && needle.length >= 3 && h.startsWith(needle))) n += 1;
  return n;
}

export type PreparedEntry = { entry: SearchEntry; title: string[]; trail: string[]; text: string[] };

/** Stem every entry once; searching then costs a pass over arrays. */
export function prepare(entries: readonly SearchEntry[]): PreparedEntry[] {
  return entries.map((entry) => ({
    entry,
    title: stemmed(entry.title),
    trail: stemmed(entry.trail),
    text: stemmed(entry.text),
  }));
}

export function snippetFor(text: string, terms: string[], length = 150): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  const lower = clean.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.slice(0, Math.max(3, t.length - 1)));
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  const start = at <= 20 ? 0 : at - 20;
  const slice = clean.slice(start, start + length).trim();
  return `${start > 0 ? "..." : ""}${slice}${start + length < clean.length ? "..." : ""}`;
}

/**
 * Search a prepared index.
 *
 * A result must match at least half of the query's terms (rounded up), so a
 * long plain question still lands while one stray word does not drag in
 * everything. Entries matching every term rank first.
 */
export function searchPrepared(index: PreparedEntry[], query: string, limit = 24): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const need = Math.max(1, Math.ceil(terms.length / 2));
  const hits: (SearchHit & { matched: number })[] = [];

  for (const p of index) {
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      let t = 0;
      if (count(p.title, term.stem, true) > 0) t += count(p.title, term.stem, false) > 0 ? 8 : 4;
      if (count(p.trail, term.stem, true) > 0) t += 2;
      t += Math.min(count(p.text, term.stem, true), 4);
      if (t === 0) {
        for (const alt of term.also) {
          const a = (count(p.title, alt, false) > 0 ? 3 : 0) + Math.min(count(p.text, alt, false), 2) * 0.5;
          t = Math.max(t, a);
        }
      }
      if (t > 0) {
        matched += 1;
        score += t;
      }
    }
    if (matched < need) continue;
    if (matched === terms.length) score += 10;
    /* Help answers are written as the question a person asks; a tie goes to them. */
    if (p.entry.section === "help") score += 1;
    hits.push({
      entry: p.entry,
      score,
      matched,
      snippet: snippetFor(
        p.entry.text,
        terms.map((t) => t.stem),
      ),
      terms: [...new Set(terms.flatMap((t) => [t.stem, ...t.also]))],
    });
  }

  hits.sort((a, b) => b.matched - a.matched || b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return hits.slice(0, limit).map(({ matched: _matched, ...hit }) => hit);
}

/**
 * THE MATCHED WORDS, MARKED (R99). The snippet cut into runs, each saying
 * whether it is a word the search matched, so the row can set those words in
 * bold. A word matches when its rough stem is one of the hit's terms, or
 * starts with one of three letters or more (the same prefix rule the ranking
 * uses), so "refunds" is marked for a search for "refund". Filler and
 * punctuation are never marked. Pure, so a test can hold it.
 */
export function markMatches(snippet: string, terms: readonly string[]): { text: string; match: boolean }[] {
  const wanted = terms.filter(Boolean);
  if (!snippet || wanted.length === 0) return snippet ? [{ text: snippet, match: false }] : [];
  const parts: { text: string; match: boolean }[] = [];
  const push = (text: string, match: boolean) => {
    const last = parts[parts.length - 1];
    if (last && last.match === match) last.text += text;
    else parts.push({ text, match });
  };
  for (const piece of snippet.split(/([A-Za-z0-9]+)/)) {
    if (!piece) continue;
    const word = /^[A-Za-z0-9]+$/.test(piece) ? piece.toLowerCase() : "";
    const s = word && !STOP.has(word) ? stem(word) : "";
    const hit = s !== "" && wanted.some((t) => s === t || (t.length >= 3 && s.startsWith(t)));
    push(piece, hit);
  }
  return parts;
}

export function search(entries: readonly SearchEntry[], query: string, limit?: number): SearchHit[] {
  return searchPrepared(prepare(entries), query, limit);
}
