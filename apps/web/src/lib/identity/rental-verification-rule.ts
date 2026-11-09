import type { IdentityOnFile } from "./listing-verification-rule";

/**
 * VERIFIED BEFORE A LONG RENTAL (Platform Grade 1, founder rulings of
 * 7 November 2026). The pure half, so the rule is a unit test.
 *
 * Guests never verify an ID to book a stay. A renter does, before the first
 * payment of a LONG rental: one whose tenancy runs 5 months or more (the
 * founder: "after 5 months, not 6"). The tenancy length is the larger of one
 * rent period (a month, a quarter, a year) and the shortest tenancy the
 * lister accepts, the same months `upfrontMonths` counts.
 *
 *   - a rent with no stated period is read as yearly, the market's default
 *     and the safe reading: unstated is never short;
 *   - an identity document on file that is pending or approved passes, the
 *     listing gate's stance, so nobody waits on the review queue mid deal
 *     (the money is held until the move-in is confirmed either way);
 *   - a QA account is never asked;
 *   - `feature_flags.rental_verification` set to false switches it off with
 *     no deploy.
 */
export const LONG_RENTAL_MONTHS = 5;

const PERIOD_MONTHS: Record<string, number> = { month: 1, quarter: 3, year: 12 };

/** Months the tenancy runs, from the listing's rent period and shortest tenancy. */
export function tenancyMonths(rentPeriod: string | null | undefined, minimumTenancyMonths: number | null | undefined): number {
  const period = (rentPeriod && PERIOD_MONTHS[rentPeriod]) || 12;
  const minimum = typeof minimumTenancyMonths === "number" && Number.isFinite(minimumTenancyMonths) ? minimumTenancyMonths : 0;
  return Math.max(period, minimum);
}

export function isLongRental(months: number): boolean {
  return months >= LONG_RENTAL_MONTHS;
}

export function rentalVerificationOwed(facts: {
  flagOn: boolean;
  qa: boolean;
  months: number;
  identity: IdentityOnFile;
}): boolean {
  if (!facts.flagOn || facts.qa) return false;
  if (!isLongRental(facts.months)) return false;
  return facts.identity !== "approved" && facts.identity !== "pending";
}

export const VERIFY_BEFORE_RENT =
  "Verify your identity before you pay for a rental of 5 months or more. It takes about five minutes, and this payment will be waiting when you come back. Nothing has been charged.";
