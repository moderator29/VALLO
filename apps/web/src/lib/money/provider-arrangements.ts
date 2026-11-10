/**
 * D73 Part B, phases 11 and 12: a rental with an approved agreement is paid
 * into a protected arrangement that the licensed provider (Payluk escrow)
 * holds, and released to the lister when the renter confirms (ADR 0003:
 * the provider holds the money, Vallo records it).
 *
 *   open      provider_arrangement_open (database: switch, rent agreement
 *             approved, both parties onboarded, milestones) -> create at the
 *             provider -> awaiting_payment, or unknown when unanswered
 *   pay       the renter funds it from their Payluk balance -> payment_processing;
 *             the provider's webhook (escrow.ongoing) makes it protected
 *   release   the renter's own deliberate confirmation -> release_requested;
 *             escrow.completed makes it released. Milestones one at a time.
 *   webhook   escrow.* -> Vallo's state, through provider_arrangement_observe
 *
 * Rules held here:
 *  - Off unless a Payluk key is set and `payments_payluk_on` is on (D77; the
 *    database checks the switch again).
 *  - A reference is never invented and a call is never retried blindly: an
 *    unanswered create is UNKNOWN and is found again by `resolveArrangement`
 *    (read-back by reference), never created twice.
 *  - Release follows the provider's documented release (the buyer confirms),
 *    taken only from the renter's own act. The conditions engine (phase 13:
 *    inspection evidence before release) is not built; until it is, nothing
 *    here releases on Vallo's own initiative.
 */

import { PAYLUK_ESCROW_FLOWS_BUILT } from "../payments/providers/payluk";
import { paylukMerchantConfig } from "../payouts/payluk-merchant";
import type { PaylukContext } from "../payments/providers/payluk-client";
import {
  buyerOwesMinor,
  confirmMilestone,
  confirmRelease,
  createMilestoneArrangement,
  createStandardArrangement,
  findArrangement,
  fundArrangement,
  openDispute,
  parseArrangement,
  readArrangement,
  resolveDispute,
  withdrawArrangement,
  type DisputeOutcome,
  type PaylukArrangement,
} from "../payments/providers/payluk-arrangements";
import type { RailFailure } from "../payments/provider";
import { deliveryWindowDays, valloStateFor, type ArrangementStatus } from "./arrangement-states";
import { isMissingFunction } from "../admin/reads/chargebacks-model";
import type { Db } from "./member-wallet";

/**
 * D77, one switch: the escrow rail is ready when the Payluk key is set and
 * `payments_payluk_on` is on (the database's `rentals_protected_pay_on()`
 * reads the same flag). `rentals_protected_pay` is superseded and read by nothing.
 */
export const PROTECTED_PAY_FLAG = "payments_payluk_on";

/**
 * Payluk's 2 percent escrow fee is borne by the lister (`whoPays: seller`,
 * docs/payments/VALLO_PRICING.md section 6, D75): the renter pays exactly the
 * agreed amount. The database holds every arrangement to it as well.
 */
export const LISTER_BEARS_THE_FEE = "seller" as const;

export type ArrangementDeps = {
  db: Db;
  ctx: PaylukContext;
  /** Today in Lagos, `YYYY-MM-DD`. */
  todayLagos: () => string;
  alert: (kind: string, detail: Record<string, unknown>) => Promise<void>;
};

export type ArrangementRow = {
  id: string;
  agreement_id: string;
  kind: "standard" | "milestone";
  reference: string;
  provider_arrangement_id: string | null;
  provider_payment_token: string | null;
  amount_minor: number;
  buyer_user_id: string;
  seller_user_id: string;
  buyer_customer_id: string;
  seller_customer_id: string;
  status: ArrangementStatus;
};

type ObserveVerdict = "changed" | "same" | "refused" | "amount_mismatch" | "id_mismatch" | "not_found" | "error";

