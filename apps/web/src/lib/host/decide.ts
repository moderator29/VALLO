/**
 * THE DECIDE-BY LIST, AS PURE DATA (C3, 30 September 2026).
 *
 * Every request a host still has to answer, with the moment it stops being
 * answerable, sorted by the time left. Two kinds today, each with its own
 * honest deadline:
 *
 *   room request   lapses HOLD_WINDOW_HOURS (48) after it was made, when
 *                  `expire_booking_holds` cancels it and gives the nights back.
 *   table request  is moot at the table's own time: the board files an
 *                  unanswered table under "past" once its moment has gone.
 *
 * THE CLOCK SPEAKS THE SUPPORT DESK'S LANGUAGE (docs/SUPPORT_STAFF.md, "The
 * promise and the clock"): blue with time to spare, cyan (the platform's
 * "pending") in the last quarter of the window, red in the last hour, and "Lapsed" once it has gone. The
 * colour is never the only signal: every chip says the time left in words.
 */

import { HOLD_WINDOW_HOURS } from "../agent/bookings-model";

export type Urgency = "spare" | "soon" | "late" | "lapsed";

export type Clock = {
  msLeft: number;
  /** How much of the window is left, 0 to 1. */
  left: number;
  urgency: Urgency;
  /** "18 h 20 min left", "45 min left", "Lapsed". */
  label: string;
};

const HOUR = 3_600_000;
const MINUTE = 60_000;

export function clockFor(openedAt: string, deadline: string, now: number): Clock {
  const start = Date.parse(openedAt);
  const end = Date.parse(deadline);
  const msLeft = end - now;
  const span = Math.max(end - start, MINUTE);
  const left = Math.min(Math.max(msLeft / span, 0), 1);
  let urgency: Urgency = "spare";
  if (msLeft <= 0) urgency = "lapsed";
  else if (msLeft <= HOUR) urgency = "late";
  else if (left <= 0.25) urgency = "soon";
  return { msLeft, left, urgency, label: leftLabel(msLeft) };
}

export function leftLabel(msLeft: number): string {
  if (msLeft <= 0) return "Lapsed";
  const minutes = Math.ceil(msLeft / MINUTE);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} h left` : `${hours} h ${rest} min left`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days} d left` : `${days} d ${h} h left`;
}

export type DecideItem = {
  kind: "room" | "table";
  id: string;
  /** When the request was made. */
  openedAt: string;
  /** When it can no longer be answered. */
  deadline: string;
};

/** A room request's deadline: its hold, counted from when it was made. */
export function roomDeadline(createdAt: string): string {
  return new Date(Date.parse(createdAt) + HOLD_WINDOW_HOURS * HOUR).toISOString();
}

/** Soonest to lapse first; a lapsed one (still PENDING until the sweep runs) after the live ones. */
export function sortByDeadline<T extends DecideItem>(items: readonly T[], now: number): T[] {
  return [...items].sort((a, b) => {
    const la = Date.parse(a.deadline) <= now;
    const lb = Date.parse(b.deadline) <= now;
    if (la !== lb) return la ? 1 : -1;
    return a.deadline.localeCompare(b.deadline);
  });
}

