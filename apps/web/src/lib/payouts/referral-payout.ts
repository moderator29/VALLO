import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import "server-only";

import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { PHONE_REQUIRED_MESSAGE, confirmedPhoneLookup, requireConfirmedPhone } from "../identity/phone-gate";
import { resolveBankAccountName } from "../payments/bank-resolve";
import { consume, subjectForUser } from "../security/rate-limit";
import { hasServiceRole } from "../security/service-rpc";
import { createAdminClient } from "../supabase/admin";
import {
  floatTransferDeps,
  recordTransferWebhook,
  runRewardsPayout,
  sendOpenedPayout,
  settleFromProvider,
  type PayoutDb,
} from "./referral-payout-core";

/**
 * THE REWARDS BALANCE PAYOUT (D51): server action, webhook settlement, sweep.
 *
 * Order of events, every one of them server-side:
 *   1. the bank resolves the account name (never the member's typing);
 *   2. `rewards_payout_open` holds the available rewards in the append-only
 *      ledger and mints an idempotent reference, or routes to review;
 *   3. a Paystack transfer recipient and a transfer from the MARKETING FLOAT
 *      account's balance under that reference;
 *   4. "sent" once the transfer is initiated; PAID ONLY on the signed
 *      `transfer.success` webhook (`public.rewards_payout_webhook`), never on
 *      the transfer API's answer or `/transfer/verify` (D62). Failed only on
 *      the `transfer.failed`/`transfer.reversed` webhook or a staff decision;
 *      the sweep's verify alerts staff and releases nothing. A timeout is
 *      `unknown`, never `failed`.
 *
 * PAYOUTS ARE OFF BY DEFAULT. The float is Vallo's own money and must not be
 * the main Paystack balance, which holds customer settlement money. No
 * separate float account exists yet, so a withdrawal answers "not available
 * yet" and sends nothing unless BOTH hold: `PAYSTACK_FLOAT_SECRET_KEY` (the
 * float account's own key, never the main key) is set, and the dated policy
 * row in force has `payouts_enabled = true` (checked in
 * `rewards_payout_open`). The verify route still needs confirming against
 * Paystack's docs before that flag is turned on (see `referral-transfer.ts`).
 *
 * The webhook route (`app/api/paystack/webhook/route.ts`) hands every
 * `transfer.*` event for a `vallo-rw-` reference to `settleRewardsTransferEvent`.
 */

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

function adminDb(): PayoutDb {
  const admin = createAdminClient() as unknown as Rpc;
  return {
    async open(input) {
      const { data, error } = await admin.rpc("rewards_payout_open", {
        p_member: input.memberId,
        p_bank_code: input.bankCode,
        p_account_number: input.accountNumber,
        p_account_name: input.accountName,
        p_recipient_code: input.recipientCode,
      });
      if (error || !data || typeof data !== "object") return { status: "error" };
      return data as Awaited<ReturnType<PayoutDb["open"]>>;
    },
    async settle(input) {
      const { error } = await admin.rpc("rewards_payout_settle", {
        p_reference: input.reference,
        p_outcome: input.outcome,
        p_provider_status: input.providerStatus ?? null,
        p_transfer_code: input.transferCode ?? null,
        p_recipient_code: input.recipientCode ?? null,
        p_reason: input.reason ?? null,
      });
      return !error;
    },
    async webhook(input) {
      const { data, error } = await admin.rpc("rewards_payout_webhook", {
        p_reference: input.reference,
        p_event: input.event,
        p_amount_minor: input.amountMinor,
        p_transfer_code: input.transferCode,
        p_payload: input.payload,
      });
      if (error || !data || typeof data !== "object") return null;
      return data as { status: string; outcome?: string; duplicate?: boolean };
    },
    async claimSend(reference) {
      const { data, error } = await admin.rpc("rewards_payout_claim_send", { p_reference: reference });
      return !error && data === true;
    },
  };
}

const payoutSchema = z.object({
  bankCode: z.string().trim().min(1, "Choose your bank.").max(12),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{10}$/.test(v), "A Nigerian account number is exactly ten digits."),
});

const MESSAGES = {
  phone_required: "Confirm your phone number in Settings before you withdraw your Rewards Balance.",
  below_minimum: "Your Rewards Balance has not reached the withdrawal minimum yet.",
  already_open: "A withdrawal from your Rewards Balance is already on its way.",
  not_confirmed: "We could not confirm that account with the bank. Check the number and the bank.",
  unreachable: "We could not reach the bank just now. Nothing was sent. Please try again.",
  not_available: "Withdrawals from your Rewards Balance are not available yet. Nothing has left your Rewards Balance and nothing was sent.",
  error: "Your withdrawal could not be started. Nothing was sent.",
  invalid: "Your withdrawal could not be started. Nothing was sent.",
} as const;

