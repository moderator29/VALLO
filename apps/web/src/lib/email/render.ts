import { formatDate, formatMoney } from "@vallo/i18n/core";

import {
  BRAND,
  DARK,
  FONT_MONO,
  FONT_SANS,
  LEGAL_LINE,
  LIGHT,
  LINK,
  LOCKUP_HEIGHT,
  LOCKUP_PATH,
  LOCKUP_WIDTH,
  MAX_WIDTH,
  PAD_X,
  PAPER_STATE,
  SCHEME_DARK_GROUND,
  SCHEME_DARK_INK,
  SCHEME_LIGHT_GROUND,
  SCHEME_LIGHT_INK,
  SIGN_OFF,
  SLOGAN,
  WORDMARK_ALT,
} from "./theme";
import { BRAND_ORIGIN } from "@/lib/brand-domain";
import { configuredSocials } from "./socials";
import { BANNER_ALT, BANNER_SHOWN_HEIGHT, BANNER_SHOWN_WIDTH, bannerFilePath, bannerFor, type BannerFile } from "./banners";
import type { ReceiptModel } from "@/components/app/money/receipt-model";
import {
  EMAIL_GLYPH_SIZE,
  EMAIL_OBJECT_SIZE,
  EMAIL_SHOWS_OBJECT,
  EMAIL_SHOWS_ROW_GLYPHS,
  FAMILY,
  emailFamilyOf,
  emailGlyphPath,
  emailObjectFor,
  emailObjectPath,
  emailRegisterOf,
  type EmailGlyph,
  type EmailKind,
  type EmailRegister,
} from "./icons";

/**
 * The Vallo transactional email shell.
 *
 * ONE DESCRIPTION, TWO RENDERINGS.
 *
 * Every message in this system is written once, as a list of blocks, and this
 * module renders that list twice: as HTML for the client that can draw it, and
 * as plain text for the one that cannot. Nothing is written twice by hand,
 * which is the only way the two stay in step. A text alternative maintained
 * separately is a text alternative that is wrong within a month, and a wrong
 * one is worse than none: it is what a screen reader reads, what a text-only
 * client shows, and what a spam filter compares against the HTML.
 *
 * WHY THERE IS A TEXT PART AT ALL, since almost every client renders HTML. A
 * message with no text/plain part scores worse with every major spam filter,
 * because a missing alternative is a bulk-mail signature. On a platform whose
 * emails carry a verification code and a wallet receipt, landing in spam is
 * not a cosmetic failure.
 *
 * WHITE IN LIGHT MODE, THE PRODUCT'S NIGHT IN DARK (D23, 6 October 2026,
 * superseding the dark-everywhere ruling of 29 September for the inline
 * layer). Every message is a white ground and one white card with a hairline
 * edge: the lockup and the slogan, the message's 3D object, the subject as
 * a display line, the consequence, the figure where there is money, the
 * detail as key-value rows with line glyphs, one primary button with its
 * address as a plain link beneath it, then the footer on the ground. Table
 * layout, every colour inline on the element it paints and repeated as a
 * `bgcolor` attribute for Outlook's Word engine.
 *
 * TWO REGISTERS (icons.ts `FAMILY`, theme.ts). Money and document mail is
 * PAPER: in a dark-mode client the ground goes navy and the card stays the
 * white document sheet (D28.1). Notification and lifecycle mail is the SHELL:
 * in a dark-mode client the card turns to the product's night. Both are white
 * in the inline layer, so a client that strips the style block, which is
 * Gmail, shows the light design every time.
 *
 * READABLE WHATEVER THE READER'S CLIENT DOES WITH DARK MODE. The document
 * declares `color-scheme: light dark`, so Apple Mail and iOS Mail apply the
 * designed dark scheme instead of inverting. Clients that run their own pass
 * anyway (Gmail's iOS app can invert a whole message) are handled by the
 * palette itself: every ink keeps AA against its ground both as written and
 * inverted. `theme.ts` carries the palette and the measurements, and
 * `email-dark-paint.test.ts` holds every message to it.
 *
 * NO WORDS IN IMAGES BEYOND THE BRAND'S OWN. The shell carries the lockup,
 * whose alt is the brand name, so with images off the reader sees "Vallo"
 * once, in its place; at most one 3D object above the headline
 * (`icons.ts`), whose alt is its family word; and 16px line glyphs in the
 * rows, decorative beside their labels, alt empty.
 * Every other word is live text. Copy baked into
 * a picture is unreadable with images off, which is the default in a large
 * share of inboxes, and unreadable to a screen reader always.
 *
 * NO EMOJI as section markers, headings or bullets. They render as tofu in
 * some clients, as a colour glyph the design did not choose in others, and
 * they are read aloud in full by a screen reader in the middle of a sentence
 * about money.
 *
 * Everything interpolated goes through escapeHtml first: listing titles, names
 * and references come from the database or a form, and a stray angle bracket
 * must never be able to reshape the markup.
 *
 * THE PALETTE, THE TYPE STACK AND THE MEASUREMENTS ALL LIVE IN `theme.ts`,
 * which is also what `scripts/build-auth-emails.mjs` mirrors, so the first
 * email somebody ever gets from Vallo and the twentieth are the same design.
 * That file explains at length why literal hex is correct in an email and must
 * not be "fixed" into a CSS custom property.
 */

/** The site the emails link back to. Absolute, no trailing slash. */
const DEFAULT_SITE_URL = BRAND_ORIGIN;

export function siteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const base = configured.length > 0 ? configured : DEFAULT_SITE_URL;
  return base.replace(/\/+$/, "");
}

/** An absolute URL for an in-app path such as "/wallet". */
export function appUrl(path: string): string {
  return siteUrl() + (path.startsWith("/") ? path : "/" + path);
}

/** Escape text for HTML. Every interpolated value passes through here. */
/**
 * EVERY SURFACE PAINTS ITS OWN GROUND, EXPLICITLY (track H, 25 September 2026).
 *
 * The shell's dark was carried by three layers: a `bgcolor` on the body and
 * the card, inline `background:` shorthands, and the `rm-*` classes under a
 * dark media query. Gmail strips the media query and runs its own dark pass,
 * Outlook's Word engine reads `bgcolor` and not the shorthand, and a cell with
 * no colour of its own takes whatever the client decides. So after a message
 * is composed, this walks every body, table, row and cell and makes the colour
 * explicit on each one, in BOTH forms every client honours:
 *
 *   - its own colour, from `background-color`, `background:` or `bgcolor`,
 *     written out as a `bgcolor` attribute AND an inline `background-color`;
 *   - or, where it has none, its container's colour, written the same way.
 *
 * So no cell ever relies on a class, and nothing inherits a white from the
 * client.
 *
 * AND THE GROUND CLASS TRAVELS WITH THE GROUND (29 September 2026). The
 * style block re-asserts the palette by class for the clients that restyle
 * by scheme, so a cell that inherits its colour also inherits the container's
 * `rm-base`, `rm-card`, `rm-panel` or `rm-head` class, and the two are always
 * repainted together rather than a cell being left behind. The mirror of this function lives in `scripts/build-auth-emails.mjs`
 * (a Node script that cannot import TypeScript); `email-dark-paint.test.ts`
 * checks the output of both.
 */
