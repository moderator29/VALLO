import "server-only";

import { ESCROWPAY_PATHS } from "../payments/providers/escrowpay/client";
import { normaliseEscrowPayEvent, normaliseEscrowPayStatus } from "../payments/providers/escrowpay/normaliser";
import { failureCode } from "../payments/providers/escrowpay/errors";
import { readBanks, readPaymentAccountId, readPaymentInstructions, readTransaction, readTransactionList, type ProviderTransaction } from "../payments/providers/escrowpay/read";
import {
  activateTransactionCall,
  checkoutSessionCall,
  createTransactionCall,
  extendTransactionCall,
  paymentAccountCall,
  refundCall,
  releaseCall,
} from "../payments/providers/escrowpay/requests";
import type { EscrowPayWebhook } from "../payments/providers/escrowpay/webhooks";
import type { ArrangementStatus } from "./arrangement-states";
import { PROTECTED_SANDBOX_BANK } from "./copy";
import { VALLO_FEE_BPS } from "./fee-schedule";
import type { Db } from "./member-wallet";
import { applyPayoutWebhook, isPayoutEvent } from "./protected-payout";
import { ensurePayoutAccount, findParty, provablyNothing, protectedRailOpen, providerReachable, type ProtectedRailDeps } from "./protected-provider";
import { releaseGate } from "./release-gate";

export { protectedRailDeps, protectedRailOpen, providerReachable, type ProtectedRailDeps } from "./protected-provider";

/**
 * THE PROTECTED RAIL, SERVER SIDE (BUILD section 5, phase 3).
 *
 * How one payment runs at the provider (its Merchant API, docs.escrowpay.app):
 *
 *   payer and lister are PARTIES  ->  a TRANSACTION is made as a draft and
 *   activated  ->  a PAYMENT ACCOUNT is issued for it and a CHECKOUT SESSION
 *   says what to transfer to it (the transfer details)  ->  the bank reports
 *   it FUNDED  ->  Vallo instructs a RELEASE (or a REFUND)  ->  the provider
 *   reports it completed.
 *
 * Every step below was run against the provider's sandbox on 14 November
 * 2026 (`docs/handoff/ESCROWPAY_INTEGRATION.md`, "The sandbox run").
 *
 * The rules that cannot bend, each held here and again in the database:
 *  - funded, released and refunded are recorded ONLY from the provider's
 *    own word (its signed webhook or a read-back), through
 *    `public.provider_arrangement_observe`, which refuses them from Vallo;
 *  - a provider word Vallo has no meaning for moves nothing and never
 *    becomes released;
 *  - no answer is `unknown`, never retried blindly, resolved by reading back.
 *    Every money call carries an idempotency key made from Vallo's stored
 *    reference, so the same step asked again is the same request;
 *  - "I've made the transfer" only marks a request to look again;
 *  - the switch (`payments_escrowpay_on`, fail closed) gates only what STARTS
 *    money movement: opening and releasing. Reading back is never gated, so
 *    money already taken is always recorded. A refund is staff's alone and
 *    is not stopped by the switch: money must be able to go back in an outage;
 *  - a test key on the production deployment starts nothing.
 */

/** How long the payer has to make the transfer before the details lapse. */
export const PROTECTED_FUNDING_WINDOW_HOURS = 48;

type Row = {
  id: string;
  agreement_id: string;
  provider: string;
  reference: string;
  provider_arrangement_id: string | null;
  amount_minor: number;
  buyer_user_id: string;
  seller_user_id: string;
  status: ArrangementStatus;
  funding_instructions: Record<string, unknown> | null;
  funding_expires_at: string | null;
};

const ROW =
  "id, agreement_id, provider, reference, provider_arrangement_id, amount_minor, buyer_user_id, seller_user_id, status, funding_instructions, funding_expires_at";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc = (db: Db): Rpc => (db as unknown as { rpc: Rpc }).rpc.bind(db);

type Answer = PromiseLike<{ data: unknown; error: unknown }>;
type Filter = { eq: (c: string, v: string) => Filter; maybeSingle: () => Answer } & Answer;
type Table = { select: (s: string) => Filter; update: (v: Record<string, unknown>) => Filter; insert: (v: Record<string, unknown>) => Answer };
const table = (db: Db, name: string): Table => (db as unknown as { from: (t: string) => Table }).from(name);

function rowOf(data: unknown): Row | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Row;
  if (row.provider !== "escrowpay") return null;
  return { ...row, amount_minor: Number(row.amount_minor) };
}