const ROW = "id, agreement_id, kind, reference, provider_arrangement_id, provider_payment_token, amount_minor, buyer_user_id, seller_user_id, buyer_customer_id, seller_customer_id, status";

/**
 * Ready on the key and the switch alone: a Payluk key in the environment
 * (PAYLUK_TEST_SECRET_KEY on staging, PAYLUK_SECRET_KEY in production) and
 * `payments_payluk_on`. PAYMENTS_KILL_PAYLUK=1 is the outage stop, as for every
 * Payluk call. A failed flag read is off.
 */
export async function arrangementsLive(db: Db, env: Readonly<Record<string, string | undefined>> = process.env): Promise<boolean> {
  if (!PAYLUK_ESCROW_FLOWS_BUILT) return false;
  if (!paylukMerchantConfig(env) || env.PAYMENTS_KILL_PAYLUK === "1") return false;
  const { data, error } = await db.from("feature_flags").select("enabled").eq("key", PROTECTED_PAY_FLAG).maybeSingle();
  return !error && (data as { enabled?: boolean } | null)?.enabled === true;
}

/**
 * Whether the partner's reports can be RECORDED: a key for this deployment,
 * nothing else. Recording is never gated by the switch or the outage stop
 * (kill-switch.ts: "never gate verify, webhooks or reconciliation: money
 * already taken must still be recorded"), so an `escrow.*` webhook or a
 * read-back during an outage still lands on Vallo's record.
 */
export function arrangementsRecordable(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return PAYLUK_ESCROW_FLOWS_BUILT && paylukMerchantConfig(env) !== null;
}

async function loadRow(db: Db, column: "id" | "provider_arrangement_id" | "reference", value: string): Promise<ArrangementRow | null> {
  const { data, error } = await db.from("provider_arrangements").select(ROW).eq(column, value).maybeSingle();
  if (error || !data) return null;
  const row = data as ArrangementRow;
  return { ...row, amount_minor: Number(row.amount_minor) };
}

async function observe(
  deps: ArrangementDeps,
  row: ArrangementRow,
  to: ArrangementStatus,
  source: "vallo" | "provider_response" | "provider_webhook" | "provider_readback",
  seen: PaylukArrangement | null,
  extra: { eventKey?: string; detail?: Record<string, unknown> } = {},
): Promise<ObserveVerdict> {
  const { data, error } = await deps.db.rpc("provider_arrangement_observe", {
    p_arrangement: row.id,
    p_to_status: to,
    p_source: source,
    p_provider_state: seen?.state ?? null,
    p_provider_status: seen?.status ?? null,
    p_provider_arrangement_id: seen?.id ?? null,
    p_provider_payment_token: seen?.paymentToken || null,
    p_provider_amount_minor: seen?.amountMinor ?? null,
    p_provider_fee_minor: seen?.feeMinor ?? null,
    p_milestones: seen?.milestones.length
      ? seen.milestones.map((m, i) => ({
          position: i + 1,
          provider_milestone_id: m.id,
          status: m.status,
          released_at: m.releasedAt,
        }))
      : null,
    p_provider_event_key: extra.eventKey ?? null,
    p_detail: extra.detail ?? {},
  });
  if (error) return "error";
  const verdict = String(data) as ObserveVerdict;
  if (verdict === "amount_mismatch" || verdict === "id_mismatch") {
    await deps.alert(`arrangement.${verdict}`, { arrangement_id: row.id, reference: row.reference, source });
  }
  return verdict;
}

/** The provider's report onto Vallo's state, observed; an undescribed pair is recorded as a detail only. */
async function observeProvider(
  deps: ArrangementDeps,
  row: ArrangementRow,
  seen: PaylukArrangement,
  source: "provider_response" | "provider_webhook" | "provider_readback",
  eventKey?: string,
): Promise<ObserveVerdict | "unmapped"> {
  const to = valloStateFor(seen.state, seen.status);
  if (!to) return "unmapped";
  const verdict = await observe(deps, row, to, source, seen, { eventKey });
  if (verdict === "changed" && to === "refunded") await unwindStayAfterRefund(deps, row);
  return verdict;
}

