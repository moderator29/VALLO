/**
 * PASTE, READ ONCE AND THE SAME WAY EVERYWHERE (founder, 14 November 2026:
 * "build that system on my platform").
 *
 * What an app owns of a paste is what was pasted, never where it came from.
 * No website and no app is told which app the clipboard was filled by: the
 * line "pasted from ..." that a phone shows is drawn by the phone. Nothing in
 * this file, or in anything built on it, names a source, and nothing should.
 *
 * This is the reading, with no DOM in it so it can be tested: which pasted
 * files a composer takes and which it refuses, whether pasted text is long
 * enough to be held as a chip rather than poured into a one-line field,
 * whether it is one web address (and one of Vallo's own), and how a pasted
 * phone number, amount, email or one-time code is cleaned.
 *
 * SAFETY, AND WHY THERE IS NO SECOND DOOR. A held paste is not a different
 * kind of message. `composeBody` joins what was typed and what was pasted
 * into one string, and that string is the message's text: it goes through the
 * same send, the same length limit, the same contact rules on the server and
 * the same scam shield on the bubble as anything typed. Nothing pasted is
 * sent anywhere until the person presses Send.
 */

/** Longer than either of these and a paste is held as a chip above the field. */
export const LONG_PASTE = { chars: 800, lines: 12 } as const;

export function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
}

export function isLongPaste(text: string): boolean {
  return text.length > LONG_PASTE.chars || lineCount(text) > LONG_PASTE.lines;
}

/* ------------------------------------------------------------------ files */

export type PastedFile = { type: string; name?: string; size?: number };

export const isImage = (file: PastedFile): boolean => file.type.startsWith("image/");

/**
 * The pasted files a composer takes, in the order they were pasted, and the
 * ones it does not. `takes` is the composer's own rule (a thread takes
 * photos); `room` is how many more it can hold. A file past the room is not
 * refused for what it is, so it is counted apart and said apart.
 */
export function sortPastedFiles<T extends PastedFile>(
  files: readonly T[],
  options: { takes?: (file: T) => boolean; room?: number } = {},
): { taken: T[]; refused: T[]; overflow: number } {
  const takes = options.takes ?? isImage;
  const room = options.room ?? Number.POSITIVE_INFINITY;
  const taken: T[] = [];
  const refused: T[] = [];
  let overflow = 0;
  for (const file of files) {
    if (!takes(file)) refused.push(file);
    else if (taken.length < room) taken.push(file);
    else overflow += 1;
  }
  return { taken, refused, overflow };
}

/* ------------------------------------------------------------------ links */

const WHOLE_LINK = /^(?:https?:\/\/|www\.)[^\s<>"']+$/i;

/** The address, when the whole paste is one web address and nothing else. */
export function soleLink(text: string): string | null {
  const trimmed = text.trim();
  if (!WHOLE_LINK.test(trimmed)) return null;
  const href = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return href;
  } catch {
    return null;
  }
}

/** What a link chip shows: where it goes, in the address's own words. Nothing is fetched. */
export function linkParts(href: string): { host: string; path: string } {
  try {
    const url = new URL(href);
    const path = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
    return { host: url.host.replace(/^www\./i, ""), path };
  } catch {
    return { host: href, path: "" };
  }
}

/** Vallo's own public hosts. The page's own host is added by the caller. */
export const VALLO_HOSTS = ["vallospaces.com", "www.vallospaces.com"] as const;

export type ValloLinkKind = "listing" | "stay" | "roommate" | "profile" | "post";
export type ValloLink = { kind: ValloLinkKind; id: string; path: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const VALLO_PATHS: [ValloLinkKind, RegExp][] = [
  ["listing", new RegExp(`^/listing/(${UUID})/?$`, "i")],
  ["stay", new RegExp(`^/stay/(${UUID})/?$`, "i")],
  ["roommate", new RegExp(`^/roommates/r/(${UUID})/?$`, "i")],
  ["post", new RegExp(`^/post/(${UUID})/?$`, "i")],
  ["profile", /^\/u\/([a-z0-9_.]{2,30})\/?$/i],
];

/**
 * The Vallo thing an address points at, or null for any other address.
 *
 * The host has to BE one of Vallo's, whole: `vallospaces.com.evil.example`
 * is somebody else's site and reads as an ordinary link. Only https counts,
 * apart from the page's own host (a development server).
 */
export function valloLink(href: string, ownHosts: readonly string[] = []): ValloLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.host.toLowerCase();
  const own = ownHosts.map((h) => h.toLowerCase()).includes(host);
  const vallo = (VALLO_HOSTS as readonly string[]).includes(host) && url.protocol === "https:";
  if (!own && !vallo) return null;
  for (const [kind, pattern] of VALLO_PATHS) {
    const match = pattern.exec(url.pathname);
    if (match) {
      const id = match[1]!.toLowerCase();
      return { kind, id, path: kind === "profile" ? `/u/${id}` : url.pathname.replace(/\/$/, "").toLowerCase() };
    }
  }
  return null;
}

/* ------------------------------------------------------------- what it is */

