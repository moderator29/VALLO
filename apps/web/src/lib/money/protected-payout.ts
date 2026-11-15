import "server-only";

import { normalisePayoutEvent, normalisePayoutWord, payoutStepOk, type PayoutState } from "../payments/providers/escrowpay/normaliser";
import { readPayout, readPayoutList, type ProviderPayout } from "../payments/providers/escrowpay/read";
import { payoutReadCall, payoutsSinceCall } from "../payments/providers/escrowpay/requests";
import type { EscrowPayWebhook } from "../payments/providers/escrowpay/webhooks";
import type { Db } from "./member-wallet";
import { providerReachable, type ProtectedRailDeps } from "./protected-provider";

/**
 * THE PAYOUT TO THE LISTER (the founder's automatic payout, 15 November 2026).
 *
 * Once the bank releases a protected payment, the payment partner sends it
 * straight on to the lister's own bank account. That last step is the
 * partner's, and Vallo records it only from the partner's own word: its
 * signed `payout.*` webhooks, or a read-back of its payouts when a webhook
 * was missed. It is kept on the payment record's own payout columns (pending
 * SQL protected_payout_to_lister_2026-11-15.sql), never as the payment's
 * state: a released payment stays released whatever happens to the transfer
 * after it, and a payout that failed is a person's to follow up, with the
 * lister told.
 *
 * Until that SQL has run the columns are not there, and every step here
 * answers that it recorded nothing, rather than failing the webhook.
 */

export type PayoutVerdict = "changed" | "same" | "refused" | "unmapped" | "unknown_arrangement" | "error";

type PayoutRow = {
  id: string;
  reference: string;
  status: string;
  provider_arrangement_id: string | null;
  payout_status: PayoutState | null;
  payout_reference: string | null;
  release_requested_at: string | null;
  release_confirmed_at: string | null;
  payout_updated_at: string | null;
};

const PAYOUT_ROW =
  "id, reference, status, provider_arrangement_id, payout_status, payout_reference, release_requested_at, release_confirmed_at, payout_updated_at";

type Answer = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
type Query = {
  eq: (c: string, v: string) => Query;
  is: (c: string, v: null) => Query;
  or: (filter: string) => Query;
  lt: (c: string, v: string) => Query;
  order: (c: string, o: { ascending: boolean; nullsFirst: boolean }) => Query;
  limit: (n: number) => Query;
  select: (s: string) => Query;
  maybeSingle: () => Answer;
} & Answer;
type Table = { select: (s: string) => Query; update: (v: Record<string, unknown>) => Query; insert: (v: Record<string, unknown>) => Answer };
const table = (db: Db, name: string): Table => (db as unknown as { from: (t: string) => Table }).from(name);

/** The payout columns are not there yet (the pending SQL has not run). */
const columnsMissing = (error: { code?: string } | null) => error?.code === "42703";

async function rowForTransaction(db: Db, transactionId: string): Promise<{ row: PayoutRow | null; missing: boolean; failed: boolean }> {
  try {
    const { data, error } = await table(db, "provider_arrangements")
      .select(PAYOUT_ROW)
      .eq("provider", "escrowpay")
      .eq("provider_arrangement_id", transactionId)
      .maybeSingle();
    if (error) return { row: null, missing: columnsMissing(error), failed: !columnsMissing(error) };
    return { row: (data as PayoutRow | null) ?? null, missing: false, failed: false };
  } catch {
    return { row: null, missing: false, failed: true };
  }
}

/**
 * Write one payout step, only if it is a step the payout may take from where
 * the record stands, and only if nobody wrote another in between (the update
 * is conditional on the state it read). The step is also written to the
 * payment's own trail, which the staff desk reads.
 */
async function recordPayout(
  deps: ProtectedRailDeps,
  row: PayoutRow,
  to: PayoutState,
  payout: Partial<ProviderPayout>,
  source: "provider_webhook" | "provider_readback",
  eventKey: string | null,
): Promise<PayoutVerdict> {
  const from = row.payout_status ?? null;
  if (from === to) return "same";
  if (!payoutStepOk(from, to)) return "refused";
  const now = new Date(deps.now()).toISOString();
  const values: Record<string, unknown> = { payout_status: to, payout_updated_at: now };
  if (payout.id) values.payout_reference = payout.id;
  if (payout.amountMinor !== undefined && payout.amountMinor !== null) values.payout_amount_minor = payout.amountMinor;
  if (payout.feeMinor !== undefined && payout.feeMinor !== null) values.payout_fee_minor = payout.feeMinor;
  if (to === "paid") values.payout_completed_at = payout.completedAt ?? now;
  try {
    let update = table(deps.db, "provider_arrangements").update(values).eq("id", row.id);
    update = from === null ? update.is("payout_status", null) : update.eq("payout_status", from);
    const { data, error } = await update.select("id");
    if (error) return columnsMissing(error) ? "unmapped" : "error";
    if (!Array.isArray(data) || data.length === 0) return "same";
  } catch {
    return "error";
  }
  try {
    await table(deps.db, "provider_arrangement_events").insert({
      arrangement_id: row.id,
      from_status: row.status,
      to_status: row.status,
      source,
      provider_state: payout.status ?? null,
      provider_event_key: eventKey,
      detail: { payout: to, payout_id: payout.id ?? null },
    });
  } catch {
    /* The trail line is best effort; the payout columns hold the fact. */
  }
  if (to === "failed" || to === "reversed") {
    await deps.alert("protected_rail.payout_trouble", { arrangement_id: row.id, reference: row.reference, payout: to, payout_id: payout.id ?? null });
  }
  return "changed";
}

