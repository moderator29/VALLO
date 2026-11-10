import { z } from "zod";

/**
 * THE AGE RULE, IN ONE PLACE: nobody under 18 is on Vallo.
 *
 * Any screen that ever asks a date of birth (sign-up, profile, verification,
 * roommates) takes its bounds from here, and any server action that receives
 * one checks it with `adultBirthDateSchema`. Dates are calendar days in
 * Nigeria's time zone, because "today" for the person typing is not UTC's.
 *
 * Existing records are never rewritten by this rule: it only decides what a
 * new entry may be.
 */
export const MINIMUM_AGE = 18;
const ZONE = "Africa/Lagos";
const OLDEST_PLAUSIBLE_AGE = 110;

export type CalendarDay = { year: number; month: number; day: number };

/** Today's calendar day in Lagos. */
export function lagosToday(now: Date = new Date()): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso({ year, month, day }: CalendarDay): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The latest birth date that makes a person at least 18 today (29 Feb clamps to 28 Feb). */
export function latestAdultBirthDay(now: Date = new Date()): CalendarDay {
  const today = lagosToday(now);
  const year = today.year - MINIMUM_AGE;
  return { year, month: today.month, day: Math.min(today.day, daysInMonth(year, today.month)) };
}

/** The same, as `YYYY-MM-DD`: the `max` of a date input. */
export function latestAdultBirthDate(now: Date = new Date()): string {
  return iso(latestAdultBirthDay(now));
}

/** The earliest date a form accepts, so a typo of 1900 is refused. */
export function earliestBirthDate(now: Date = new Date()): string {
  const today = lagosToday(now);
  return iso({ year: today.year - OLDEST_PLAUSIBLE_AGE, month: 1, day: 1 });
}

/**
 * The years a year picker offers, newest first, starting at the latest year
 * that can still hold an adult birth date and running back `span` years. The
 * day and month are still checked against `isAdultBirthDate`: the newest year
 * holds adults only up to today's date.
 */
export function birthYearOptions(now: Date = new Date(), span = 100): number[] {
  const newest = latestAdultBirthDay(now).year;
  return Array.from({ length: span + 1 }, (_, i) => newest - i);
}

export function parseBirthDate(value: unknown): CalendarDay | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** A real date, not in the future, that makes the person at least 18, and not absurdly old. */
export function isAdultBirthDate(value: unknown, now: Date = new Date()): boolean {
  const day = parseBirthDate(value);
  if (!day) return false;
  const text = iso(day);
  return text <= latestAdultBirthDate(now) && text >= earliestBirthDate(now);
}

export const UNDER_AGE_MESSAGE = "You must be 18 or older to use Vallo.";
export const BAD_BIRTH_DATE_MESSAGE = "Enter a real date of birth.";

/** The zod rule every date of birth a server action accepts goes through. */
export const adultBirthDateSchema = z
  .string({ message: BAD_BIRTH_DATE_MESSAGE })
  .trim()
  .superRefine((value, ctx) => {
    if (!parseBirthDate(value)) {
      ctx.addIssue({ code: "custom", message: BAD_BIRTH_DATE_MESSAGE });
      return;
    }
    if (value > latestAdultBirthDate()) ctx.addIssue({ code: "custom", message: UNDER_AGE_MESSAGE });
    else if (value < earliestBirthDate()) ctx.addIssue({ code: "custom", message: BAD_BIRTH_DATE_MESSAGE });
  });

/** True only for a real date that is later than the latest adult birth date (a future date counts). */
export function isUnderMinimumAge(value: unknown, now: Date = new Date()): boolean {
  const day = parseBirthDate(value);
  return day !== null && iso(day) > latestAdultBirthDate(now);
}
