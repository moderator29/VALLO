import { z } from "zod";
import { STAFF_SCOPES, requireConsole } from "@/lib/admin/guard";
import { listEscalations } from "@/lib/admin/escalations/read";
import {
  CATEGORY_LABEL,
  ESCALATION_CATEGORIES,
  ESCALATION_SEVERITIES,
  PERSONAL_NUMBER_REFUSAL,
  ROUTE_LABEL,
  ROUTING,
  SEVERITY_LABEL,
  STATUS_LABEL,
  isClosed,
  type EscalationRow,
} from "@/lib/admin/escalations/types";
import { clockOf, waitedWords } from "@/lib/admin/escalations/words";
import { deskName } from "@/app/admin/escalations/desk-name";
import { capList, clampLimit, clip, refused, unreadable } from "./common";
import { defineTool } from "./types";

/**
 * ESCALATIONS, FOR EVERY DESK'S COPILOT (15 November 2026). One read tool,
 * open to every member of staff the console admits, so any desk's copilot
 * can answer "what is waiting on me" and "how do I escalate this".
 *
 * It reads through the desk's own reads (`listEscalations`), which run on the
 * viewer's own session: the database answers only what this person may see.
 * It hands back counts and one plain line per escalation (the title a
 * colleague wrote, never the "what happened" text, and nothing about a
 * member beyond that title), with the link to the record. It writes nothing:
 * raising and answering an escalation stay on the screen, where the person
 * presses the button themselves.
 */

/** How to escalate, as facts the copilot repeats rather than invents. Built from the same tables the form uses. */
export const HOW_TO_ESCALATE = {
  steps: [
    "Press Escalate at the top of any admin page. The page you are on is attached as a link.",
    "Choose what kind of issue it is and how urgent it is, give it a short title, and say what happened and what you need from them.",
    "It goes to the team for that kind of issue, with a response time. If nobody is on that team it goes to the COO, then to the super admin.",
    "You are told when it is seen, when a question is asked, and when it is resolved or declined. You can reopen it within 14 days.",
  ],
  rules: [
    `Do not paste ID numbers, bank details or documents. ${PERSONAL_NUMBER_REFUSAL}`,
    "On identity, fraud and safety: never tell the member you suspect them.",
    "You cannot resolve or decline an escalation you raised yourself.",
  ],
  whereEachKindGoes: ESCALATION_CATEGORIES.map((category) => ({ kind: CATEGORY_LABEL[category].name, goesTo: ROUTE_LABEL[ROUTING[category]] })),
  responseTimes: [...ESCALATION_SEVERITIES].reverse().map((severity) => ({ urgency: SEVERITY_LABEL[severity].name, answered: SEVERITY_LABEL[severity].answer })),
  form: "/admin/escalations/new",
  manual: "/admin/manual/escalation",
} as const;

function line(row: EscalationRow, now: number) {
  const clock = clockOf(row, now);
  return {
    reference: row.reference,
    title: clip(row.title, 120),
    kind: CATEGORY_LABEL[row.category].name,
    urgency: SEVERITY_LABEL[row.severity].name,
    status: STATUS_LABEL[row.status],
    clock: clock.words,
    overdue: clock.overdue,
    waited: waitedWords(row, now),
    raisedBy: row.raisedByMe ? "you" : (row.raisedByName ?? "a colleague who has left"),
    raisedFrom: deskName(row.sourceDesk),
    link: `/admin/escalations/${row.id}`,
  };
}

export const getEscalations = defineTool({
  name: "get_escalations",
  description:
    "The viewer's own escalations: what is waiting on them now (with how many are overdue) and what they raised (open and closed), each as one plain line with its response clock and a link. Also the facts for how to escalate: the steps, where each kind of issue goes and the response times. Use it for 'what is waiting on me', 'did my escalation get an answer', 'how do I escalate this' and 'who do I send this to'.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading your escalations",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const door = await requireConsole();
    if (door.state !== "console" || door.user.id !== ctx.viewer.userId) return refused();
    const [forMe, mine] = await Promise.all([listEscalations("for_me"), listEscalations("mine")]);
    if (forMe.state === "not_set_up" || mine.state === "not_set_up") {
      return {
        ok: false,
        error:
          "Escalations are not set up on this server yet, so there is nothing to read and the Escalate button cannot send. Say so plainly, and tell them to take it to their lead directly for now (the staff manual, /admin/manual/escalation).",
      };
    }
    if (forMe.state === "forbidden" || mine.state === "forbidden") return refused();
    if (forMe.state !== "ok" && mine.state !== "ok") return unreadable("Your escalations");

    const limit = clampLimit(input.limit, 6);
    const waiting = forMe.state === "ok" ? forMe.data.rows.map((row) => line(row, ctx.now)) : null;
    const raised = mine.state === "ok" ? mine.data.rows : null;
    const raisedOpen = raised ? raised.filter((row) => !isClosed(row.status)) : null;
    return {
      ok: true,
      data: {
        waitingOnYou: waiting
          ? { overdue: waiting.filter((w) => w.overdue).length, ...capList(waiting, limit) }
          : null,
        raisedByYou:
          raised && raisedOpen
            ? {
                open: raisedOpen.length,
                closed: raised.length - raisedOpen.length,
                ...capList(raised.map((row) => line(row, ctx.now)), limit),
              }
            : null,
        howToEscalate: HOW_TO_ESCALATE,
        page: "/admin/escalations",
      },
      note: "A part that is null could not be read; say so rather than guess. Give each escalation's link. You cannot raise, answer or close an escalation: point to the Escalate button or the record.",
    };
  },
});

export const ESCALATION_TOOLS = [getEscalations];