export function paintExplicit(html: string): string {
  const stack: { tag: string; bg: string | null; cls: string | null }[] = [];
  const HEX = /#[0-9a-fA-F]{6}\b/;
  const GROUND_CLASS = /\brm-(base|card|panel|head|sheet-panel|sheet)\b/;
  return html.replace(/<(\/?)(body|table|tr|td)\b([^>]*)>/gi, (whole, close: string, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
      return whole;
    }
    const style = /\bstyle="([^"]*)"/i.exec(attrs)?.[1] ?? null;
    const classAttr = /\bclass="([^"]*)"/i.exec(attrs)?.[1] ?? null;
    const own =
      (style && /background-color\s*:\s*(#[0-9a-fA-F]{6})/i.exec(style)?.[1]) ||
      (style && /background\s*:\s*(#[0-9a-fA-F]{6})/i.exec(style)?.[1]) ||
      /\bbgcolor="(#[0-9a-fA-F]{6})"/i.exec(attrs)?.[1] ||
      null;
    const parent = [...stack].reverse().find((s) => s.bg) ?? null;
    const bg = own ?? parent?.bg ?? null;
    /* The ground class travels with the ground. A cell with its own colour
       keeps its own class (or none: a button is blue in both schemes); a cell
       that only inherits a colour inherits the class that colour came with,
       so the dark scheme repaints it together with its container. */
    const ownClass = classAttr ? (GROUND_CLASS.exec(classAttr)?.[0] ?? null) : null;
    const cls = own ? ownClass : (ownClass ?? parent?.cls ?? null);
    stack.push({ tag, bg, cls });
    if (!bg || tag === "tr" || !HEX.test(bg)) return whole;
    /* Appended, never prepended: every existing attribute keeps its place,
       so a reader (or a test) looking for `<table role="presentation" ...`
       still finds it. A trailing "/" of a self-closing form stays last. */
    let next = attrs.replace(/\s*\/?\s*$/, "");
    const selfClose = /\/\s*$/.test(attrs) ? " /" : "";
    if (!/\bbgcolor="/i.test(next)) next += ` bgcolor="${bg}"`;
    if (style === null) next += ` style="background-color:${bg};"`;
    else if (!/background-color\s*:/i.test(style)) {
      const sep = style.trim().length === 0 || style.trim().endsWith(";") ? "" : ";";
      next = next.replace(/\bstyle="([^"]*)"/i, `style="$1${sep}background-color:${bg};"`);
    }
    if (!own && cls && !ownClass) {
      if (classAttr === null) next += ` class="${cls}"`;
      else next = next.replace(/\bclass="([^"]*)"/i, `class="$1 ${cls}"`);
    }
    return `<${rawTag}${next}${selfClose}>`;
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------------------------------------------------- formatting */

/**
 * Money for humans. Integer kobo in, naira out, always through formatMoney so
 * a raw minor-unit integer can never reach a reader. formatMoney renders whole
 * naira; when an amount carries kobo they are appended, so a receipt stays
 * exact to the last kobo rather than quietly rounding.
 */
export function money(minor: number): string {
  const abs = Math.abs(Math.trunc(minor));
  const kobo = abs % 100;
  const whole = formatMoney(abs - kobo);
  const signed = minor < 0 ? "-" + whole : whole;
  if (kobo === 0) return signed;
  return signed + "." + String(kobo).padStart(2, "0");
}

/** An ISO date (YYYY-MM-DD) as "3 Aug 2026". Read at midday UTC so the
 * calendar day never slips a day either side of the date line. */
export function prettyDate(isoDate: string): string {
  const parsed = new Date(isoDate + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return formatDate(parsed);
}

/** "3 Aug 2026 to 7 Aug 2026", the one date phrase every stay email uses. */
export function dateRange(checkIn: string, checkOut: string): string {
  return prettyDate(checkIn) + " to " + prettyDate(checkOut);
}

/* ----------------------------------------------------- the lock-screen line */

/**
 * WRITTEN FOR THE LOCK SCREEN (29 September 2026, founder: "clean, sharp").
 *
 * What a phone shows when a Vallo email lands is three lines: the sender
 * ("Vallo", `client.ts`), the subject in bold, and one line of preheader. So
 * every message is written for that view first:
 *
 *   SUBJECT: the fact first, 45 characters or fewer, sentence case, no full
 *   stop. Anything past about 45 is cut on a phone, so the end of a longer
 *   subject is decoration rather than communication.
 *
 *   PREHEADER: one sentence, 90 characters or fewer, ending in a full stop,
 *   saying the one thing the subject does not (who, when, how much). Never a
 *   greeting, never marketing, never the subject again.
 *
 * `messages.test.ts` walks every fixture and fails over either limit.
 */
export const SUBJECT_MAX = 45;
export const PREHEADER_MAX = 90;

/**
 * Cut text to `max` characters at a word boundary, with an ellipsis when
 * anything was cut. A trailing comma or colon left by the cut goes too, so
 * "Two bedroom flat, Herbert" never reads as "Two bedroom flat,…".
 */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const room = Math.max(1, max - 1);
  const cut = clean.slice(0, room);
  const atWord = cut.lastIndexOf(" ") > room * 0.5 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return atWord.replace(/[\s,;:.\-]+$/, "") + "…";
}

/**
 * A listing or place title short enough to sit in a subject.
 *
 * Listing titles here are written as "Two bedroom flat, Herbert Macaulay Way,
 * Yaba": the thing, then where it is. On a lock screen the thing is what the
 * reader recognises, so the part before the first comma is used when it says
 * enough on its own, and the whole title is cut at a word otherwise.
 */
export function shortTitle(title: string, max = 28): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const head = clean.split(",")[0]?.trim() ?? "";
  if (head.length >= 8 && head.length <= max) return head;
  return clip(clean, max);
}

/**
 * "Booking confirmed: Two bedroom flat". The fact, then the thing it is
 * about, cut to fit the 45 characters a phone shows. With no room left for a
 * useful detail the fact stands alone rather than trailing a stub.
 */
export function fitSubject(fact: string, detail?: string | null): string {
  const lead = fact.trim();
  const about = (detail ?? "").trim();
  if (about.length === 0) return clip(lead, SUBJECT_MAX);
  const room = SUBJECT_MAX - lead.length - 2;
  if (room < 10) return clip(lead, SUBJECT_MAX);
  return `${lead}: ${shortTitle(about, room)}`;
}

/**
 * A preheader that quotes somebody's words: "Reason: ..." when the label and
 * the words both fit, the words alone when only they fit (the subject already
 * says what they are), and the words cut at a word only as a last resort.
 * Somebody's own sentence is never paraphrased to make it shorter.
 */
export function quoteLine(label: string, words: string, max = PREHEADER_MAX): string {
  const clean = words.replace(/\s+/g, " ").trim();
  const labelled = `${label}: ${clean}`;
  if (labelled.length <= max) return labelled;
  if (clean.length <= max) return clean;
  return clip(clean, max);
}

/** "1 Sep", in Lagos. */
export function dayMonth(isoDate: string): string {
  const parsed = new Date(isoDate + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return formatDate(parsed, "en", { day: "numeric", month: "short" });
}

/**
 * "1 to 5 Sep", "28 Sep to 2 Oct": a stay's dates as a lock screen wants
 * them. The year is left off because every date on this platform is in the
 * coming months; the full range with years stays in the body's rows.
 */
export function shortRange(checkIn: string, checkOut: string): string {
  const from = dayMonth(checkIn);
  const to = dayMonth(checkOut);
  const [fromDay, fromMonth] = from.split(" ");
  const [, toMonth] = to.split(" ");
  if (fromMonth && fromMonth === toMonth && checkIn.slice(0, 4) === checkOut.slice(0, 4)) {
    return `${fromDay} to ${to}`;
  }
  return `${from} to ${to}`;
}

/**
 * A name we can greet somebody by, or null.
 *
 * THE BUG THIS EXISTS TO MAKE IMPOSSIBLE is "Hello ,". It happens the moment
 * a template interpolates a name that turned out to be an empty string, and it
 * is the single clearest signal an email can send that nobody is home. This
 * platform has three ways to arrive at one: a profile whose full_name was
 * never filled in, an OAuth provider that returned no name, and a signed-out
 * support ticket where the name field was submitted blank.
 *
 * Four rules, in order:
 *   1. Trim, and treat whitespace-only as absent.
 *   2. Reject anything that is an email address. Supabase's own metadata falls
 *      back to the address when a provider gives no name, so "Hello
 *      ada.obi@gmail.com" is a real thing this would otherwise print.
 *   3. First token only. "Adaeze Chinwe Obi" greets as "Adaeze", because a
 *      greeting is a first name and reading somebody their own full legal name
 *      back at them is what a bank letter does.
 *   4. Cap the length, so a pasted paragraph in a name field cannot become the
 *      subject line.
 */
export function greetingName(name?: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("@")) return null;
  const first = trimmed.split(/\s+/)[0] ?? "";
  if (first.length === 0) return null;
  return first.length > 40 ? first.slice(0, 40) : first;
}

/**
 * "Hello Ada." or, with no usable name, "Hello there."
 *
 * The fallback is a real greeting rather than a bare "Hello." followed by a
 * sentence, because "Hello." on its own reads as a stub somebody forgot to
 * finish, which is the same impression "Hello ," gives for the same reason.
 */
export function hello(name?: string | null): string {
  const first = greetingName(name);
  return first === null ? "Hello there." : `Hello ${first}.`;
}

/* ------------------------------------------------------------------ blocks */

export type ReceiptRow = {
  label: string;
  value: string;
  /** Emphasise this row: the total line of a receipt, or a new balance. */
  strong?: boolean;
  /** A line glyph beside the label (icons.ts, `EMAIL_GLYPHS`). Decorative. */
  icon?: EmailGlyph;
};

/** A state, said three ways (the app's StatusChip): a word, a shape and a colour. */
export type EmailStatus = "success" | "pending" | "failed" | "neutral";

/** One step of a multi-step process; `done` is a fact, never a guess. */
export type TimelineStep = { label: string; detail?: string; done: boolean };

/**
 * One piece of a message.
 *
 * Deliberately a small closed set. Every block here renders sensibly in both
 * HTML and plain text, and a block that cannot is a block that does not
 * belong in an email: there is no "column", no "card grid" and no "image with
 * copy on it", because none of those survives the trip.
 *
 * THE COMPONENTS (north star 16.5, W9): the figure block, the key-value table
 * with line glyphs, the itemised breakdown with a total rule, the status
 * chip, the timeline, the space card, the person row, the receipt block, the
 * code block and the quiet callout. Each is drawn in the message's register
 * (paper or shell) and in plain text, from the one description.
 */
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: readonly string[] }
  | { kind: "rows"; rows: readonly ReceiptRow[] }
  | {
      kind: "button";
      label: string;
      href: string;
      /**
       * Print the destination underneath with a sentence saying what it is,
       * for the messages whose button IS the message (a password reset has no
       * other way in). Every button already carries its address as a plain
       * link beneath it; this adds the sentence and the full address.
       */
      showUrl?: boolean;
    }
  /** A short value to be read out or typed in: a code, a reference. */
  | { kind: "code"; value: string }
  | { kind: "note"; text: string }
  /** The money, large and tabular, with its quiet label above it. */
  | { kind: "figure"; label: string; value: string; caption?: string }
  /** Itemised lines adding up to a total under a solid rule. */
  | { kind: "itemised"; lines: readonly ReceiptRow[]; total: ReceiptRow }
  | { kind: "status"; status: EmailStatus; label: string }
  | { kind: "timeline"; steps: readonly TimelineStep[] }
  | {
      kind: "space";
      title: string;
      place?: string | null;
      /** An absolute https URL of a real photograph of the space, or nothing. */
      photo?: string | null;
      figureLabel?: string | null;
      figure?: string | null;
    }
  | { kind: "person"; name: string; role: string }
  /** The receipt, drawn from the one receipt model the app draws on screen. */
  | { kind: "receipt"; receipt: ReceiptModel }
  /** A warning said quietly: a panel with a brand rule, never red. */
  | { kind: "callout"; text: string };

/** Convenience constructors, so a message reads as prose rather than as JSON. */
export const heading = (text: string): Block => ({ kind: "heading", text });
export const paragraph = (text: string): Block => ({ kind: "paragraph", text });
export const bullets = (items: readonly string[]): Block => ({ kind: "bullets", items });
export const rows = (list: readonly ReceiptRow[]): Block => ({ kind: "rows", rows: list });
export const button = (label: string, href: string, showUrl?: boolean): Block =>
  showUrl ? { kind: "button", label, href, showUrl } : { kind: "button", label, href };
export const code = (value: string): Block => ({ kind: "code", value });
export const note = (text: string): Block => ({ kind: "note", text });
export const figure = (label: string, value: string, caption?: string): Block =>
  caption ? { kind: "figure", label, value, caption } : { kind: "figure", label, value };
export const itemised = (lines: readonly ReceiptRow[], total: ReceiptRow): Block => ({ kind: "itemised", lines, total });
export const status = (state: EmailStatus, label: string): Block => ({ kind: "status", status: state, label });
export const timeline = (steps: readonly TimelineStep[]): Block => ({ kind: "timeline", steps });
export const space = (card: Omit<Extract<Block, { kind: "space" }>, "kind">): Block => ({ kind: "space", ...card });
export const person = (name: string, role: string): Block => ({ kind: "person", name, role });
export const receiptBlock = (receipt: ReceiptModel): Block => ({ kind: "receipt", receipt });
export const callout = (text: string): Block => ({ kind: "callout", text });

/**
 * Drop the blocks that turned out to have nothing in them.
 *
 * A message often has an optional half: gate details the host never recorded,
 * a reason nobody typed. Building the list with `...(x ? [block(x)] : [])` at
 * every site is noise, so a message may pass null and this removes it. An
 * empty rows block is removed too: a panel with no rows in it renders as a
 * bordered box containing nothing, which reads as a bug and, worse, reads as
 * though the answer were "none".
 */
function usable(blocks: readonly (Block | null | undefined | false)[]): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (!block) continue;
    if (block.kind === "rows" && block.rows.length === 0) continue;
    if (block.kind === "bullets" && block.items.length === 0) continue;
    if (block.kind === "timeline" && block.steps.length === 0) continue;
    if (block.kind === "itemised" && block.lines.length === 0) continue;
    out.push(block);
  }
  return out;
}