/**
 * The partner has returned a stay's money to the payer (a dispute Vallo
 * resolved as REFUNDED): the stay and its agreement are cancelled through the
 * database's explicit unwind (`public.partner_hold_unwind_cancel`, pending
 * migration pov05), which refuses while the partner still holds anything.
 * A rental has no booking to cancel here. Best effort: a failure raises an
 * alert for a person, and never undoes the refund already recorded.
 */
async function unwindStayAfterRefund(deps: ArrangementDeps, row: ArrangementRow): Promise<void> {
  const { data } = await deps.db.from("deal_agreements").select("booking_id").eq("id", row.agreement_id).maybeSingle();
  const bookingId = (data as { booking_id?: string | null } | null)?.booking_id ?? null;
  if (!bookingId) return;
  const { data: answer, error } = await deps.db.rpc("partner_hold_unwind_cancel", {
    p_booking: bookingId,
    p_note: "Cancelled after the payment partner returned the money to the guest.",
  });
  const status = String(answer ?? "");
  if (error || !["ok", "already_cancelled", "not_open"].includes(status)) {
    await deps.alert("arrangement.unwind_after_refund_failed", { arrangement_id: row.id, booking_id: bookingId, status: status || "error" });
  }
}

/* ------------------------------------------------------------------ open */

export type OpenInput = {
  agreementId: string;
  kind: "standard" | "milestone";
  purpose: string;
  milestones?: { title: string; description?: string | null; amountMinor: number }[];
};

export type OpenOutcome =
  | { outcome: "arranged" | "unknown" | "failed"; arrangementId: string; status: ArrangementStatus }
  | { outcome: "existing"; arrangementId: string; status: ArrangementStatus }
  | { outcome: "refused"; reason: string };

function settledWhy(f: RailFailure): string {
  return `${f.kind}${f.httpStatus ? ` ${f.httpStatus}` : ""}: ${f.detail}`;
}

export async function openArrangement(deps: ArrangementDeps, input: OpenInput): Promise<OpenOutcome> {
  if (!(await arrangementsLive(deps.db))) return { outcome: "refused", reason: "switched_off" };

  /* The delivery window first: no record is made for an agreement whose
     move-in date cannot bound the provider's claim clock. */
  const { data: ag } = await deps.db.from("deal_agreements").select("terms").eq("id", input.agreementId).maybeSingle();
  /* A rental is bounded by its move-in; a stay at a listing (ruling 2) by its check-in. */
  const agTerms = (ag as { terms?: Record<string, unknown> } | null)?.terms;
  const moveIn = ((agTerms?.move_in ?? agTerms?.check_in) ?? null) as string | null;
  const windowDays = deliveryWindowDays(moveIn, deps.todayLagos());
  if (windowDays === null) return { outcome: "refused", reason: "move_in_unreadable" };

  const { data, error } = await deps.db.rpc("provider_arrangement_open", {
    p_agreement: input.agreementId,
    p_kind: input.kind,
    p_milestones: input.kind === "milestone"
      ? (input.milestones ?? []).map((m) => ({ title: m.title, description: m.description ?? null, amount_minor: m.amountMinor }))
      : null,
  });
  if (error || !data) return { outcome: "refused", reason: "store_unavailable" };
  const opened = data as { status: string; id?: string; reference?: string };

  if (opened.status === "exists" && opened.id) {
    const row = await loadRow(deps.db, "id", opened.id);
    if (!row) return { outcome: "refused", reason: "store_unavailable" };
    /* Never a second create: an unfinished one is read back. */
    if (row.status === "preparing" || row.status === "unknown") {
      const resolved = await resolveArrangement(deps, row);
      return { outcome: "existing", arrangementId: row.id, status: resolved };
    }
    return { outcome: "existing", arrangementId: row.id, status: row.status };
  }
  if (opened.status !== "ok" || !opened.id) return { outcome: "refused", reason: opened.status };

  const row = await loadRow(deps.db, "id", opened.id);
  if (!row) return { outcome: "refused", reason: "store_unavailable" };

  const terms = { reference: row.reference, amountMinor: row.amount_minor, purpose: input.purpose, whoPays: LISTER_BEARS_THE_FEE, windowDays };
  const created =
    input.kind === "milestone"
      ? await createMilestoneArrangement(deps.ctx, row.seller_customer_id, { ...terms, milestones: input.milestones ?? [] })
      : await createStandardArrangement(deps.ctx, row.seller_customer_id, terms);

  if (created.ok) {
    const verdict = await observeProvider(deps, row, created.value, "provider_response");
    if (verdict === "changed" || verdict === "same") {
      return { outcome: "arranged", arrangementId: row.id, status: "awaiting_payment" };
    }
    await observe(deps, row, "unknown", "vallo", null, { detail: { created_but: verdict } });
    return { outcome: "unknown", arrangementId: row.id, status: "unknown" };
  }
  /* Provably not created: refused by the provider, an unapproved key, or held
     by the rate gate before sending. The record closes as failed and a later
     open makes a fresh one. */
  if (created.kind === "refused" || created.kind === "not_configured" || created.kind === "rate_limited") {
    await observe(deps, row, "failed", "provider_response", null, { detail: { why: settledWhy(created) } });
    return { outcome: "failed", arrangementId: row.id, status: "failed" };
  }
  /* Anything else may have reached the provider. */
  await observe(deps, row, "unknown", "vallo", null, { detail: { why: settledWhy(created) } });
  await deps.alert("arrangement.create_unknown", { arrangement_id: row.id, reference: row.reference });
  return { outcome: "unknown", arrangementId: row.id, status: "unknown" };
}

