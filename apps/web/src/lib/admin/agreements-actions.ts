"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@vallo/i18n";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { getLocale } from "../locale";
import { parseNairaToKobo } from "../money/amount";
import { adminRefusal, requireAdmin } from "./guard";
import { KillSwitchInput, RiskSettingsInput, settingsAnswer, settingsRpcArgs } from "./risk-settings";

/**
 * THE ADMIN GATE BETWEEN AGREEMENT AND PAYMENT, AND THE GUARANTEE DECISIONS.
 *
 * Every call runs as the signed-in reviewer through their own client, so the
 * database functions see `auth.uid()` and decide for themselves whether this
 * person may act (`private.staff_can`), refuse a reviewer who is a party to
 * the agreement, write the decision to `deal_agreement_events` and
 * `audit_log`, and tell both parties by notification and email. Nothing here
 * is the only check; it is the first one, so a person gets a sentence rather
 * than a status code.
 */

const uuid = z.string().uuid("That is not an id we recognise.");

const AGREEMENT_WORDS: Record<string, string> = {
  forbidden: "Your account cannot review agreements.",
  bad_decision: "Choose approve or reject.",
  reason_required: "Say why in at least ten characters. Both parties read it.",
  reason_too_long: "Keep the reason under 1,000 characters.",
  not_found: "That agreement no longer exists.",
  not_in_review: "That agreement is no longer waiting for review. Refresh the queue.",
  own_agreement: "You are a party to this agreement, so somebody else has to review it.",
};

export async function decideAgreement(input: {
  agreementId: string;
  decision: "approve" | "reject";
  reason?: string;
}): Promise<ActionResult<{ status: string }>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(
    z.object({
      agreementId: uuid,
      decision: z.enum(["approve", "reject"]),
      reason: z.string().trim().max(1000, "Keep the reason under 1,000 characters.").optional(),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_decide_agreement" as never, {
    p_agreement: parsed.data.agreementId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason ?? null,
  } as never);
  if (error) return fail("That decision could not be recorded. Nothing changed. Try again.");
  const status = String((data as Record<string, unknown> | null)?.status ?? "");
  if (status !== "ok") return fail(AGREEMENT_WORDS[status] ?? "That decision could not be recorded.");
  revalidatePath("/admin/agreements");
  return ok({ status: String((data as Record<string, unknown>).agreement_status ?? "") });
}

/* D77: the risk settings screen. The database checks the scope, validates and audits. */
export async function saveRiskSettings(input: RiskSettingsInput): Promise<ActionResult<null>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(RiskSettingsInput, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const args = settingsRpcArgs(parsed.data);
  if (!args.ok) return fail(args.error);
  const { data, error } = await access.userClient.rpc("admin_update_risk_settings" as never, args.args as never);
  if (error) return fail("The settings could not be saved. Nothing changed. Try again.");
  const refusal = settingsAnswer(data);
  if (refusal) return fail(refusal);
  revalidatePath("/admin/agreements");
  revalidatePath("/admin/agreements/settings");
  return ok(null);
}

export async function setReviewKillSwitch(input: { on: boolean; reason: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(KillSwitchInput, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_set_review_kill_switch" as never, {
    p_on: parsed.data.on,
    p_reason: parsed.data.reason,
  } as never);
  if (error) return fail("The switch could not be moved. Nothing changed. Try again.");
  const refusal = settingsAnswer(data);
  if (refusal) return fail(refusal);
  revalidatePath("/admin/agreements");
  revalidatePath("/admin/agreements/settings");
  return ok(null);
}

/* D68d: Vallo reviews during the hold and can pause a release while it looks. */
const PAUSE_WORDS: Record<string, string> = {
  forbidden: "Your account cannot pause releases.",
  reason_required: "Say why in at least ten characters.",
  not_found: "That payment no longer exists.",
  final: "That payment is already settled; there is nothing to pause.",
};