/* ------------------------------------------------------------ the registers */

/**
 * THE CLASSES A REGISTER PAINTS WITH (theme.ts, SCHEME_*).
 *
 * Both registers write the same LIGHT values inline, so every email is white
 * in light mode in every client. What differs is the class each surface and
 * ink carries, which decides what a dark-mode client does with it: the shell
 * classes flip to the product's night, the sheet classes stay paper.
 */
export type Ink = {
  card: string;
  panel: string;
  title: string;
  body: string;
  muted: string;
  link: string;
};

export const SHELL_INK: Ink = {
  card: "rm-card",
  panel: "rm-panel",
  title: "rm-title",
  body: "rm-body",
  muted: "rm-muted",
  link: "rm-link",
};

export const PAPER_INK: Ink = {
  card: "rm-sheet",
  panel: "rm-sheet-panel",
  title: "rm-ink",
  body: "rm-ink-body",
  muted: "rm-ink-muted",
  link: "rm-ink-link",
};

export function inkFor(register: EmailRegister): Ink {
  return register === "paper" ? PAPER_INK : SHELL_INK;
}

/* -------------------------------------------------------------- html parts */

const TEXT = `font-family:${FONT_SANS};`;
/** Tabular figures where a client honours it; every client still gets the digits. */
const TABULAR = "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;";

/** A 16px line glyph, decorative beside its label: alt empty, box reserved. */
function glyphHtml(glyph: EmailGlyph): string {
  const size = EMAIL_GLYPH_SIZE;
  return `<img src="${siteUrl()}${emailGlyphPath(glyph)}" width="${size}" height="${size}" alt="" border="0" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;" />`;
}

/**
 * THE KEY-VALUE TABLE (16.5): label left in quiet ink, value right, a
 * hairline between rows, and a line glyph before the label when the row
 * names one. The glyph column only exists when a row in the block has one,
 * so a table of plain facts is not indented for nothing.
 */
