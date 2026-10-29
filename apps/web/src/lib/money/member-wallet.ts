import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import { getAdminClient } from "../supabase/service";
import { can, type AnyFiatProvider, type FiatProvider, type RailFailure, type RailMovement } from "../payments/provider";
import { fiatProvider, memberWalletRailLive } from "../payments/providers";
import { reportReadFault } from "../observability/read-error";
import {
  balanceFigures,
  isFresh,
  isOpenMovement,
  movementStatusForProvider,
  onboardingStateFor,
  profileGaps,
  openFailureKind,
  type BalanceFigures,
  type OpenFailure,
  type MovementKind,
  type MovementStatus,
  type OnboardingState,
  type ProfileGap,
} from "./funds";
import { sumMovements, type MovementTotals } from "./wallet-view";

export type { MovementTotals };

/**
 * THE MEMBER BALANCE, SERVER SIDE (Part B phase 6; founder section 10).
 *
 * Every figure a member sees comes from here and is either what the provider
 * reported, with the time it reported it, or Vallo's record of the member's
 * own requests. Never a figure the browser computed, and never one invented
 * for a rail that is not live: that is its own state, said plainly.
 *
 * The provider is the book of record (ADR 0003). `member_funds_reported` is a
 * cache of what it said, kept so ten requests a minute can serve a platform
 * and so an unreachable provider shows "last confirmed at", not a blank.
 */

export type WalletProvider = AnyFiatProvider & FiatProvider<"member_wallet">;
/* The new tables are not in the generated types until the migration lands. */
export type Db = SupabaseClient;

export type AccountRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_customer_id: string | null;
  status: OnboardingState;
  provider_status: string | null;
  status_observed_at: string;
  metadata?: { last_failure?: string | null } | null;
};

export type MovementRow = {
  id: string;
  user_id: string;
  kind: MovementKind;
  reference: string;
  amount_minor: number;
  provider_fee_minor: number | null;
  vallo_fee_minor: number;
  vat_minor: number;
  currency: string;
  status: MovementStatus;
  status_source: string;
  status_observed_at: string;
  counterparty: Record<string, string>;
  narration: string | null;
  provider_metadata: Record<string, unknown>;
  created_at: string;
};

export const MOVEMENT_COLUMNS =
  "id, user_id, kind, reference, amount_minor, provider_fee_minor, vallo_fee_minor, vat_minor, currency, status, status_source, status_observed_at, counterparty, narration, provider_metadata, created_at";

export function walletProvider(): WalletProvider | null {
  const p = fiatProvider("payluk");
  return p && can(p, "member_wallet") ? p : null;
}

export function adminDb(): Db | null {
  return getAdminClient() as unknown as Db | null;
}

/* ------------------------------------------------------------ records */

export async function loadAccount(db: Db, userId: string): Promise<AccountRow | null> {
  const { data, error } = await db
    .from("financial_provider_accounts")
    .select("id, user_id, provider, provider_customer_id, status, provider_status, status_observed_at, metadata")
    .eq("user_id", userId)
    .eq("provider", "payluk")
    .maybeSingle();
  if (error) throw error;
  return (data as AccountRow | null) ?? null;
}

export async function loadMovement(db: Db, userId: string, movementId: string): Promise<MovementRow | null> {
  const { data, error } = await db.from("funds_movements").select(MOVEMENT_COLUMNS).eq("id", movementId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as MovementRow | null) ?? null;
}