/* ------------------------------------------------------------- read back */

/**
 * Settle an unanswered create (or refresh any record) from the provider's own
 * answer: by payment token when Vallo has one, else by listing the seller's
 * escrows and matching Vallo's reference and the amount. Not found leaves it
 * where it is; it is never created again from here.
 */
export async function resolveArrangement(deps: ArrangementDeps, row: ArrangementRow): Promise<ArrangementStatus> {
  const seen = row.provider_payment_token
    ? await readArrangement(deps.ctx, row.provider_payment_token)
    : await findArrangement(deps.ctx, row.seller_customer_id, { reference: row.reference, amountMinor: row.amount_minor });
  if (!seen.ok || seen.value === null) return row.status;
  await observeProvider(deps, row, seen.value, "provider_readback");
  const fresh = await loadRow(deps.db, "id", row.id);
  return fresh?.status ?? row.status;
}

/* ------------------------------------------------------------------- pay */

export type ActOutcome =
  | { outcome: "submitted" | "unknown" }
  | { outcome: "refused"; reason: string };

/**
 * The renter funds the arrangement from their Payluk balance. Vallo's
 * reference for the payment is the arrangement's reference with `-pay`, so a
 * second press is the same payment, never a second one.
 */
export async function payArrangement(deps: ArrangementDeps, arrangementId: string, actorUserId: string): Promise<ActOutcome> {
  if (!(await arrangementsLive(deps.db))) return { outcome: "refused", reason: "switched_off" };
  const row = await loadRow(deps.db, "id", arrangementId);
  if (!row || row.buyer_user_id !== actorUserId) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "awaiting_payment" || !row.provider_payment_token || !row.provider_arrangement_id) {
    return { outcome: "refused", reason: `not_payable:${row.status}` };
  }
  /* Read the escrow first, as the docs ask, rather than trust a cached quote. */
  const seen = await readArrangement(deps.ctx, row.provider_payment_token);
  if (!seen.ok) return { outcome: "refused", reason: "provider_unreadable" };
  if (seen.value.amountMinor !== row.amount_minor || seen.value.id !== row.provider_arrangement_id) {
    await deps.alert("arrangement.amount_mismatch", { arrangement_id: row.id, reference: row.reference, source: "pay" });
    return { outcome: "refused", reason: "provider_mismatch" };
  }
  const owed = buyerOwesMinor(seen.value);
  if (owed === null) return { outcome: "refused", reason: "fee_share_unclear" };

  const asked = await observe(deps, row, "payment_processing", "vallo", null, { detail: { owed_minor: owed } });
  if (asked !== "changed" && asked !== "same") return { outcome: "refused", reason: `store:${asked}` };

  const paid = await fundArrangement(deps.ctx, row.buyer_customer_id, {
    arrangementId: row.provider_arrangement_id,
    reference: `${row.reference}-pay`,
    owedMinor: owed,
  });
  if (paid.ok) return { outcome: "submitted" };
  if (paid.kind === "refused" || paid.kind === "not_configured" || paid.kind === "rate_limited") {
    /* The provider charged nothing (insufficient balance, amount mismatch,
       wrong state) or the call was never sent. */
    await observe(deps, row, "awaiting_payment", "provider_response", null, { detail: { why: settledWhy(paid) } });
    return { outcome: "refused", reason: paid.kind === "refused" ? paid.detail : paid.kind };
  }
  /* Stays payment_processing: the webhook or a read-back settles it. */
  await deps.alert("arrangement.payment_unknown", { arrangement_id: row.id, reference: `${row.reference}-pay` });
  return { outcome: "unknown" };
}

