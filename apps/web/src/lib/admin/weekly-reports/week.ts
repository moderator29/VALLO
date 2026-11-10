/**
 * THE WEEK OF A WEEKLY REPORT, ON LAGOS TIME. Pure and client safe.
 *
 * A week runs Monday 00:00 to the next Monday 00:00 in Africa/Lagos, named by
 * its Monday as a plain date (`week_start`). Lagos is a fixed UTC+1 all year
 * (West Africa Time has no daylight saving), so the arithmetic below is done
 * with that offset on epoch milliseconds, not with a time zone library: no
 * "local midnight" can fall in a skipped or repeated hour, and the edges of
 * the week behave the same on a server in any zone.
 *
 * The form OPENS on Saturday 00:00 of the week it reports, and is DUE on the
 * Monday after the week at 12:00. Filing later is allowed and flagged late.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Lagos wall clock minus UTC. */
const LAGOS_OFFSET = HOUR;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date as epoch ms at UTC midnight of that date. Null when it is not a real date. */
function dateMs(value: string): number | null {
  const m = DATE.exec(value);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const back = new Date(ms).toISOString().slice(0, 10);
  return back === value ? ms : null;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The instant a Lagos wall-clock time falls on: `day` is UTC midnight of the Lagos date. */
function instant(day: number, hours: number): number {
  return day + hours * HOUR - LAGOS_OFFSET;
}

/** UTC midnight of the Lagos calendar date, and the weekday (0 Monday .. 6 Sunday), for an instant. */
function lagosDay(nowMs: number): { day: number; weekday: number } {
  const wall = new Date(nowMs + LAGOS_OFFSET);
  const day = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  return { day, weekday: (wall.getUTCDay() + 6) % 7 };
}

/** True for a real calendar date that falls on a Monday: the only valid `week_start`. */
export function isWeekStart(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ms = dateMs(value);
  return ms !== null && new Date(ms).getUTCDay() === 1;
}

export function addDays(date: string, days: number): string {
  const ms = dateMs(date);
  if (ms === null) throw new Error("addDays: not a date");
  return isoDate(ms + days * DAY);
}

export type WeekInfo = {
  /** The Monday, as a date. */
  weekStart: string;
  /** The Sunday, as a date. */
  weekEnd: string;
  /** Monday 00:00 Lagos, as an ISO instant. */
  startsAt: string;
  /** The next Monday 00:00 Lagos: the first instant that is not in the week. */
  endsAt: string;
  /** Saturday 00:00 Lagos: the form opens. */
  opensAt: string;
  /** The Monday after the week, 12:00 Lagos: the report is due. */
  dueAt: string;
};

/** Everything about one week, from its Monday. Throws on anything but a Monday date. */
export function weekInfo(weekStart: string): WeekInfo {
  if (!isWeekStart(weekStart)) throw new Error("weekInfo: week_start must be a Monday date");
  const monday = dateMs(weekStart)!;
  return {
    weekStart,
    weekEnd: isoDate(monday + 6 * DAY),
    startsAt: new Date(instant(monday, 0)).toISOString(),
    endsAt: new Date(instant(monday + 7 * DAY, 0)).toISOString(),
    opensAt: new Date(instant(monday + 5 * DAY, 0)).toISOString(),
    dueAt: new Date(instant(monday + 7 * DAY, 12)).toISOString(),
  };
}

export type WeekWindow = WeekInfo & {
  /** `open` up to the due time, `overdue` after it: the week this window reports on. */
  phase: "open" | "overdue";
  /** The week after this one, the next to open. */
  nextWeekStart: string;
  /** When that next week's form opens. */
  nextOpensAt: string;
  /** The Monday of the Lagos calendar week that holds `now`. */
  calendarWeekStart: string;
};

/**
 * The week a person should be reporting on right now: the latest week whose
 * form has opened. From Saturday 00:00 Lagos that is the week in progress;
 * from the following Monday 00:00 until the next Saturday it is the week that
 * just ended (open until Monday 12:00, overdue after).
 */
export function weekWindow(now: Date = new Date()): WeekWindow {
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new Error("weekWindow: invalid date");
  const { day, weekday } = lagosDay(nowMs);
  const calendar = day - weekday * DAY;
  const calendarOpens = instant(calendar + 5 * DAY, 0);
  const focus = nowMs >= calendarOpens ? calendar : calendar - 7 * DAY;
  const info = weekInfo(isoDate(focus));
  const next = focus + 7 * DAY;
  return {
    ...info,
    phase: nowMs <= new Date(info.dueAt).getTime() ? "open" : "overdue",
    nextWeekStart: isoDate(next),
    nextOpensAt: new Date(instant(next + 5 * DAY, 0)).toISOString(),
    calendarWeekStart: isoDate(calendar),
  };
}

/** Has the form for this week opened yet? */
export function formIsOpen(weekStart: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(weekInfo(weekStart).opensAt).getTime();
}

/** Filing at this instant is after the due time. */
export function isLateAt(weekStart: string, at: Date): boolean {
  return at.getTime() > new Date(weekInfo(weekStart).dueAt).getTime();
}

/** True when an instant falls inside the week (Monday 00:00 to the next Monday 00:00, Lagos). */
export function inWeek(weekStart: string, iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const w = weekInfo(weekStart);
  return t >= new Date(w.startsAt).getTime() && t < new Date(w.endsAt).getTime();
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 9 Nov 2026" for a calendar date. Built by hand so every runtime prints the same. */
export function dateLabel(date: string): string {
  const ms = dateMs(date);
  if (ms === null) return date;
  const d = new Date(ms);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "9 Nov to 15 Nov 2026" for a week. */
export function weekLabel(weekStart: string): string {
  const w = weekInfo(weekStart);
  const a = dateMs(w.weekStart)!;
  const b = dateMs(w.weekEnd)!;
  const first = new Date(a);
  const last = new Date(b);
  const left = `${first.getUTCDate()} ${MONTH_NAMES[first.getUTCMonth()]}`;
  const right = `${last.getUTCDate()} ${MONTH_NAMES[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  return `${left} to ${right}`;
}