async function loadRow(db: Db, id: string): Promise<Row | null> {
  try {
    const { data, error } = await table(db, "provider_arrangements").select(ROW).eq("id", id).maybeSingle();
    return error ? null : rowOf(data);
  } catch {
    return null;
  }
}

/** Facts about the arrangement that are not its status: the provider's ids, the transfer details. Service role only. */
async function stamp(db: Db, id: string, values: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await table(db, "provider_arrangements").update(values).eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

type Verdict = "changed" | "same" | "refused" | "amount_mismatch" | "id_mismatch" | "not_found" | "error";

async function observe(
  deps: ProtectedRailDeps,
  row: Row,
  to: ArrangementStatus,
  source: "vallo" | "provider_response" | "provider_webhook" | "provider_readback",
  detail: Record<string, unknown> = {},
  provider: { state?: string | null; amountMinor?: number | null; id?: string | null; eventKey?: string | null } = {},
): Promise<Verdict> {
  try {
    const { data, error } = await rpc(deps.db)("provider_arrangement_observe", {
      p_arrangement: row.id,
      p_to_status: to,
      p_source: source,
      p_provider_state: provider.state ?? null,
      p_provider_status: null,
      p_provider_arrangement_id: provider.id ?? null,
      p_provider_payment_token: null,
      p_provider_amount_minor: provider.amountMinor ?? null,
      p_provider_fee_minor: null,
      p_milestones: null,
      p_provider_event_key: provider.eventKey ?? null,
      p_detail: detail,
    });
    if (error) return "error";
    const verdict = String(data) as Verdict;
    if (verdict === "amount_mismatch" || verdict === "id_mismatch") {
      await deps.alert(`protected_rail.${verdict}`, { arrangement_id: row.id, reference: row.reference, source });
    }
    return verdict;
  } catch {
    return "error";
  }
}

/**
 * The provider's report about one transaction, in Vallo's words. The status
 * comes only from a word the sandbox showed (`normaliseEscrowPayStatus`);
 * a release or refund of less than the whole is never read as the whole.
 */
function readReport(tx: ProviderTransaction, row: Row): { status: ArrangementStatus | null; amountMinor: number | null; id: string; word: string | null } {
  let status = normaliseEscrowPayStatus(tx.status);
  if (status === "released" && tx.releasedMinor !== null && tx.releasedMinor < row.amount_minor) status = "requires_review";
  if (status === "refunded" && tx.refundedMinor !== null && tx.refundedMinor < row.amount_minor) status = "requires_review";
  if (status === "protected" && tx.fundedMinor !== null && tx.fundedMinor < row.amount_minor) status = "requires_review";
  return { status, amountMinor: tx.amountMinor, id: tx.id, word: tx.status };
}

/**
 * The states Vallo records ON TOP of money the provider holds: an instruction
 * in flight, its own dispute, a payment with a person. While any of them
 * stands, the provider saying "still held" is no news and undoes nothing:
 * the record leaves them only on the provider's report of an outcome, its
 * refusal where the instruction is given, or a person's decision.
 */
const ON_TOP_OF_HELD: ReadonlySet<ArrangementStatus> = new Set(["release_requested", "refund_requested", "disputed", "requires_review"]);

/* ------------------------------------------------- transfer details */

type Issued = "issued" | "refused" | "unknown";

/** The bank's name for the provider's code, from the provider's own list. Null when it is not on it. */
async function bankNameFor(deps: ProtectedRailDeps, bankCode: string): Promise<string | null> {
  const listed = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.banks });
  const named = listed.ok ? readBanks(listed.value).find((b) => b.code === bankCode)?.name : undefined;
  if (named) return named;
  /* The sandbox simulator's accounts sit at a code that is on no list. A live one always is. */
  return deps.config?.environment === "sandbox" ? PROTECTED_SANDBOX_BANK : null;
}

/**
 * Make the transaction payable and hand out transfer details for it:
 *
 *  1. the draft is activated;
 *  2. a payment account is made for this one transaction, good for the
 *     whole funding window (a checkout session on its own makes one that
 *     lapses in half an hour);
 *  3. a checkout session is opened, whose `payment_instructions` are that
 *     account with its name and the exact total to transfer: the amount,
 *     plus the provider's fee when the payer bears it.
 *
 * Nothing is stored unless the bank, the account name, the number and a
 * total of at least the amount are all there. `attempt` numbers the details
 * issued, so a second set is a second request, never the first again.
 */