/* ------------------------------------------------- the chargeback hold */

export type ReleaseGate = "clear" | "held" | "paused" | "not_found" | "error";

/**
 * THE PAYOUT RULE at the moment Vallo would instruct a release to the lister
 * (`public.chargeback_release_gate`, migration cbh01). `held`: the lister has a
 * lost chargeback still owed and finance has not overridden it for this
 * payment; the database has audited the refusal and paused the release
 * where the agreements desk shows it. `paused`: a person at Vallo paused it.
 * Fails closed on any other error. Live since 13 October 2026; should the
 * function ever be missing (a database behind the app) the gate reads
 * `clear`, and the pause trigger and the hold check in it still refuse.
 */
export async function releaseGate(db: Db, arrangementId: string): Promise<ReleaseGate> {
  try {
    const { data, error } = await (db as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
    }).rpc("chargeback_release_gate", { p_arrangement: arrangementId });
    if (error) return isMissingFunction(error) ? "clear" : "error";
    const status = data && typeof data === "object" ? (data as Record<string, unknown>).status : undefined;
    return status === "clear" || status === "held" || status === "paused" || status === "not_found" ? status : "error";
  } catch {
    return "error";
  }
}

/* --------------------------------------------------------------- release */

/**
 * The renter confirms, deliberately, and the provider releases to the
 * lister. Standard: the whole amount. Milestone: one milestone, by position.
 */
