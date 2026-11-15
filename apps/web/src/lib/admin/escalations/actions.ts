"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { recordAlert } from "@/lib/alerts";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  ADMIN_SIGNED_OUT_MESSAGE,
  ADMIN_STEP_UP_MESSAGE,
  ADMIN_UNCONFIGURED_MESSAGE,
  requireConsole,
  type ConsoleAccess,
} from "@/lib/admin/guard";
import { isNotDeployed } from "@/lib/observability/read-error";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import {
  ESCALATION_ACTIONS,
  ESCALATION_CATEGORIES,
  ESCALATION_SEVERITIES,
  LIMITS,
  PERSONAL_NUMBER_REFUSAL,
  carriesPersonalNumber,
  isEscalationRoute,
  safeRecordUrl,
  sourceDeskOf,
  type EscalationAction,
} from "./types";

/**
 * THE ESCALATION WRITES: raise one, and act on one.
 *
 * THE DOOR is the console's own (`requireConsole`): any admin, and any staff
 * member with a scope who has acknowledged the handbook. Both writes then go
 * through a database function on the CALLER'S OWN session
 * (`staff_escalation_raise`, `staff_escalation_act`), which decides again who
 * they are, where the escalation lands and whether this action is theirs to
 * take, writes the timeline and the audit line, and tells the other side.
 * Nothing here uses the service client.
 *
 * THE TEXT RULE is applied here first so the person reads the reason beside
 * the field, and again by the database: escalation text never carries an ID
 * number, a bank account number or a card number. The record travels as a
 * link.
 *
 * AN URGENT ESCALATION also records a risk alert (`recordAlert`, critical), so
 * the on-call page fires as it does for any critical alert. The alert carries
 * the reference and the route, never the text.
 */

const NOT_SET_UP = "Escalations are not set up on this server yet. Tell your lead directly for now.";
const FAILED = "That did not go through. Nothing was sent. Try again.";
const TOO_MANY = "That is a lot in a short while. Wait a few minutes, then try again.";
const HANDBOOK_FIRST = "Read and acknowledge the staff handbook first. Escalations open once you have.";
const CHECK_FIELDS = "Please check the highlighted fields and try again.";

function refusal(door: Exclude<ConsoleAccess, { state: "console" }>): string {
  if (door.state === "unconfigured") return ADMIN_UNCONFIGURED_MESSAGE;
  if (door.state === "signed-out") return ADMIN_SIGNED_OUT_MESSAGE;
  if (door.state === "step-up") return ADMIN_STEP_UP_MESSAGE;
  return ADMIN_FORBIDDEN_MESSAGE;
}

type RpcError = { code?: string | null; message?: string | null };
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type Called = { ok: true; answer: Record<string, unknown> } | { ok: false; error: string };

async function callDoor(client: unknown, fn: string, args: Record<string, unknown>): Promise<Called> {
  let result: { data: unknown; error: RpcError | null };
  try {
    result = await (client as RpcClient).rpc(fn, args);
  } catch {
    return { ok: false, error: FAILED };
  }
  if (result.error) return { ok: false, error: isNotDeployed(result.error) ? NOT_SET_UP : FAILED };
  const answer = result.data;
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { ok: false, error: FAILED };
  return { ok: true, answer: answer as Record<string, unknown> };
}

/* ------------------------------------------------------------------ raise */

const raiseSchema = z.object({
  category: z.enum(ESCALATION_CATEGORIES, { message: "Choose what kind of issue this is." }),
  severity: z.enum(ESCALATION_SEVERITIES, { message: "Choose how urgent this is." }),
  title: z
    .string()
    .trim()
    .min(LIMITS.title.min, "Give it a short title.")
    .max(LIMITS.title.max, `Keep the title under ${LIMITS.title.max} characters.`),
  whatHappened: z
    .string()
    .trim()
    .min(LIMITS.whatHappened.min, "Say what happened, in a sentence or two.")
    .max(LIMITS.whatHappened.max, `Keep this under ${LIMITS.whatHappened.max} characters.`),
  whatIsNeeded: z
    .string()
    .trim()
    .min(LIMITS.whatIsNeeded.min, "Say what you need from them.")
    .max(LIMITS.whatIsNeeded.max, `Keep this under ${LIMITS.whatIsNeeded.max} characters.`),
  /** The admin page it was raised from (the path, with or without its query). */
  sourcePath: z.string().max(600).optional().nullable(),
  /** The attached record: a path inside the console. */
  recordUrl: z.string().max(600).optional().nullable(),
  recordLabel: z.string().trim().max(LIMITS.recordLabel.max).optional().nullable(),
  /** Set only when the person chose to send it somewhere other than the table's answer. */
  routedTo: z.string().max(40).optional().nullable(),
});

