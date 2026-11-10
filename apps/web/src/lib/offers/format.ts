import { plural } from "@vallo/i18n/core";
import { formatMoney } from "@vallo/i18n/core";

/**
 * MONEY, PERCENTAGES AND TIMES FOR THE OFFER SCREENS. Pure functions, no
 * server imports, so a client component and a unit test can use them.
 *
 * Every figure is integer kobo (minor units) and prints through `formatMoney`.
 * Times print in Lagos time with a fixed locale so the server and the browser
 * agree and a page never hydrates with a different word.
 */

export const NAIRA = "₦";

/** The largest offer the screens will send, in naira. The server is the authority. */
export const MAX_OFFER_NAIRA = 100_000_000_000;

/** The full figure, "₦85,000,000". Kobo only when the figure has them. */
export function nairaFull(minor: number): string {
  const whole = Number.isInteger(minor / 100);
  return formatMoney(minor, "en", "NGN", {}).replace(/\.00$/, whole ? "" : ".00");
}

/** The short figure for a dense cell, "₦85m". */
export function nairaShort(minor: number): string {
  return formatMoney(minor, "en", "NGN", { compact: true });
}

export type Direction = "above" | "below" | "at";

export type Difference = {
  /** Offer minus asking, in kobo. Signed. */
  minor: number;
  /** Absolute kobo. */
  absMinor: number;
  /** Percentage of the asking price, one decimal, signed. */
  pct: number;
  direction: Direction;
  /** "Above asking", "Below asking" or "At asking". Never colour alone. */
  word: string;
};

const DIRECTION_WORD: Record<Direction, string> = {
  above: "Above asking",
  below: "Below asking",
  at: "At asking",
};

/** How an offer sits against the asking price: an amount, a percentage and a word. */
export function differenceOf(offerMinor: number, askingMinor: number): Difference {
  const minor = offerMinor - askingMinor;
  const direction: Direction = minor > 0 ? "above" : minor < 0 ? "below" : "at";
  const pct = askingMinor > 0 ? Math.round((minor / askingMinor) * 1000) / 10 : 0;
  return { minor, absMinor: Math.abs(minor), pct, direction, word: DIRECTION_WORD[direction] };
}

/** "2.4%" (no sign: the word carries the direction). */
export function formatPct(pct: number): string {
  const abs = Math.abs(pct);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${text}%`;
}

/** "Below asking by ₦3,000,000 (3.5%)" or "At asking". */
export function describeDifference(diff: Difference): string {
  if (diff.direction === "at") return diff.word;
  return `${diff.word} by ${nairaFull(diff.absMinor)} (${formatPct(diff.pct)})`;
}

export type ParsedAmount =
  | { ok: true; minor: number; atAsking: boolean }
  | { ok: false; reason: "bad_amount" | "amount_too_large" };

/**
 * What the buyer typed, resolved. Blank means the asking price and the resolved
 * figure is returned so the screen can show it. Nothing here is ever zero or
 * null: a figure that is not a positive whole-naira (or kobo) amount is refused.
 */
export function resolveAmount(typed: string | null | undefined, askingMinor: number): ParsedAmount {
  const raw = (typed ?? "").replace(/[,\s₦]/g, "");
  if (raw === "") {
    return askingMinor > 0 ? { ok: true, minor: askingMinor, atAsking: true } : { ok: false, reason: "bad_amount" };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, reason: "bad_amount" };
  const naira = Number(raw);
  if (!Number.isFinite(naira) || naira <= 0) return { ok: false, reason: "bad_amount" };
  if (naira > MAX_OFFER_NAIRA) return { ok: false, reason: "amount_too_large" };
  const minor = Math.round(naira * 100);
  return { ok: true, minor, atAsking: minor === askingMinor };
}

/* ------------------------------------------------------------------ times */

const ZONE = "Africa/Lagos";
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE });
const DAY_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: ZONE });
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONE });

/** "12 Nov 2026". */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DAY.format(d);
}

/** "12 Nov, 14:05". */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${DAY_SHORT.format(d)}, ${CLOCK.format(d)}`;
}

/** How long something has been waiting, in plain words. */
export function waitingFor(sinceIso: string, nowMs: number): string {
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) return "";
  const minutes = Math.max(0, Math.floor((nowMs - since) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return plural(hours, { one: "{count} hour", other: "{count} hours" });
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

/** The deadline line. Only ever from real data: no `expiresAt`, no deadline is stated. */
export function deadlineLine(expiresAt: string | null, nowMs: number): string {
  if (!expiresAt) return "No deadline has been set on this offer.";
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return "No deadline has been set on this offer.";
  return at <= nowMs ? `This offer expired on ${formatDay(expiresAt)}.` : `This offer expires on ${formatDay(expiresAt)}.`;
}

/** The proposed closing date, always labelled proposed. */
export function proposedDate(iso: string | null | undefined): string {
  if (!iso) return "No date proposed";
  const day = formatDay(iso);
  return day ? `Proposed ${day}` : "No date proposed";
}
