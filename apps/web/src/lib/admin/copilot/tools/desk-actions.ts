import { z } from "zod";
import { STAFF_SCOPES, requireConsole } from "@/lib/admin/guard";
import { getMessageFlags, getRiskAlerts } from "@/lib/admin/queries";
import { getSupportTicketDetail } from "@/lib/admin/support-queue";
import { getEscalation } from "@/lib/admin/escalations/read";
import { PERSONAL_NUMBER_REFUSAL, actionsFor, carriesPersonalNumber } from "@/lib/admin/escalations/types";
import {
  escalationStepInput,
  messageFlagInput,
  riskAlertStepInput,
  sendTicketReplyInput,
  setTicketStatusInput,
} from "../action-schemas";
import { UUID_RE, capList, clampLimit, clip, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool, type ProposalDraft, type ToolResult } from "./types";

/**
 * THE DESK WORK THE COPILOT CAN DO FOR YOU, BEHIND A BUTTON (16 November 2026).
 *
 * The founder: "make it possible for it to write, fix and do things, but it
 * should always show a confirm button for you to click, to reply to users or
 * resolve stuff ... it should show you a preview". So each of these reads the
 * item first, refuses when the item is gone or already done, and hands back a
 * card that shows exactly what will happen: the reply word for word as the
 * member will read it, the status before and after, the note the raiser will
 * read. Nothing changes until the person presses the card's button, and then
 * the desk's own server action runs with its own permission checks
 * (`lib/admin/copilot/act.ts`), recorded in the audit log as made through
 * the copilot.
 *
 * Still never through the copilot: money, a decision on a listing, an
 * identity or an appeal, restricting a member, staff access, deleting.
 */

const proposed = (summary: string, draft: ProposalDraft): ToolResult => ({
  ok: true,
  data: {
    proposed: true,
    summary,
    note: "A card with the full preview is now on the person's screen. Nothing has happened yet. Tell them in one line what the card does and that it runs only when they press its button. Do not repeat the whole preview.",
  },
  proposal: draft,
});

const gone = (what: string): ToolResult => ({ ok: false, error: `${what} could not be found. It may have been dealt with already. Say so plainly and offer to look at the queue again.` });

/* ------------------------------------------------------------- tickets */

