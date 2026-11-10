import "server-only";

import type { RailResult } from "../payments/provider";
import { escrowPayConfig, type EscrowPayConfig } from "../payments/providers/escrowpay/config";
import { DOCUMENTED, ESCROWPAY_PATHS, escrowPayRequest, type EscrowPayCall } from "../payments/providers/escrowpay/client";
import { normaliseEscrowPayStatus } from "../payments/providers/escrowpay/normaliser";
import { escrowPayEnabled } from "../payments/providers/escrowpay/switch";
import type { ArrangementStatus } from "./arrangement-states";
import type { Db } from "./member-wallet";
import { releaseGate } from "./release-gate";

/**
 * THE PROTECTED RAIL, SERVER SIDE (BUILD section 5, phase 3; 10 November
 * 2026). Built switched off.
 *
 * The rules that cannot bend, each held here and again in the database:
 *  - funded, released and refunded are recorded ONLY from the provider's
 *    own word (its signed webhook or a read-back), through
 *    `public.provider_arrangement_observe`, which refuses them from Vallo;
 *  - an unknown provider word moves nothing (`normaliseEscrowPayStatus` is
 *    null for it) and never becomes released;
 *  - no answer is `unknown`, never retried blindly, resolved by reading back;
 *  - "I've made the transfer" only marks a request to look again;
 *  - the switch (`payments_escrowpay_on`, fail closed) gates only what STARTS
 *    money movement: opening and releasing. Reading back is never gated, so
 *    money already taken is always recorded.
 *
 * Today nothing here reaches the provider: `DOCUMENTED` is false, so every
 * call answers `not_configured` before the network.
 */

export type ProtectedRailDeps = {
  db: Db;
  config: EscrowPayConfig | null;
  send: (config: EscrowPayConfig | null, call: EscrowPayCall) => Promise<RailResult<unknown>>;
  enabled: () => Promise<boolean>;
  alert: (kind: string, detail: Record<string, unknown>) => Promise<void>;
};

export function protectedRailDeps(db: Db, alert: ProtectedRailDeps["alert"]): ProtectedRailDeps {
  return { db, config: escrowPayConfig(process.env), send: escrowPayRequest, enabled: escrowPayEnabled, alert };
}

/** Whether a call to the provider could be made at all (never the switch: reading back is not gated). */
export function providerReachable(deps: ProtectedRailDeps): boolean {
  return DOCUMENTED && deps.config !== null;
}

/** Whether money movement may START: reachable, and the founder's switch on. */
export async function protectedRailOpen(deps: ProtectedRailDeps): Promise<boolean> {
  if (!providerReachable(deps)) return false;
  try {
    return await deps.enabled();
  } catch {
    return false;
  }
}

type Row = {
  id: string;
  agreement_id: string;
  provider: string;
  reference: string;
  provider_reference: string | null;
  amount_minor: number;
  buyer_user_id: string;
  seller_user_id: string;
  status: ArrangementStatus;
};

const ROW = "id, agreement_id, provider, reference, provider_reference, amount_minor, buyer_user_id, seller_user_id, status";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc = (db: Db): Rpc => (db as unknown as { rpc: Rpc }).rpc.bind(db);

async function loadRow(db: Db, id: string): Promise<Row | null> {
  const { data, error } = await (db as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
  })
    .from("provider_arrangements")
    .select(ROW)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Row;
  if (row.provider !== "escrowpay") return null;
  return { ...row, amount_minor: Number(row.amount_minor) };
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

/** A provider failure that provably moved nothing. Anything else may have reached it. */
function provablyNothing(result: RailResult<unknown>): boolean {
  return !result.ok && (result.kind === "refused" || result.kind === "not_configured" || result.kind === "rate_limited");
}

/**
 * The provider's report about one arrangement, read the only way the
 * documentation will allow. TODO(provider-docs): the response shape. Until it
 * is documented this reads nothing, so it can never record a state.
 */
function readReport(value: unknown): { status: ArrangementStatus | null; amountMinor: number | null; id: string | null; word: string | null } {
  void value;
  return { status: normaliseEscrowPayStatus(null), amountMinor: null, id: null, word: null };
}

/* --------------------------------------------------------------- open */

export type OpenProtectedOutcome =
  | { outcome: "opened"; arrangementId: string; status: ArrangementStatus }
  | { outcome: "existing"; arrangementId: string }
  | { outcome: "unknown"; arrangementId: string }
  | { outcome: "failed"; arrangementId: string }
  | { outcome: "refused"; reason: string };

/**
 * Open the protected payment for an approved agreement, on the exact version
 * the payer accepted (spec screen 2). The database decides everything it can
 * (`public.protected_payment_open`: the switch, the category, the rail, a
 * card attempt, the single live arrangement, the named payer), then the
 * provider is asked once. A row is made before the call, so an unanswered
 * call is read back, never repeated.
 */
