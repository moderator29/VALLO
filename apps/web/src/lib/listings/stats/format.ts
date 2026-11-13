import { formatNumber, rulesFor, type Locale } from "@vallo/i18n/core";
import { listingStatsEn, type ListingStatsWords } from "@vallo/i18n/en/listing-stats";
import { lagosDaysBetween } from "@/lib/listings/listed-age";

/**
 * LISTING STATS, THE PURE HALF (founder, 13 November 2026).
 *
 * Which of the three figures a listing shows, and how each is written. Client
 * and server safe: the listing page draws the row on the server, the lister's
 * workspace draws the same items in the browser.
 *
 * THE HONESTY RULES, decided here and nowhere else:
 *
 *   - An example listing (`is_demo`) shows nothing at all. It is not a place
 *     anybody can rent, so "3 days on Vallo" would be a sentence about the
 *     world that is false, and its views are never counted.
 *   - The time on Vallo comes from `published_at`, which the review desk writes
 *     once, the first time a listing goes live (`lib/listings/listed-age.ts`),
 *     so a listing sent back and republished keeps its age. "Listed today" on
 *     day 0, days to 60, then months, then years from 24 months. Counted in
 *     Lagos days; a missing or future date shows no age.
 *   - Views show from the first one. Zero views is not shown: counting began
 *     after many listings went live (members from 28 September 2026, everyone
 *     from the listing stats migration), so "0 views" on an older listing
 *     would state something the platform does not know.
 *   - Saves show at zero too: every save a listing has ever held is in
 *     `saved_items`, so 0 is a true statement.
 *   - Compact numbers never round up: 1,999 is "1.9k", not "2k".
 */

export type StatsFigures = { views: number; saves: number };

export type StatKey = "days" | "views" | "saves";

/** One item of the row: the words drawn, and the full sentence for a screen reader. */
export type StatItem = { key: StatKey; text: string; full: string };

type Forms = { readonly one?: string; readonly other: string };

const MONTH_DAYS = 30.4375;

/** Where the row stops counting days. */
export const DAYS_UNTIL_MONTHS = 60;
/** Where months become years. */
export const MONTHS_UNTIL_YEARS = 24;

/** A whole count as people read it at a glance: 999, 1.2k, 12.3k, 123k, 1.2m. Never rounded up. */
export function compactCount(value: number, locale: Locale = "en"): string {
  const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (n < 1000) return formatNumber(n, locale);
  const [unit, suffix] = n < 1_000_000 ? [1000, "k"] : [1_000_000, "m"];
  const scaled = n / unit;
  /* One decimal under a hundred of the unit, none above; truncated, so the
     figure never claims more than happened. */
  const shown = scaled < 100 ? Math.floor(scaled * 10) / 10 : Math.floor(scaled);
  return `${formatNumber(shown, locale, { maximumFractionDigits: 1 })}${suffix}`;
}

function counted(n: number, forms: Forms, text: string, locale: Locale): string {
  const category = rulesFor(locale).select(n);
  const template = (category === "one" ? forms.one : undefined) ?? forms.other;
  return template.replace(/\{count\}/g, text);
}

/** Whole Lagos days since the listing first went live, or null when there is no honest answer. */
export function daysLive(publishedAt: string | null | undefined, now: Date): number | null {
  if (!publishedAt) return null;
  const at = new Date(publishedAt);
  if (Number.isNaN(at.getTime())) return null;
  /* A clock that disagrees with ours is not a listing from tomorrow. */
  if (at.getTime() - now.getTime() > 5 * 60 * 1000) return null;
  return lagosDaysBetween(at, now);
}

/** "Listed today", "12 days on Vallo", "3 months on Vallo", "2 years on Vallo". */
export function timeOnVallo(days: number, locale: Locale = "en", words: ListingStatsWords = listingStatsEn): string {
  if (days <= 0) return words.listedToday;
  if (days <= DAYS_UNTIL_MONTHS) return counted(days, words.days, formatNumber(days, locale), locale);
  const months = Math.floor(days / MONTH_DAYS);
  if (months < MONTHS_UNTIL_YEARS) return counted(months, words.months, formatNumber(months, locale), locale);
  const years = Math.floor(months / 12);
  return counted(years, words.years, formatNumber(years, locale), locale);
}

/** "340 views" with the compact figure, and the full sentence beside it. */
export function countPhrase(n: number, forms: Forms, locale: Locale = "en"): { text: string; full: string } {
  const whole = Math.max(0, Math.floor(n));
  return {
    text: counted(whole, forms, compactCount(whole, locale), locale),
    full: counted(whole, forms, formatNumber(whole, locale), locale),
  };
}

/**
 * The row's items in order (time on Vallo, views, saves), or null when the
 * row must not be drawn: an example, or figures that could not be read (the
 * pending SQL not applied, a read that failed). Fail closed: no figures, no
 * row, not even the age.
 */
export function listingStatItems({
  isDemo,
  publishedAt,
  figures,
  now,
  locale = "en",
  words = listingStatsEn,
}: {
  isDemo: boolean;
  publishedAt: string | null | undefined;
  figures: StatsFigures | null;
  now: Date;
  locale?: Locale;
  words?: ListingStatsWords;
}): StatItem[] | null {
  if (isDemo || !figures) return null;
  const items: StatItem[] = [];
  const days = daysLive(publishedAt, now);
  if (days !== null) {
    const text = timeOnVallo(days, locale, words);
    items.push({ key: "days", text, full: text });
  }
  if (figures.views >= 1) items.push({ key: "views", ...countPhrase(figures.views, words.views, locale) });
  items.push({ key: "saves", ...countPhrase(figures.saves, words.saves, locale) });
  return items;
}

/** The lister's own row: days live, views (or "No views yet"), saves. */
export function agentStatItems({
  publishedAt,
  figures,
  now,
  locale = "en",
  words = listingStatsEn,
}: {
  publishedAt: string | null | undefined;
  figures: StatsFigures | null;
  now: Date;
  locale?: Locale;
  words?: ListingStatsWords;
}): StatItem[] | null {
  if (!figures) return null;
  const items: StatItem[] = [];
  const days = daysLive(publishedAt, now);
  if (days !== null) {
    const text = days === 0 ? words.agentLiveToday : counted(days, words.agentLive, formatNumber(days, locale), locale);
    items.push({ key: "days", text, full: text });
  }
  items.push(
    figures.views >= 1
      ? { key: "views", ...countPhrase(figures.views, words.views, locale) }
      : { key: "views", text: words.agentNoViews, full: words.agentNoViews },
  );
  items.push({ key: "saves", ...countPhrase(figures.saves, words.saves, locale) });
  return items;
}

/** A share of views, as a percentage to one decimal, or null when there were no views to divide by. */
export function conversionPercent(part: number, views: number): number | null {
  if (!(views > 0)) return null;
  return Math.round((Math.max(0, part) / views) * 1000) / 10;
}