function rowsHtml(list: readonly ReceiptRow[], ink: Ink, options: { first?: boolean } = {}): string {
  const glyphs = EMAIL_SHOWS_ROW_GLYPHS && list.some((row) => row.icon);
  return list
    .map((row, index) => {
      const top = index === 0 && options.first !== false ? "0" : `1px solid ${LIGHT.edge}`;
      /* Labels in body ink and values in title ink: the muted ink measures
         4.45:1 on the details panel, a hair under AA, and a label is read, so
         the hierarchy is carried by size and weight rather than by a paler ink. */
      const weight = row.strong ? "700" : "400";
      const valueClass = ink.title;
      const valueColour = LIGHT.text;
      const glyphCell = glyphs
        ? `<td width="28" valign="top" style="width:28px;padding:15px 0 0;border-top:${top};vertical-align:top;font-size:0;line-height:0;">${row.icon ? glyphHtml(row.icon) : "&nbsp;"}</td>`
        : "";
      return `<tr>
                          ${glyphCell}<td width="40%" class="${ink.body}" style="width:40%;padding:13px 12px 13px 0;border-top:${top};${TEXT}font-size:13px;line-height:1.5;vertical-align:top;color:${LIGHT.body};">${escapeHtml(row.label)}</td>
                          <td align="right" class="${valueClass}" style="padding:13px 0;border-top:${top};${TEXT}${TABULAR}font-size:15px;line-height:1.5;font-weight:${weight};vertical-align:top;color:${valueColour};">${escapeHtml(row.value)}</td>
                        </tr>`;
    })
    .join("\n                        ");
}

/**
 * THE DETAILS BLOCK (the redesign of 13 October 2026): the facts of the
 * message (when, where, how much) in one quiet panel, a step off the card's
 * white, label left and value right with a hairline between rows. No glyphs
 * and no heavy rules: the headline and the one button carry the message, and
 * this is what a reader glances at to be sure it is the right booking.
 */
function rowsTable(list: readonly ReceiptRow[], ink: Ink, margin = "0 0 26px"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:${margin};">
                    <tr>
                      <td class="${ink.panel}" bgcolor="${LIGHT.panel}" style="background-color:${LIGHT.panel};border-radius:12px;padding:4px 18px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                    ${rowsHtml(list, ink)}
                        </table>
                      </td>
                    </tr>
                  </table>`;
}

/** The figure: a quiet label, then the money large and tabular (16.5). */
function figureHtml(label: string, value: string, ink: Ink, caption?: string, margin = "0 0 24px"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:${margin};">
                    <tr><td class="${ink.muted}" style="padding:0 0 6px;${TEXT}font-size:13px;line-height:18px;font-weight:500;color:${LIGHT.muted};">${escapeHtml(label)}</td></tr>
                    <tr><td class="${ink.title}" style="padding:0;${TEXT}${TABULAR}font-size:38px;line-height:44px;font-weight:700;letter-spacing:-0.025em;color:${LIGHT.text};">${escapeHtml(value)}</td></tr>${
                      caption
                        ? `
                    <tr><td class="${ink.muted}" style="padding:6px 0 0;${TEXT}font-size:13px;line-height:18px;color:${LIGHT.muted};">${escapeHtml(caption)}</td></tr>`
                        : ""
                    }
                  </table>`;
}

/** The total under a solid 2px rule: the line the column adds up to. */
function totalRowHtml(total: ReceiptRow, ink: Ink): string {
  return `<tr>
                      <td class="${ink.title}" style="padding:14px 12px 0 0;border-top:2px solid ${LIGHT.text};${TEXT}font-size:16px;line-height:1.4;font-weight:700;color:${LIGHT.text};">${escapeHtml(total.label)}</td>
                      <td align="right" class="${ink.title}" style="padding:14px 0 0;border-top:2px solid ${LIGHT.text};${TEXT}${TABULAR}font-size:16px;line-height:1.4;font-weight:700;color:${LIGHT.text};">${escapeHtml(total.value)}</td>
                    </tr>`;
}

/**
 * A state, said three ways: the word, a shape and a colour (the app's
 * StatusChip). Done is a filled circle, waiting a hollow one, failed a filled
 * square, neutral a bar. The word is in the ink of the text around it, so it
 * reads in every scheme; the shape and its colour carry the state beside it.
 */
function statusMark(state: EmailStatus): string {
  const colour = state === "success" ? PAPER_STATE.success : state === "failed" ? PAPER_STATE.error : state === "pending" ? PAPER_STATE.attention : LIGHT.muted;
  const shape =
    state === "success"
      ? `width:8px;height:8px;border-radius:4px;background-color:${colour};`
      : state === "pending"
        ? `width:6px;height:6px;border-radius:4px;border:2px solid ${colour};`
        : state === "failed"
          ? `width:8px;height:8px;border-radius:1px;background-color:${colour};`
          : `width:10px;height:3px;border-radius:2px;background-color:${colour};`;
  return `<span style="display:inline-block;vertical-align:middle;${shape}">&nbsp;</span>`;
}

function statusHtml(state: EmailStatus, label: string, ink: Ink): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                    <tr>
                      <td class="${ink.title}" style="padding:6px 14px;border:1px solid ${LIGHT.edge};border-radius:999px;${TEXT}font-size:13px;line-height:18px;font-weight:600;color:${LIGHT.text};mso-line-height-rule:exactly;">${statusMark(state)}&nbsp;&nbsp;${escapeHtml(label)}</td>
                    </tr>
                  </table>`;
}

/** A multi-step process as a column of marks: filled when done, hollow when not. */
function timelineHtml(steps: readonly TimelineStep[], ink: Ink): string {
  const cells = steps
    .map((step, index) => {
      const last = index === steps.length - 1;
      const mark = step.done
        ? `<span style="display:inline-block;width:12px;height:12px;border-radius:7px;background-color:${LINK};border:1px solid ${LINK};">&nbsp;</span>`
        : `<span style="display:inline-block;width:10px;height:10px;border-radius:7px;border:2px solid ${LIGHT.muted};">&nbsp;</span>`;
      return `<tr>
                      <td width="24" valign="top" style="width:24px;padding:3px 0 ${last ? "0" : "16px"};vertical-align:top;font-size:0;line-height:0;">${mark}</td>
                      <td valign="top" style="padding:0 0 ${last ? "0" : "16px"};vertical-align:top;">
                        <p class="${step.done ? ink.title : ink.body}" style="margin:0;${TEXT}font-size:15px;line-height:1.45;font-weight:${step.done ? "600" : "500"};color:${step.done ? LIGHT.text : LIGHT.body};">${escapeHtml(step.label)}</p>${
                          step.detail
                            ? `
                        <p class="${ink.muted}" style="margin:2px 0 0;${TEXT}font-size:13px;line-height:1.5;color:${LIGHT.muted};">${escapeHtml(step.detail)}</p>`
                            : ""
                        }
                      </td>
                    </tr>`;
    })
    .join("\n                    ");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;">
                    ${cells}
                  </table>`;
}

/** Initials for the person row's disc: two letters at most, never a guess at a face. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "");
  return letters.toUpperCase() || "V";
}

function personHtml(name: string, role: string, ink: Ink): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px;">
                    <tr>
                      <td width="52" valign="middle" style="width:52px;vertical-align:middle;">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                          <td align="center" class="${ink.panel} ${ink.link}" width="40" height="40" style="width:40px;height:40px;background-color:${LIGHT.panel};border-radius:20px;${TEXT}font-size:15px;line-height:40px;font-weight:700;text-align:center;color:${LINK};mso-line-height-rule:exactly;">${escapeHtml(initialsOf(name))}</td>
                        </tr></table>
                      </td>
                      <td valign="middle" style="vertical-align:middle;">
                        <p class="${ink.title}" style="margin:0;${TEXT}font-size:15px;line-height:1.4;font-weight:600;color:${LIGHT.text};">${escapeHtml(name)}</p>
                        <p class="${ink.muted}" style="margin:2px 0 0;${TEXT}font-size:13px;line-height:1.4;color:${LIGHT.muted};">${escapeHtml(role)}</p>
                      </td>
                    </tr>
                  </table>`;
}

/**
 * THE SPACE CARD: a real photograph when there is one, the space's name and
 * place, and its move-in total. With images off the photograph's alt is the
 * space's name, set in quiet ink in a box of the photograph's size, so the
 * card still reads. No photograph, no image: a card never stands in a
 * picture of somewhere else.
 */
