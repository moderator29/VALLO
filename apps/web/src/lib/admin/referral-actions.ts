"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { ADMIN_FORBIDDEN_MESSAGE, requireAdmin } from "./guard";
import { budgetMonths } from "./reads/referrals-model";

/**
 * THE REFERRAL DESK'S THREE DECISIONS.
 *
 * Each is one call to a SECURITY DEFINER function that checks `is_staff()`
 * from `auth.uid()`, validates the reason, moves the row through the
 * lifecycle triggers and writes `audit_log` itself:
 *
 *   setReferralBudget   admin_referral_budget_set(month, cap, reason)
 *   decideReferral      admin_referral_decide(referral, approve | reject, reason)
 *   decidePayout        admin_rewards_payout_decide(payout, release | refuse | fail_unsent, reason)
 *
 * This file cannot grant anybody anything. It resolves the session, shapes the
 * input, refuses what the database would refuse before asking, turns a
 * machine answer into a sentence a person can act on, and refreshes the page.
 * Every call goes on the OPERATOR's own client (`userClient`): the functions
 * read `auth.uid()` and are not granted to the service role.
 *
 * NOTHING HERE MOVES MONEY. `release` puts a payout back in the queue the
 * payout partner's sweep reads; it does not call the partner. A reward is
 * paid only when the partner's signed webhook confirms the transfer.
 */

const SERVICE_DOWN = "That could not be recorded just now. Nothing was changed. Please try again.";

const MIN_REASON = 8;

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;

async function door() {
  const access = await requireAdmin();
  if (access.state !== "admin" || access.isStaff) return null;
  return { rpc: access.userClient.rpc.bind(access.userClient) as unknown as Rpc };
}

function refusalOf(error: { code?: string; message?: string } | null): string {
  if (error?.code === "42501") return ADMIN_FORBIDDEN_MESSAGE;
  return SERVICE_DOWN;
}

/* ------------------------------------------------------------------ budget */

const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Choose a month."),
  capMinor: z
    .number()
    .int("Enter the budget in whole naira.")
    .min(0, "A budget cannot be negative.")
    .max(Number.MAX_SAFE_INTEGER, "That is more than a budget can be.")
    .refine((n) => n % 100 === 0, "Enter the budget in whole naira."),
  reason: z.string().trim().min(12, "Say why, in a sentence. This goes on the record.").max(500, "Keep the reason under 500 characters."),
});

export type BudgetSet = { month: string; capMinor: number; committedMinor: number };

export async function setReferralBudget(input: { month: string; capMinor: number; reason: string }): Promise<ActionResult<BudgetSet>> {
  const admin = await door();
  if (!admin) return fail(ADMIN_FORBIDDEN_MESSAGE);

  const parsed = validate(budgetSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  /* A past month's budget is a record, not a setting. */
  const { current, next } = budgetMonths(Date.now());
  if (parsed.data.month !== current && parsed.data.month !== next) {
    return fail("A budget can be set for this month or the next.", { month: "This month or the next." });
  }

  try {
    const { data, error } = await admin.rpc("admin_referral_budget_set", {
      p_month: parsed.data.month,
      p_cap_minor: parsed.data.capMinor,
      p_reason: parsed.data.reason,
    });
    if (error) {
      if (error.code === "22023") return fail("Say why, in a sentence.", { reason: "Say why, in a sentence." });
      return fail(refusalOf(error));
    }
    const d = data as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || typeof d.cap_minor !== "number") return fail(SERVICE_DOWN);
    revalidatePath("/admin/referrals");
    return ok({
      month: parsed.data.month,
      capMinor: Number(d.cap_minor),
      committedMinor: typeof d.committed_minor === "number" ? d.committed_minor : 0,
    });
  } catch {
    return fail(SERVICE_DOWN);
  }
}

/* --------------------------------------------------------------- referrals */

const referralSchema = z.object({
  referralId: z.string().uuid("That referral could not be found."),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(MIN_REASON, "Say why, in a sentence. This goes on the record.").max(500, "Keep the reason under 500 characters."),
});