async function issueInstructions(deps: ProtectedRailDeps, row: Row, tx: ProviderTransaction, attempt: number, seen?: { state: string | null }): Promise<Issued> {
  if (tx.status === "draft") {
    if (tx.version === null) return "unknown";
    const activated = await deps.send(deps.config, activateTransactionCall({ reference: row.reference, transactionId: tx.id, version: tx.version }));
    if (!activated.ok) return provablyNothing(activated) ? "refused" : "unknown";
    /* The provider's word for the transaction now that it is payable, for the record. */
    if (seen) seen.state = readTransaction(activated.value)?.status ?? null;
  }
  /* A little inside the transaction's own funding deadline, which was set a moment earlier. */
  const expiresAt = new Date(deps.now() + PROTECTED_FUNDING_WINDOW_HOURS * 3_600_000 - 15 * 60_000).toISOString();
  const account = await deps.send(
    deps.config,
    paymentAccountCall({ reference: row.reference, transactionId: tx.id, amountMinor: row.amount_minor, expiresAt, attempt }),
  );
  if (!account.ok) return provablyNothing(account) ? "refused" : "unknown";
  if (!readPaymentAccountId(account.value)) return "unknown";

  const session = await deps.send(deps.config, checkoutSessionCall({ reference: row.reference, transactionId: tx.id, attempt }));
  if (!session.ok) return provablyNothing(session) ? "refused" : "unknown";
  const details = readPaymentInstructions(session.value, deps.config?.environment === "sandbox");
  /* A total below the amount would leave the payment short: never shown. */
  if (!details || details.amountMinor < row.amount_minor) return "unknown";
  const bank = await bankNameFor(deps, details.bankCode);
  if (!bank) return "unknown";
  const stored = await stamp(deps.db, row.id, {
    funding_instructions: {
      bank_name: bank,
      bank_code: details.bankCode,
      account_name: details.accountName,
      account_number: details.accountNumber,
      amount_minor: details.amountMinor,
      expires_at: details.expiresAt,
      payment_account_id: details.paymentAccountId,
      checkout_session_id: details.checkoutSessionId,
      attempt,
    },
    /* A countdown is drawn only from the provider's own expiry (spec screen 3). */
    funding_expires_at: details.expiresAt,
  });
  return stored ? "issued" : "unknown";
}

const attemptOf = (row: Row): number => {
  const n = row.funding_instructions?.attempt;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : 0;
};

/* --------------------------------------------------------------- open */

export type OpenProtectedOutcome =
  | { outcome: "opened"; arrangementId: string; status: ArrangementStatus }
  | { outcome: "existing"; arrangementId: string }
  | { outcome: "unknown"; arrangementId: string }
  | { outcome: "failed"; arrangementId: string }
  | { outcome: "refused"; reason: string };

type AgreementParties = { renter_id: string; owner_id: string; named_payer_id: string | null; named_payer_by_renter_at: string | null; named_payer_accepted_at: string | null; listing_id: string | null };

/**
 * Open the protected payment for an approved agreement, on the exact version
 * the payer accepted (spec screen 2).
 *
 * Before anything is made: both people must be known to the provider (the
 * payer's identity check, the lister's identity check and payout account).
 * A payment that could not be paid out is never opened. Then the database
 * decides everything it can (`public.protected_payment_open`: the switch,
 * the category, the rail, a card attempt, the single live arrangement, the
 * named payer), and the provider is asked. A row is made before the call, so
 * an unanswered call is read back, never repeated.
 */
