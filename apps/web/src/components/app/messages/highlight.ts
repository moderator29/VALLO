/**
 * SEARCH MATCHES, MARKED (Platform Grade 1, inbox polish).
 *
 * The inbox filters as the reader types; each row then shows WHERE it
 * matched: the words are split around every case-insensitive occurrence of
 * the query so the screen can mark them. A preview that matched beyond what
 * one line shows is re-cut around the match (`snippetAround`), so the reader
 * sees the words that brought the row back. Pure, so it is tested.
 */

export type HitPart = { text: string; hit: boolean };

export function highlightParts(text: string, query: string): HitPart[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLocaleLowerCase();
  const needle = q.toLocaleLowerCase();
  const parts: HitPart[] = [];
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at < 0) break;
    if (at > from) parts.push({ text: text.slice(from, at), hit: false });
    parts.push({ text: text.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), hit: false });
  return parts.length > 0 ? parts : [{ text, hit: false }];
}

/**
 * One line of `text` that shows the first match: unchanged when the match is
 * already near the start, otherwise from a word shortly before it, led by an
 * ellipsis. No match: the text as it was.
 */
export function snippetAround(text: string, query: string, lead = 24): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const q = query.trim().toLocaleLowerCase();
  if (!q) return flat;
  const at = flat.toLocaleLowerCase().indexOf(q);
  if (at <= lead) return flat;
  const cut = flat.lastIndexOf(" ", at - lead);
  return `…${flat.slice(cut < 0 ? at - lead : cut + 1)}`;
}
