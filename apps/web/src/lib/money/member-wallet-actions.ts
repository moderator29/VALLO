"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { guardMoney } from "../security/money-limits";
import { accountNumberSchema, sameAccountName } from "../payments/bank-resolve";
import { needsOtp } from "../payments/providers/payluk-client";
import { memberWalletRailLive } from "../payments/providers";
import { provisionWallet, type OpenResult } from "./wallet-provision";
import type { HostedCollection, RailFailure } from "../payments/provider";
import { parseNairaToKobo } from "./amount";
import { REFUSAL } from "./balance-copy";
import {
  INTENT_MIN_KOBO,
  MOVE_MAX_KOBO,
  WITHDRAWAL_MIN_KOBO,
  isOpenMovement,
  lastFour,
  movementReference,
  normalisePhone,
  withdrawalBreakdown,
  type WithdrawalBreakdown,
} from "./funds";
import {
  MOVEMENT_COLUMNS,
  adminDb,
  loadAccount,
  loadMovement,
  movementView,
  observe,
  readBack,
  reportedBalance,
  walletProvider,
  type Db,
  type MovementRow,
  type MovementView,
  type WalletProvider,
} from "./member-wallet";

/**
 * THE MEMBER BALANCE ACTIONS (Part B phases 5 and 7 to 10).
 *
 * Every money-moving action follows the same rules (founder sections 28, 31, 46):
 *  1. The screen sends a `clientKey` it generated when the form opened. The
 *     row is unique on (member, clientKey), so a double tap, a retried post
 *     or a replay finds the row already made and moves nothing new.
 *  2. The row and its reference exist BEFORE the provider is called; the
 *     reference is derived from the row id, so the provider sees one
 *     transaction however often Vallo asks.
 *  3. Staging an intent moves no money. Submitting it does, and only one
 *     caller can submit: the row is claimed `awaiting_confirmation ->
 *     processing` in one locked statement first.
 *  4. No answer from a submit is UNKNOWN. It is never retried; it is read
 *     back (`readBack`) until the provider says what happened.
 *  5. Nothing is "completed" until the provider says so by webhook or by
 *     read-back. The database refuses anything else.
 *  6. Every fee shown is the one the provider set on this intent.
 */

type Ready = { db: Db; provider: WalletProvider; userId: string; customerId: string };

/* The rate guard is not in here: every action calls `guardMoney` itself, with
   its own action named, so the call-site test can see each one is spent. */
async function ready(): Promise<{ ok: true; ctx: Ready } | { ok: false; error: string }> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { ok: false, error: "Sign in to continue." };
  if ((await memberWalletRailLive()) !== "live") return { ok: false, error: REFUSAL.notLive };
  const db = adminDb();
  const provider = walletProvider();
  if (!db || !provider) return { ok: false, error: REFUSAL.notLive };
  const account = await loadAccount(db, session.user.id);
  if (!account || account.status !== "ACTIVE" || !account.provider_customer_id) return { ok: false, error: REFUSAL.notActive };
  return { ok: true, ctx: { db, provider, userId: session.user.id, customerId: account.provider_customer_id } };
}

function refusalFor(f: RailFailure): string {
  switch (f.kind) {
    case "rate_limited":
      return REFUSAL.busy;
    case "unavailable":
    case "unreadable":
      return REFUSAL.unavailable;
    case "not_configured":
      return REFUSAL.notLive;
    case "unknown":
      return REFUSAL.submittedUnknown;
    default:
      return REFUSAL.refused;
  }
}

function amountFrom(raw: string, minimum: number): { ok: true; minor: number } | { ok: false; error: string } {
  const minor = parseNairaToKobo(raw);
  if (minor === null || minor <= 0) return { ok: false, error: REFUSAL.amountInvalid };
  if (minor < minimum) return { ok: false, error: minimum === WITHDRAWAL_MIN_KOBO ? REFUSAL.belowWithdrawalMinimum : REFUSAL.belowMinimum };
  if (minor > MOVE_MAX_KOBO) return { ok: false, error: REFUSAL.aboveMaximum };
  return { ok: true, minor };
}

/* ---------------------------------------------------------- onboarding */