export async function openProtectedPayment(
  deps: ProtectedRailDeps,
  input: { agreementId: string; acceptedVersion: number; actorUserId: string },
): Promise<OpenProtectedOutcome> {
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: providerReachable(deps) ? "switched_off" : "not_configured" };

  let ag: AgreementParties | null = null;
  try {
    const { data, error } = await table(deps.db, "deal_agreements")
      .select("renter_id, owner_id, named_payer_id, named_payer_by_renter_at, named_payer_accepted_at, listing_id")
      .eq("id", input.agreementId)
      .maybeSingle();
    if (error) return { outcome: "refused", reason: "store_unavailable" };
    ag = (data as AgreementParties | null) ?? null;
  } catch {
    return { outcome: "refused", reason: "store_unavailable" };
  }
  if (!ag) return { outcome: "refused", reason: "not_found" };
  /* The same payer the database will name: a named payer only once both consented. */
  const payerId = ag.named_payer_id && ag.named_payer_by_renter_at && ag.named_payer_accepted_at ? ag.named_payer_id : ag.renter_id;
  if (input.actorUserId !== ag.renter_id && input.actorUserId !== payerId) return { outcome: "refused", reason: "not_found" };

  const payer = await findParty(deps, payerId);
  if (payer.state === "unavailable") return { outcome: "refused", reason: "provider_unavailable" };
  if (payer.state !== "known") return { outcome: "refused", reason: "payer_identity_required" };
  const lister = await findParty(deps, ag.owner_id);
  if (lister.state === "unavailable") return { outcome: "refused", reason: "provider_unavailable" };
  if (lister.state !== "known") return { outcome: "refused", reason: "lister_not_ready" };
  const payout = await ensurePayoutAccount(deps, { userId: ag.owner_id, partyId: lister.partyId });
  if (payout.state === "unavailable") return { outcome: "refused", reason: "provider_unavailable" };
  if (payout.state !== "ready") return { outcome: "refused", reason: "lister_not_ready" };

  let opened: { status?: string; id?: string };
  try {
    const { data, error } = await rpc(deps.db)("protected_payment_open", {
      p_agreement: input.agreementId,
      p_accepted_version: input.acceptedVersion,
    });
    if (error || !data) return { outcome: "refused", reason: "store_unavailable" };
    opened = data as { status?: string; id?: string };
  } catch {
    return { outcome: "refused", reason: "store_unavailable" };
  }
  if (opened.status === "exists" && opened.id) return { outcome: "existing", arrangementId: opened.id };
  if (opened.status !== "ok" || !opened.id) return { outcome: "refused", reason: opened.status ?? "store_unavailable" };

  const row = await loadRow(deps.db, opened.id);
  if (!row) return { outcome: "refused", reason: "store_unavailable" };
  await stamp(deps.db, row.id, { buyer_customer_id: payer.partyId, seller_customer_id: lister.partyId, environment: deps.config?.environment ?? null });

  const created = await deps.send(
    deps.config,
    createTransactionCall({
      reference: row.reference,
      amountMinor: row.amount_minor,
      payerPartyId: payer.partyId,
      beneficiaryPartyId: lister.partyId,
      payoutAccountId: payout.payoutAccountId,
      payoutPreference: deps.config?.payoutPreference ?? "automatic",
      fundingDeadline: new Date(deps.now() + PROTECTED_FUNDING_WINDOW_HOURS * 3_600_000).toISOString(),
      description: `Vallo payment ${row.reference}`,
      metadata: { vallo_arrangement_id: row.id, vallo_agreement_id: row.agreement_id },
      /* VALLO'S SHARE, NAMED ON THE PAYMENT ITSELF (the founder, 15 November
       * 2026). The provider charges its own fee separately; the two together
       * are the published schedule, which only `fee-schedule.ts` states.
       * Sent on every transaction rather than left to the account default, so
       * the share that applied is in the record of that payment and a later
       * change to the account cannot reprice a payment already agreed. The
       * figure is read from `fee-schedule.ts`, never typed here. */
      marketplaceCommissionBps: VALLO_FEE_BPS,
    }),
  );
  if (!created.ok) {
    if (provablyNothing(created)) {
      /* The provider never made it: closed as failed, from the provider's own refusal. */
      const code = failureCode(created);
      await observe(deps, row, "failed", "provider_response", { why: created.kind, code });
      /* Seen on the sandbox: an account whose automatic payout is switched off
         refuses every transaction that asks for one. Staff are told what to turn on. */
      if (code === "policy_violation" && created.detail.includes("automatic_payout_disabled")) {
        await deps.alert("protected_rail.automatic_payout_disabled", { arrangement_id: row.id, reference: row.reference });
      }
      return { outcome: "failed", arrangementId: row.id };
    }
    await observe(deps, row, "unknown", "vallo", { why: created.kind });
    await deps.alert("protected_rail.create_unknown", { arrangement_id: row.id, reference: row.reference });
    return { outcome: "unknown", arrangementId: row.id };
  }
  const tx = readTransaction(created.value);
  if (!tx) {
    await observe(deps, row, "unknown", "vallo", { created_but_unread: true });
    await deps.alert("protected_rail.create_unread", { arrangement_id: row.id, reference: row.reference });
    return { outcome: "unknown", arrangementId: row.id };
  }
  /* The provider's id is kept before anything else is asked of it. */
  await stamp(deps.db, row.id, { provider_arrangement_id: tx.id });

  const seen = { state: tx.status };
  const issued = await issueInstructions(deps, { ...row, provider_arrangement_id: tx.id }, tx, 1, seen);
  if (issued !== "issued") {
    /* Made at the provider, not yet payable: the read-back finishes it. */
    await observe(deps, row, "unknown", "vallo", { instructions: issued }, { id: tx.id });
    await deps.alert("protected_rail.instructions_pending", { arrangement_id: row.id, reference: row.reference, why: issued });
    return { outcome: "unknown", arrangementId: row.id };
  }
  const verdict = await observe(deps, row, "awaiting_payment", "provider_response", {}, { state: seen.state, amountMinor: tx.amountMinor, id: tx.id });
  if (verdict === "changed" || verdict === "same") return { outcome: "opened", arrangementId: row.id, status: "awaiting_payment" };
  return { outcome: "unknown", arrangementId: row.id };
}

