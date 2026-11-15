/**
 * MOVING VALLO'S OWN EARNINGS FROM THE PAYMENT PARTNER TO VALLO'S BANK (the
 * founder, 15 November 2026: "build the sweep to bank").
 *
 * Vallo names its own share on every protected payment
 * (`marketplace_commission_bps`, `protected-rail.ts`). The partner credits
 * that share to Vallo's own wallet, where it sits until somebody moves it.
 * On the card rail the equivalent money arrives in Vallo's bank by itself,
 * because Vallo's share is the remainder of a Paystack split. Here it does
 * not, so revenue piles up somewhere nobody is watching unless a job moves
 * it. That job is the sweep.
 *
 * This module is the DECISION only: no reads, no HTTP, no copy, so every
 * rule below can be read and tested on its own. The job that carries it out
 * is `lib/cron/jobs/revenue-sweep.ts`.
 *
 * NONE OF THIS IS A MEMBER'S MONEY. A lister is paid straight to their own
 * bank when a payment is released (`payout_preference: "automatic"`), so
 * Vallo's wallet at the partner never holds a member's funds. The ceiling
 * below exists so that if that ever stopped being true, the sweep stops and
 * asks a person rather than moving what it finds.
 *
 * Integer kobo throughout, as everywhere in Vallo.
 */

/** ₦1 in kobo. */
const NAIRA = 100;

/**
 * THE FLOOR. Below this the sweep waits. The partner charges a flat fee per
 * payout (₦40 up to ₦50,000, ₦70 above), so sweeping ₦500 would spend an
 * eighth of it on the transfer. At the floor the fee is well under one
 * percent, and the money is never more than a few days from the bank.
 */
export const SWEEP_FLOOR_MINOR = 10_000 * NAIRA;

/**
 * THE CEILING, which is a safety rail and not a limit anybody should hit.
 * Vallo's share of a payment is 2 percent, so a balance this size would mean
 * either a misread figure or money that is not Vallo's. Either way a person
 * should look before anything moves.
 */
export const SWEEP_CEILING_MINOR = 50_000_000 * NAIRA;

export type SweepReading = {
  /** The partner's own figure for what may be paid out today, or null when it could not be read plainly. */
  availableMinor: number | null;
  /** An earlier sweep that has neither succeeded nor failed. Nothing new is sent while one is open. */
  unsettled: boolean;
  /** Vallo's own payout account at the partner is configured. */
  destinationSet: boolean;
  /** The founder's switch. */
  switchedOn: boolean;
};

export type SweepHold =
  | "switched_off"
  | "no_destination"
  | "waiting_on_earlier_sweep"
  | "balance_unreadable"
  | "below_floor"
  | "too_large";

export type SweepDecision = { move: true; amountMinor: number } | { move: false; hold: SweepHold };

/**
 * Whether to move money, and how much. The order matters: the cheapest and
 * most ordinary reasons to do nothing are answered first, so a deployment
 * with the sweep switched off never reads a balance at all.
 */
export function decideSweep(reading: SweepReading): SweepDecision {
  if (!reading.switchedOn) return { move: false, hold: "switched_off" };
  if (!reading.destinationSet) return { move: false, hold: "no_destination" };
  if (reading.unsettled) return { move: false, hold: "waiting_on_earlier_sweep" };
  const available = reading.availableMinor;
  if (available === null || !Number.isSafeInteger(available) || available < 0) return { move: false, hold: "balance_unreadable" };
  if (available > SWEEP_CEILING_MINOR) return { move: false, hold: "too_large" };
  if (available < SWEEP_FLOOR_MINOR) return { move: false, hold: "below_floor" };
  /* The whole available balance, never a part of it: a remainder left behind
     would be swept next time anyway, and a part-sweep is one more number to
     reconcile against the partner's own ledger. */
  return { move: true, amountMinor: available };
}

/** A hold that a person should look at, as against one that is the ordinary quiet state. */
export function holdNeedsAPerson(hold: SweepHold): boolean {
  return hold === "balance_unreadable" || hold === "too_large";
}

/**
 * The reason written on the payout, which the partner shows on its own
 * records and on Vallo's bank statement narration where it fits.
 */
export function sweepReason(): string {
  return "Vallo marketplace commission moved to Vallo's own bank account.";
}