/**
 * Open the member's balance at the provider (founder sections 8 and 9). The
 * work is `provisionWallet`, shared with the moment a phone number is
 * confirmed, where the wallet now opens by itself.
 */
export async function openBalanceAccount(): Promise<ActionResult<OpenResult>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to continue.");
  return provisionWallet(session.user);
}

/* --------------------------------------------------------------- banks */

export async function listBalanceBanks(): Promise<ActionResult<{ banks: { name: string; code: string }[] }>> {
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceLookup", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const banks = await r.ctx.provider.listBanks();
  if (!banks.ok) return fail(refusalFor(banks));
  return ok({ banks: banks.value.sort((a, b) => a.name.localeCompare(b.name)) });
}

const accountInput = z.object({
  bankCode: z.string().trim().min(1).max(20),
  bankName: z.string().trim().min(1).max(80),
  accountNumber: accountNumberSchema,
});

/** Phase 9: the provider resolves the name; a member never withdraws to an account it did not. */
export async function checkBalanceBankAccount(input: unknown): Promise<ActionResult<{ accountName: string }>> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? REFUSAL.accountNotFound);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceLookup", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const v = await r.ctx.provider.resolveAccount(r.ctx.customerId, parsed.data);
  if (v.ok) return ok({ accountName: v.value.accountName });
  if (v.kind === "refused" || v.kind === "not_found") return fail(REFUSAL.accountNotFound);
  if (v.kind === "rate_limited") return fail(REFUSAL.busy);
  return fail(REFUSAL.accountUnreachable);
}

/* ------------------------------------------------------------- shared */

export type Quote = {
  movementId: string;
  reference: string;
  breakdown: WithdrawalBreakdown;
  destination: { title: string; detail: string };
  status: MovementView["status"];
};

function quoteFrom(m: MovementRow): Quote {
  const cp = m.counterparty ?? {};
  return {
    movementId: m.id,
    reference: m.reference,
    breakdown: withdrawalBreakdown({ amountMinor: Number(m.amount_minor), providerFeeMinor: Number(m.provider_fee_minor ?? 0) }),
    destination:
      m.kind === "withdrawal"
        ? { title: cp.name ?? "", detail: `${cp.bank ?? ""} •••• ${cp.last4 ?? ""}`.trim() }
        : { title: cp.name ?? "", detail: "Vallo member" },
    status: m.status,
  };
}

async function existingByKey(db: Db, userId: string, clientKey: string): Promise<MovementRow | null> {
  const { data } = await db.from("funds_movements").select(MOVEMENT_COLUMNS).eq("user_id", userId).eq("client_key", clientKey).maybeSingle();
  return (data as MovementRow | null) ?? null;
}

/**
 * Make the row, then stage the intent, then read the fee back. A repeated
 * clientKey returns the row already made. A stage with no answer moved no
 * money (staging never does), so it is cancelled rather than guessed at.
 */
async function stage(
  ctx: Ready,
  clientKey: string,
  row: { kind: "withdrawal" | "transfer_out" | "deposit"; amountMinor: number; counterparty: Record<string, string>; narration: string | null },
  intent: (reference: string) => Parameters<WalletProvider["stageIntent"]>[1],
): Promise<ActionResult<{ row: MovementRow; hosted: HostedCollection | null }>> {
  const prior = await existingByKey(ctx.db, ctx.userId, clientKey);
  if (prior) return ok({ row: prior, hosted: null });

  const id = randomUUID();
  const reference = movementReference(row.kind, id);
  const { error } = await ctx.db.from("funds_movements").insert({
    id,
    user_id: ctx.userId,
    provider: "payluk",
    kind: row.kind,
    reference,
    client_key: clientKey,
    amount_minor: row.amountMinor,
    counterparty: row.counterparty,
    narration: row.narration,
  });
  if (error) {
    const again = await existingByKey(ctx.db, ctx.userId, clientKey);
    return again ? ok({ row: again, hosted: null }) : fail(REFUSAL.generic);
  }

  const staged = await ctx.provider.stageIntent(ctx.customerId, intent(reference));
  if (!staged.ok) {
    await observe(ctx.db, reference, "cancelled", "vallo", { detail: { stage_failure: staged.kind } });
    return fail(staged.kind === "unknown" ? REFUSAL.stagedUnknown : refusalFor(staged));
  }
  const to = row.kind === "deposit" ? "awaiting_payment" : "awaiting_confirmation";
  await observe(ctx.db, reference, to, "provider_response", {
    providerStatus: staged.value.status,
    providerTransactionId: staged.value.providerId || undefined,
    providerFeeMinor: staged.value.feeMinor,
  });
  const fresh = await loadMovement(ctx.db, ctx.userId, id);
  return fresh ? ok({ row: fresh, hosted: staged.value.hosted }) : fail(REFUSAL.generic);
}