export type PasteKind =
  | { kind: "plain" }
  | { kind: "long"; text: string }
  | { kind: "link"; href: string; vallo: ValloLink | null };

/** What pasted TEXT is. `plain` means: let it land in the field as it always did. */
export function readPastedText(text: string, ownHosts: readonly string[] = []): PasteKind {
  const href = soleLink(text);
  if (href) return { kind: "link", href, vallo: valloLink(href, ownHosts) };
  if (isLongPaste(text)) return { kind: "long", text };
  return { kind: "plain" };
}

/* -------------------------------------------------------------- the chips */

export type PasteChip =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "link"; href: string; vallo: ValloLink | null };

/** The two lines a text chip shows of what it holds. */
export function chipPreview(text: string): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join("\n");
}

/**
 * THE MESSAGE'S TEXT: what was typed, then each held paste, in order, a blank
 * line between them. This is the only place a chip becomes words, and the
 * result is an ordinary string that every check reads as typed text.
 */
export function composeBody(draft: string, chips: readonly PasteChip[]): string {
  const parts = [draft.trim(), ...chips.map((chip) => (chip.kind === "text" ? chip.text.trim() : chip.href))];
  return parts.filter((part) => part.length > 0).join("\n\n");
}

/** How far over the message's own limit a body is; 0 when it fits. */
export function overBy(body: string, limit: number): number {
  return Math.max(0, body.length - limit);
}

/* ---------------------------------------------------------------- cleaning */

/** A pasted phone number: its digits, and one leading plus when it had one. */
export function cleanPastedPhone(text: string): string {
  const trimmed = text.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") && digits ? `+${digits}` : digits;
}

/**
 * A pasted amount as whole naira: "₦1,250,000.00", "NGN 1 250 000" and
 * "1.25m" are all 1250000. Null when there is no number in it.
 */
export function cleanPastedAmount(text: string): number | null {
  const lower = text.trim().toLowerCase().replace(/ngn|naira|₦|n(?=\s*\d)/g, "");
  const match = /(\d[\d,\s]*)(?:\.(\d+))?\s*(k|m|bn|b)?/.exec(lower);
  if (!match) return null;
  const whole = match[1]!.replace(/[,\s]/g, "");
  if (!whole) return null;
  const value = Number(`${whole}.${match[2] ?? "0"}`);
  if (!Number.isFinite(value)) return null;
  const scale = match[3] === "k" ? 1_000 : match[3] === "m" ? 1_000_000 : match[3] ? 1_000_000_000 : 1;
  const amount = Math.round(value * scale);
  return amount > Number.MAX_SAFE_INTEGER ? null : amount;
}

/**
 * A pasted amount as the plain figure a naira field holds ("1250000", or
 * "1250000.50" where the field takes kobo). Null when there is no number in
 * it, and for plain digits, which the field's own paste already handles.
 */
export function cleanPastedFigure(text: string, allowKobo = false): string | null {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return null;
  const amount = cleanPastedAmount(trimmed);
  if (amount === null) return null;
  if (!allowKobo) return String(amount);
  const plain = /^[^\d]*(\d[\d,\s]*)\.(\d{1,2})\d*\s*$/.exec(trimmed.replace(/ngn|naira|₦/gi, ""));
  if (!plain) return String(amount);
  const kobo = plain[2]!.padEnd(2, "0");
  return kobo === "00" ? plain[1]!.replace(/[,\s]/g, "") : `${plain[1]!.replace(/[,\s]/g, "")}.${kobo}`;
}

/** A pasted email: trimmed, lowered, and out of a "Name <a@b.c>" or "mailto:" wrapper. */
export function cleanPastedEmail(text: string): string {
  const trimmed = text.trim().replace(/^mailto:/i, "");
  const angled = /<([^<>\s]+@[^<>\s]+)>/.exec(trimmed);
  return (angled ? angled[1]! : trimmed).trim().toLowerCase();
}

/**
 * The digits of a pasted one-time code, found in whatever it arrived in:
 * "482913", "482 913" and "Your Vallo code is 482-913. It expires in 10
 * minutes." are all 482913 for a six digit field.
 *
 * In order: a run of exactly `length` digits as written; the same once a
 * single space or dash between digit groups is closed up; the first run of
 * four to `length` digits, as written and then closed up (a field whose
 * limit is longer than the code); and
 * last, every digit there is, uncut, so a code with one digit too many is
 * still the form's to refuse in words rather than this function's to hide.
 */
export function pastedCode(text: string, length: number): string {
  const exact = new RegExp(`(?<!\\d)\\d{${length}}(?!\\d)`);
  const asWritten = exact.exec(text);
  if (asWritten) return asWritten[0];
  const closedText = text.replace(/(?<=\d)[ \u00a0-](?=\d)/g, "");
  const closed = exact.exec(closedText);
  if (closed) return closed[0];
  const shorter = new RegExp(`(?<!\\d)\\d{4,${length}}(?!\\d)`);
  const found = shorter.exec(text) ?? shorter.exec(closedText);
  if (found) return found[0];
  return text.replace(/\D/g, "");
}