/* ---------------------------------------------------------- read back */

export type RefreshOutcome =
  | { outcome: "read"; status: ArrangementStatus; moved: boolean }
  | { outcome: "not_reachable" }
  | { outcome: "refused"; reason: string };

/** The provider's transaction for a row: by its id, or, when the create was never answered, by Vallo's reference. */
async function providerTransaction(deps: ProtectedRailDeps, row: Row): Promise<ProviderTransaction | null> {
  if (row.provider_arrangement_id) {
    const seen = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.read(row.provider_arrangement_id) });
    return seen.ok ? readTransaction(seen.value) : null;
  }
  const found = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.byReference(row.reference) });
  if (!found.ok) return null;
  const tx = readTransactionList(found.value).find((t) => t.externalReference === row.reference) ?? null;
  if (tx) await stamp(deps.db, row.id, { provider_arrangement_id: tx.id });
  return tx;
}

/** Read the provider's word for one arrangement. Never gated by the switch; never moves a state the provider did not report. */
export async function readBack(deps: ProtectedRailDeps, row: Row, source: "provider_readback" = "provider_readback"): Promise<RefreshOutcome> {
  if (!providerReachable(deps)) return { outcome: "not_reachable" };
  const tx = await providerTransaction(deps, row);
  if (!tx) return { outcome: "read", status: row.status, moved: false };
  const known: Row = { ...row, provider_arrangement_id: tx.id };

  /* An open that stopped half way: made at the provider, no transfer details yet. */
  const unfinished = (row.status === "preparing" || row.status === "unknown") && row.funding_instructions === null;
  if (unfinished && (tx.status === "draft" || normaliseEscrowPayStatus(tx.status) === "awaiting_payment") && (await protectedRailOpen(deps))) {
    const seen = { state: tx.status };
    const issued = await issueInstructions(deps, known, tx, attemptOf(row) + 1, seen);
    if (issued !== "issued") return { outcome: "read", status: row.status, moved: false };
    const verdict = await observe(deps, known, "awaiting_payment", source, { resumed: true }, { state: seen.state, amountMinor: tx.amountMinor, id: tx.id });
    return { outcome: "read", status: verdict === "changed" ? "awaiting_payment" : row.status, moved: verdict === "changed" };
  }

  const report = readReport(tx, row);
  if (!report.status) return { outcome: "read", status: row.status, moved: false };
  if (report.status === "protected" && ON_TOP_OF_HELD.has(row.status)) return { outcome: "read", status: row.status, moved: false };
  const verdict = await observe(deps, known, report.status, source, {}, { state: report.word, amountMinor: report.amountMinor, id: report.id });
  return { outcome: "read", status: verdict === "changed" ? report.status : row.status, moved: verdict === "changed" };
}

function partyOf(row: Row, actor: string): "payer" | "lister" | null {
  if (row.buyer_user_id === actor) return "payer";
  if (row.seller_user_id === actor) return "lister";
  return null;
}

/** "Refresh status": the payer or the lister asks for a fresh read. */
export async function refreshProtectedPayment(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<RefreshOutcome> {
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row || !partyOf(row, input.actorUserId)) return { outcome: "refused", reason: "not_found" };
  return readBack(deps, row);
}

/**
 * "I've made the transfer" (spec screen 3): marks that the payer asked us to
 * look, then reads back. It can never mark the payment funded: the database
 * function writes only `transfer_reported_at`.
 */