/** "sent" until the webhook confirms; the member is never told "paid" here. */
export type RewardsPayoutResult = { status: "sent" | "under_review" | "unknown"; amountMinor: number };

/** The member asks for their Rewards Balance to be paid to a bank account. */
export async function requestRewardsPayout(input: unknown): Promise<ActionResult<RewardsPayoutResult>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  /* A passcode-locked session moves no money (docs/PASSCODE.md). */
  const lockedOut = await passcodeMoneyRefusal(session.user.id);
  if (lockedOut) return fail(lockedOut);
  const parsed = validate(payoutSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (!hasServiceRole()) return fail(NOT_CONFIGURED_MESSAGE);
  const transfer = floatTransferDeps();
  if (!transfer) return fail(MESSAGES.not_available);

  const verdict = await consume({
    bucket: "rewards_payout",
    subject: subjectForUser(session.user.id),
    limit: 5,
    windowSeconds: 3600,
  });
  if (!verdict.allowed || verdict.degraded) return fail("Too many attempts. Please wait an hour and try again.");

  const phone = await requireConfirmedPhone(confirmedPhoneLookup(createAdminClient()), session.user.id);
  if (!phone.ok) return fail(phone.reason === "phone_required" ? PHONE_REQUIRED_MESSAGE : MESSAGES.error);

  const resolved = await resolveBankAccountName(parsed.data);
  if (!resolved.ok) {
    return fail(resolved.failure === "not-confirmed" ? MESSAGES.not_confirmed : MESSAGES.unreachable);
  }

  const outcome = await runRewardsPayout(
    { db: adminDb(), transfer },
    {
      memberId: session.user.id,
      bankCode: parsed.data.bankCode,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
    },
  );
  if (outcome.kind === "refused") return fail(MESSAGES[outcome.reason]);
  return ok({ status: outcome.status, amountMinor: outcome.amountMinor });
}

/**
 * For the Paystack webhook, after its signature check. "ignored" for an event
 * or reference this file does not own, so the route can carry on as before.
 * Needs only the service role, not the float key: recording what the provider
 * says never moves money.
 */
export async function settleRewardsTransferEvent(
  event: string,
  data: unknown,
): Promise<"recorded" | "incident" | "duplicate" | "ignored" | "error"> {
  if (!hasServiceRole()) return "error";
  return recordTransferWebhook(adminDb(), event, data);
}

/**
 * The cron sweep (wiring is the cron lane's): send payouts that were opened
 * or released from review but never initiated, ask Paystack about every
 * payout still in flight, and raise an alert for any older than a day so
 * none sits in processing forever unseen.
 */
export async function sweepRewardsPayouts(): Promise<{ sent: number; checked: number; stuck: number }> {
  if (!hasServiceRole()) return { sent: 0, checked: 0, stuck: 0 };
  const admin = createAdminClient() as unknown as Rpc;
  const stuckRes = await admin.rpc("rewards_payouts_stuck", { p_older_than_hours: 24 });
  const stuck = Array.isArray(stuckRes.data) ? stuckRes.data.length : 0;
  if (stuck > 0) console.error(`rewards payouts: ${stuck} in flight for more than 24 hours; staff must look`);
  const transfer = floatTransferDeps();
  if (!transfer) return { sent: 0, checked: 0, stuck };
  const deps = { db: adminDb(), transfer };

  const toSend = await admin.rpc("rewards_payouts_to_send", { p_older_than_minutes: 2 });
  const sendRows = Array.isArray(toSend.data)
    ? (toSend.data as { reference: string; amount_minor: number | string; recipient_code: string }[])
    : [];
  let sent = 0;
  for (const r of sendRows) {
    const amountMinor = Number(r.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || !r.recipient_code) continue;
    const out = await sendOpenedPayout(deps, { reference: r.reference, amountMinor, recipientCode: r.recipient_code });
    if (out !== "skipped") sent += 1;
  }

  const { data } = await admin.rpc("rewards_payouts_to_verify", { p_older_than_minutes: 10 });
  const rows = Array.isArray(data) ? (data as { reference: string }[]) : [];
  for (const r of rows) await settleFromProvider(deps, r.reference);
  return { sent, checked: rows.length, stuck };
}