export async function requestRelease(
  deps: ArrangementDeps,
  arrangementId: string,
  actorUserId: string,
  milestonePosition?: number,
): Promise<ActOutcome> {
  if (!(await arrangementsLive(deps.db))) return { outcome: "refused", reason: "switched_off" };
  const row = await loadRow(deps.db, "id", arrangementId);
  if (!row || row.buyer_user_id !== actorUserId) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "protected" || !row.provider_arrangement_id) return { outcome: "refused", reason: `not_releasable:${row.status}` };
  /* Asked before either road, so a milestone is held and paused exactly as a
     standard release is (a paused milestone used to go through). */
  const gate = await releaseGate(deps.db, row.id);
  if (gate === "held" || gate === "paused") return { outcome: "refused", reason: "release_paused" };
  if (gate !== "clear") return { outcome: "refused", reason: "store_unavailable" };

  if (row.kind === "standard") {
    if (milestonePosition !== undefined) return { outcome: "refused", reason: "no_milestones" };
    const asked = await observe(deps, row, "release_requested", "vallo", null);
    if (asked !== "changed") return { outcome: "refused", reason: `store:${asked}` };
    const done = await confirmRelease(deps.ctx, row.buyer_customer_id, row.provider_arrangement_id);
    if (done.ok) return { outcome: "submitted" };
    if (done.kind === "refused" || done.kind === "not_configured" || done.kind === "rate_limited") {
      await observe(deps, row, "protected", "provider_response", null, { detail: { why: settledWhy(done) } });
      return { outcome: "refused", reason: done.kind };
    }
    await deps.alert("arrangement.release_unknown", { arrangement_id: row.id, reference: row.reference });
    return { outcome: "unknown" };
  }

  /* Milestone: the arrangement stays protected until the final milestone;
     each milestone records its own request. */
  if (milestonePosition === undefined) return { outcome: "refused", reason: "milestone_required" };
  const { data: m } = await deps.db
    .from("provider_arrangement_milestones")
    .select("id, provider_milestone_id, status")
    .eq("arrangement_id", row.id)
    .eq("position", milestonePosition)
    .maybeSingle();
  const milestone = m as { id: string; provider_milestone_id: string | null; status: string } | null;
  if (!milestone?.provider_milestone_id || milestone.status !== "pending") return { outcome: "refused", reason: "milestone_not_releasable" };
  const { error: markError } = await deps.db
    .from("provider_arrangement_milestones")
    .update({ status: "release_requested", release_requested_at: new Date().toISOString() })
    .eq("id", milestone.id)
    .eq("status", "pending");
  if (markError) return { outcome: "refused", reason: "store_unavailable" };
  const done = await confirmMilestone(deps.ctx, row.buyer_customer_id, row.provider_arrangement_id, milestone.provider_milestone_id);
  if (done.ok) return { outcome: "submitted" };
  if (done.kind === "refused" || done.kind === "not_configured" || done.kind === "rate_limited") {
    await deps.db
      .from("provider_arrangement_milestones")
      .update({ status: "pending", release_requested_at: null })
      .eq("id", milestone.id)
      .eq("status", "release_requested");
    return { outcome: "refused", reason: done.kind };
  }
  await deps.alert("arrangement.release_unknown", { arrangement_id: row.id, milestone: milestonePosition });
  return { outcome: "unknown" };
}

/* --------------------------------------------------------------- webhook */

const REFERENCE_IN_DESCRIPTION = /Vallo reference (vallo-arr-[0-9a-f]{32})/;

export type WebhookOutcome = ObserveVerdict | "unmapped" | "unknown_arrangement" | "malformed";

/** An `escrow.*` delivery, already signature-checked and stored raw by the route. */
export async function applyArrangementWebhook(deps: ArrangementDeps, data: unknown, eventKey: string): Promise<WebhookOutcome> {
  const seen = parseArrangement(data);
  if (!seen) return "malformed";
  let row = await loadRow(deps.db, "provider_arrangement_id", seen.id);
  if (!row) {
    /* escrow.created can arrive before the create's own answer was recorded. */
    const ref = REFERENCE_IN_DESCRIPTION.exec(seen.description)?.[1];
    row = ref ? await loadRow(deps.db, "reference", ref) : null;
  }
  if (!row) return "unknown_arrangement";
  return observeProvider(deps, row, seen, "provider_webhook", eventKey);
}

/* --------------------------------------------------- withdraw for card */

export type WithdrawOutcome =
  | { outcome: "withdrawn" | "nothing_to_withdraw" }
  | { outcome: "refused"; reason: "not_found" | "moving" | "held" | "provider_refused" | "unknown" | "switched_off" | "store" };