export async function reportTransfer(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<RefreshOutcome> {
  try {
    const { data, error } = await rpc(deps.db)("protected_payment_transfer_reported", {
      p_arrangement: input.arrangementId,
      p_payer: input.actorUserId,
    });
    if (error) return { outcome: "refused", reason: "store_unavailable" };
    const status = String(data);
    if (status !== "ok") return { outcome: "refused", reason: status };
  } catch {
    return { outcome: "refused", reason: "store_unavailable" };
  }
  return refreshProtectedPayment(deps, input);
}

/* ------------------------------------------------------------ release */

export type ActOutcome = { outcome: "submitted" } | { outcome: "unknown" } | { outcome: "refused"; reason: string };

/**
 * The payer confirms the category's milestone (check-in, or the keys), and
 * Vallo instructs the release of the whole amount. Only the provider's
 * report then records it released. Refused while the switch is off, and
 * while the chargeback gate holds or a person paused it.
 */
export async function confirmProtectedMilestone(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<ActOutcome> {
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: "switched_off" };
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row || row.buyer_user_id !== input.actorUserId) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "protected") return { outcome: "refused", reason: `not_releasable:${row.status}` };
  if (!row.provider_arrangement_id) return { outcome: "refused", reason: "store_unavailable" };
  const gate = await releaseGate(deps.db, row.id);
  if (gate === "held" || gate === "paused") return { outcome: "refused", reason: "release_paused" };
  if (gate !== "clear") return { outcome: "refused", reason: "store_unavailable" };

  const asked = await observe(deps, row, "release_requested", "vallo");
  if (asked !== "changed") return { outcome: "refused", reason: `store:${asked}` };
  const done = await deps.send(deps.config, releaseCall({ reference: row.reference, transactionId: row.provider_arrangement_id, amountMinor: row.amount_minor }));
  if (done.ok) return { outcome: "submitted" };
  if (provablyNothing(done)) {
    await observe(deps, row, "protected", "provider_response", { release_refused: done.kind });
    return { outcome: "refused", reason: done.kind };
  }
  await deps.alert("protected_rail.release_unknown", { arrangement_id: row.id, reference: row.reference });
  return { outcome: "unknown" };
}

/* ------------------------------------------------- staff instructions */

async function audit(deps: ProtectedRailDeps, row: Row, detail: Record<string, unknown>): Promise<void> {
  try {
    await table(deps.db, "provider_arrangement_events").insert({ arrangement_id: row.id, from_status: row.status, to_status: row.status, source: "vallo", detail });
  } catch {
    /* The instruction is also in the alert below; the audit row is best effort. */
  }
}

/**
 * A refund of the whole amount to the payer, on a decision staff made under
 * the agreement (Vallo's own dispute process, or a deal that fell through
 * while the money was held). Reachable only from the staff desk. Not gated
 * by the member switch: money must be able to go back while the rail is
 * closed to new payments. Only the provider's report records it refunded.
 */
export async function instructProtectedRefund(
  deps: ProtectedRailDeps,
  input: { arrangementId: string; staffUserId: string; reason: string },
): Promise<ActOutcome> {
  if (!providerReachable(deps) || deps.config?.startsMoney !== true) return { outcome: "refused", reason: "not_configured" };
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "protected" && row.status !== "disputed") return { outcome: "refused", reason: `not_refundable:${row.status}` };
  if (!row.provider_arrangement_id) return { outcome: "refused", reason: "store_unavailable" };
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 10) return { outcome: "refused", reason: "reason_too_short" };

  const asked = await observe(deps, row, "refund_requested", "vallo", { instructed_by: input.staffUserId, reason });
  if (asked !== "changed") return { outcome: "refused", reason: `store:${asked}` };
  const done = await deps.send(deps.config, refundCall({ reference: row.reference, transactionId: row.provider_arrangement_id, amountMinor: row.amount_minor, reason }));
  if (done.ok) return { outcome: "submitted" };
  if (provablyNothing(done)) {
    /* The provider refused: the money is where it was. */
    await observe(deps, row, row.status, "provider_response", { refund_refused: done.kind });
    return { outcome: "refused", reason: done.kind };
  }
  await deps.alert("protected_rail.refund_unknown", { arrangement_id: row.id, reference: row.reference });
  return { outcome: "unknown" };
}

/**
 * A release to the lister on staff's decision in a dispute. The arrangement
 * stays disputed until the provider reports the release; the chargeback gate
 * and a person's pause still refuse it.
 */