export async function recentMovements(db: Db, userId: string, limit = 20): Promise<MovementRow[]> {
  const { data, error } = await db
    .from("funds_movements")
    .select(MOVEMENT_COLUMNS)
    .eq("user_id", userId)
    .not("status", "in", "(preparing,cancelled)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as MovementRow[] | null) ?? [];
}

/**
 * MONEY IN AND MONEY OUT, from the member's own completed movements (D81:
 * the founder's Total received and Total spent). Only rows the provider
 * confirmed as completed count (the database refuses "completed" from
 * anywhere else), so the two sums are facts, never estimates. The sum
 * itself is `sumMovements` (wallet-view.ts, pure and tested).
 */
/** The most completed rows the totals read: past it, the totals say nothing rather than a partial sum. */
export const TOTALS_ROW_LIMIT = 5000;

export async function movementTotals(db: Db, userId: string): Promise<MovementTotals | null> {
  const { data, error } = await db
    .from("funds_movements")
    .select("kind, amount_minor")
    .eq("user_id", userId)
    .eq("status", "completed")
    .limit(TOTALS_ROW_LIMIT + 1);
  if (error) throw error;
  const rows = (data as { kind: MovementKind; amount_minor: number }[] | null) ?? [];
  if (rows.length > TOTALS_ROW_LIMIT) return null;
  return sumMovements(rows.map((r) => ({ kind: r.kind, amountMinor: Number(r.amount_minor) })));
}

export type ObserveSource = "vallo" | "provider_response" | "provider_webhook" | "provider_readback";

/** The one status writer (`funds_movement_observe`): locked, legal, idempotent. */
export async function observe(
  db: Db,
  reference: string,
  to: MovementStatus,
  source: ObserveSource,
  extra: { providerStatus?: string; providerTransactionId?: string; providerFeeMinor?: number; detail?: Record<string, unknown> } = {},
): Promise<"changed" | "same" | "refused" | "not_found" | "error"> {
  const { data, error } = await db.rpc("funds_movement_observe", {
    p_reference: reference,
    p_to_status: to,
    p_source: source,
    p_provider_status: extra.providerStatus ?? null,
    p_provider_transaction_id: extra.providerTransactionId ?? null,
    p_provider_fee_minor: extra.providerFeeMinor ?? null,
    p_detail: extra.detail ?? {},
  });
  if (error) {
    await reportReadFault("read.money.funds_movement_observe", error);
    return "error";
  }
  return data as "changed" | "same" | "refused" | "not_found";
}

/**
 * Settle an open movement from the provider's own record (the read-back that
 * resolves UNKNOWN, founder section 46). Never re-submits anything: it only
 * reads, and moves the record to what the provider says. Absence leaves the
 * record as it is.
 */
export async function readBack(db: Db, provider: WalletProvider, customerId: string, m: MovementRow): Promise<MovementStatus> {
  if (!isOpenMovement(m.status)) return m.status;
  const r = await provider.findMovement(customerId, m.reference);
  if (!r.ok || r.value === null) return m.status;
  const found: RailMovement = r.value;
  if (found.amountMinor !== m.amount_minor) {
    await observe(db, m.reference, "under_review", "provider_readback", {
      providerStatus: found.status,
      detail: { reason: "amount_mismatch", provider_amount_minor: found.amountMinor },
    });
    return "under_review";
  }
  const to = movementStatusForProvider(found.status);
  const verdict = await observe(db, m.reference, to, "provider_readback", {
    providerStatus: found.status,
    providerTransactionId: found.providerId || undefined,
    providerFeeMinor: found.feeMinor,
  });
  return verdict === "changed" || verdict === "same" ? to : m.status;
}

/* ------------------------------------------------------------- balance */

export type Reported = { availableMinor: number; protectedMinor: number; currency: string; observedAt: string; live: boolean };

/**
 * The provider's balance for a member: from the cache while fresh, else read
 * and recorded. When the provider cannot answer, the last record is returned
 * with `live: false` and its own time, or null if there never was one.
 */
export async function reportedBalance(
  db: Db,
  provider: WalletProvider,
  userId: string,
  customerId: string,
  opts: { force?: boolean } = {},
): Promise<{ reported: Reported | null; failure: RailFailure | null }> {
  const { data: cached } = await db
    .from("member_funds_reported")
    .select("available_minor, protected_minor, currency, observed_at")
    .eq("user_id", userId)
    .eq("provider", "payluk")
    .maybeSingle();
  const row = cached as { available_minor: number; protected_minor: number; currency: string; observed_at: string } | null;
  const fromRow = (r: NonNullable<typeof row>, live: boolean): Reported => ({
    availableMinor: Number(r.available_minor),
    protectedMinor: Number(r.protected_minor),
    currency: r.currency,
    observedAt: r.observed_at,
    live,
  });
  if (row && !opts.force && isFresh(row.observed_at, Date.now())) return { reported: fromRow(row, true), failure: null };

  const r = await provider.readBalance(customerId);
  if (!r.ok) return { reported: row ? fromRow(row, false) : null, failure: r };
  const observedAt = new Date().toISOString();
  await db.from("member_funds_reported").upsert(
    {
      user_id: userId,
      provider: "payluk",
      provider_balance_id: r.value.providerBalanceId || customerId,
      available_minor: r.value.availableMinor,
      protected_minor: r.value.protectedMinor,
      currency: r.value.currency,
      observed_at: observedAt,
    },
    { onConflict: "user_id,provider" },
  );
  return {
    reported: { availableMinor: r.value.availableMinor, protectedMinor: r.value.protectedMinor, currency: r.value.currency, observedAt, live: true },
    failure: null,
  };
}

/* ---------------------------------------------------------- the read */

export type MovementView = {
  id: string;
  kind: MovementKind;
  status: MovementStatus;
  amountMinor: number;
  providerFeeMinor: number | null;
  currency: string;
  counterparty: Record<string, string>;
  reference: string;
  createdAt: string;
  observedAt: string;
  confirmedByProvider: boolean;
};

export function movementView(m: MovementRow): MovementView {
  return {
    id: m.id,
    kind: m.kind,
    status: m.status,
    amountMinor: Number(m.amount_minor),
    providerFeeMinor: m.provider_fee_minor === null ? null : Number(m.provider_fee_minor),
    currency: m.currency,
    counterparty: m.counterparty ?? {},
    reference: m.reference,
    createdAt: m.created_at,
    observedAt: m.status_observed_at,
    confirmedByProvider: m.status_source === "provider_webhook" || m.status_source === "provider_readback",
  };
}

export type BalanceRead =
  | { state: "signed-out" }
  | { state: "not-live"; reason: "not_configured" | "switched_off" }
  | { state: "onboarding"; onboarding: OnboardingState; gaps: ProfileGap[]; failure?: OpenFailure | null }
  | { state: "error" }
  | {
      state: "ready";
      /** False when the provider could not be reached and these are the last figures it gave. */
      live: boolean;
      figures: BalanceFigures | null;
      movements: MovementView[];
      /**
       * Money in and out from completed movements; null when they could not
       * be summed honestly. Optional so the older reads stay valid.
       */
      totals?: MovementTotals | null;
      /** True when `movements` stopped at the read's limit and older ones exist. */
      more?: boolean;
      /** The server's clock when this was read, so "confirmed n minutes ago" agrees on both sides. */
      readAt: string;
    };

export async function profileFor(db: Db, user: User): Promise<{ firstName: string | null; lastName: string | null; phone: string | null; email: string | null }> {
  const [{ data }, { data: confirmed }] = await Promise.all([
    db.from("profiles").select("first_name, surname, phone").eq("id", user.id).maybeSingle(),
    /* The number the member confirmed with a code is the one the wallet opens
       with (27 October 2026): "verify your number" must not come back for
       somebody who already did. */
    db.from("confirmed_phones").select("phone").eq("user_id", user.id).maybeSingle(),
  ]);
  const p = (data ?? {}) as { first_name?: string | null; surname?: string | null; phone?: string | null };
  const c = (confirmed ?? null) as { phone?: string | null } | null;
  return {
    firstName: p.first_name ?? null,
    lastName: p.surname ?? null,
    phone: c?.phone ?? p.phone ?? user.phone ?? null,
    email: user.email ?? null,
  };
}

/**
 * The /wallet page's one read. `limit` is how many recent movements to bring;
 * the Transactions screen asks for more than the overview's preview.
 */
export async function readMyBalance(opts: { limit?: number } = {}): Promise<BalanceRead> {
  const limit = opts.limit ?? 20;
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  const rail = await memberWalletRailLive();
  if (rail !== "live") return { state: "not-live", reason: rail };
  const db = adminDb();
  const provider = walletProvider();
  if (!db || !provider) return { state: "not-live", reason: "not_configured" };

  try {
    const userId = session.user.id;
    const account = await loadAccount(db, userId);
    if (!account || account.status !== "ACTIVE" || !account.provider_customer_id) {
      const gaps = profileGaps(await profileFor(db, session.user));
      const onboarding = onboardingStateFor({
        account: account ? { state: account.status, providerCustomerId: account.provider_customer_id } : null,
        customer: null,
        gaps,
      });
      const failure = onboarding === "FAILED" ? openFailureKind(account?.metadata?.last_failure) : null;
      return { state: "onboarding", onboarding, gaps, failure };
    }

    const { reported } = await reportedBalance(db, provider, userId, account.provider_customer_id);
    const [rows, totals] = await Promise.all([recentMovements(db, userId, limit + 1), movementTotals(db, userId)]);
    const more = rows.length > limit;
    const movements = rows.slice(0, limit).map(movementView);
    const figures = reported
      ? balanceFigures(
          reported,
          movements.map((m) => ({ kind: m.kind, status: m.status, amountMinor: m.amountMinor, providerFeeMinor: m.providerFeeMinor, observedAt: m.observedAt })),
        )
      : null;
    return { state: "ready", live: reported?.live ?? false, figures, movements, totals, more, readAt: new Date().toISOString() };
  } catch (error) {
    await reportReadFault("read.money.member_balance", error);
    return { state: "error" };
  }
}