function spaceHtml(block: Extract<Block, { kind: "space" }>, ink: Ink): string {
  const photo =
    block.photo && /^https:\/\//.test(block.photo)
      ? `<td width="112" valign="top" style="width:112px;padding:0 16px 0 0;vertical-align:top;"><img data-space-photo="" src="${escapeHtml(block.photo)}" width="96" height="96" alt="${escapeHtml(block.title)}" border="0" style="display:block;width:96px;height:96px;border:0;border-radius:12px;object-fit:cover;${TEXT}font-size:12px;line-height:16px;color:${LIGHT.muted};" /></td>`
      : "";
  const money =
    block.figure && block.figureLabel
      ? `
                          <p class="${ink.muted}" style="margin:12px 0 2px;${TEXT}font-size:12px;line-height:16px;color:${LIGHT.muted};">${escapeHtml(block.figureLabel)}</p>
                          <p class="${ink.title}" style="margin:0;${TEXT}${TABULAR}font-size:20px;line-height:26px;font-weight:700;letter-spacing:-0.01em;color:${LIGHT.text};">${escapeHtml(block.figure)}</p>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
                    <tr>
                      <td style="border:1px solid ${LIGHT.edge};border-radius:16px;padding:16px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
                          ${photo}<td valign="top" style="vertical-align:top;">
                          <p class="${ink.title}" style="margin:0;${TEXT}font-size:16px;line-height:1.35;font-weight:600;color:${LIGHT.text};">${escapeHtml(block.title)}</p>${
                            block.place
                              ? `
                          <p class="${ink.muted}" style="margin:4px 0 0;${TEXT}font-size:13px;line-height:1.4;color:${LIGHT.muted};">${escapeHtml(block.place)}</p>`
                              : ""
                          }${money}
                          </td>
                        </tr></table>
                      </td>
                    </tr>
                  </table>`;
}

/**
 * THE RECEIPT BLOCK: the one receipt model (components/app/money/
 * receipt-model.ts) in the same order the document sheet draws it on screen,
 * so the inbox and the app show one receipt. The kind and the title, the
 * place, the figure, a dashed tear line, the facts and the itemised lines,
 * the total under its rule, then each confirmation the record holds with its
 * mark, the reference when there is one, and the rail sentence.
 */
function receiptHtml(receipt: ReceiptModel, ink: Ink): string {
  const head = `<p class="${ink.muted}" style="margin:0 0 4px;${TEXT}font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.02em;color:${LIGHT.muted};">${escapeHtml(receipt.kind)}</p>
                  <p class="${ink.title}" style="margin:0;${TEXT}font-size:18px;line-height:1.35;font-weight:600;color:${LIGHT.text};">${escapeHtml(receipt.title)}</p>${
                    receipt.place
                      ? `
                  <p class="${ink.muted}" style="margin:4px 0 0;${TEXT}font-size:13px;line-height:1.4;color:${LIGHT.muted};">${escapeHtml(receipt.place)}</p>`
                      : ""
                  }`;
  const lines = [...receipt.facts, ...receipt.lines];
  const confirmRows = receipt.confirmations
    .map(
      (row) => `<tr>
                      <td class="${ink.muted}" style="padding:11px 12px 11px 0;border-top:1px solid ${LIGHT.edge};${TEXT}font-size:13px;line-height:1.5;color:${LIGHT.muted};">${escapeHtml(row.label)}</td>
                      <td align="right" class="${ink.link}" style="padding:11px 0;border-top:1px solid ${LIGHT.edge};${TEXT}font-size:14px;line-height:1.5;font-weight:600;color:${LINK};">${statusMark("success")}&nbsp;&nbsp;${escapeHtml(row.state)}</td>
                    </tr>`,
    )
    .join("\n                    ");
  const reference = receipt.reference
    ? `<tr>
                      <td class="${ink.muted}" style="padding:11px 12px 11px 0;border-top:1px solid ${LIGHT.edge};${TEXT}font-size:13px;line-height:1.5;color:${LIGHT.muted};">${escapeHtml(receipt.reference.label)}</td>
                      <td align="right" class="${ink.title}" style="padding:11px 0;border-top:1px solid ${LIGHT.edge};font-family:${FONT_MONO};font-size:13px;line-height:1.5;letter-spacing:0.02em;word-break:break-all;color:${LIGHT.text};">${escapeHtml(receipt.reference.value)}</td>
                    </tr>`
    : "";
  const confirmations =
    confirmRows || reference
      ? `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0 0;">
                    ${confirmRows}${reference ? "\n                    " + reference : ""}
                  </table>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;">
                    <tr>
                      <td style="border:1px solid ${LIGHT.edge};border-radius:16px;padding:22px 22px 20px;">
                  ${head}
                  ${figureHtml(receipt.figureLabel, receipt.figure, ink, undefined, "18px 0 0")}
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0 0;border-top:1px dashed ${LIGHT.edge};">
                    ${rowsHtml(lines, ink)}
                    ${totalRowHtml(receipt.total, ink)}
                  </table>${confirmations}
                  <p class="${ink.muted}" style="margin:18px 0 0;${TEXT}font-size:12px;line-height:1.55;color:${LIGHT.muted};">${escapeHtml(receipt.note)}</p>
                      </td>
                    </tr>
                  </table>`;
}

/**
 * THE ONE PRIMARY BUTTON (the redesign of 13 October 2026): the product's
 * brand blue as a SOLID fill, white label, a rounded rectangle (never a
 * capsule, D2: 12px of radius on a 50px button is a ratio of 0.24). No
 * gradient, no glow: a flat button is the same in every client, and the one
 * action in the message needs no ornament to be found.
 *
 * BULLETPROOF, in the specific sense the word has in email. Outlook's Word
 * engine ignores padding on an inline-block and draws no radius, so it gets a
 * VML round rectangle with the same fill and an anchor lock; every other
 * client gets a table cell carrying the fill as both a `bgcolor` attribute and
 * an inline colour, with the padding on the anchor so the whole button is the
 * tap target on a phone. On a phone the button runs the full width of the
 * card (`rm-btn`, the style block's narrow rule).
 *
 * The colour is written #FFFFFF rather than through the palette because it is
 * the text ON the brand blue in both schemes, not a themed value.
 */
export function buttonHtml(label: string, url: string, options: { arrow?: boolean; margin?: string } = {}): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  const shown = options.arrow ? `${safeLabel}&nbsp;&nbsp;&rarr;` : safeLabel;
  const width = Math.min(380, Math.max(190, Math.round(label.length * 9.6 + 72)));
  return `<!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:50px;v-text-anchor:middle;width:${width}px;" arcsize="24%" strokecolor="${BRAND}" strokeweight="1px" fillcolor="${BRAND}">
                    <w:anchorlock/>
                    <center style="color:#FFFFFF;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:600;">${shown}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <table role="presentation" class="rm-btn" cellpadding="0" cellspacing="0" style="margin:${options.margin ?? "10px 0 12px"};">
                    <tr>
                      <td align="center" bgcolor="${BRAND}" style="border-radius:12px;background-color:${BRAND};">
                        <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 34px;${TEXT}font-size:16px;line-height:20px;font-weight:600;letter-spacing:-0.01em;color:#FFFFFF;text-decoration:none;border-radius:12px;">${shown}</a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->`;
}