/**
 * The payer moves from escrow to card before paying (founder instruction:
 * nobody is stranded). An arrangement opened at the partner and never funded
 * is withdrawn there first (`withdrawArrangement`, seller only, while
 * `AWAITING_PAYMENT`), so it can never be funded for a deal that is now on
 * card; only then is Vallo's record closed as cancelled, from the partner's
 * own answer. Anything that may be moving or is held is never withdrawn here:
 * the money's position is the partner's to report.
 */
export async function withdrawForCard(deps: ArrangementDeps, agreementId: string, actorUserId: string): Promise<WithdrawOutcome> {
  const { data, error } = await deps.db
    .from("provider_arrangements")
    .select(ROW)
    .eq("agreement_id", agreementId)
    .not("status", "in", "(failed,cancelled,refunded)")
    .maybeSingle();
  if (error) return { outcome: "refused", reason: "store" };
  if (!data) return { outcome: "nothing_to_withdraw" };
  const row = { ...(data as ArrangementRow), amount_minor: Number((data as ArrangementRow).amount_minor) };
  if (row.buyer_user_id !== actorUserId) return { outcome: "refused", reason: "not_found" };
  if (["protected", "release_requested", "released", "disputed", "split"].includes(row.status)) {
    return { outcome: "refused", reason: "held" };
  }
  if (row.status !== "awaiting_payment" || !row.provider_payment_token) return { outcome: "refused", reason: "moving" };
  /* Withdrawing is a write at the partner: it needs the key, but not the
     switch, so a payer is never stranded on escrow while escrow is paused. */
  if (!arrangementsRecordable()) return { outcome: "refused", reason: "switched_off" };
  const done = await withdrawArrangement(deps.ctx, row.seller_customer_id, row.provider_payment_token);
  if (!done.ok) {
    if (done.kind === "unknown") {
      await deps.alert("arrangement.withdraw_unknown", { arrangement_id: row.id, reference: row.reference });
      return { outcome: "refused", reason: "unknown" };
    }
    /* Refused (funded meanwhile, or not the seller's) or never sent: read it
       back so Vallo's record follows the partner. */
    await resolveArrangement(deps, row);
    return { outcome: "refused", reason: "provider_refused" };
  }
  const verdict = await observe(deps, row, "cancelled", "provider_response", null, {
    detail: { why: "payer_moved_to_card", actor: actorUserId },
  });
  if (verdict !== "changed" && verdict !== "same") return { outcome: "refused", reason: "store" };
  return { outcome: "withdrawn" };
}

/* ----------------------------------------------------- staff resolution */

export type ResolveOutcome =
  | { outcome: "submitted"; to: "refunded" | "released" }
  | { outcome: "refused"; reason: "not_found" | "not_held" | "provider_refused" | "unknown" | "switched_off" | "store" | "chargeback_hold" | "release_paused" };

/**
 * A person at Vallo decides a held payment: back to the payer (REFUNDED) or
 * on to the lister (COMPLETED). The partner documents one road only (findings,
 * question 3): the buyer opens a dispute, then the merchant resolves it.
 * Vallo opens the dispute for the payer (their `customer-id`, which the
 * merchant key may act for) and resolves it at once. Nothing is recorded as
 * refunded or released here: the partner's `escrow.refunded` or
 * `escrow.completed` webhook, or a read-back, does that; the answers of the
 * two calls are observed as provider responses on the way.
 */