export const replyToTicket = defineTool({
  name: "reply_to_ticket",
  description:
    "Write a reply to a member's support ticket (by ticket id) and put it on a card the agent can send with one press. Read the ticket with get_support_ticket first. Write warm and plain, in the house money wording, never promise an outcome another desk decides, and never ask for passwords, card numbers or ID numbers. Set resolve true only when the reply fully answers the member. Nothing is sent until the person presses Send reply.",
  kind: "propose",
  scopes: ["support"],
  status: "Writing the reply",
  input: z.object({ ticketId: z.string().regex(UUID_RE), text: z.string().trim().min(2).max(4000), resolve: z.boolean().optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support"]);
    if (!gate.ok) return refused();
    if (carriesPersonalNumber(input.text)) return { ok: false, error: `The reply carries what looks like an ID, card or account number. ${PERSONAL_NUMBER_REFUSAL} Write it again without it.` };
    const read = await getSupportTicketDetail(input.ticketId, ctx.now);
    if (read.state === "forbidden") return refused();
    if (read.state !== "ok") return unreadable("That ticket");
    const t = read.data;
    if (!t) return gone("That ticket");
    if (t.row.status === "closed") return { ok: false, error: "That ticket is closed. A reply cannot go on a closed ticket; say so and point to the ticket." };
    const then = input.resolve ? "resolve" : "keep";
    const action = sendTicketReplyInput.parse({ ticketId: input.ticketId, body: input.text, then });
    const who = t.row.name || "the member";
    return proposed(`Reply to ${who} on ${t.row.reference}`, {
      label: `Reply to ${who}`,
      summary: `On ticket ${t.row.reference}${t.row.topic ? ` (${t.row.topic})` : ""}. ${then === "resolve" ? "Sends the reply and marks the ticket resolved." : "Sends the reply and keeps the ticket open for their answer."} They get a notification in the app.`,
      args: { ticket: t.row.reference, member: who, status: t.row.status, afterSending: then === "resolve" ? "resolved" : "stays open" },
      preview: { heading: `What ${who} will read`, text: action.body },
      confirmLabel: then === "resolve" ? "Send and resolve" : "Send reply",
      mode: "act",
      deskHref: `/admin/support?ticket=${input.ticketId}`,
      action: { kind: "send_ticket_reply", input: action },
    });
  },
});

export const changeTicketStatus = defineTool({
  name: "set_ticket_status",
  description:
    "Change a support ticket's status (by ticket id): open, pending (waiting on the member), resolved, or closed. Closing needs a note of what was done (at least eight characters). Read the ticket first. Nothing changes until the person presses the button on the card.",
  kind: "propose",
  scopes: ["support"],
  status: "Preparing the status change",
  input: z.object({ ticketId: z.string().regex(UUID_RE), status: z.enum(["open", "pending", "resolved", "closed"]), note: z.string().trim().max(1000).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["support"]);
    if (!gate.ok) return refused();
    const parsed = setTicketStatusInput.safeParse({ ticketId: input.ticketId, status: input.status, note: input.note ?? "" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That status change does not pass the desk's checks." };
    const read = await getSupportTicketDetail(input.ticketId, ctx.now);
    if (read.state === "forbidden") return refused();
    if (read.state !== "ok") return unreadable("That ticket");
    const t = read.data;
    if (!t) return gone("That ticket");
    if (t.row.status === input.status) return { ok: false, error: `That ticket is already ${input.status}. Nothing to change.` };
    const word = { open: "Reopen", pending: "Mark waiting on the member", resolved: "Resolve", closed: "Close" }[input.status];
    return proposed(`${word} ${t.row.reference}`, {
      label: `${word}: ${t.row.reference}`,
      summary: `Moves the ticket from ${t.row.status} to ${input.status}.${input.status === "closed" ? " The note is kept in the audit trail." : ""}`,
      args: { ticket: t.row.reference, member: t.row.name || "the member", from: t.row.status, to: input.status },
      ...(parsed.data.note ? { preview: { heading: "Closing note", text: parsed.data.note } } : {}),
      confirmLabel: word,
      mode: "act",
      deskHref: `/admin/support?ticket=${input.ticketId}`,
      action: { kind: "set_ticket_status", input: parsed.data },
    });
  },
});

/* --------------------------------------------------------- escalations */

const STEP_WORD = {
  acknowledge: "Mark as seen",
  comment: "Add a note",
  ask_raiser: "Ask the raiser",
  resolve: "Resolve",
  decline: "Decline",
  reopen: "Reopen",
} as const;

export const escalationStep = defineTool({
  name: "escalation_step",
  description:
    "Take one step on an escalation (by escalation id from get_escalations): acknowledge (mark as seen), comment (a note on the record), ask_raiser (a question to whoever raised it), resolve or decline (each needs a closing note of at least 10 characters that the raiser reads), or reopen (with a reason). Only steps the viewer may take now are offered. Never paste ID numbers, bank details or documents. Nothing changes until the person presses the button on the card.",
  kind: "propose",
  scopes: STAFF_SCOPES,
  status: "Preparing the escalation step",
  input: z.object({ escalationId: z.string().regex(UUID_RE), step: z.enum(["acknowledge", "comment", "ask_raiser", "resolve", "decline", "reopen"]), note: z.string().trim().max(4000).optional() }),
  handler: async (input, ctx) => {
    const door = await requireConsole();
    if (door.state !== "console" || door.user.id !== ctx.viewer.userId) return refused();
    const note = (input.note ?? "").trim();
    if (carriesPersonalNumber(note)) return { ok: false, error: PERSONAL_NUMBER_REFUSAL };
    const needsNote = input.step !== "acknowledge";
    const min = input.step === "resolve" || input.step === "decline" || input.step === "reopen" ? 10 : 2;
    if (needsNote && note.length < min) return { ok: false, error: `That step needs a note of at least ${min} characters${input.step === "resolve" || input.step === "decline" ? " that the raiser will read" : ""}. Write it, then call again.` };
    const read = await getEscalation(input.escalationId);
    if (read.state === "not_set_up") return { ok: false, error: "Escalations are not set up on this server yet." };
    if (read.state === "forbidden") return refused();
    if (read.state !== "ok") return unreadable("That escalation");
    const { record, viewer } = read.data;
    const allowed = actionsFor(viewer, { status: record.status, hasRaiser: record.raisedByMe || record.raisedByName !== null, resolvedAt: record.resolvedAt }, ctx.now);
    if (!(allowed as readonly string[]).includes(input.step)) {
      return { ok: false, error: `${STEP_WORD[input.step]} is not open to this person on ${record.reference} right now. What they can do: ${allowed.map((a) => a.replace("_", " ")).join(", ") || "nothing, only read it"}.` };
    }
    const action = escalationStepInput.parse({ escalationId: input.escalationId, step: input.step, note });
    const raiserReads = input.step === "resolve" || input.step === "decline" || input.step === "ask_raiser";
    return proposed(`${STEP_WORD[input.step]} on ${record.reference}`, {
      label: `${STEP_WORD[input.step]}: ${record.reference}`,
      summary: `"${clip(record.title, 100)}". ${raiserReads ? "The person who raised it is told and reads your note." : "Recorded on the escalation's history."}`,
      args: { escalation: record.reference, status: record.status, step: STEP_WORD[input.step] },
      ...(note ? { preview: { heading: raiserReads ? "What the raiser will read" : "Your note", text: note } } : {}),
      confirmLabel: STEP_WORD[input.step],
      mode: "act",
      deskHref: `/admin/escalations/${input.escalationId}`,
      action: { kind: "escalation_step", input: action },
    });
  },
});

/* ------------------------------------------------------------- alerts */

export const riskAlertStep = defineTool({
  name: "risk_alert_step",
  description:
    "Acknowledge a risk alert (say you have it) or resolve it with a short note of what was done (by alert id from get_operations_overview). Nothing changes until the person presses the button on the card.",
  kind: "propose",
  scopes: ["operations"],
  /* The alert desk's own actions answer only to an admin (requireAdmin with
     no scope), so an Operations member's card would always be refused. It is
     offered to those it can work for. */
  allow: (v) => v.isAdmin || v.isSuperAdmin,
  status: "Preparing the alert step",
  input: z.object({ alertId: z.string().regex(UUID_RE), step: z.enum(["acknowledge", "resolve"]), notes: z.string().trim().max(2000).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["operations"]);
    if (!gate.ok) return refused();
    const read = await getRiskAlerts({});
    if (read.state !== "ok") return unreadable("The alerts");
    const alert = read.data.rows.find((a) => a.id === input.alertId);
    if (!alert) return gone("That alert");
    if (alert.status === "resolved") return { ok: false, error: "That alert is already resolved." };
    if (input.step === "acknowledge" && alert.status !== "open") return { ok: false, error: "That alert has already been picked up." };
    const action = riskAlertStepInput.parse({ alertId: input.alertId, step: input.step, notes: input.notes ?? "" });
    const word = input.step === "resolve" ? "Resolve alert" : "I have this";
    return proposed(`${word}: ${alert.title}`, {
      label: `${word}: ${clip(alert.title, 80)}`,
      summary: input.step === "resolve" ? "Closes the alert with your note, under your name." : "Marks the alert as yours, so nobody else picks it up.",
      args: { alert: clip(alert.title, 120), severity: alert.severity, hoursOpen: waitingHours(alert.createdAt, ctx.now) },
      ...(action.notes ? { preview: { heading: "Resolution note", text: action.notes } } : {}),
      confirmLabel: word,
      mode: "act",
      deskHref: "/admin/alerts",
      action: { kind: "risk_alert_step", input: action },
    });
  },
});

/* -------------------------------------------------------- message flags */

export const getFlagsTool = defineTool({
  name: "get_message_flags",
  description: "Open message flags (messages the safety scan caught): reason, what matched, who sent it and a short excerpt, oldest first, each with its id. Use it before review_message_flag.",
  kind: "read",
  scopes: ["moderation"],
  status: "Reading message flags",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["moderation"]);
    if (!gate.ok) return refused();
    const read = await getMessageFlags({});
    if (read.state !== "ok") return unreadable("Message flags");
    const open = read.data.rows.filter((f) => f.status !== "reviewed").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      ok: true,
      data: {
        open: capList(
          open.map((f) => ({ id: f.id, reason: f.reason, matched: clip(f.matched, 60), sender: f.senderRole, excerpt: clip(f.body, 160), waitingHours: waitingHours(f.createdAt, ctx.now) })),
          clampLimit(input.limit, 8),
          open.length,
        ),
        page: "/admin/queue",
      },
    };
  },
});

