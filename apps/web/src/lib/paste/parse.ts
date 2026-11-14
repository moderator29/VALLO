import { BRAND_DOMAIN } from "@/lib/brand-domain";

/**
 * WHAT A PASTE IS (founder, 14 November 2026, from the Claude composer's
 * chips: "build that system on my platform").
 *
 * WHAT VALLO CANNOT DO, SAID ONCE SO NOBODY CHASES IT. No website and no app
 * is told WHICH APP a paste came from. The banner "Claude pasted from ChatGPT"
 * is drawn by iOS itself when an app reads the clipboard without the person
 * tapping Paste, and the keyboard strip's "Paste from ChatGPT" is iOS too.
 * Vallo gets the same iOS banner for free the moment it reads the clipboard,
 * and it can never show a source of its own. Nothing here pretends otherwise.
 *
 * WHAT AN APP DOES OWN is the half below: what the pasted thing IS, and what
 * the composer should do with it. Pure functions over the clipboard's own
 * data, so every rule is tested without a browser.
 */

/** Longer than this, or more lines than LINES_MAX, is held as a chip. */
export const LONG_TEXT_CHARS = 800;
export const LONG_TEXT_LINES = 12;

export type PastedThing =
  | { kind: "files"; files: File[]; refused: number }
  | { kind: "long-text"; text: string }
  | { kind: "link"; href: string; host: string; path: string; vallo: ValloLink | null }
  | { kind: "text"; text: string };

/** A link to something on Vallo, which may be drawn as that thing's own card. */
export type ValloLink = { thing: "listing" | "stay" | "restaurant" | "profile" | "post"; id: string };

const VALLO_THINGS: Record<string, ValloLink["thing"]> = {
  listing: "listing",
  stay: "stay",
  restaurant: "restaurant",
  u: "profile",
  post: "post",
};

/** Hosts that are Vallo's own, whatever deployment a person is reading on. */
export function isValloHost(host: string, origin?: string): boolean {
  const bare = host.replace(/^www\./i, "").toLowerCase();
  if (bare === BRAND_DOMAIN) return true;
  if (!origin) return false;
  try {
    return new URL(origin).host.replace(/^www\./i, "").toLowerCase() === bare;
  } catch {
    return false;
  }
}

/**
 * The Vallo thing an address names, or null. Only the five that have a card
 * of their own, and only with an id that looks like one, so a stray
 * `/listing/` never draws an empty card.
 */
export function valloLinkOf(href: string, origin?: string): ValloLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!isValloHost(url.host, origin)) return null;
  const [first, second] = url.pathname.split("/").filter(Boolean);
  if (!first || !second) return null;
  const thing = VALLO_THINGS[first];
  if (!thing) return null;
  const id = decodeURIComponent(second).trim();
  if (id.length === 0 || id.length > 120) return null;
  return { thing, id };
}

/** Whether the whole paste is one web address and nothing else. */
export function lonelyLink(text: string): string | null {
  const one = text.trim();
  if (/\s/.test(one)) return null;
  if (!/^(https?:\/\/|www\.)/i.test(one)) return null;
  const href = /^www\./i.test(one) ? `https://${one}` : one;
  try {
    const url = new URL(href);
    return url.host.length > 0 ? href : null;
  } catch {
    return null;
  }
}

/** Over the field's comfort: long enough to hide the composer behind it. */
export function isLongText(text: string): boolean {
  return text.length > LONG_TEXT_CHARS || text.split("\n").length > LONG_TEXT_LINES;
}

/**
 * Every image and video on a clipboard, and how many other files were
 * refused. A screenshot pasted from the phone arrives as an `image/png` file
 * with no name, which is why the name is never trusted for the kind.
 */
export function mediaFrom(items: readonly DataTransferItem[] | DataTransferItemList): { files: File[]; refused: number } {
  const files: File[] = [];
  let refused = 0;
  for (const item of Array.from(items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) files.push(file);
    else refused += 1;
  }
  return { files, refused };
}

/**
 * What the composer should do with this paste. Files win over text, because
 * a copied screenshot carries both the image and its file name; one address
 * on its own becomes a chip; a wall of words becomes a chip; everything else
 * goes into the field exactly as it always did.
 */
export function readPaste(data: DataTransfer, origin?: string): PastedThing {
  const media = mediaFrom(data.items);
  if (media.files.length > 0 || media.refused > 0) {
    return { kind: "files", files: media.files, refused: media.refused };
  }
  const text = data.getData("text/plain") ?? "";
  const href = lonelyLink(text);
  if (href) {
    const url = new URL(href);
    return {
      kind: "link",
      href,
      host: url.host.replace(/^www\./i, ""),
      path: url.pathname === "/" ? "" : url.pathname,
      vallo: valloLinkOf(href, origin),
    };
  }
  if (isLongText(text)) return { kind: "long-text", text };
  return { kind: "text", text };
}

/* ------------------------------------------------------------ cleaning */

/**
 * A pasted phone number loses its spaces, dashes and brackets. A leading
 * plus is kept (it is part of the number); anything else that is not a digit
 * goes, so "+234 (0) 801-234-5678" becomes "+23408012345678" for the field's
 * own rules to read.
 */
export function cleanPhone(text: string): string {
  const trimmed = text.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^0-9]/g, "");
}

/**
 * A pasted amount loses its currency sign, its commas and its spaces, and
 * keeps one decimal point. "NGN 1,250,000.50" and "₦1 250 000,50" both
 * become "1250000.50". Returns null when nothing in it is a number, so the
 * field can leave a bad paste alone rather than clearing itself.
 */
export function cleanAmount(text: string): string | null {
  const bare = text.trim().replace(/[₦$£€]|ngn|naira/gi, "").replace(/\s/g, "");
  /* A comma is a thousands mark here unless it is the only separator and sits
     where a decimal point would: "1250,50" is kobo, "1,250" is a thousand. */
  const decimalComma = /^[0-9]+,[0-9]{1,2}$/.test(bare);
  const digits = decimalComma ? bare.replace(",", ".") : bare.replace(/,/g, "");
  const match = /^-?[0-9]*\.?[0-9]+$/.exec(digits);
  return match ? digits : null;
}

/** A pasted email is trimmed and lowered; nothing else is touched. */
export function cleanEmail(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * The digits of a pasted one-time code, in order, capped at the field's own
 * length. A code copied from an email often arrives as "Your code is 492018"
 * or "492-018", so only the digits are read.
 */
export function cleanCode(text: string, length: number): string {
  return text.replace(/[^0-9]/g, "").slice(0, length);
}

/* --------------------------------------------------------- the chip's face */

/** The first `lines` lines of a long paste, for the chip's two-line face. */
export function firstLines(text: string, lines = 2): string {
  return text
    .split("\n")
    .slice(0, lines)
    .join("\n")
    .slice(0, 160)
    .trim();
}

/**
 * How far over a message's own limit a pasted wall is, or 0 when it fits.
 * The chip says the number, so a person knows what to cut rather than
 * meeting a refusal at Send.
 */
export function overBy(text: string, limit: number): number {
  return Math.max(0, text.length - limit);
}
