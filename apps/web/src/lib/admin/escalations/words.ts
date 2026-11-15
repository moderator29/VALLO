import {
  CATEGORY_LABEL,
  ROUTE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  isClosed,
  isEscalationRoute,
  routeName,
  withWhom,
  type EscalationEvent,
  type EscalationRow,
  type EscalationSeverity,
  type EscalationStatus,
  type RoutePlan,
} from "./types";
import { plural } from "@vallo/i18n/core";

/**
 * THE ESCALATION SCREENS' SENTENCES. Pure: every line a person reads on the
 * list, the record and the form is built here from the record's own fields,
 * so the list, the record, the copilot and the tests say the same thing.
 * Plain words: "due in 2 hours", "overdue by 3 hours", never a raw state.
 */

function count(n: number, one: string): string {
  return plural(n, { one: `{count} ${one}`, other: `{count} ${one}s` });
}

/** A length of time in the largest unit that reads well: minutes, hours, days. */
export function spanWords(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return count(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return count(hours, "hour");
  return count(Math.floor(hours / 24), "day");
}

export type Clock = { words: string; overdue: boolean };

/** "due in 2 hours" or "overdue by 3 hours". A closed one has no clock. */
export function clockOf(row: Pick<EscalationRow, "dueAt" | "status" | "resolvedAt">, nowMs: number): Clock {
  if (isClosed(row.status)) {
    return { words: row.status === "resolved" ? "resolved" : "declined", overdue: false };
  }
  const due = Date.parse(row.dueAt);
  if (Number.isNaN(due)) return { words: "no due time recorded", overdue: false };
  if (row.status === "waiting_on_raiser") {
    return { words: "waiting for the raiser to answer", overdue: false };
  }
  return due >= nowMs
    ? { words: `due in ${spanWords(due - nowMs)}`, overdue: false }
    : { words: `overdue by ${spanWords(nowMs - due)}`, overdue: true };
}

/** "waiting 5 hours": how long since it was raised. */
export function waitedWords(row: Pick<EscalationRow, "createdAt" | "status" | "resolvedAt">, nowMs: number): string {
  const from = Date.parse(row.createdAt);
  if (Number.isNaN(from)) return "";
  if (isClosed(row.status)) {
    const closed = row.resolvedAt ? Date.parse(row.resolvedAt) : Number.NaN;
    return Number.isNaN(closed) ? "" : `closed after ${spanWords(closed - from)}`;
  }
  return `waiting ${spanWords(nowMs - from)}`;
}

/** "Kemi raised this from the Verification desk." */
export function raisedByWords(row: Pick<EscalationRow, "raisedByName" | "raisedByMe">, deskName: string): string {
  const who = row.raisedByMe ? "You" : (row.raisedByName ?? "A colleague who has left");
  return `${who} raised this from ${deskName}.`;
}

/** Who has it now: the person who took it, or the group at its level. */
export function ownerWords(row: Pick<EscalationRow, "assignedToName" | "assignedToMe" | "routedTo" | "level" | "status">): string {
  if (isClosed(row.status)) return "Nobody. It is closed.";
  if (row.status === "waiting_on_raiser") return "The raiser, who has a question to answer.";
  if (row.assignedToMe) return "You.";
  if (row.assignedToName) return `${row.assignedToName}.`;
  const group = withWhom(row.routedTo, row.level);
  return `${group.charAt(0).toUpperCase()}${group.slice(1)}. Nobody has taken it yet.`;
}

export function statusWords(status: EscalationStatus): string {
  return STATUS_LABEL[status];
}

/** "This goes to Trust and Safety. They aim to answer within 4 hours." */
export function whereItGoesWords(plan: RoutePlan, severity: EscalationSeverity): string {
  const answer = `They aim to answer ${SEVERITY_LABEL[severity].answer}.`;
  if (!plan.fallback) return `This goes to ${ROUTE_LABEL[plan.route]}. ${answer}`;
  return `Nobody is on ${ROUTE_LABEL[plan.intended]} yet, so this goes to ${ROUTE_LABEL[plan.route]}. ${answer}`;
}

/** What the raiser reads once it is sent. */
export function sentWords(reference: string, routedTo: string, intended: string | null): string {
  const to = isEscalationRoute(routedTo) ? ROUTE_LABEL[routedTo] : "the right team";
  const moved = intended && intended !== routedTo && isEscalationRoute(intended);
  return moved
    ? `${reference} sent to ${to}, because nobody is on ${ROUTE_LABEL[intended]} yet. They have been told.`
    : `${reference} sent to ${to}. They have been told.`;
}

function str(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** One line of the timeline, in plain words. The note itself is drawn under it. */
export function eventWords(event: EscalationEvent): string {
  const who = event.system ? "The clock" : event.actorMe ? "You" : (event.actorName ?? "A colleague");
  switch (event.kind) {
    case "raised": {
      const to = str(event.detail, "routed_to");
      const intended = str(event.detail, "intended");
      const where = to ? withWhom(to, to === "super_admin" ? 2 : to === "coo" ? 1 : 0) : "the right team";
      return event.detail["fallback"] === true && intended && isEscalationRoute(intended)
        ? `${who} raised this. Nobody was on ${ROUTE_LABEL[intended]}, so it went to ${where}.`
        : `${who} raised this. It went to ${where}.`;
    }
    case "acknowledged":
      return `${who} saw this and said so.`;
    case "assigned": {
      const to = str(event.detail, "to_name");
      return event.detail["self"] === true || !to ? `${who} took this.` : `${who} gave this to ${to}.`;
    }
    case "comment":
      return `${who} added a note.`;
    case "rerouted": {
      const to = str(event.detail, "to");
      return `${who} sent this to ${to && isEscalationRoute(to) ? ROUTE_LABEL[to] : "another team"}.`;
    }
    case "bumped": {
      if (event.detail["reminder"] === true) return "Still overdue. The super admin was reminded.";
      const level = Number(event.detail["to_level"]);
      return `Nobody answered in time, so this moved up to ${level >= 2 ? ROUTE_LABEL.super_admin : ROUTE_LABEL.coo}.`;
    }
    case "asked_raiser":
      return `${who} asked the raiser a question.`;
    case "raiser_replied":
      return `${who} answered the question.`;
    case "resolved":
      return `${who} resolved this.`;
    case "declined":
      return `${who} declined this.`;
    case "reopened":
      return `${who} reopened this.`;
  }
}

/** A list row in one plain sentence, for the copilot and for screen readers. */
export function rowSummary(row: EscalationRow, deskName: string, nowMs: number): string {
  const clock = clockOf(row, nowMs);
  return [
    `${row.reference}: ${row.title}.`,
    `${CATEGORY_LABEL[row.category].name}, ${SEVERITY_LABEL[row.severity].name.toLowerCase()}.`,
    raisedByWords(row, deskName),
    `${statusWords(row.status)}, ${clock.words}.`,
  ].join(" ");
}

export { routeName };
