/**
 * THE PUBLISHED FEE SCHEDULE, IN ONE PLACE (founder, 10 November 2026).
 *
 * Every sentence that states what a payment costs on Vallo (the Terms, the
 * help and docs pages, the lister's fee screen labels, the assistant's and
 * the copilot's knowledge) reads these numbers, through the sentences in
 * `lib/money/copy.ts`. Change a figure here and every statement moves with
 * it; a number typed anywhere else is a drift the schedule test catches.
 *
 *   Rent payments (the protected payment rail, switched off for now):
 *     about 3.5 percent in total
 *       Vallo's service fee            2.0 percent
 *       the payment partner's fee      about 1.5 percent
 *   Every other payment (card, through the payment processor):
 *     about 3.5 percent in total
 *       Vallo's service fee            2.0 percent
 *       the payment processor's fee    about 1.5 percent
 *
 * The 1.5 percent figures are round: the partner's and the processor's own
 * tariffs are theirs, and "around that area" is the founder's wording. The
 * exact naira figure is always shown to the lister before they agree. Vallo's
 * 2 percent is the live commission (`money_policy_versions.commission_bps`,
 * 200); the partner's share is the `fee_protection_rates` row
 * (`supabase/migrations/pending/fee_schedule_2026-11-10.sql`, not applied
 * until the founder runs it). The lister bears the fee; a renter or guest
 * pays exactly the listed price.
 *
 * Integer basis points, as everywhere (PRODUCT.md). Client-safe and pure.
 */

export const FEE_SCHEDULE_DATE = "2026-11-10";

/** Vallo's own service fee, on every payment. */
export const VALLO_FEE_BPS = 200;

/** The payment partner's share of a rent payment (the protected rail). About. */
export const RENT_PARTNER_FEE_BPS = 150;

/** The payment processor's share of any other payment (card). About. */
export const OTHER_PROCESSOR_FEE_BPS = 150;

export const RENT_TOTAL_FEE_BPS = VALLO_FEE_BPS + RENT_PARTNER_FEE_BPS;
export const OTHER_TOTAL_FEE_BPS = VALLO_FEE_BPS + OTHER_PROCESSOR_FEE_BPS;

/** Basis points as the percentage a person reads: 350 is "3.5", 200 is "2". Integer maths. */
export function feePercentText(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = bps % 100;
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

export const FEE_PERCENT = {
  vallo: feePercentText(VALLO_FEE_BPS),
  rentPartner: feePercentText(RENT_PARTNER_FEE_BPS),
  rentTotal: feePercentText(RENT_TOTAL_FEE_BPS),
  otherProcessor: feePercentText(OTHER_PROCESSOR_FEE_BPS),
  otherTotal: feePercentText(OTHER_TOTAL_FEE_BPS),
} as const;
