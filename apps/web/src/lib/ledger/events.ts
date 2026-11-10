/**
 * THE LEDGER'S VOCABULARY (Session 2, 7.5; feature register E5.1 to E5.3).
 *
 * Types and pure functions only, safe to import anywhere. The database is the
 * authority (`supabase/migrations/pending/b2_ledger.sql`): every rule here is
 * also a constraint there, and `events.test.ts` reads that file so the two
 * lists cannot drift.
 *
 * THREE POTS, three tables, never a column on one table (D50, D51):
 *  - customer_funds: the member's money at the provider. Never Vallo's.
 *  - vallo_revenue: commission, withdrawal fees, promotion. Never VAT.
 *  - marketing_float: Vallo's own money funding referral payouts.
 *
 * Append-only. A mistake is corrected by a NEW entry that names the one it
 * corrects and moves the opposite way; nothing is ever edited.
 */

export const LEDGER_EVENTS = [
  "DEPOSIT_INITIATED",
  "DEPOSIT_CONFIRMED",
  "WITHDRAWAL_INITIATED",
  "WITHDRAWAL_COMPLETED",
  "TRANSFER_INITIATED",
  "TRANSFER_COMPLETED",
  "ESCROW_CREATED",
  "ESCROW_FUNDED",
  "ESCROW_RELEASED",
  "REFUND_INITIATED",
  "REFUND_COMPLETED",
  "FEE_CHARGED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
] as const;
export type LedgerEvent = (typeof LEDGER_EVENTS)[number];

export const LEDGER_POTS = ["customer_funds", "vallo_revenue", "marketing_float"] as const;
export type LedgerPot = (typeof LEDGER_POTS)[number];

export type LedgerDirection = "in" | "out";
export type LedgerStatus = "pending" | "confirmed" | "failed" | "unknown";
export type LedgerProvider = "paystack" | "vallo";

/** What each pot may never carry, exactly as the table constraints say. */
const POT_RULES: Record<LedgerPot, { providers: readonly LedgerProvider[]; forbidden: readonly LedgerEvent[] }> = {
  customer_funds: { providers: ["paystack"], forbidden: [] },
  vallo_revenue: {
    providers: ["paystack", "vallo"],
    forbidden: ["ESCROW_CREATED", "ESCROW_FUNDED", "ESCROW_RELEASED", "DEPOSIT_INITIATED", "DEPOSIT_CONFIRMED"],
  },
  marketing_float: {
    providers: ["paystack", "vallo"],
    forbidden: ["ESCROW_CREATED", "ESCROW_FUNDED", "ESCROW_RELEASED", "DISPUTE_OPENED", "DISPUTE_RESOLVED"],
  },
};

export type LedgerEntryInput = {
  pot: LedgerPot;
  /** Vallo's idempotency key: a replay with the same key writes nothing. */
  key: string;
  event: LedgerEvent;
  direction: LedgerDirection;
  amountMinor: number;
  /** ISO 4217. Never assumed to be NGN. */
  currency: string;
  provider: LedgerProvider;
  providerReference?: string | null;
  transactionId?: string | null;
  rail?: "escrow" | "direct" | null;
  status?: LedgerStatus;
  metadata?: Record<string, unknown>;
  /** The entry this one corrects, in the same pot. */
  correctsEntryId?: string | null;
  actorId?: string | null;
};

/** Pure. Why the database would refuse this entry, in words, or null. */
export function ledgerEntryProblem(e: LedgerEntryInput): string | null {
  if (!(LEDGER_POTS as readonly string[]).includes(e.pot)) return "unknown pot";
  if (!(LEDGER_EVENTS as readonly string[]).includes(e.event)) return "unknown event type";
  const rules = POT_RULES[e.pot];
  if (rules.forbidden.includes(e.event)) return `${e.pot} never carries ${e.event}`;
  if (!rules.providers.includes(e.provider)) return `${e.pot} never carries a ${e.provider} entry`;
  if (!Number.isSafeInteger(e.amountMinor) || e.amountMinor <= 0) return "the amount must be a positive whole number of minor units";
  if (!/^[A-Z]{3}$/.test(e.currency)) return "the currency must be an ISO 4217 code";
  if (e.direction !== "in" && e.direction !== "out") return "the direction must be in or out";
  const key = e.key.trim();
  if (key.length < 8 || key.length > 200) return "the key must be 8 to 200 characters";
  return null;
}
