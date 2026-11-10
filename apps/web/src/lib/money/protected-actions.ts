"use server";

/**
 * THE PROTECTED PAYMENT SCREENS' FIVE ACTIONS (spec two, screens 3 to 8).
 * Thin on purpose: the session, a rate limit and the input, then the server
 * steps in `protected-rail.ts`, which hold the money rules.
 *
 * FAIL CLOSED. Every action refuses, before reading anything, while the rail
 * is switched off (`escrowPayEnabled()`, `payments_escrowpay_on`, fail
 * closed) or the provider's API is undocumented (`DOCUMENTED` false). Both
 * are true today, so none of these can do anything on any deployment.
 *
 * NOTHING HERE MARKS MONEY MOVED. "Refresh status" and "I've made the
 * transfer" only ask for a read-back; funded, released and refunded are
 * recorded only from the provider's own word, inside the database.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { recordAlert } from "../alerts";
import { DOCUMENTED } from "../payments/providers/escrowpay/client";
import { escrowPayEnabled } from "../payments/providers/escrowpay/switch";
import { consume, subjectForUser } from "../security/rate-limit";
import { PROTECTED_ACTION_REFUSED, PROTECTED_PROBLEM_REASONS } from "./copy";
import { adminDb } from "./member-wallet";
import {
  askNewTransferDetails,
  confirmProtectedMilestone,
  protectedRailDeps,
  raiseProtectedDispute,
  refreshProtectedPayment,
  reportTransfer,
  type ActOutcome,
  type ProtectedRailDeps,
  type RefreshOutcome,
} from "./protected-rail";

const Target = z.object({ agreementId: z.string().uuid(), arrangementId: z.string().uuid() });
type TargetInput = z.input<typeof Target>;

const REASONS = Object.keys(PROTECTED_PROBLEM_REASONS) as [keyof typeof PROTECTED_PROBLEM_REASONS, ...(keyof typeof PROTECTED_PROBLEM_REASONS)[]];
const Problem = Target.extend({ reason: z.enum(REASONS), statement: z.string().trim().min(10).max(2000) });

/** Reads are cheap but each one may reach the provider: a few a minute is plenty. */
const LIMITS = {
  read: { bucket: "protected_payment_read", limit: 12, windowSeconds: 300 },
  act: { bucket: "protected_payment_act", limit: 6, windowSeconds: 600 },
} as const;

type Ready = { userId: string; deps: ProtectedRailDeps };

/** The gate every action passes first, in this order: rail, input, session, limit. */
async function gate(kind: keyof typeof LIMITS): Promise<Ready | string> {
  let on = false;
  try {
    on = DOCUMENTED && (await escrowPayEnabled());
  } catch {
    on = false;
  }
  if (!on) return PROTECTED_ACTION_REFUSED.rail_off;
  const session = await resolveSession();
  if (session.state === "unconfigured") return NOT_CONFIGURED_MESSAGE;
  if (session.state === "signed-out") return SIGNED_OUT_MESSAGE;
  const verdict = await consume({ ...LIMITS[kind], subject: subjectForUser(session.user.id) });
  if (!verdict.allowed) return PROTECTED_ACTION_REFUSED.too_many;
  const db = adminDb();
  if (!db) return PROTECTED_ACTION_REFUSED.unavailable;
  const deps = protectedRailDeps(db, async (alertKind, detail) => {
    await recordAlert({ kind: alertKind, severity: "critical", detail });
  });
  return { userId: session.user.id, deps };
}

function refresh(agreementId: string) {
  revalidatePath(`/agreements/${agreementId}/fund`);
  revalidatePath(`/agreements/${agreementId}/held`);
}

function refusal(reason: string): string {
  if (reason === "not_found") return PROTECTED_ACTION_REFUSED.not_found;
  if (reason === "switched_off" || reason === "not_configured" || reason === "not_documented") return PROTECTED_ACTION_REFUSED.rail_off;
  return PROTECTED_ACTION_REFUSED.unavailable;
}

function readResult(out: RefreshOutcome): ActionResult<{ read: boolean }> {
  if (out.outcome === "read") return ok({ read: true });
  if (out.outcome === "not_reachable") return ok({ read: false });
  return fail(refusal(out.reason));
}

function actResult(out: ActOutcome): ActionResult<{ submitted: boolean }> {
  if (out.outcome === "submitted") return ok({ submitted: true });
  /* No answer is not success: the screen keeps showing the recorded state. */
  if (out.outcome === "unknown") return ok({ submitted: false });
  return fail(refusal(out.reason));
}

/** "Refresh status": a read-back, nothing more. */
export async function refreshProtected(input: TargetInput): Promise<ActionResult<{ read: boolean }>> {
  const ready = await gate("read");
  if (typeof ready === "string") return fail(ready);
  const parsed = Target.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  const out = await refreshProtectedPayment(ready.deps, { arrangementId: parsed.data.arrangementId, actorUserId: ready.userId });
  refresh(parsed.data.agreementId);
  return readResult(out);
}

/** "I've made the transfer": marks the request to look, then a read-back. Never funded. */
export async function reportProtectedTransfer(input: TargetInput): Promise<ActionResult<{ read: boolean }>> {
  const ready = await gate("read");
  if (typeof ready === "string") return fail(ready);
  const parsed = Target.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  const out = await reportTransfer(ready.deps, { arrangementId: parsed.data.arrangementId, actorUserId: ready.userId });
  refresh(parsed.data.agreementId);
  return readResult(out);
}

/** The category's milestone: the payer asks Vallo to instruct the release. */
export async function confirmProtected(input: TargetInput): Promise<ActionResult<{ submitted: boolean }>> {
  const ready = await gate("act");
  if (typeof ready === "string") return fail(ready);
  const parsed = Target.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  /* A passcode-locked session moves no money (docs/PASSCODE.md). */
  const locked = await passcodeMoneyRefusal(ready.userId);
  if (locked) return fail(locked);
  const out = await confirmProtectedMilestone(ready.deps, { arrangementId: parsed.data.arrangementId, actorUserId: ready.userId });
  refresh(parsed.data.agreementId);
  return actResult(out);
}

/** Something is wrong: opens Vallo's dispute process. Moves no money. */
export async function raiseProtectedProblem(input: TargetInput & { reason: string; statement: string }): Promise<ActionResult<{ submitted: boolean }>> {
  const ready = await gate("act");
  if (typeof ready === "string") return fail(ready);
  const parsed = Problem.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  const out = await raiseProtectedDispute(ready.deps, {
    arrangementId: parsed.data.arrangementId,
    actorUserId: ready.userId,
    statement: `${PROTECTED_PROBLEM_REASONS[parsed.data.reason]}: ${parsed.data.statement}`,
  });
  refresh(parsed.data.agreementId);
  return actResult(out);
}

/** New transfer details after expiry. The old instruction is never reused. */
export async function newProtectedDetails(input: TargetInput): Promise<ActionResult<{ submitted: boolean }>> {
  const ready = await gate("act");
  if (typeof ready === "string") return fail(ready);
  const parsed = Target.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  const out = await askNewTransferDetails(ready.deps, { arrangementId: parsed.data.arrangementId, actorUserId: ready.userId });
  refresh(parsed.data.agreementId);
  return actResult(out);
}