export async function staffResolve(
  deps: ArrangementDeps,
  arrangementId: string,
  outcome: DisputeOutcome,
  note: string,
  staffUserId: string,
): Promise<ResolveOutcome> {
  if (!arrangementsRecordable()) return { outcome: "refused", reason: "switched_off" };
  const row = await loadRow(deps.db, "id", arrangementId);
  if (!row || !row.provider_arrangement_id || !row.provider_payment_token) return { outcome: "refused", reason: "not_found" };
  if (!["protected", "release_requested", "disputed"].includes(row.status)) return { outcome: "refused", reason: "not_held" };
  /* Money on to the lister follows the payout rule; money back to the payer
     never waits on it. Finance overrides one payment with a reason. */
  if (outcome === "COMPLETED") {
    const gate = await releaseGate(deps.db, row.id);
    if (gate === "held") return { outcome: "refused", reason: "chargeback_hold" };
    if (gate === "paused") return { outcome: "refused", reason: "release_paused" };
    if (gate !== "clear") return { outcome: "refused", reason: "store" };
  }

  if (row.status !== "disputed") {
    const opened = await openDispute(
      deps.ctx,
      row.buyer_customer_id,
      row.provider_payment_token,
      `Opened by Vallo for the payer: ${note}`.slice(0, 500),
    );
    if (!opened.ok) {
      if (opened.kind === "unknown") {
        await deps.alert("arrangement.dispute_unknown", { arrangement_id: row.id, reference: row.reference, staff: staffUserId });
        return { outcome: "refused", reason: "unknown" };
      }
      /* "Buyer already submitted Dispute" is fine: the resolve below needs one. */
      if (!/already submitted/i.test(opened.detail)) return { outcome: "refused", reason: "provider_refused" };
    } else if (opened.value) {
      await observeProvider(deps, row, opened.value, "provider_response");
    }
  }

  const resolved = await resolveDispute(deps.ctx, row.provider_arrangement_id, outcome, note);
  if (!resolved.ok) {
    if (resolved.kind === "unknown") {
      await deps.alert("arrangement.resolve_unknown", { arrangement_id: row.id, reference: row.reference, staff: staffUserId });
      return { outcome: "refused", reason: "unknown" };
    }
    return { outcome: "refused", reason: "provider_refused" };
  }
  const fresh = (await loadRow(deps.db, "id", row.id)) ?? row;
  if (resolved.value) await observeProvider(deps, fresh, resolved.value, "provider_response");
  await deps.db.from("audit_log").insert({
    actor_id: staffUserId,
    action: outcome === "REFUNDED" ? "arrangement.refund_decided" : "arrangement.release_decided",
    entity_type: "provider_arrangement",
    entity_id: row.id,
    metadata: { reference: row.reference, agreement_id: row.agreement_id, amount_minor: row.amount_minor, note: note.slice(0, 500) },
  });
  return { outcome: "submitted", to: outcome === "REFUNDED" ? "refunded" : "released" };
}

/* ------------------------------------------------------- reconciliation */

/** States in which Vallo waits on the partner's word. */
export const RECONCILE_STATUSES = ["preparing", "unknown", "payment_processing", "release_requested", "disputed"] as const;

export type ReconcileSummary = { read: number; moved: number; skipped: number; failed: number };

/**
 * Read back every arrangement still waiting on the partner, oldest
 * observation first, at most `limit` per run (the key allows 10 requests a
 * minute across everything, so the budget is small on purpose). The webhook
 * is the fast path; this catches what it missed (webhooks are best effort,
 * unordered, and have no failure event on the escrow stream). Recording only:
 * never gated by the switch.
 */
export async function reconcileArrangements(deps: ArrangementDeps, limit = 3): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { read: 0, moved: 0, skipped: 0, failed: 0 };
  if (!arrangementsRecordable()) return summary;
  /* A create is given two minutes to answer before it is read back. */
  const settled = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await deps.db
    .from("provider_arrangements")
    .select(ROW)
    /* Payluk's rows only: an EscrowPay row is read back by its own adapter
       (lib/money/protected-rail.ts), never through the Payluk client. */
    .eq("provider", "payluk")
    .in("status", [...RECONCILE_STATUSES])
    .lt("updated_at", settled)
    .order("status_observed_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(limit, 5)));
  if (error || !data) {
    summary.failed += 1;
    return summary;
  }
  for (const raw of data as ArrangementRow[]) {
    const row = { ...raw, amount_minor: Number(raw.amount_minor) };
    summary.read += 1;
    try {
      const after = await resolveArrangement(deps, row);
      if (after !== row.status) summary.moved += 1;
      else summary.skipped += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