function htmlBlock(block: Block, ink: Ink): string {
  switch (block.kind) {
    case "heading":
      // font-family is repeated on the h1 because several clients reset heading
      // fonts to a serif default and inheritance from body does not save it.
      // The subject as a display line (16.5): 28px, 700, tight.
      return `<h1 class="${ink.title}" style="margin:0 0 14px;${TEXT}font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.022em;color:${LIGHT.text};">${escapeHtml(block.text)}</h1>`;

    case "paragraph":
      return `<p class="${ink.body}" style="margin:0 0 20px;${TEXT}font-size:16px;line-height:1.65;color:${LIGHT.body};">${escapeHtml(block.text)}</p>`;

    case "bullets": {
      const items = block.items
        .map(
          (item) =>
            `<li class="${ink.body}" style="margin:0 0 10px;padding-left:2px;color:${LIGHT.body};">${escapeHtml(item)}</li>`,
        )
        .join("\n                    ");
      return `<ul class="${ink.body}" style="margin:0 0 22px;padding:0 0 0 22px;${TEXT}font-size:16px;line-height:1.65;color:${LIGHT.body};">
                    ${items}
                  </ul>`;
    }

    case "rows":
      return rowsTable(block.rows, ink);

    case "figure":
      return figureHtml(block.label, block.value, ink, block.caption);

    case "itemised":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;">
                    ${rowsHtml(block.lines, ink)}
                    ${totalRowHtml(block.total, ink)}
                  </table>`;

    case "status":
      return statusHtml(block.status, block.label, ink);

    case "timeline":
      return timelineHtml(block.steps, ink);

    case "space":
      return spaceHtml(block, ink);

    case "person":
      return personHtml(block.name, block.role, ink);

    case "receipt":
      return receiptHtml(block.receipt, ink);

    case "callout":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
                    <tr>
                      <td class="${ink.panel} ${ink.body}" style="background-color:${LIGHT.panel};border-left:3px solid ${LINK};border-radius:4px 12px 12px 4px;padding:14px 16px;${TEXT}font-size:14px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(block.text)}</td>
                    </tr>
                  </table>`;

    case "button":
      /*
       * The button itself is `buttonHtml` (one button for every message,
       * including the welcome). What stays here is the plain link beneath it,
       * ALWAYS (16.5): the address as text in the link blue, for the clients
       * and gateways that strip a styled anchor, so no button is ever the only
       * way through.
       */
      return `${buttonHtml(block.label, block.href)}${
                    block.showUrl
                      ? `
                  <p class="${ink.muted}" style="margin:0 0 6px;${TEXT}font-size:13px;line-height:1.6;color:${LIGHT.muted};">If the button does not work, copy this address into your browser:</p>
                  <p class="${ink.link}" style="margin:0 0 20px;font-family:${FONT_MONO};font-size:13px;line-height:1.6;word-break:break-all;color:${LINK};">${escapeHtml(block.href)}</p>`
                      : /* The whole address, scheme included, as the copy-this line above
                           prints it: a bare "vallo.ng/messages/<id>" reads as copy and
                           puts a record's id in the visible text (outbox-delivery). */ `
                  <p class="${ink.link}" style="margin:0 0 22px;${TEXT}font-size:12px;line-height:1.6;word-break:break-all;color:${LINK};"><a class="${ink.link}" href="${escapeHtml(block.href)}" target="_blank" style="color:${LINK};text-decoration:underline;">${escapeHtml(block.href)}</a></p>`
                  }`;

    case "code":
      // Letter-spacing pushes the last glyph off centre, so text-indent puts
      // the same amount back on the left. Without it a six figure code reads
      // as though it were nudged right, which is the sort of thing somebody
      // notices without being able to say why.
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;">
                    <tr>
                      <td align="center" class="${ink.panel} ${ink.title}" style="background-color:${LIGHT.panel};border-radius:16px;padding:20px 16px;font-family:${FONT_MONO};font-size:26px;line-height:32px;font-weight:700;letter-spacing:0.2em;text-indent:0.2em;color:${LIGHT.text};">${escapeHtml(block.value)}</td>
                    </tr>
                  </table>`;

    case "note":
      return `<p class="${ink.muted}" style="margin:22px 0 0;${TEXT}font-size:13px;line-height:1.6;color:${LIGHT.muted};">${escapeHtml(block.text)}</p>`;
  }
}

/* -------------------------------------------------------------- text parts */

/** Wrap to a readable measure. Long URLs are left whole so they stay clickable. */
function wrap(text: string, width = 72): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\n");
}

const rowLines = (list: readonly ReceiptRow[]) => list.map((row) => `${row.label}: ${row.value}`).join("\n");

function textBlock(block: Block): string {
  switch (block.kind) {
    case "heading":
      // Underlined with dashes rather than shouted in capitals: a screen
      // reader spells out an all-caps word letter by letter.
      return `${block.text}\n${"-".repeat(Math.min(block.text.length, 72))}`;

    case "paragraph":
      return wrap(block.text);

    case "bullets":
      return block.items.map((item) => wrap(`- ${item}`)).join("\n");

    case "rows":
      // "Label: value", one per line. Not column-aligned: alignment padding
      // depends on a monospaced font, and a proportional one turns it into
      // ragged nonsense.
      return rowLines(block.rows);

    case "figure":
      return `${block.label}: ${block.value}${block.caption ? `\n${wrap(block.caption)}` : ""}`;

    case "itemised":
      return `${rowLines(block.lines)}\n${"-".repeat(24)}\n${block.total.label}: ${block.total.value}`;

    case "status":
      return `Status: ${block.label}`;

    case "timeline":
      return block.steps.map((step) => `[${step.done ? "x" : " "}] ${step.label}${step.detail ? ` (${step.detail})` : ""}`).join("\n");

    case "space":
      return [block.title, block.place, block.figure && block.figureLabel ? `${block.figureLabel}: ${block.figure}` : null]
        .filter(Boolean)
        .join("\n");

    case "person":
      return `${block.name}, ${block.role}`;

    case "receipt": {
      const r = block.receipt;
      return [
        r.kind,
        r.title,
        ...(r.place ? [r.place] : []),
        "",
        `${r.figureLabel}: ${r.figure}`,
        "",
        rowLines([...r.facts, ...r.lines]),
        "-".repeat(24),
        `${r.total.label}: ${r.total.value}`,
        ...(r.confirmations.length > 0 || r.reference ? [""] : []),
        ...r.confirmations.map((row) => `${row.label}: ${row.state}`),
        ...(r.reference ? [`${r.reference.label}: ${r.reference.value}`] : []),
        "",
        wrap(r.note),
      ].join("\n");
    }

    case "callout":
      return wrap(block.text);

    case "button":
      return `${block.label}:\n${block.href}`;

    case "code":
      return block.value;

    case "note":
      return wrap(block.text);
  }
}

/* ------------------------------------------------------------------- shell */

export type ComposeOptions = {
  /**
   * Which message this is, which picks the 3D object in the header, its
   * family word, and the register it is drawn in (`icons.ts`). Required, so
   * no new message ships without one being chosen.
   */
  icon: EmailKind;
  /** The inbox preview line. Never rendered in the body. Required. */
  preheader: string;
  /** The message, block by block. Nulls are dropped. */
  blocks: readonly (Block | null | undefined | false)[];
  /** Muted footer lines above the sign-off. Plain text, escaped here. */
  footerLines?: readonly string[];
  /**
   * One linked footer line, under the plain ones.
   *
   * For the messages that a preference can switch off. The settings card
   * promises those can be turned off, so the email that arrives because of one
   * says where that switch is, in the small print, where a reader looks for
   * it. It is NOT an unsubscribe: the outbox sends a List-Unsubscribe header
   * pointing at the same switch (OPS-14), but there is no one-click
   * unsubscribe yet, and saying "unsubscribe" and meaning "change a
   * preference" is the kind of promise a footer should not make.
   *
   * A transactional message that nothing can switch off leaves this unset,
   * because offering a switch that does not exist is worse than offering none.
   */
  footerLink?: { label: string; href: string };
};

export type Composed = {
  /** The inbox line as it is shipped: trimmed and held to PREHEADER_MAX. */
  preheader: string;
  html: string;
  /** The text/plain alternative. Always present, always from the same blocks. */
  text: string;
};

/**
 * THE STYLE BLOCK, SHARED BY EVERY DOCUMENT (the catalogue and the welcome).
 *
 * Nothing the message depends on lives here. The inline layer is the light
 * palette and it is complete on its own (Gmail strips this block); this only
 * tells the clients that honour it what the dark scheme is:
 *
 *   1. `color-scheme: light dark` tells Apple Mail and iOS Mail the message
 *      knows both schemes, so they apply the rules below instead of
 *      inverting it themselves.
 *   2. Under `prefers-color-scheme: dark` every class is repainted from
 *      `SCHEME_DARK_*` (theme.ts): the shell classes to the product's night,
 *      the sheet classes held at paper, so a receipt stays a document on the
 *      dark desk (D28.1). The hairlines inside a shell card turn to the
 *      night's own edge with it, so a white rule never cuts a navy card.
 *      Under `light` the inline palette is re-asserted.
 *   3. OUTLOOK.COM runs its own dark pass and marks each element it repainted
 *      with `data-ogsb` (ground) or `data-ogsc` (ink). The rules keyed on them
 *      put the designed dark back, so its guess never replaces the design.
 *   4. A phone gets tighter card padding.
 *
 * WHAT IT DOES NOT REACH. Gmail strips media queries and, in its iOS app, may
 * invert the whole message. That is answered by the inline palette, whose
 * every ink keeps AA against its ground inverted as well as written.
 */
function paletteRules(grounds: Readonly<Record<string, string>>, inks: Readonly<Record<string, string>>, indent = "        "): string {
  const g = Object.entries(grounds).map(([cls, hex]) => `${indent}.${cls} { background-color: ${hex} !important; }`);
  const i = Object.entries(inks).map(([cls, hex]) => `${indent}.${cls} { color: ${hex} !important; }`);
  return "\n" + [...g, ...i].join("\n");
}

export function schemeStyle(extra = ""): string {
  const ogsb = Object.entries(SCHEME_DARK_GROUND)
    .map(([cls, hex]) => `      .${cls}[data-ogsb] { background-color: ${hex} !important; }`)
    .join("\n");
  const ogsc = Object.entries(SCHEME_DARK_INK)
    .map(([cls, hex]) => `      [data-ogsc] .${cls}, .${cls}[data-ogsc] { color: ${hex} !important; }`)
    .join("\n");
  return `
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      @media (prefers-color-scheme: light) {${paletteRules(SCHEME_LIGHT_GROUND, SCHEME_LIGHT_INK)}
      }
      @media (prefers-color-scheme: dark) {${paletteRules(SCHEME_DARK_GROUND, SCHEME_DARK_INK)}
        .rm-card, .rm-card td, .rm-card table { border-color: ${DARK.edge} !important; }
      }
${ogsb}
${ogsc}
      .rm-card[data-ogsb], .rm-card[data-ogsb] td { border-color: ${DARK.edge} !important; }
      @media only screen and (max-width: 480px) {
        .rm-pad    { padding-left: 22px !important; padding-right: 22px !important; }
        .rm-outer  { padding-left: 8px !important; padding-right: 8px !important; }
        .rm-btn    { width: 100% !important; }
        .rm-btn a  { display: block !important; }
      }${extra}`;
}

/** The document head: charset, viewport, both colour-scheme metas, the style block. */
export function documentHead(title: string, extraStyle = "", headExtra = ""): string {
  return `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(title)}</title>${headExtra}
    <style>${schemeStyle(extraStyle)}
    </style>
  </head>`;
}

/**
 * The padding after the preheader: invisible, zero-width and non-breaking
 * characters, enough of them to fill the rest of any client's preview line.
 * Without it Gmail and iOS Mail pull the first body text in behind the
 * preheader ("Hello Ada. Somebody asked..."), so the lock screen shows the
 * sentence we wrote followed by one we did not choose. Numeric entities only,
 * so the preview test's `&#\d+;` strip removes all of it.
 * `scripts/build-auth-emails.mjs` mirrors this string.
 */
export const PREHEADER_PAD = "&#847;&#8204;&#160;".repeat(60);

/** The hidden inbox line, with spacer entities so a client does not pull body copy in behind it. */
export function preheaderHtml(text: string): string {
  return `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">${escapeHtml(clip(text, PREHEADER_MAX))}${PREHEADER_PAD}</span>`;
}

/**
 * THE HEADER: the wordmark with the slogan quiet beneath it (16.5, D1), then
 * the brand rule.
 *
 * The lockup is one picture carrying its own navy tile (`LOCKUP_PATH`,
 * theme.ts). That is not a dark card on light: it is the rule the north star
 * keeps for any glass mark that survives (14.7), a dark ground of its own so
 * the mark never sits on white, and mail clients do not invert pictures, so
 * it is the same badge in a light client, a dark one and an inverting one.
 * Its alt is the brand name, set in the ink of the header, so with images
 * off the reader sees "Vallo" once, in its place.
 *
 * The slogan is live text, never baked into the image, so it reads with
 * images off and in every scheme.
 */
export function brandBandRow(ink: Ink = SHELL_INK): string {
  return `<tr>
              <td class="${ink.card} rm-pad" style="padding:28px ${PAD_X}px 0;border-radius:19px 19px 0 0;">
                <img src="${siteUrl()}${LOCKUP_PATH}" width="${LOCKUP_WIDTH}" height="${LOCKUP_HEIGHT}" alt="${WORDMARK_ALT}" style="display:block;width:${LOCKUP_WIDTH}px;height:${LOCKUP_HEIGHT}px;border:0;outline:none;text-decoration:none;${TEXT}font-size:22px;line-height:${LOCKUP_HEIGHT}px;font-weight:700;letter-spacing:-0.025em;color:${LIGHT.text};" />
                <p class="${ink.muted}" style="margin:10px 0 0;${TEXT}font-size:13px;line-height:18px;letter-spacing:0.01em;color:${LIGHT.muted};">${escapeHtml(SLOGAN)}</p>
              </td>
            </tr>
            <tr>
              <td class="${ink.card} rm-pad" style="padding:22px ${PAD_X}px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="height:0;line-height:0;font-size:0;border-top:1px solid ${LIGHT.edge};mso-line-height-rule:exactly;">&nbsp;</td></tr></table>
              </td>
            </tr>`;
}

/**
 * THE OBJECT: the message's 3D object above the headline, like
 * an app icon beside a notification (icons.ts). Drawn at 64px from a 128px
 * PNG (webp is not drawn by every client), with width and height set so a
 * blocked image reserves its box, and alt set to the family word in quiet
 * ink so a blocked image still names the family. The object is a cutout with
 * an alpha channel and a matte finish, legible on white and on the night a
 * dark-mode client paints. The cell's zero line height stops Outlook and
 * Gmail adding a text line under it.
 */
export function heroMarkHtml(kind: EmailKind, ink: Ink = SHELL_INK): string {
  const name = emailObjectFor(kind);
  const family = emailFamilyOf(kind);
  if (name === null || family === null) return "";
  const size = EMAIL_OBJECT_SIZE;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                    <tr>
                      <td class="${ink.muted}" style="font-size:0;line-height:0;mso-line-height-rule:exactly;color:${LIGHT.muted};">
                        <img src="${siteUrl()}${emailObjectPath(name)}" width="${size}" height="${size}" alt="${FAMILY[family].alt}" border="0" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;${TEXT}font-size:12px;line-height:16px;color:${LIGHT.muted};" />
                      </td>
                    </tr>
                  </table>`;
}

/**
 * The pages every footer links, by the same names everywhere: where the
 * person changes what Vallo tells them, where they get help, and the two legal
 * pages. The first is the notification settings screen. It is offered on every
 * message, security mail included, under a name that promises only what the
 * screen does ("Notification settings", not "turn this off"): a security
 * notice says on its own that it cannot be switched off.
 */
export const SETTINGS_LINK = { label: "Settings", path: "/settings/notifications" } as const;

/* Short words, one quiet row (29 October 2026: brief and mature). */
export const FOOTER_LINKS: readonly { label: string; path: string }[] = [
  SETTINGS_LINK,
  { label: "Help", path: "/support" },
  { label: "Privacy", path: "/legal/privacy" },
  { label: "Terms", path: "/legal/terms" },
];

/**
 * The footer links in the text part, one "Label: url" per line. When a message
 * supplies its own settings line (`footerLink`, the Bookings and Messages
 * wording) the default settings line is left out so the same address is not
 * printed twice under two names.
 */
export function footerLinksText(options: { skipSettings?: boolean } = {}): string {
  return FOOTER_LINKS.filter((l) => !(options.skipSettings && l.path === SETTINGS_LINK.path))
    .map((l) => `${l.label}: ${appUrl(l.path)}`)
    .join("\n");
}

/**
 * THE SOCIAL LINE (3 November 2026): "Follow us" and our accounts as plain
 * clickable words, in the footer's own link style (no icons, no pictures),
 * read from the one shared list (`socials.ts`). Nothing when none is set.
 */
export function socialRowHtml(): string {
  const socials = configuredSocials();
  if (socials.length === 0) return "";
  const links = socials
    .map(
      (s) =>
        `<a class="rm-link rm-social" href="${escapeHtml(s.url)}" target="_blank" style="color:${LINK};text-decoration:underline;white-space:nowrap;">${escapeHtml(s.label)}</a>`,
    )
    .join(" &nbsp;&middot;&nbsp; ");
  return `<p class="rm-muted" style="margin:0 0 8px;${TEXT}font-size:13px;line-height:20px;color:${LIGHT.muted};">Follow us: ${links}</p>`;
}

/** A banner under the lockup: decoration with a real alt, never a link. */
export function bannerRowHtml(file: BannerFile): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
                  <tr>
                    <td style="font-size:0;line-height:0;mso-line-height-rule:exactly;border-radius:14px;">
                      <img src="${siteUrl()}${bannerFilePath(file)}" width="${BANNER_SHOWN_WIDTH}" height="${BANNER_SHOWN_HEIGHT}" alt="${escapeHtml(BANNER_ALT[file])}" border="0" style="display:block;width:100%;max-width:${BANNER_SHOWN_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:14px;${TEXT}font-size:15px;line-height:20px;color:${LIGHT.muted};" />
                    </td>
                  </tr>
                </table>`;
}

/** The same accounts in the text part, one "Label: url" per line, or nothing. */
export function socialLinksText(): string {
  const socials = configuredSocials();
  return socials.length === 0 ? "" : ["Follow us:", ...socials.map((s) => `${s.label}: ${s.url}`)].join("\n");
}

/**
 * THE FOOTER (the redesign of 13 October 2026): why this arrived, then ONE
 * row of links (notification settings, help, privacy, terms), then who sent
 * it: the sign-off and the company's full legal line with its registered
 * address. It sits on the ground outside the card, so it reads as small print
 * by position as well as size, and it takes the shell classes in both
 * registers because the ground is the shell's: a dark-mode client turns it to
 * night under any card.
 */
export function footerRows(lines: readonly string[], link?: { label: string; href: string }): string {
  const p = (inner: string, margin = "0 0 8px") =>
    `<p class="rm-muted" style="margin:${margin};${TEXT}font-size:13px;line-height:20px;color:${LIGHT.muted};">${inner}</p>`;
  const a = (label: string, href: string) =>
    `<a class="rm-link" href="${escapeHtml(href)}" target="_blank" style="color:${LINK};text-decoration:underline;white-space:nowrap;">${escapeHtml(label)}</a>`;
  const reason = lines.map((line) => p(escapeHtml(line))).join("\n                ");
  const settings = link ? a(link.label, link.href) : a(SETTINGS_LINK.label, appUrl(SETTINGS_LINK.path));
  const rest = FOOTER_LINKS.filter((l) => l.path !== SETTINGS_LINK.path).map((l) => a(l.label, appUrl(l.path)));
  const links = [settings, ...rest].join(" &nbsp;&middot;&nbsp; ");
  return `<tr>
              <td class="rm-pad" style="padding:26px ${PAD_X}px 0;">
                ${reason}
                ${socialRowHtml()}
                ${p(links, "6px 0 18px")}
                <p class="rm-title" style="margin:0;${TEXT}font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.02em;color:${LIGHT.text};">${SIGN_OFF}</p>
                <p class="rm-muted" style="margin:4px 0 0;${TEXT}font-size:12px;line-height:18px;color:${LIGHT.muted};">${LEGAL_LINE}</p>
              </td>
            </tr>`;
}

/**
 * The whole document around a card's contents: ground, card (header inside),
 * footer. `cardClass` lets a document add its own phone rules to the card
 * cell; `register` picks the classes that decide what a dark-mode client
 * does with the card (paper stays paper; the shell turns to night).
 *
 * White ground, white card, one hairline edge (16.5: "no grey wash, no dark
 * card on light"). Classic Outlook drops the radius and draws a square card,
 * which is the same design with corners.
 */
/** The namespaces and the pixel density Outlook's Word engine needs to draw the VML button. */
export const OFFICE_HTML_ATTRS =
  ' xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
export const OFFICE_HEAD =
  "\n    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->";

export function documentHtml(options: {
  title: string;
  preheader: string;
  card: string;
  footer: string;
  extraStyle?: string;
  headExtra?: string;
  htmlAttrs?: string;
  cardClass?: string;
  register?: EmailRegister;
}): string {
  const ink = inkFor(options.register ?? "shell");
  return `<!doctype html>
<html lang="en"${options.htmlAttrs ?? OFFICE_HTML_ATTRS} style="color-scheme:light dark;background-color:${LIGHT.ground};">
  ${documentHead(options.title, options.extraStyle, options.headExtra ?? OFFICE_HEAD)}
  <body class="rm-base" bgcolor="${LIGHT.ground}" style="margin:0;padding:0;width:100%;background-color:${LIGHT.ground};color:${LIGHT.body};${TEXT}-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
    ${preheaderHtml(options.preheader)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rm-base" bgcolor="${LIGHT.ground}" style="width:100%;background-color:${LIGHT.ground};">
      <tr>
        <td align="center" class="rm-outer" style="padding:28px 12px 44px;">
          <!-- Outlook's Word engine ignores max-width, so it gets a fixed table. -->
          <!--[if mso]><table role="presentation" width="${MAX_WIDTH}" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${MAX_WIDTH}px;width:100%;">
            <tr>
              <td class="${ink.card}" bgcolor="${LIGHT.card}" style="background-color:${LIGHT.card};border:1px solid ${LIGHT.edge};border-radius:20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-radius:19px;">
                  ${brandBandRow(ink)}
                  <tr>
                    <td class="${ink.card} rm-pad${options.cardClass ? " " + options.cardClass : ""}" bgcolor="${LIGHT.card}" style="background-color:${LIGHT.card};border-radius:0 0 19px 19px;padding:30px ${PAD_X}px 36px;">
                      ${options.card}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${options.footer}
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/**
 * Render one message, twice.
 *
 * The HTML is a table layout with fully inline styles, no external stylesheet
 * and no web fonts, because that is what survives Outlook, Gmail's clipping
 * and every webmail in between. The text is the same blocks in the same order.
 */
export function compose(options: ComposeOptions): Composed {
  const blocks = usable(options.blocks);
  const footerLines = options.footerLines ?? [];
  const register = emailRegisterOf(options.icon);
  const ink = inkFor(register);

  const mark = EMAIL_SHOWS_OBJECT
    ? heroMarkHtml(options.icon, ink)
    : register === "shell"
      ? bannerRowHtml(bannerFor(options.icon))
      : "";
  const body = (mark ? mark + "\n                " : "") + blocks.map((block) => htmlBlock(block, ink)).join("\n                ");

  const html = documentHtml({
    title: "Vallo",
    preheader: options.preheader,
    card: body,
    footer: footerRows(footerLines, options.footerLink),
    register,
  });

  /*
   * The text part.
   *
   * The preheader is NOT repeated at the top: in HTML it is a hidden preview
   * line, and in text there is nothing to preview because the reader is
   * already looking at the whole message. Repeating it would print the same
   * sentence twice.
   */
  const text =
    [
      "Vallo",
      SLOGAN,
      "",
      blocks.map(textBlock).join("\n\n"),
      "",
      ...(footerLines.length > 0 ? [footerLines.map((l) => wrap(l)).join("\n"), ""] : []),
      // The same line in text, as "Label: url", because a bare label with no
      // address is a link a text reader cannot follow.
      ...(options.footerLink
        ? [`${options.footerLink.label}: ${options.footerLink.href}`, ""]
        : []),
      ...(socialLinksText() ? [socialLinksText(), ""] : []),
      footerLinksText({ skipSettings: options.footerLink !== undefined }),
      "",
      SIGN_OFF,
      LEGAL_LINE,
      siteUrl(),
    ].join("\n") + "\n";

  return { preheader: clip(options.preheader, PREHEADER_MAX), html: paintExplicit(html), text };
}
