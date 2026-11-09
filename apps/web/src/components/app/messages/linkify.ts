/**
 * LINKS IN A MESSAGE (Platform Grade 1, thread polish).
 *
 * A web address somebody typed is a way somewhere, so it is drawn as a link
 * that opens (in the system browser, outside the app). Only `http`, `https`
 * and a bare `www.` address are links; a trailing full stop, comma or closing
 * bracket stays with the sentence, not the address. A very long address is
 * shortened on screen (the host, then the start of the path) and kept whole
 * in the link. Pure, so it is tested rather than trusted.
 *
 * No preview card is fetched: reading somebody's URL from Vallo's servers to
 * draw a card would be a request to any address a stranger types, which is
 * not a door this platform opens.
 */

export type TextPart = { kind: "text"; text: string } | { kind: "link"; href: string; label: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;
const LABEL_MAX = 48;

function labelOf(raw: string): string {
  if (raw.length <= LABEL_MAX) return raw;
  try {
    const url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
    const path = url.pathname === "/" ? "" : url.pathname;
    const short = `${url.host}${path}`;
    return short.length <= LABEL_MAX ? `${short}…` : `${short.slice(0, LABEL_MAX - 1)}…`;
  } catch {
    return `${raw.slice(0, LABEL_MAX - 1)}…`;
  }
}

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let raw = match[0];
    const start = match.index ?? 0;
    const tail = TRAILING.exec(raw)?.[0] ?? "";
    /* A closing bracket that closes one opened inside the address stays. */
    if (tail && !(tail.startsWith(")") && raw.includes("("))) raw = raw.slice(0, raw.length - tail.length);
    if (raw.replace(/^https?:\/\//i, "").length < 4) continue;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw;
    parts.push({ kind: "link", href, label: labelOf(raw) });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts.length > 0 ? parts : [{ kind: "text", text }];
}