export type RaiseEscalationInput = z.input<typeof raiseSchema>;
export type RaisedEscalation = { id: string; reference: string; routedTo: string; intended: string | null; dueAt: string | null };

const RAISE_REFUSED: Record<string, { error: string; field?: string }> = {
  forbidden: { error: HANDBOOK_FIRST },
  invalid_category: { error: CHECK_FIELDS, field: "category" },
  invalid_severity: { error: CHECK_FIELDS, field: "severity" },
  title_length: { error: CHECK_FIELDS, field: "title" },
  what_happened_length: { error: CHECK_FIELDS, field: "whatHappened" },
  what_is_needed_length: { error: CHECK_FIELDS, field: "whatIsNeeded" },
  invalid_desk: { error: FAILED },
  invalid_record: { error: "The attached link must be a page inside the console.", field: "recordUrl" },
  invalid_route: { error: "Choose a team from the list.", field: "routedTo" },
  personal_data: { error: PERSONAL_NUMBER_REFUSAL },
};

const FIELD_WORDS: Record<string, string> = {
  category: "Choose what kind of issue this is.",
  severity: "Choose how urgent this is.",
  title: "Give it a short title, 3 to 120 characters.",
  whatHappened: "Say what happened, in at least 10 characters.",
  whatIsNeeded: "Say what you need from them, in at least 5 characters.",
  recordUrl: "The attached link must be a page inside the console.",
  routedTo: "Choose a team from the list.",
};

