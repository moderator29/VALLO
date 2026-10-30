/**
 * The hours an agent says they are usually reachable. Pure and client-safe.
 *
 * A schedule is one entry per weekday: `{ open: "09:00", close: "18:00" }` or
 * null for a day off. It is a statement of habit, not a promise: the card says
 * "Usually available" and nothing here switches a conversation on or off.
 */

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export type DayHours = { open: string; close: string };
export type Schedule = Partial<Record<Weekday, DayHours | null>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

/** Read whatever the database holds into a schedule; a bad day is a day off. */
export function readSchedule(raw: unknown): Schedule {
  if (!raw || typeof raw !== "object") return {};
  const out: Schedule = {};
  for (const day of WEEKDAYS) {
    const v = (raw as Record<string, unknown>)[day];
    if (v && typeof v === "object") {
      const { open, close } = v as Record<string, unknown>;
      if (isTime(open) && isTime(close) && open < close) out[day] = { open, close };
    }
  }
  return out;
}

/** "9:00" for "09:00", so the line reads as a person would say it. */
function clock(t: string): string {
  return `${Number(t.slice(0, 2))}:${t.slice(3)}`;
}

/**
 * One calm line for the card: "Mon to Fri, 9:00 to 18:00. Sat, 10:00 to 14:00."
 * Consecutive days with the same hours are one run. Null when no day is set.
 */
export function hoursLine(schedule: Schedule): string | null {
  const runs: { from: Weekday; to: Weekday; hours: DayHours }[] = [];
  for (const day of WEEKDAYS) {
    const hours = schedule[day];
    if (!hours) continue;
    const last = runs[runs.length - 1];
    const prev = last ? WEEKDAYS.indexOf(last.to) : -2;
    if (last && prev === WEEKDAYS.indexOf(day) - 1 && last.hours.open === hours.open && last.hours.close === hours.close) {
      last.to = day;
    } else {
      runs.push({ from: day, to: day, hours });
    }
  }
  if (runs.length === 0) return null;
  return runs
    .map((r) => {
      const days = r.from === r.to ? WEEKDAY_SHORT[r.from] : `${WEEKDAY_SHORT[r.from]} to ${WEEKDAY_SHORT[r.to]}`;
      return `${days}, ${clock(r.hours.open)} to ${clock(r.hours.close)}.`;
    })
    .join(" ");
}