export async function instructDisputeRelease(
  deps: ProtectedRailDeps,
  input: { arrangementId: string; staffUserId: string; reason: string },
): Promise<ActOutcome> {
  if (!providerReachable(deps) || deps.config?.startsMoney !== true) return { outcome: "refused", reason: "not_configured" };
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "disputed") return { outcome: "refused", reason: `not_releasable:${row.status}` };
  if (!row.provider_arrangement_id) return { outcome: "refused", reason: "store_unavailable" };
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 10) return { outcome: "refused", reason: "reason_too_short" };
  const gate = await releaseGate(deps.db, row.id);
  if (gate === "held" || gate === "paused") return { outcome: "refused", reason: "release_paused" };
  if (gate !== "clear") return { outcome: "refused", reason: "store_unavailable" };

  await audit(deps, row, { dispute_release_instructed_by: input.staffUserId, reason });
  await deps.alert("protected_rail.dispute_release_instructed", { arrangement_id: row.id, reference: row.reference, by: input.staffUserId });
  const done = await deps.send(deps.config, releaseCall({ reference: row.reference, transactionId: row.provider_arrangement_id, amountMinor: row.amount_minor }));
  if (done.ok) return { outcome: "submitted" };
  if (provablyNothing(done)) return { outcome: "refused", reason: done.kind };
  await deps.alert("protected_rail.release_unknown", { arrangement_id: row.id, reference: row.reference });
  return { outcome: "unknown" };
}

/* ------------------------------------------------------------ dispute */

/**
 * Vallo's own dispute process (the provider holds the money; Vallo decides
 * the outcome under the agreement). Opening one moves no money: the payment
 * stays where it is and the release cannot be asked for. Either party may
 * open it while the money is held or a release is pending.
 */
export async function raiseProtectedDispute(
  deps: ProtectedRailDeps,
  input: { arrangementId: string; actorUserId: string; statement: string },
): Promise<ActOutcome> {
  const row = await loadRow(deps.db, input.arrangementId);
  const side = row ? partyOf(row, input.actorUserId) : null;
  if (!row || !side) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "protected" && row.status !== "release_requested") return { outcome: "refused", reason: `not_disputable:${row.status}` };
  const statement = input.statement.trim().slice(0, 2000);
  if (statement.length < 10) return { outcome: "refused", reason: "statement_too_short" };
  const verdict = await observe(deps, row, "disputed", "vallo", { opened_by: side, statement });
  if (verdict !== "changed") return { outcome: "refused", reason: `store:${verdict}` };
  await deps.alert("protected_rail.dispute_opened", { arrangement_id: row.id, reference: row.reference, opened_by: side });
  return { outcome: "submitted" };
}

/* ------------------------------------------------- new transfer details */

/**
 * New details after the old ones lapsed (spec screen 3). The provider's
 * funding deadline is moved on (`POST /transactions/{id}/extend`) and a NEW
 * payment account is made; the lapsed one is never handed out again. When
 * the provider has already closed the transaction, that is recorded and the
 * payer starts a new payment from the agreement.
 */
export async function askNewTransferDetails(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<ActOutcome> {
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row || row.buyer_user_id !== input.actorUserId) return { outcome: "refused", reason: "not_found" };
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: "switched_off" };
  if (row.status !== "awaiting_payment") return { outcome: "refused", reason: `not_waiting:${row.status}` };
  if (row.funding_expires_at === null || Date.parse(row.funding_expires_at) > deps.now()) return { outcome: "refused", reason: "not_expired" };
  const tx = await providerTransaction(deps, row);
  if (!tx || tx.version === null) return { outcome: "unknown" };
  const state = normaliseEscrowPayStatus(tx.status);
  if (state !== "awaiting_payment") {
    /* The provider has moved on (closed it, or money arrived): its word is recorded, nothing is reissued. */
    if (state) await observe(deps, row, state, "provider_readback", {}, { state: tx.status, amountMinor: tx.amountMinor, id: tx.id });
    return { outcome: "refused", reason: "closed_at_provider" };
  }
  const attempt = attemptOf(row) + 1;
  const extended = await deps.send(
    deps.config,
    extendTransactionCall({
      reference: row.reference,
      transactionId: tx.id,
      version: tx.version,
      fundingDeadline: new Date(deps.now() + PROTECTED_FUNDING_WINDOW_HOURS * 3_600_000).toISOString(),
      attempt,
    }),
  );
  if (!extended.ok) return provablyNothing(extended) ? { outcome: "refused", reason: extended.kind } : { outcome: "unknown" };
  const issued = await issueInstructions(deps, row, readTransaction(extended.value) ?? tx, attempt);
  if (issued === "issued") return { outcome: "submitted" };
  return issued === "refused" ? { outcome: "refused", reason: "refused" } : { outcome: "unknown" };
}