/**
 * Before money moves: Available as the provider reports it now, read once
 * per preparation (ten requests a minute serve the whole platform), then
 * checked against the amount and again against the amount plus the fee.
 */
async function freshAvailable(ctx: Ready): Promise<number | null> {
  const { reported, failure } = await reportedBalance(ctx.db, ctx.provider, ctx.userId, ctx.customerId, { force: true });
  return failure || !reported ? null : reported.availableMinor;
}

/* ---------------------------------------------------------- withdrawal */

const withdrawInput = accountInput.extend({
  clientKey: z.string().uuid(),
  amount: z.string().max(20),
  /** The name the member was shown and agreed to. Checked again here, never trusted. */
  shownAccountName: z.string().trim().min(1).max(120),
});

/** Phase 8, steps 1 to 9: verify again, check the balance, stage, read the fee back. */
export async function prepareWithdrawal(input: unknown): Promise<ActionResult<Quote>> {
  const parsed = withdrawInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? REFUSAL.refused);
  const amount = amountFrom(parsed.data.amount, WITHDRAWAL_MIN_KOBO);
  if (!amount.ok) return fail(amount.error);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceMove", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const ctx = r.ctx;

  const prior = await existingByKey(ctx.db, ctx.userId, parsed.data.clientKey);
  if (prior) return ok(quoteFrom(prior));

  const resolved = await ctx.provider.resolveAccount(ctx.customerId, parsed.data);
  if (!resolved.ok) return fail(resolved.kind === "refused" || resolved.kind === "not_found" ? REFUSAL.accountNotFound : REFUSAL.accountUnreachable);
  if (!sameAccountName(resolved.value.accountName, parsed.data.shownAccountName)) return fail(REFUSAL.accountChanged);

  const available = await freshAvailable(ctx);
  if (available === null) return fail(REFUSAL.unavailable);
  if (amount.minor > available) return fail(REFUSAL.insufficient);

  const staged = await stage(
    ctx,
    parsed.data.clientKey,
    {
      kind: "withdrawal",
      amountMinor: amount.minor,
      counterparty: { bank: parsed.data.bankName, last4: lastFour(parsed.data.accountNumber), name: resolved.value.accountName },
      narration: null,
    },
    (reference) => ({
      type: "withdrawal",
      reference,
      amountMinor: amount.minor,
      bank: {
        bankCode: parsed.data.bankCode,
        bankName: parsed.data.bankName,
        accountNumber: parsed.data.accountNumber,
        accountName: resolved.value.accountName,
        narration: "Vallo withdrawal",
      },
    }),
  );
  if (!staged.ok) return staged;
  const quote = quoteFrom(staged.data.row);
  /* The fee is known now: the whole debit must fit, or nothing is offered. */
  if (quote.breakdown.totalDebitedMinor > available) {
    await observe(ctx.db, quote.reference, "cancelled", "vallo", { detail: { reason: "insufficient_with_fee" } });
    return fail(REFUSAL.insufficientWithFee);
  }
  return ok(quote);
}

/* ------------------------------------------------------------- confirm */

export type ConfirmOutcome = { movement: MovementView; needsOtp: boolean; message: string | null };

/**
 * Phase 8 steps 10 to 12 and phase 10's send: submit a staged intent. Only
 * the caller that moves the row from `awaiting_confirmation` to `processing`
 * submits; everyone else is shown where it is.
 */
