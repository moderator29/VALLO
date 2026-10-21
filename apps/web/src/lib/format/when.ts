import { countOf, intlTag, LAGOS_TIME_ZONE, DEFAULT_LOCALE, type Locale } from "@vallo/i18n/core";

/**
 * WHEN, SAID ONE WAY (details pass, 30 September 2026).
 *
 * Six components had their own `ago()`: "synced 12 min ago" on the calendar,
 * "12m ago" in two admin desks, "just now" under an hour on the agent and host
 * boards (so a message from 55 minutes ago was "just now"), and eleven more
 * called `toLocaleString` with four different option sets, so one console
 * printed "30/09/2026, 14:05:11", "30 Sept 2026, 2:05 pm" and "Sep 30" on
 * three neighbouring pages. These are the one set of words for a time, on
 * Lagos time from the server and from every phone:
 *
 *   dayLabel      "Today", "Tomorrow", "Yesterday", "Mon 6 Oct", "6 Oct 2025"
 *   timeLabel     "14:05"
 *   dateTimeLabel "Today, 14:05", "Mon 6 Oct, 14:05"
 *   ago           "just now", "12 min ago", "3 h ago", "2 days ago", then the day
 *   agoShort      "just now", "12m ago", "3h ago", "2d ago", then "6 Oct" (tables)
 *
 * The day words come from `Intl.RelativeTimeFormat` for the page's locale
 * (en-NG for every locale, `intlTag` says why), so they need no dictionary.
 * Everything takes `now` so a server render and its tests are pinned.
 */

type When = Date | string | number | null | undefined;

function toDate(value: When): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS_TIME_ZONE });

/** The Lagos calendar day of an instant, as a whole number of days. */
function lagosDay(date: Date): number {
  const [y, m, d] = DAY_KEY.format(date).split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let built = cache.get(key);
  if (!built) {
    built = new Intl.DateTimeFormat(intlTag[locale], { timeZone: LAGOS_TIME_ZONE, ...options });
    cache.set(key, built);
  }
  return built;
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function relativeDay(offset: number, locale: Locale): string {
  return capitalise(
    new Intl.RelativeTimeFormat(intlTag[locale], { numeric: "auto" }).format(offset, "day"),
  );
}

/** "Mon 6 Oct" this year, "6 Oct 2025" otherwise. Never "Today". */
export function dateLabel(value: When, options: { now?: Date; locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  const locale = options.locale ?? DEFAULT_LOCALE;
  const now = options.now ?? new Date();
  const sameYear = fmt(locale, { year: "numeric" }).format(date) === fmt(locale, { year: "numeric" }).format(now);
  return (sameYear
    ? fmt(locale, { weekday: "short", day: "numeric", month: "short" })
    : fmt(locale, { day: "numeric", month: "short", year: "numeric" })
  )
    .format(date)
    .replace(/,/g, "")
    /* en-NG writes September "Sept"; every other month is three letters. */
    .replace(/\bSept\b/, "Sep");
}

/** "Today", "Tomorrow", "Yesterday", else `dateLabel`. */
export function dayLabel(value: When, options: { now?: Date; locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  const locale = options.locale ?? DEFAULT_LOCALE;
  const offset = lagosDay(date) - lagosDay(options.now ?? new Date());
  if (offset >= -1 && offset <= 1) return relativeDay(offset, locale);
  return dateLabel(date, options);
}

/** "14:05", the 24-hour clock Nigerian schedules are written in. */
export function timeLabel(value: When, options: { locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  return fmt(options.locale ?? DEFAULT_LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** "Today, 14:05" or "Mon 6 Oct, 14:05". */
export function dateTimeLabel(value: When, options: { now?: Date; locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  return `${dayLabel(date, options)}, ${timeLabel(date, options)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, in words: "just now", "12 min ago", "3 h ago", "2 days ago",
 * and past a week the day itself. A time in the future reads "in 12 min",
 * "in 3 h", "in 2 days". Lower case, so it can follow "Updated" or "Synced".
 */
export function ago(value: When, options: { now?: Date | number; locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
  const diff = now - date.getTime();
  const span = Math.abs(diff);
  const future = diff < 0;
  const say = (text: string) => (future ? `in ${text}` : `${text} ago`);
  if (span < MINUTE) return "just now";
  if (span < HOUR) return say(`${Math.floor(span / MINUTE)} min`);
  if (span < DAY) return say(`${Math.floor(span / HOUR)} h`);
  const days = Math.floor(span / DAY);
  if (days < 7) return say(countOf(days, "days", options.locale ?? DEFAULT_LOCALE));
  return dateLabel(date, { now: new Date(now), ...(options.locale ? { locale: options.locale } : {}) });
}

/**
 * The dense form the console's tables use: "just now", "12m ago", "3h ago",
 * "2d ago", then the date ("1 Sep"). A future stamp reads "just now" rather
 * than a negative age.
 */
export function agoShort(value: When, options: { now?: Date | number; locale?: Locale } = {}): string {
  const date = toDate(value);
  if (!date) return "";
  const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
  const span = Math.max(0, now - date.getTime());
  if (span < MINUTE) return "just now";
  if (span < HOUR) return `${Math.floor(span / MINUTE)}m ago`;
  if (span < DAY) return `${Math.floor(span / HOUR)}h ago`;
  const days = Math.floor(span / DAY);
  if (days < 7) return `${days}d ago`;
  return fmt(options.locale ?? DEFAULT_LOCALE, { day: "numeric", month: "short" })
    .format(date)
    .replace(/\bSept\b/, "Sep");
}

/**
 * The request's clock, read outside a component body. A server component is
 * rendered once per request, so "now" is the request's moment; reading it
 * through a named function keeps the render itself pure in the linter's eyes,
 * and handing the one value down keeps the page agreeing with itself. The one
 * definition: every page and server component imports it from here.
 */
export function requestNow(): number {
  return Date.now();
}