export type ReferralDecided = { status: "approved" | "reversed" };

export async function decideReferral(input: {
  referralId: string;
  decision: "approve" | "reject";
  reason: string;
}): Promise<ActionResult<ReferralDecided>> {
  const admin = await door();
  if (!admin) return fail(ADMIN_FORBIDDEN_MESSAGE);

  const parsed = validate(referralSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    const { data, error } = await admin.rpc("admin_referral_decide", {
      p_referral: parsed.data.referralId,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason,
    });
    if (error) {
      if (error.code === "22023") return fail("Say why, in a sentence.", { reason: "Say why, in a sentence." });
      return fail(refusalOf(error));
    }
    if (data === "not_found") return fail("That referral could not be found. It may have been removed.");
    /* Migration 20261021104453_nobody_decides_their_own_case_refunds_referrals_payouts_badges. */
    if (data === "own_referral") return fail("You made or received this invite, so somebody else has to decide it. Nothing was changed.");
    if (data === "refused") {
      return fail("That referral is no longer waiting on a decision. Somebody may have decided it already. Nothing was changed.");
    }
    /* Approve lands on approved. Reject reverses the reward, so it lands on reversed. */
    const expected = parsed.data.decision === "approve" ? "approved" : "reversed";
    if (data !== expected) return fail(SERVICE_DOWN);
    revalidatePath("/admin/referrals");
    return ok({ status: expected });
  } catch {
    return fail(SERVICE_DOWN);
  }
}

/* ----------------------------------------------------------------- payouts */

const payoutSchema = z
  .object({
    payoutId: z.string().uuid("That payout could not be found."),
    decision: z.enum(["release", "refuse", "fail_unsent"]),
    reason: z.string().trim().min(MIN_REASON, "Say why, in a sentence. This goes on the record.").max(500, "Keep the reason under 500 characters."),
  })
  .superRefine((value, ctx) => {
    /* The database asks for more when a payout is marked never sent: what the provider's dashboard showed. */
    if (value.decision === "fail_unsent" && value.reason.length < 20) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Say what the payout partner's dashboard showed." });
    }
  });

export type PayoutDecided = { status: "processing" | "failed" };

export async function decidePayout(input: {
  payoutId: string;
  decision: "release" | "refuse" | "fail_unsent";
  reason: string;
}): Promise<ActionResult<PayoutDecided>> {
  const admin = await door();
  if (!admin) return fail(ADMIN_FORBIDDEN_MESSAGE);

  const parsed = validate(payoutSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    const { data, error } = await admin.rpc("admin_rewards_payout_decide", {
      p_payout: parsed.data.payoutId,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason,
    });
    if (error) {
      if (error.code === "22023") {
        const message =
          parsed.data.decision === "fail_unsent" ? "Say what the payout partner's dashboard showed." : "Say why, in a sentence.";
        return fail(message, { reason: message });
      }
      return fail(refusalOf(error));
    }
    if (data === "own_payout") return fail("This is your own payout, so somebody else has to decide it. Nothing was changed.");
    if (data === "no_recipient") {
      return fail("This payout has no recipient with the payout partner yet, so it cannot be released. Nothing was changed.");
    }
    if (data === "chargeback_hold") {
      return fail(
        "This member has a lost chargeback still owed, so the payout stays held. Nothing was changed. Finance can override it for this payout, with a reason, on the chargebacks desk.",
      );
    }
    if (data === "refused") {
      return fail(
        parsed.data.decision === "fail_unsent"
          ? "That payout is not old enough to mark as never sent, or it has already settled. Nothing was changed."
          : "That payout is no longer waiting on a decision. Somebody may have decided it already. Nothing was changed.",
      );
    }
    const expected = parsed.data.decision === "release" ? "processing" : "failed";
    if (data !== expected) return fail(SERVICE_DOWN);
    revalidatePath("/admin/referrals");
    return ok({ status: expected });
  } catch {
    return fail(SERVICE_DOWN);
  }
}