export async function confirmBalanceMovement(input: unknown): Promise<ActionResult<ConfirmOutcome>> {
  const parsed = z.object({ movementId: z.string().uuid(), otp: z.string().trim().regex(/^\d{4,8}$/).optional() }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.refused);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceMove", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const ctx = r.ctx;
  const m = await loadMovement(ctx.db, ctx.userId, parsed.data.movementId);
  if (!m || m.kind === "deposit") return fail(REFUSAL.refused);
  if (m.status !== "awaiting_confirmation") return ok({ movement: movementView(m), needsOtp: false, message: REFUSAL.alreadySent });

  const claim = await observe(ctx.db, m.reference, "processing", "vallo", { detail: { step: "submit" } });
  if (claim !== "changed") {
    const now = await loadMovement(ctx.db, ctx.userId, m.id);
    return ok({ movement: movementView(now ?? m), needsOtp: false, message: REFUSAL.alreadySent });
  }

  const sent = await ctx.provider.submitIntent(ctx.customerId, { reference: m.reference, otp: parsed.data.otp });
  let message: string | null = null;
  let otp = false;
  if (sent.ok) {
    /* Accepted. Not done: done is the webhook's or the read-back's to say. */
    const to = sent.value.status === "failed" ? "failed" : "processing";
    await observe(ctx.db, m.reference, to, "provider_response", { providerStatus: sent.value.status, providerFeeMinor: sent.value.feeMinor });
    if (to === "failed") message = REFUSAL.refused;
  } else if (sent.kind === "unknown") {
    await observe(ctx.db, m.reference, "unknown", "vallo", { detail: { submit: "no_answer" } });
    message = REFUSAL.submittedUnknown;
  } else if (sent.kind === "refused" && needsOtp(sent)) {
    await observe(ctx.db, m.reference, "awaiting_confirmation", "provider_response", { detail: { otp_required: true } });
    otp = true;
    message = REFUSAL.otpNeeded;
  } else if (sent.kind === "refused" || sent.kind === "not_found") {
    await observe(ctx.db, m.reference, "failed", "provider_response", { detail: { refused: sent.detail } });
    message = REFUSAL.refused;
  } else {
    /* Held before sending, rate limited, or the provider down: nothing executed. */
    await observe(ctx.db, m.reference, "awaiting_confirmation", "vallo", { detail: { not_sent: sent.kind } });
    message = refusalFor(sent);
  }
  const after = await loadMovement(ctx.db, ctx.userId, m.id);
  return ok({ movement: movementView(after ?? m), needsOtp: otp, message });
}

export async function cancelBalanceMovement(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ movementId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.refused);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to continue.");
  const db = adminDb();
  if (!db) return fail(REFUSAL.notLive);
  const m = await loadMovement(db, session.user.id, parsed.data.movementId);
  /* Only a staged, never submitted intent: staging moves no money. */
  if (m && (m.status === "awaiting_confirmation" || m.status === "awaiting_payment")) {
    await observe(db, m.reference, "cancelled", "vallo", { detail: { by: "member" } });
  }
  return ok(null);
}

/* ------------------------------------------------------------- deposit */

export type DepositStart = { movement: MovementView; hosted: HostedCollection };

/**
 * Phase 7: the documented payment intent (`deposit`, no saved card), never
 * the retired virtual account and never a Vallo bank account.
 */
