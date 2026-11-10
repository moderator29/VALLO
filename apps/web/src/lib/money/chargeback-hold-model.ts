/**
 * THE LISTER'S CHARGEBACK HOLD, as their money screens read it.
 *
 * The payout rule is `public.lister_chargeback_hold(lister)`: true while the
 * lister has a LOST chargeback whose recovery is still owed. Since migration
 * cbh01 (13 October 2026) it is enforced where Vallo instructs money to the
 * lister: protected-payment releases and Rewards Balance payouts are refused
 * while it holds, unless finance overrides one with a reason. Card payments
 * split at charge time still settle to the lister directly. An undecided
 * chargeback holds nothing (one dispute must not stop a lister's business
 * before it is decided), so it is shown as its own calmer state.
 *
 * Two sources, one shape:
 *   - `public.my_chargeback_hold()` (cb01, live), the signed-in person's
 *     own answer with the owed total, the count and the undecided count;
 *   - as a fallback, `lister_chargeback_hold(uuid)` for the
 *     session's own id, which says held or not and nothing more.
 *
 * Pure: the read is `chargeback-hold.ts`.
 */
export type ChargebackHold =
  | { state: "none" }
  | { state: "open"; openCount: number }
  | {
      state: "held";
      /** Null when only the yes-or-no predicate could be read. */
      owedMinor: number | null;
      currency: string;
      count: number | null;
      since: string | null;
      openCount: number;
    };

export const NO_HOLD: ChargebackHold = { state: "none" };

const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);

/** `my_chargeback_hold()`'s jsonb, read. Anything unreadable is no hold: the notice never alarms on a guess. */
export function holdFromSummary(data: unknown): ChargebackHold {
  if (!data || typeof data !== "object" || Array.isArray(data)) return NO_HOLD;
  const d = data as Record<string, unknown>;
  const openCount = int(d.open_count);
  if (d.held === true) {
    return {
      state: "held",
      owedMinor: int(d.owed_minor),
      currency: typeof d.currency === "string" && d.currency.length > 0 ? d.currency : "NGN",
      count: int(d.count) || 1,
      since: typeof d.since === "string" ? d.since : null,
      openCount,
    };
  }
  return openCount > 0 ? { state: "open", openCount } : NO_HOLD;
}

/** The live predicate's boolean, read. */
export function holdFromPredicate(data: unknown): ChargebackHold {
  return data === true ? { state: "held", owedMinor: null, currency: "NGN", count: null, since: null, openCount: 0 } : NO_HOLD;
}
