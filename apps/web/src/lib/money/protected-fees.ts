/**
 * THE PROTECTED RAIL'S FEES, IN ONE PLACE (appendix, "Standard fees, all
 * options": "Fees shown to a member must come from one configuration module so
 * a repricing is one edit").
 *
 * All money is integer kobo (`*_minor`), as everywhere in Vallo. The numbers
 * are the provider's stated standard fees, to be checked against the signed
 * agreement before go-live.
 *
 * WHO PAYS (the founder, 9 November 2026): the SELLER pays the money-in fee,
 * as the database already records it, until the provider's contract says
 * otherwise. A buyer's total is therefore the agreed amount, with no fee
 * added.
 */

import { RENT_PARTNER_FEE_BPS } from "./fee-schedule";

/** ₦1 in kobo. */
const NAIRA = 100;

/** Money in, band one: up to ₦250,000, 1.5% plus ₦150, capped at ₦3,000. */
export const MONEY_IN_BAND_ONE_MAX_MINOR = 250_000 * NAIRA;
/** Money in, band two: ₦250,001 to ₦50,000,000, 1.25% plus ₦150, uncapped. */
export const MONEY_IN_BAND_TWO_MAX_MINOR = 50_000_000 * NAIRA;

export const MONEY_IN_FIXED_MINOR = 150 * NAIRA;
export const MONEY_IN_BAND_ONE_BPS = RENT_PARTNER_FEE_BPS;
export const MONEY_IN_BAND_ONE_CAP_MINOR = 3_000 * NAIRA;
export const MONEY_IN_BAND_TWO_BPS = 125;

/** Money out: ₦40 up to ₦50,000, ₦70 above. */
export const MONEY_OUT_SMALL_MAX_MINOR = 50_000 * NAIRA;
export const MONEY_OUT_SMALL_MINOR = 40 * NAIRA;
export const MONEY_OUT_LARGE_MINOR = 70 * NAIRA;

/** Identity verification: ₦80 per member, once, only on a successful lookup. */
export const IDENTITY_CHECK_MINOR = 80 * NAIRA;

export type FeePayer = "seller" | "buyer";
/** The founder's ruling of 9 November 2026. */
export const MONEY_IN_FEE_PAYER: FeePayer = "seller";

/** A basis-point share of an amount, rounded UP to the kobo (never under-quote a fee). */
function bpsOf(amountMinor: number, bps: number): number {
  return Math.ceil((amountMinor * bps) / 10_000);
}

/**
 * The money-in fee for an amount, in kobo, or null above ₦50,000,000 where
 * the price is "agreed in advance" (a pricing band, not a limit). A caller
 * that gets null shows no figure and routes the deal to a person.
 */
export function moneyInFeeMinor(amountMinor: number): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  if (amountMinor <= MONEY_IN_BAND_ONE_MAX_MINOR) {
    return Math.min(bpsOf(amountMinor, MONEY_IN_BAND_ONE_BPS) + MONEY_IN_FIXED_MINOR, MONEY_IN_BAND_ONE_CAP_MINOR);
  }
  if (amountMinor <= MONEY_IN_BAND_TWO_MAX_MINOR) {
    return bpsOf(amountMinor, MONEY_IN_BAND_TWO_BPS) + MONEY_IN_FIXED_MINOR;
  }
  return null;
}

/** The money-out fee for one payout of an amount, in kobo. */
export function moneyOutFeeMinor(amountMinor: number): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  return amountMinor <= MONEY_OUT_SMALL_MAX_MINOR ? MONEY_OUT_SMALL_MINOR : MONEY_OUT_LARGE_MINOR;
}

export type ProtectedQuote = {
  /** What the buyer transfers. */
  buyerPaysMinor: number;
  /** The money-in fee, whoever bears it. */
  moneyInFeeMinor: number;
  /** What reaches the seller on release, before the payout transfer fee. */
  sellerReceivesMinor: number;
  payer: FeePayer;
};

/**
 * The whole quote a payment screen draws, line by line (BUILD 7.1 "What you
 * pay"). Null when no fee can be quoted (zero, invalid, or above the agreed
 * band): the screen then shows no protected option.
 */
export function protectedQuote(amountMinor: number, payer: FeePayer = MONEY_IN_FEE_PAYER): ProtectedQuote | null {
  const fee = moneyInFeeMinor(amountMinor);
  if (fee === null) return null;
  return payer === "seller"
    ? { buyerPaysMinor: amountMinor, moneyInFeeMinor: fee, sellerReceivesMinor: amountMinor - fee, payer }
    : { buyerPaysMinor: amountMinor + fee, moneyInFeeMinor: fee, sellerReceivesMinor: amountMinor, payer };
}