export async function raiseEscalation(input: RaiseEscalationInput): Promise<ActionResult<RaisedEscalation>> {
  const door = await requireConsole();
  if (door.state !== "console") return fail(refusal(door));
  if (!door.staff.isAdmin && !door.staff.isSuperAdmin && !door.staff.handbookAcknowledged) return fail(HANDBOOK_FIRST);

  const parsed = validate(raiseSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;

  /* The text rule, field by field, so the person sees which box to change. */
  const fieldErrors: Record<string, string> = {};
  if (carriesPersonalNumber(data.title)) fieldErrors.title = PERSONAL_NUMBER_REFUSAL;
  if (carriesPersonalNumber(data.whatHappened)) fieldErrors.whatHappened = PERSONAL_NUMBER_REFUSAL;
  if (carriesPersonalNumber(data.whatIsNeeded)) fieldErrors.whatIsNeeded = PERSONAL_NUMBER_REFUSAL;
  if (carriesPersonalNumber(data.recordLabel)) fieldErrors.recordLabel = PERSONAL_NUMBER_REFUSAL;
  if (Object.keys(fieldErrors).length > 0) return fail(PERSONAL_NUMBER_REFUSAL, fieldErrors);

  const asked = (data.recordUrl ?? "").trim();
  const recordUrl = safeRecordUrl(asked);
  if (asked.length > 0 && !recordUrl) return fail(FIELD_WORDS.recordUrl!, { recordUrl: FIELD_WORDS.recordUrl! });
  const routedTo = (data.routedTo ?? "").trim();
  if (routedTo.length > 0 && !isEscalationRoute(routedTo)) return fail(FIELD_WORDS.routedTo!, { routedTo: FIELD_WORDS.routedTo! });

  const limit = await consume({ bucket: "admin_escalation_raise", limit: 20, windowSeconds: 600, subject: subjectForUser(door.user.id) });
  if (!limit.allowed) return fail(TOO_MANY);

  const called = await callDoor(door.supabase, "staff_escalation_raise", {
    p_category: data.category,
    p_severity: data.severity,
    p_title: data.title,
    p_what_happened: data.whatHappened,
    p_what_is_needed: data.whatIsNeeded,
    p_source_desk: sourceDeskOf(data.sourcePath),
    p_record_url: recordUrl,
    p_record_label: recordUrl ? (data.recordLabel?.trim() || null) : null,
    p_routed_to: routedTo.length > 0 ? routedTo : null,
  });
  if (!called.ok) return fail(called.error);
  const answer = called.answer;
  if (answer.status !== "ok") {
    const known = RAISE_REFUSED[String(answer.status)];
    if (!known) return fail(FAILED);
    return known.field ? fail(known.error, { [known.field]: FIELD_WORDS[known.field] ?? known.error }) : fail(known.error);
  }
  const id = String(answer.id ?? "");
  const reference = String(answer.reference ?? "");
  const landed = String(answer.routed_to ?? "");
  if (!id || !reference) return fail(FAILED);

  /* Urgent: the on-call page fires. Reference and route only, never the text. */
  if (data.severity === "urgent") {
    await recordAlert({
      kind: "escalation.urgent",
      severity: "critical",
      subjectId: reference,
      subjectKind: "staff_escalation",
      detail: { reference, category: data.category, routed_to: landed, level: Number(answer.level ?? 0), due_at: String(answer.due_at ?? "") },
    });
  }

  revalidatePath("/admin", "layout");
  return ok({
    id,
    reference,
    routedTo: landed,
    intended: typeof answer.intended === "string" ? answer.intended : null,
    dueAt: typeof answer.due_at === "string" ? answer.due_at : null,
  });
}

/* -------------------------------------------------------------------- act */

const actSchema = z.object({
  id: z.string().uuid("That escalation could not be found."),
  action: z.enum(ESCALATION_ACTIONS, { message: "That action is not known." }),
  body: z.string().trim().max(4000, "Keep this under 4000 characters.").optional().nullable(),
  /** A person (assign) or a team (reroute). */
  target: z.string().trim().max(60).optional().nullable(),
});

export type ActOnEscalationInput = z.input<typeof actSchema>;
export type ActedEscalation = { status: string; routedTo: string };

/** What each action needs written, and what to say when it is missing. */
const BODY_RULE: Partial<Record<EscalationAction, { min: number; max: number; words: string }>> = {
  comment: { ...LIMITS.note, words: "Write the note first." },
  reroute: { ...LIMITS.reason, words: "Say why it should go there, in at least 10 characters." },
  ask_raiser: { ...LIMITS.question, words: "Write the question first." },
  raiser_reply: { ...LIMITS.note, words: "Write your answer first." },
  resolve: { ...LIMITS.closing, words: "Write a closing note of at least 10 characters. The raiser reads it." },
  decline: { ...LIMITS.closing, words: "Give the reason, in at least 10 characters. The raiser reads it." },
  reopen: { ...LIMITS.reopen, words: "Say why it should be reopened." },
};

const ACT_REFUSED: Record<string, string> = {
  forbidden: "That is not yours to do on this escalation.",
  not_found: "That escalation could not be found.",
  invalid_action: "That action is not known.",
  not_open: "Somebody has already seen this one. Refresh to see where it stands.",
  closed: "This escalation is closed. Reopen it first.",
  already: "That is already the case. Refresh to see where it stands.",
  invalid_target: "Choose somebody who can work this escalation.",
  invalid_route: "Choose a team from the list.",
  note_needed: "Write it first.",
  reason_needed: "Give the reason, in at least 10 characters.",
  resolution_needed: "Write a closing note of at least 10 characters. The raiser reads it.",
  no_raiser: "The person who raised this has left, so there is nobody to ask.",
  not_waiting: "No question is waiting for an answer on this one.",
  not_closed: "This escalation is still open.",
  too_late: "This was closed more than 14 days ago. Raise a new escalation and link this one.",
  too_long: "Keep this under 4000 characters.",
  personal_data: PERSONAL_NUMBER_REFUSAL,
};

export async function actOnEscalation(input: ActOnEscalationInput): Promise<ActionResult<ActedEscalation>> {
  const door = await requireConsole();
  if (door.state !== "console") return fail(refusal(door));
  if (!door.staff.isAdmin && !door.staff.isSuperAdmin && !door.staff.handbookAcknowledged) return fail(HANDBOOK_FIRST);

  const parsed = validate(actSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { id, action } = parsed.data;
  const body = (parsed.data.body ?? "").trim();
  const target = (parsed.data.target ?? "").trim();

  const rule = BODY_RULE[action];
  if (rule && (body.length < rule.min || body.length > rule.max)) {
    const words = body.length > rule.max ? `Keep this under ${rule.max} characters.` : rule.words;
    return fail(words, { body: words });
  }
  if (carriesPersonalNumber(body)) return fail(PERSONAL_NUMBER_REFUSAL, { body: PERSONAL_NUMBER_REFUSAL });
  if (action === "reroute" && !isEscalationRoute(target)) return fail(ACT_REFUSED.invalid_route!, { target: ACT_REFUSED.invalid_route! });

  const limit = await consume({ bucket: "admin_escalation_act", limit: 60, windowSeconds: 600, subject: subjectForUser(door.user.id) });
  if (!limit.allowed) return fail(TOO_MANY);

  const called = await callDoor(door.supabase, "staff_escalation_act", {
    p_id: id,
    p_action: action,
    p_body: body.length > 0 ? body : null,
    p_target: target.length > 0 ? target : null,
  });
  if (!called.ok) return fail(called.error);
  const answer = called.answer;
  if (answer.status !== "ok") return fail(ACT_REFUSED[String(answer.status)] ?? FAILED);

  revalidatePath("/admin", "layout");
  return ok({ status: String(answer.escalation_status ?? ""), routedTo: String(answer.routed_to ?? "") });
}
