import { appUrl, button, compose, fitSubject, heading, hello, note, paragraph, rows } from "./render";
import type { EmailMessage } from "./messages";

/**
 * THE STAFF ESCALATION EMAILS (15 November 2026). One builder for the whole
 * family, written by the `staff_escalation_*` database functions
 * (`supabase/migrations/pending/staff_escalations_2026-11-15.sql`) under the
 * template `staff.escalation`, with the event in the payload.
 *
 * WHAT THE EMAIL CARRIES, AND WHAT IT LEAVES IN THE CONSOLE. The reference,
 * how urgent it is, when an answer is due, and one button. Never the title
 * and never the text: an escalation can be about a member, and nothing about
 * a member leaves the console in an email. The reader opens the record to
 * read it.
 */
export const ESCALATION_EMAIL_EVENTS = [
  "raised",
  "urgent",
  "bumped",
  "reminder",
  "rerouted",
  "assigned",
  "answered",
  "reopened",
  "acknowledged",
  "asked",
  "asked_again",
  "resolved",
  "declined",
] as const;
export type EscalationEmailEvent = (typeof ESCALATION_EMAIL_EVENTS)[number];

export function isEscalationEmailEvent(value: unknown): value is EscalationEmailEvent {
  return typeof value === "string" && (ESCALATION_EMAIL_EVENTS as readonly string[]).includes(value);
}

export type EscalationEmailData = {
  name: string | null;
  reference: string;
  escalationId: string;
  severity: string | null;
  /** When an answer is due, as the database wrote it. */
  dueAt: string | null;
};

/** `clock` says whether the reader is the one the response time runs for. */
const WORDS: Record<EscalationEmailEvent, { subject: string; lead: string; line: string; clock: boolean }> = {
  raised: { subject: "Escalation for you", lead: "An escalation needs you", line: "A colleague raised something they cannot or may not decide. Open it to read what happened and what they need.", clock: true },
  urgent: { subject: "Urgent escalation", lead: "An urgent escalation was raised", line: "It went to its team, and you are told at once because it is urgent.", clock: true },
  bumped: { subject: "Overdue escalation", lead: "An overdue escalation moved up to you", line: "Nobody answered in time, so it is with you now.", clock: true },
  reminder: { subject: "Still overdue", lead: "An escalation is still overdue", line: "It has passed its response time and is waiting on you.", clock: false },
  rerouted: { subject: "Escalation sent to you", lead: "An escalation was sent to you", line: "Another team looked at it and sent it on, with their reason on the record.", clock: true },
  assigned: { subject: "Escalation given to you", lead: "An escalation was given to you", line: "It is yours now. Open it to read what is needed.", clock: true },
  answered: { subject: "The raiser answered", lead: "The raiser answered your question", line: "Read the answer on the record and carry on.", clock: true },
  reopened: { subject: "Escalation reopened", lead: "An escalation was reopened", line: "The reason is on the record. The response time starts again.", clock: true },
  acknowledged: { subject: "Escalation seen", lead: "Your escalation was seen", line: "Somebody on the receiving side has it. You will be told the outcome.", clock: false },
  asked: { subject: "A question for you", lead: "There is a question about your escalation", line: "Answer it on the record so the work can carry on. The response time waits for you.", clock: false },
  asked_again: { subject: "A question is waiting", lead: "A question about your escalation is still waiting", line: "Answer it on the record so the work can carry on.", clock: false },
  resolved: { subject: "Escalation resolved", lead: "Your escalation was resolved", line: "The closing note is on the record. You can reopen it within 14 days if it is not right.", clock: false },
  declined: { subject: "Escalation declined", lead: "Your escalation was declined", line: "The reason is on the record. You can reopen it within 14 days if you disagree.", clock: false },
};

const URGENCY: Record<string, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };

/** Lagos time, as every other clock in a Vallo email. */
function lagosTime(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

export function staffEscalationEmail(event: EscalationEmailEvent, data: EscalationEmailData): EmailMessage {
  const w = WORDS[event];
  const urgency = data.severity ? URGENCY[data.severity] : undefined;
  const due = w.clock ? lagosTime(data.dueAt) : null;
  const composed = compose({
    icon: "supportReplied",
    preheader: w.line,
    blocks: [
      heading(w.lead),
      paragraph(`${hello(data.name)} ${w.line}`),
      rows([
        { label: "Reference", value: data.reference, strong: true },
        ...(urgency ? [{ label: "Urgency", value: urgency }] : []),
        ...(due ? [{ label: "Answer by", value: `${due}, Lagos time` }] : []),
      ]),
      button("Open the escalation", appUrl(`/admin/escalations/${data.escalationId}`)),
      note("The details stay in the console. Do not forward this email or reply to it with anything about a member."),
    ],
    footerLines: ["You are receiving this because you have staff access on Vallo."],
  });
  return { subject: fitSubject(w.subject, data.reference), preheader: composed.preheader, html: composed.html, text: composed.text };
}