export const reviewFlag = defineTool({
  name: "review_message_flag",
  description:
    "Review a message flag (by flag id from get_message_flags): cleared (nothing wrong, the message stays) or escalated (needs a closer look by Trust and Safety). Nothing changes until the person presses the button on the card.",
  kind: "propose",
  scopes: ["moderation"],
  status: "Preparing the flag review",
  input: z.object({ flagId: z.string().regex(UUID_RE), resolution: z.enum(["cleared", "escalated"]) }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["moderation"]);
    if (!gate.ok) return refused();
    const read = await getMessageFlags({});
    if (read.state !== "ok") return unreadable("Message flags");
    const flag = read.data.rows.find((f) => f.id === input.flagId);
    if (!flag) return gone("That flag");
    if (flag.status === "reviewed") return { ok: false, error: "That flag has already been reviewed." };
    const action = messageFlagInput.parse(input);
    const word = input.resolution === "cleared" ? "Clear flag" : "Escalate flag";
    return proposed(`${word} (${flag.reason})`, {
      label: `${word}: ${flag.reason.replace(/_/g, " ")}`,
      summary: input.resolution === "cleared" ? "Marks the flag reviewed with nothing wrong. The message stays as it was." : "Sends the flag on for a closer look.",
      args: { reason: flag.reason, matched: clip(flag.matched, 60), sender: flag.senderRole },
      preview: { heading: "The flagged message", text: clip(flag.body, 600) ?? "" },
      confirmLabel: word,
      mode: "act",
      deskHref: "/admin/queue",
      action: { kind: "review_message_flag", input: action },
    });
  },
});

export const DESK_ACTION_TOOLS = [replyToTicket, changeTicketStatus, escalationStep, riskAlertStep, getFlagsTool, reviewFlag];