export async function openProtectedPayment(
  deps: ProtectedRailDeps,
  input: { agreementId: string; acceptedVersion: number; actorUserId: string },
): Promise<OpenProtectedOutcome> {
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: providerReachable(deps) ? "switched_off" : "not_configured" };
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
  /* The tenant opens it; the payer on the row may be a named payer the
     tenant chose and who accepted (the database decided which). */

  /* TODO(provider-docs): the create body (amount unit, parties, reference,
     release condition, callback). Nothing is invented; the client refuses to
     send while undocumented. */
  const created = await deps.send(deps.config, { method: "POST", path: ESCROWPAY_PATHS.create, body: { reference: row.reference }, reference: row.reference });
  if (created.ok) {
    const report = readReport(created.value);
    if (report.status) {
      const verdict = await observe(deps, row, report.status, "provider_response", {}, { state: report.word, amountMinor: report.amountMinor, id: report.id });
      if (verdict === "changed" || verdict === "same") return { outcome: "opened", arrangementId: row.id, status: report.status };
    }
    await observe(deps, row, "unknown", "vallo", { created_but_unread: true });
    await deps.alert("protected_rail.create_unread", { arrangement_id: row.id, reference: row.reference });
    return { outcome: "unknown", arrangementId: row.id };
  }
  if (provablyNothing(created)) {
    /* The provider never made it: closed as failed, from the provider's own refusal. */
    await observe(deps, row, "failed", "provider_response", { why: created.kind });
    return { outcome: "failed", arrangementId: row.id };
  }
  await observe(deps, row, "unknown", "vallo", { why: created.ok ? "unread" : created.kind });
  await deps.alert("protected_rail.create_unknown", { arrangement_id: row.id, reference: row.reference });
  return { outcome: "unknown", arrangementId: row.id };
}

/* ---------------------------------------------------------- read back */

export type RefreshOutcome =
  | { outcome: "read"; status: ArrangementStatus; moved: boolean }
  | { outcome: "not_reachable" }
  | { outcome: "refused"; reason: string };

/** Read the provider's word for one arrangement. Never gated by the switch; never moves a state the provider did not report. */
export async function readBack(deps: ProtectedRailDeps, row: Row, source: "provider_readback" = "provider_readback"): Promise<RefreshOutcome> {
  if (!providerReachable(deps)) return { outcome: "not_reachable" };
  const seen = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.read(row.provider_reference ?? row.reference) });
  if (!seen.ok) return { outcome: "read", status: row.status, moved: false };
  const report = readReport(seen.value);
  if (!report.status) return { outcome: "read", status: row.status, moved: false };
  const verdict = await observe(deps, row, report.status, source, {}, { state: report.word, amountMinor: report.amountMinor, id: report.id });
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
 * Vallo instructs the release. Only the provider's report then records it
 * released. Refused while the switch is off, and while the chargeback gate
 * holds or a person paused it.
 */
export async function confirmProtectedMilestone(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<ActOutcome> {
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: "switched_off" };
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row || row.buyer_user_id !== input.actorUserId) return { outcome: "refused", reason: "not_found" };
  if (row.status !== "protected") return { outcome: "refused", reason: `not_releasable:${row.status}` };
  const gate = await releaseGate(deps.db, row.id);
  if (gate === "held" || gate === "paused") return { outcome: "refused", reason: "release_paused" };
  if (gate !== "clear") return { outcome: "refused", reason: "store_unavailable" };

  const asked = await observe(deps, row, "release_requested", "vallo");
  if (asked !== "changed") return { outcome: "refused", reason: `store:${asked}` };
  /* TODO(provider-docs): the release body and its idempotency. */
  const done = await deps.send(deps.config, { method: "POST", path: ESCROWPAY_PATHS.release(row.provider_reference ?? row.reference), reference: row.reference });
  if (done.ok) return { outcome: "submitted" };
  if (provablyNothing(done)) {
    await observe(deps, row, "protected", "provider_response", { release_refused: done.ok ? "" : done.kind });
    return { outcome: "refused", reason: done.ok ? "unknown" : done.kind };
  }
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
 * New details after the old ones expired. TODO(provider-docs, audit 10.2
 * item 10): how an unfunded arrangement is cancelled and whether a new one or
 * new instructions are issued. Until then this refuses, and the screen sends
 * the payer to support with the old reference: an expired instruction is
 * never reused (spec screen 3).
 */
export async function askNewTransferDetails(deps: ProtectedRailDeps, input: { arrangementId: string; actorUserId: string }): Promise<ActOutcome> {
  const row = await loadRow(deps.db, input.arrangementId);
  if (!row || row.buyer_user_id !== input.actorUserId) return { outcome: "refused", reason: "not_found" };
  if (!(await protectedRailOpen(deps))) return { outcome: "refused", reason: "switched_off" };
  return { outcome: "refused", reason: "not_documented" };
}

/* ------------------------------------------------------------ webhook */

export type ProtectedWebhookOutcome = Verdict | "unmapped" | "unknown_arrangement" | "malformed";

/** A delivery the route has already verified and stored raw. */
export async function applyProtectedWebhook(
  deps: ProtectedRailDeps,
  event: { key: string; providerReference: string; status: string },
): Promise<ProtectedWebhookOutcome> {
  const to = normaliseEscrowPayStatus(event.status);
  if (!to) return "unmapped";
  const { data, error } = await (deps.db as unknown as {
    from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } } };
  })
    .from("provider_arrangements")
    .select(ROW)
    .eq("provider", "escrowpay")
    .eq("provider_reference", event.providerReference)
    .maybeSingle();
  if (error) return "error";
  if (!data) return "unknown_arrangement";
  const row = { ...(data as Row), amount_minor: Number((data as Row).amount_minor) };
  return observe(deps, row, to, "provider_webhook", {}, { state: event.status, eventKey: event.key });
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