export async function pauseRelease(input: { arrangementId: string; reason: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(z.object({ arrangementId: uuid, reason: z.string().trim().min(10, PAUSE_WORDS.reason_required!).max(1000) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_pause_release" as never, {
    p_arrangement: parsed.data.arrangementId,
    p_reason: parsed.data.reason,
  } as never);
  if (error) return fail("The pause could not be recorded. Nothing changed. Try again.");
  const status = String((data as Record<string, unknown> | null)?.status ?? "");
  if (status !== "ok") return fail(PAUSE_WORDS[status] ?? "The pause could not be recorded.");
  revalidatePath("/admin/agreements");
  return ok(null);
}

export async function resumeRelease(input: { arrangementId: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(z.object({ arrangementId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_resume_release" as never, {
    p_arrangement: parsed.data.arrangementId,
  } as never);
  if (error) return fail("The release could not be resumed. Nothing changed. Try again.");
  const status = String((data as Record<string, unknown> | null)?.status ?? "");
  if (status !== "ok") return fail(PAUSE_WORDS[status] ?? "The release could not be resumed.");
  revalidatePath("/admin/agreements");
  return ok(null);
}

/*
 * A held payment decided by a person (founder instruction, 13 October 2026:
 * refund or dispute). With no rail able to carry the decision, the action
 * answers that the partner is not configured and nothing moves. Nothing is
 * recorded as moved here.
 */
const RESOLVE_WORDS: Record<string, string> = {
  switched_off: "The payment partner is not configured here, so nothing can be asked of it.",
  not_found: "That payment no longer exists, or the partner has not reported it yet.",
  not_held: "That payment is not held right now; there is nothing to decide.",
  provider_refused: "The payment partner refused. Nothing moved; read its record before trying again.",
  unknown: "The payment partner did not answer. Do not try again until its record says what happened.",
  own_payment: "You are a party to this payment, so somebody else has to decide it.",
  store: "That could not be recorded. Nothing moved. Try again.",
  chargeback_hold:
    "The lister has a lost chargeback still owed, so the release is paused. Nothing moved. Finance can override it for this payment, with a reason, on the chargebacks desk.",
  release_paused: "The release of this payment is paused. Resume it first, then decide. Nothing moved.",
};

export async function resolveHeldPayment(input: {
  arrangementId: string;
  outcome: "refund" | "release";
  note: string;
}): Promise<ActionResult<{ to: "refunded" | "released" }>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(
    z.object({
      arrangementId: uuid,
      outcome: z.enum(["refund", "release"]),
      note: z.string().trim().min(10, "Say why in at least ten characters. Both parties read it.").max(500),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* The previous rail's resolve road was removed (founder, 10 November 2026).
     The new protected rail has no staff-resolve road until its provider's
     documentation arrives, so nothing can be asked of it and nothing moves. */
  return fail(RESOLVE_WORDS.switched_off!);
}

const CLAIM_WORDS: Record<string, string> = {
  forbidden: "Your account cannot decide Guarantee claims.",
  reason_required: "Say why in at least ten characters. The claimant reads it.",
  not_found: "That claim no longer exists.",
  already_decided: "That claim was already decided. Refresh.",
  own_claim: "You are a party to this agreement, so somebody else has to decide the claim.",
  bad_amount: "Enter the amount to pay from the Guarantee.",
  reference_required: "Enter the bank transfer reference for this payout.",
  not_approved: "Only an approved claim can be marked paid.",
};

/**
 * The payout rule's refusal (migration fm02): the claimant owes a lost card
 * chargeback, so approving or marking paid answers `chargeback_hold` until
 * finance overrides that one claim on /admin/chargebacks/<id>.
 */
async function claimHeldWords(): Promise<{ approve: string; markPaid: string }> {
  return getDictionary(await getLocale()).chargebacks.override.claimHeld;
}

export async function decideClaim(input: {
  claimId: string;
  decision: "approve" | "reject";
  amountNaira?: string;
  reason?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("guarantee");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(
    z.object({
      claimId: uuid,
      decision: z.enum(["approve", "reject"]),
      amountNaira: z.string().trim().max(30).optional(),
      reason: z.string().trim().max(1000).optional(),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  let amount: number | null = null;
  if (parsed.data.decision === "approve") {
    amount = parseNairaToKobo(parsed.data.amountNaira ?? "");
    if (amount === null || amount <= 0) return fail(CLAIM_WORDS.bad_amount!, { amountNaira: CLAIM_WORDS.bad_amount! });
  }
  const { data, error } = await access.userClient.rpc("admin_decide_guarantee_claim" as never, {
    p_claim: parsed.data.claimId,
    p_decision: parsed.data.decision,
    p_amount_minor: amount,
    p_reason: parsed.data.reason ?? null,
  } as never);
  if (error) return fail("That decision could not be recorded. Nothing changed. Try again.");
  const answer = (data ?? {}) as Record<string, unknown>;
  const status = String(answer.status ?? "");
  if (status === "over_cap") {
    const naira = (minor: unknown) => `₦${(Number(minor ?? 0) / 100).toLocaleString("en-NG")}`;
    return fail(
      `At most ${naira(answer.cap_minor)} can be paid on this claim: the claim asked ${naira(answer.requested_minor)}, the booking has ${naira(answer.booking_left_minor)} left to claim against, and the Guarantee reserve holds ${naira(answer.reserve_minor)}.`,
    );
  }
  if (status === "chargeback_hold") return fail((await claimHeldWords()).approve);
  if (status !== "ok") return fail(CLAIM_WORDS[status] ?? "That decision could not be recorded.");
  revalidatePath("/admin/money");
  return ok(null);
}

export async function markClaimPaid(input: { claimId: string; reference: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("guarantee");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(z.object({ claimId: uuid, reference: z.string().trim().min(4).max(100) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_mark_guarantee_claim_paid" as never, {
    p_claim: parsed.data.claimId,
    p_bank_reference: parsed.data.reference,
  } as never);
  if (error) return fail("That could not be recorded. Nothing changed. Try again.");
  const status = String((data as Record<string, unknown> | null)?.status ?? "");
  if (status === "chargeback_hold") return fail((await claimHeldWords()).markPaid);
  if (status !== "ok") return fail(CLAIM_WORDS[status] ?? "That could not be recorded.");
  revalidatePath("/admin/money");
  return ok(null);
}
