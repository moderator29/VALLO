"use server";

/**
 * THE PROTECTED PAYMENT SCREENS' FIVE ACTIONS (spec two, screens 3 to 8).
 * Thin on purpose: the session, a rate limit and the input, then the server
 * steps in `protected-rail.ts`, which hold the money rules.
 *
 * FAIL CLOSED. Every action refuses, before reading anything, while the rail
 * is switched off (`escrowPayEnabled()`, `payments_escrowpay_on`, fail
 * closed). The switch is off today, so none of these can do anything on any
 * deployment; what else stops money is in the adapter's README.
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
import { PROTECTED_ACTION_REFUSED, PROTECTED_IDENTITY_ALREADY_USED, PROTECTED_IDENTITY_RESULT, PROTECTED_PROBLEM_REASONS, PROTECTED_START_REFUSED } from "./copy";
import { adminDb } from "./member-wallet";
import { onboardMember } from "./protected-provider";
import {
  askNewTransferDetails,
  confirmProtectedMilestone,
  openProtectedPayment,
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
  /* Each try is a real lookup against a person's record: a handful a day. */
  identity: { bucket: "protected_identity_check", limit: 5, windowSeconds: 86_400 },
} as const;

type Ready = { userId: string; email: string | null; deps: ProtectedRailDeps };

/** Whether the rail is on at all: verified against the provider, and the founder's switch on. Fails closed. */
async function railOn(): Promise<boolean> {
  try {
    return DOCUMENTED && (await escrowPayEnabled());
  } catch {
    return false;
  }
}

/** The gate every action passes first, in this order: rail, input, session, limit. */
async function gate(kind: keyof typeof LIMITS): Promise<Ready | string> {
  if (!(await railOn())) return PROTECTED_ACTION_REFUSED.rail_off;
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
  return { userId: session.user.id, email: session.user.email ?? null, deps };
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

/* --------------------------------------------- identity, and the open */

const Identity = z.object({
  kind: z.enum(["nin", "bvn"]),
  /* A NIN and a BVN are both eleven digits. */
  identifier: z.string().trim().regex(/^\d{11}$/),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consent: z.literal(true),
});
type IdentityInput = z.input<typeof Identity>;

/** Whole years between a date of birth and today in Lagos; null for a date that is not one. */
function ageOn(dateOfBirth: string, now: number): number | null {
  const born = Date.parse(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(born) || new Date(born).toISOString().slice(0, 10) !== dateOfBirth) return null;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
}

/**
 * The member's one identity check, asked for by the holder of the money
 * before a first protected payment. The number and the date of birth go
 * straight to the check and are kept nowhere: not in a row, a log or an
 * alert. The member consents on the screen, in their own tap.
 */
export async function verifyProtectedIdentity(input: IdentityInput): Promise<ActionResult<{ verified: true }>> {
  if (!(await railOn())) return fail(PROTECTED_ACTION_REFUSED.rail_off);
  /* Read before the limit is counted: a mistyped number is not one of the day's tries. */
  const parsed = Identity.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_IDENTITY_RESULT.bad_input);
  const age = ageOn(parsed.data.dateOfBirth, Date.now());
  if (age === null || age > 120) return fail(PROTECTED_IDENTITY_RESULT.bad_input);
  if (age < 18) return fail(PROTECTED_IDENTITY_RESULT.under_age);
  const ready = await gate("identity");
  if (typeof ready === "string") return fail(ready);
  if (!ready.email) return fail(PROTECTED_IDENTITY_RESULT.no_email);
  const locked = await passcodeMoneyRefusal(ready.userId);
  if (locked) return fail(locked);
  const out = await onboardMember(ready.deps, {
    userId: ready.userId,
    kind: parsed.data.kind,
    identifier: parsed.data.identifier,
    dateOfBirth: parsed.data.dateOfBirth,
    email: ready.email,
    name: null,
    phone: null,
  });
  if (out.state === "verified") return ok({ verified: true });
  if (out.state === "needs_review") {
    await recordAlert({ kind: "protected_rail.identity_needs_review", severity: "warning", detail: { user_id: ready.userId, kind: parsed.data.kind } });
    return fail(PROTECTED_IDENTITY_RESULT.needs_review);
  }
  if (out.state === "already_used") {
    await recordAlert({ kind: "protected_rail.identity_already_used", severity: "warning", detail: { user_id: ready.userId, kind: parsed.data.kind } });
    return fail(PROTECTED_IDENTITY_ALREADY_USED);
  }
  if (out.state === "not_matched") return fail(PROTECTED_IDENTITY_RESULT.not_matched);
  if (out.state === "bad_input") return fail(PROTECTED_IDENTITY_RESULT.bad_input);
  return fail(PROTECTED_IDENTITY_RESULT.unavailable);
}

const Start = z.object({ agreementId: z.string().uuid(), acceptedVersion: z.number().int().min(1) });

export type StartProtectedResult =
  /** The payment is open: the funding page now shows the transfer details. */
  | { state: "opened" }
  /** Made, and still being set up with the provider: the funding page follows it. */
  | { state: "pending" }
  /** The payer has not been checked yet: the identity step comes first. */
  | { state: "identity" };

/**
 * "Agree and continue" (spec screen 2): opens the protected payment on the
 * exact agreement version the payer was shown. Opens nothing for a payer
 * whose identity the provider has not checked, and says so.
 */
export async function startProtected(input: z.input<typeof Start>): Promise<ActionResult<StartProtectedResult>> {
  const ready = await gate("act");
  if (typeof ready === "string") return fail(ready);
  const parsed = Start.safeParse(input);
  if (!parsed.success) return fail(PROTECTED_ACTION_REFUSED.bad_input);
  const locked = await passcodeMoneyRefusal(ready.userId);
  if (locked) return fail(locked);
  const out = await openProtectedPayment(ready.deps, { ...parsed.data, actorUserId: ready.userId });
  refresh(parsed.data.agreementId);
  if (out.outcome === "opened" || out.outcome === "existing") return ok({ state: "opened" });
  if (out.outcome === "unknown") return ok({ state: "pending" });
  if (out.outcome === "failed") return fail(PROTECTED_ACTION_REFUSED.unavailable);
  if (out.reason === "payer_identity_required") return ok({ state: "identity" });
  if (out.reason === "lister_not_ready") return fail(PROTECTED_START_REFUSED.lister_not_ready);
  if (out.reason === "agreement_changed") return fail(PROTECTED_START_REFUSED.agreement_changed);
  if (out.reason === "card_payment_started") return fail(PROTECTED_START_REFUSED.card_payment_started);
  if (out.reason === "category_not_approved" || out.reason === "not_offered" || out.reason === "not_escrow" || out.reason === "not_payable") {
    return fail(PROTECTED_START_REFUSED.not_offered);
  }
  return fail(refusal(out.reason));
}