/* ------------------------------------------------------------ webhook */

export type ProtectedWebhookOutcome = Verdict | "unmapped" | "unknown_arrangement" | "malformed";

/**
 * A delivery the route has already verified and stored raw. The event's
 * meaning is the provider's (`normaliseEscrowPayEvent`); the arrangement is
 * found by the provider's own transaction id, which Vallo recorded when the
 * provider answered the create. A release or refund of less than the whole
 * is never recorded as the whole: it goes to a person.
 */
export async function applyProtectedWebhook(deps: ProtectedRailDeps, event: EscrowPayWebhook): Promise<ProtectedWebhookOutcome> {
  /* The transfer to the lister's bank after a release: its own record (protected-payout.ts). */
  if (isPayoutEvent(event.event)) return applyPayoutWebhook(deps, event);
  const mapped = normaliseEscrowPayEvent(event.event);
  if (!mapped) return "unmapped";
  if (!event.transactionId) return "unknown_arrangement";
  const { data, error } = await (deps.db as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } } };
  })
    .from("provider_arrangements")
    .select(ROW)
    .eq("provider", "escrowpay")
    .eq("provider_arrangement_id", event.transactionId)
    .maybeSingle();
  if (error) return "error";
  if (!data) return "unknown_arrangement";
  const row = { ...(data as Row), amount_minor: Number((data as Row).amount_minor) };
  let to = mapped as ArrangementStatus;
  /* A late or repeated "funded" for money Vallo already knows is held. */
  if (to === "protected" && ON_TOP_OF_HELD.has(row.status)) return "same";
  const detail: Record<string, unknown> = { event: event.event, object_id: event.objectId };
  const whole = to === "released" || to === "refunded";
  if (whole && event.amountMinor !== null && event.amountMinor !== row.amount_minor) {
    detail.partial_of = to;
    detail.reported_amount_minor = event.amountMinor;
    to = "requires_review";
    await deps.alert("protected_rail.partial_settlement", { arrangement_id: row.id, reference: row.reference, event: event.event, reported_amount_minor: event.amountMinor });
  }
  return observe(deps, row, to, "provider_webhook", detail, {
    state: event.event,
    id: event.transactionId,
    /* The database refuses a funded report whose amount is not the record's. */
    amountMinor: to === "protected" ? event.amountMinor : null,
    eventKey: event.key,
  });
}

/* ---------------------------------------------------------- reconcile */

export const PROTECTED_RECONCILE_STATUSES = [
  "preparing",
  "unknown",
  "awaiting_payment",
  "payment_processing",
  "release_requested",
  "refund_requested",
  "disputed",
] as const;

export type ProtectedReconcileSummary = { read: number; moved: number; skipped: number; failed: number };

/**
 * Read back what the webhook may have missed, oldest observation first, a
 * few per run. Recording only: never gated by the switch, never releases.
 */
export async function reconcileProtected(deps: ProtectedRailDeps, limit = 3): Promise<ProtectedReconcileSummary> {
  const summary: ProtectedReconcileSummary = { read: 0, moved: 0, skipped: 0, failed: 0 };
  if (!providerReachable(deps)) return summary;
  const settled = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await (deps.db as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          in: (c: string, v: readonly string[]) => {
            lt: (c: string, v: string) => { order: (c: string, o: { ascending: boolean; nullsFirst: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> } };
          };
        };
      };
    };
  })
    .from("provider_arrangements")
    .select(ROW)
    .eq("provider", "escrowpay")
    .in("status", PROTECTED_RECONCILE_STATUSES)
    .lt("updated_at", settled)
    .order("status_observed_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(limit, 10)));
  if (error || !data) {
    summary.failed += 1;
    return summary;
  }
  for (const raw of data as Row[]) {
    summary.read += 1;
    try {
      const result = await readBack(deps, { ...raw, amount_minor: Number(raw.amount_minor) });
      if (result.outcome === "read" && result.moved) summary.moved += 1;
      else summary.skipped += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
