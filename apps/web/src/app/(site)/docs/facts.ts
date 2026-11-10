import { formatMoney } from "@vallo/i18n/core";
import { SEATED_FEE_MINOR_DEFAULT } from "@/lib/reservations/seating";

/**
 * THE FACTS THE DOCS REPEAT, IN ONE PLACE.
 *
 * The founder's money rules of 13 October 2026, and the two figures the docs
 * state, written once so every chapter says them the same way. A figure that
 * lives in the product is imported from the module that enforces it; the
 * only figure typed here is the hotel commission. It is live in the database
 * as a dated row (`public.scoped_commission_rates`, scope `hotel_room`, 1,000
 * basis points, `20261013171019_pov06_hotel_room_commission.sql`) that the
 * client cannot read, so this constant moves in the same commit as any new
 * row. The restaurant fee is the code default; the database row
 * (`restaurant_money_settings.seated_fee_minor`) wins, and the two must agree.
 *
 * The processor is named only on the help page on how paying works, through
 * `HOW_PAYING_PROCESSOR_NAMED` (rule (e), 9 November 2026); everywhere else the
 * docs say "our payment processor".
 */

/** Vallo's commission on a paid hotel room booking, as a percentage of the hotel's share. */
export const HOTEL_COMMISSION_PERCENT = 10;

/** The hotel commission, said once. */
export const HOTEL_COMMISSION_SENTENCE = `Vallo's commission on a hotel room is ${HOTEL_COMMISSION_PERCENT} percent of the booking. It comes out of the hotel's share when a booking is paid, and is never added to the guest's price.`;

/** What Vallo bills a restaurant for each table seated from a Vallo booking, formatted. */
export const SEATED_TABLE_FEE = formatMoney(SEATED_FEE_MINOR_DEFAULT);


/* ------------------------------------------------------- the money rules */

/*
 * The money rules' sentences live in `lib/money/copy.ts` (rule (d), 9
 * November 2026), re-exported here so a chapter keeps one import. The escrow
 * facts that stood here (escrow or card, what escrow means, a sale through
 * escrow, escrow paused) are retired with the protected rail, which is
 * switched off (MONEY_COPY_SWEEP.md items 26 to 31).
 */
export {
  CARD_MEANS,
  ESCROW_NOT_OFFERED,
  HOW_EACH_DEAL_IS_PAID,
  PAY_INSIDE_VALLO,
  RENT_AND_SALE_NOT_OPEN,
  SALE_NOT_PAID,
  STAYS_PAID_BY_CARD,
  VALLO_NEVER_HOLDS,
} from "@/lib/money/copy";

/** Rule 5: a hotel room. */
export const HOTEL_ROOM_BY_CARD = "A hotel room is paid by card when you book, at the price shown.";

/** Rule 6: the price is the price. */
export const PRICE_IS_THE_PRICE =
  "You pay exactly the listed price. Every cost, including any charge at the door, is shown before you book.";

/** Rule 7: the commission. */
export const COMMISSION_FROM_SHARE =
  "Vallo's commission comes out of the host's or lister's share. It is never added to your price.";

/** The fee statement, from the one schedule (lib/money/fee-schedule.ts). */
export { FEE_RENT_LINE, FEE_OTHER_LINE, FEE_PROVIDER_CHARGES, FEE_WHO_PAYS, FEE_ROUND_NOTE } from "@/lib/money/copy";

/** Rule 8: viewings and listing. */
export const VIEWINGS_AND_LISTING_FREE = "Viewings never take money, and listing is free.";