export async function prepareDeposit(input: unknown): Promise<ActionResult<DepositStart>> {
  const parsed = z.object({ clientKey: z.string().uuid(), amount: z.string().max(20) }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.amountInvalid);
  const amount = amountFrom(parsed.data.amount, INTENT_MIN_KOBO);
  if (!amount.ok) return fail(amount.error);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const depositGate = await phoneGateFor(r.ctx.db, r.ctx.userId, "payment");
  if (depositGate) return depositGate;
  const limit = await guardMoney("balanceMove", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const staged = await stage(r.ctx, parsed.data.clientKey, { kind: "deposit", amountMinor: amount.minor, counterparty: {}, narration: null }, (reference) => ({
    type: "deposit",
    reference,
    amountMinor: amount.minor,
  }));
  if (!staged.ok) return staged;
  const hosted = staged.data.hosted ?? hostedFromRow(staged.data.row);
  if (!hosted || hosted.kind === "checkout_config") {
    /* UNVERIFIED against live docs: `checkoutConfig` has no documented fields, so without a page to open there is nothing honest to show. */
    await observe(r.ctx.db, staged.data.row.reference, "cancelled", "vallo", { detail: { reason: "no_hosted_page" } });
    return fail(REFUSAL.depositUnavailable);
  }
  if (!staged.data.hosted) return ok({ movement: movementView(staged.data.row), hosted });
  await r.ctx.db.from("funds_movements").update({ provider_metadata: { hosted } }).eq("id", staged.data.row.id);
  return ok({ movement: movementView(staged.data.row), hosted });
}

function hostedFromRow(m: MovementRow): HostedCollection | null {
  const h = (m.provider_metadata ?? {}).hosted as HostedCollection | undefined;
  return h && typeof h === "object" && "kind" in h ? h : null;
}

/** "I have paid": ask the provider to settle the collection (create-payment-intent: "settle it with Verify payment once paid"). */
export async function confirmDepositPaid(input: unknown): Promise<ActionResult<ConfirmOutcome>> {
  const parsed = z.object({ movementId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.refused);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceMove", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const ctx = r.ctx;
  const m = await loadMovement(ctx.db, ctx.userId, parsed.data.movementId);
  if (!m || m.kind !== "deposit") return fail(REFUSAL.refused);
  if (m.status !== "awaiting_payment") return ok({ movement: movementView(m), needsOtp: false, message: null });
  const claim = await observe(ctx.db, m.reference, "processing", "vallo", { detail: { step: "settle" } });
  if (claim !== "changed") {
    const now = await loadMovement(ctx.db, ctx.userId, m.id);
    return ok({ movement: movementView(now ?? m), needsOtp: false, message: null });
  }
  const sent = await ctx.provider.submitIntent(ctx.customerId, { reference: m.reference });
  let message: string | null = null;
  if (sent.ok) {
    await observe(ctx.db, m.reference, sent.value.status === "failed" ? "failed" : "processing", "provider_response", { providerStatus: sent.value.status });
  } else if (sent.kind === "unknown") {
    await observe(ctx.db, m.reference, "unknown", "vallo", { detail: { settle: "no_answer" } });
  } else {
    /* UNVERIFIED against live docs: what verify says before the payer has paid. Treated as "not yet". */
    await observe(ctx.db, m.reference, "awaiting_payment", "provider_response", { detail: { settle_refused: sent.detail } });
    message = "Your bank has not confirmed the payment yet. If you have paid, give it a few minutes; this page updates on its own.";
  }
  const after = await loadMovement(ctx.db, ctx.userId, m.id);
  return ok({ movement: movementView(after ?? m), needsOtp: false, message });
}

/* ---------------------------------------------------------------- send */

type Recipient = { userId: string; customerId: string; displayName: string };

function phoneVariants(local: string): string[] {
  const rest = local.slice(1);
  return [local, `234${rest}`, `+234${rest}`, rest];
}

function maskedName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Vallo member";
  const [first, ...others] = parts;
  const last = others.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}

async function findRecipientRow(db: Db, phone: string, selfId: string): Promise<{ recipient: Recipient } | { error: string }> {
  const local = normalisePhone(phone);
  if (!local) return { error: REFUSAL.noRecipient };
  const { data } = await db.from("profiles").select("id, first_name, surname").in("phone", phoneVariants(local)).limit(2);
  const rows = (data ?? []) as { id: string; first_name: string | null; surname: string | null }[];
  /* Two members on one number is a question for a person, never a guess. */
  if (rows.length !== 1) return { error: REFUSAL.noRecipient };
  const row = rows[0]!;
  if (row.id === selfId) return { error: REFUSAL.selfSend };
  const account = await loadAccount(db, row.id);
  if (!account || account.status !== "ACTIVE" || !account.provider_customer_id) return { error: REFUSAL.noRecipient };
  return {
    recipient: { userId: row.id, customerId: account.provider_customer_id, displayName: maskedName(`${row.first_name ?? ""} ${row.surname ?? ""}`) },
  };
}

/** Phase 10: who is this number, in as few letters as confirm it. */
export async function findBalanceRecipient(input: unknown): Promise<ActionResult<{ name: string }>> {
  const parsed = z.object({ phone: z.string().max(20) }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.noRecipient);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceLookup", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const found = await findRecipientRow(r.ctx.db, parsed.data.phone, r.ctx.userId);
  return "error" in found ? fail(found.error) : ok({ name: found.recipient.displayName });
}

const sendInput = z.object({
  clientKey: z.string().uuid(),
  phone: z.string().max(20),
  amount: z.string().max(20),
  note: z.string().trim().max(100).optional(),
});

export async function prepareSend(input: unknown): Promise<ActionResult<Quote>> {
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) return fail(REFUSAL.refused);
  const amount = amountFrom(parsed.data.amount, INTENT_MIN_KOBO);
  if (!amount.ok) return fail(amount.error);
  const r = await ready();
  if (!r.ok) return fail(r.error);
  const limit = await guardMoney("balanceMove", r.ctx.userId);
  if (!limit.allowed) return fail(limit.message);
  const ctx = r.ctx;

  const prior = await existingByKey(ctx.db, ctx.userId, parsed.data.clientKey);
  if (prior) return ok(quoteFrom(prior));

  /* FULL GATE: sending money to somebody is a payment. */
  const sendGate = await phoneGateFor(ctx.db, ctx.userId, "payment");
  if (sendGate) return sendGate;

  const found = await findRecipientRow(ctx.db, parsed.data.phone, ctx.userId);
  if ("error" in found) return fail(found.error);
  /* The provider's own record decides whether this customer can receive, and which phone names them. */
  const customer = await ctx.provider.readCustomer(found.recipient.customerId);
  if (!customer.ok) return fail(refusalFor(customer));
  if (customer.value.blocked || customer.value.status !== "active") return fail(REFUSAL.recipientOnHold);

  const available = await freshAvailable(ctx);
  if (available === null) return fail(REFUSAL.unavailable);
  if (amount.minor > available) return fail(REFUSAL.insufficient);

  const staged = await stage(
    ctx,
    parsed.data.clientKey,
    { kind: "transfer_out", amountMinor: amount.minor, counterparty: { name: found.recipient.displayName }, narration: parsed.data.note ?? null },
    (reference) => ({
      type: "wallet_transfer",
      reference,
      amountMinor: amount.minor,
      recipient: { phone: customer.value.phone, name: customer.value.displayName || found.recipient.displayName, narration: parsed.data.note },
    }),
  );
  if (!staged.ok) return staged;
  const quote = quoteFrom(staged.data.row);
  if (quote.breakdown.totalDebitedMinor > available) {
    await observe(ctx.db, quote.reference, "cancelled", "vallo", { detail: { reason: "insufficient_with_fee" } });
    return fail(REFUSAL.insufficientWithFee);
  }
  return ok(quote);
}

/* --------------------------------------------------------------- watch */

/**
 * The waiting screen's poll. Reads Vallo's record, which the webhook keeps
 * current; at most once a minute per movement it also reads the provider
 * back, which is how an UNKNOWN or a lost webhook is resolved.
 */
export async function balanceMovementStatus(input: unknown): Promise<ActionResult<MovementView>> {
  const parsed = z.object({ movementId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail(REFUSAL.refused);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to continue.");
  const db = adminDb();
  const provider = walletProvider();
  if (!db || !provider) return fail(REFUSAL.notLive);
  const verdict = await guardMoney("balanceState", session.user.id);
  if (!verdict.allowed) return fail(verdict.message);
  const m = await loadMovement(db, session.user.id, parsed.data.movementId);
  if (!m) return fail(REFUSAL.refused);
  if (isOpenMovement(m.status) && m.status !== "awaiting_payment" && Date.now() - Date.parse(m.status_observed_at) > 60_000) {
    const account = await loadAccount(db, session.user.id);
    if (account?.provider_customer_id) await readBack(db, provider, account.provider_customer_id, m);
  }
  const now = await loadMovement(db, session.user.id, m.id);
  return ok(movementView(now ?? m));
}