/** Whether a webhook event is about a payout. */
export function isPayoutEvent(event: string): boolean {
  return normalisePayoutEvent(event) !== null;
}

/** A verified `payout.*` delivery, onto the payment it settles. */
export async function applyPayoutWebhook(deps: ProtectedRailDeps, event: EscrowPayWebhook): Promise<PayoutVerdict> {
  const to = normalisePayoutEvent(event.event);
  if (!to) return "unmapped";
  if (!event.transactionId) return "unknown_arrangement";
  const found = await rowForTransaction(deps.db, event.transactionId);
  if (found.failed) return "error";
  if (found.missing) return "unmapped";
  if (!found.row) return "unknown_arrangement";
  const data = event.data;
  const fee = data.fee_minor;
  const completed = data.completed_at;
  return recordPayout(
    deps,
    found.row,
    to,
    {
      id: event.object === "payout" ? event.objectId : undefined,
      status: event.event,
      amountMinor: event.amountMinor,
      feeMinor: typeof fee === "number" && Number.isSafeInteger(fee) && fee >= 0 ? fee : null,
      completedAt: typeof completed === "string" && completed ? completed : event.createdAt,
    },
    "provider_webhook",
    event.key,
  );
}

/** How far back to look for a payout a release produced, before the release was asked for. */
const LOOKBACK_MS = 10 * 60_000;

/**
 * The provider's payout for one released payment: by its id when a webhook
 * named it, otherwise from the payouts made since the release, matched on
 * the transaction they settle.
 */
async function findPayout(deps: ProtectedRailDeps, row: PayoutRow): Promise<ProviderPayout | null> {
  if (row.payout_reference) {
    const read = await deps.send(deps.config, payoutReadCall(row.payout_reference));
    return read.ok ? readPayout(read.value) : null;
  }
  const since = Date.parse(row.release_requested_at ?? row.release_confirmed_at ?? "");
  if (!Number.isFinite(since) || !row.provider_arrangement_id) return null;
  const listed = await deps.send(deps.config, payoutsSinceCall(new Date(since - LOOKBACK_MS).toISOString()));
  if (!listed.ok) return null;
  return readPayoutList(listed.value).find((p) => p.transactionId === row.provider_arrangement_id) ?? null;
}

export type PayoutReconcileSummary = { read: number; moved: number; skipped: number; failed: number };

/**
 * Read back the payouts the webhook may have missed: released payments whose
 * transfer to the lister is not yet known to have completed, oldest first, a
 * few per run. Recording only; it never moves money.
 */
export async function reconcilePayouts(deps: ProtectedRailDeps, limit = 3): Promise<PayoutReconcileSummary> {
  const summary: PayoutReconcileSummary = { read: 0, moved: 0, skipped: 0, failed: 0 };
  if (!providerReachable(deps)) return summary;
  const settled = new Date(deps.now() - 2 * 60_000).toISOString();
  let rows: PayoutRow[];
  try {
    const { data, error } = await table(deps.db, "provider_arrangements")
      .select(PAYOUT_ROW)
      .eq("provider", "escrowpay")
      .eq("status", "released")
      .or("payout_status.is.null,payout_status.eq.processing")
      .lt("updated_at", settled)
      .order("payout_updated_at", { ascending: true, nullsFirst: true })
      .limit(Math.max(1, Math.min(limit, 10)));
    if (error) {
      if (!columnsMissing(error)) summary.failed += 1;
      return summary;
    }
    rows = (data ?? []) as PayoutRow[];
  } catch {
    summary.failed += 1;
    return summary;
  }
  for (const row of rows) {
    summary.read += 1;
    try {
      const payout = await findPayout(deps, row);
      const to = payout ? normalisePayoutWord(payout.status) : null;
      if (!payout || !to) {
        summary.skipped += 1;
        continue;
      }
      const verdict = await recordPayout(deps, row, to, payout, "provider_readback", null);
      if (verdict === "changed") summary.moved += 1;
      else if (verdict === "error") summary.failed += 1;
      else summary.skipped += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
