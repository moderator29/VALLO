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
 * No provider is named: the docs say "licensed payment partner", as
 * `lib/money/copy.ts` does outside a receipt or a legal page.
 */

/** Vallo's commission on a paid hotel room booking, as a percentage of the hotel's share. */
export const HOTEL_COMMISSION_PERCENT = 10;

/** The hotel commission, said once. */
export const HOTEL_COMMISSION_SENTENCE = `Vallo's commission on a hotel room is ${HOTEL_COMMISSION_PERCENT} percent of the booking. It comes out of the hotel's share when a booking is paid, and is never added to the guest's price.`;

/** What Vallo bills a restaurant for each table seated from a Vallo booking, formatted. */
export const SEATED_TABLE_FEE = formatMoney(SEATED_FEE_MINOR_DEFAULT);


/* ------------------------------------------------------- the money rules */

/** Rule 1: every payment for a deal is made inside Vallo. */
export const PAY_INSIDE_VALLO =
  "Every payment for a deal happens inside Vallo. Never pay outside Vallo. A payment made outside Vallo is not covered.";

/** Rule 2: who holds money. */
export const VALLO_NEVER_HOLDS =
  "Vallo never holds customer money. Licensed payment partners hold payments and escrow.";

/** Rule 3: the payer's choice for rent and shortlets. */
export const ESCROW_OR_CARD =
  "For rent and shortlets you choose how to pay: Escrow, which is selected for you, or Pay by card.";

/** What escrow does. */
export const ESCROW_MEANS =
  "With Escrow, a licensed payment partner holds your payment until the deal is confirmed. Only then is it released to the owner, agent or host.";

/** What paying by card does. */
export const CARD_MEANS =
  "With Pay by card, your payment goes to the owner, agent or host through our licensed payment partner as soon as it clears.";

/** Rule 4: a sale. */
export const SALE_IS_ESCROW = "A sale is always paid through escrow. There is no card option for a sale.";

/** Rule 5: a hotel room. */
export const HOTEL_ROOM_BY_CARD = "A hotel room is paid by card when you book, at the price shown.";

/** Rule 6: the price is the price. */
export const PRICE_IS_THE_PRICE =
  "You pay exactly the listed price. Every cost, including any charge at the door, is shown before you book.";

/** Rule 7: the commission. */
export const COMMISSION_FROM_SHARE =
  "Vallo's commission comes out of the host's or lister's share. It is never added to your price.";

/** Rule 8: viewings and listing. */
export const VIEWINGS_AND_LISTING_FREE = "Viewings never take money, and listing is free.";

/**
 * What happens when escrow cannot be used at the moment (its partner is
 * switched off or unreachable). The docs are static pages, so this states
 * the rule rather than today's state; the payment step itself offers escrow
 * only when the server reads it as working (`protectedRailLive()`).
 */
export const ESCROW_PAUSED =
  "If escrow is paused, a payment that must go through escrow does not open, and nothing is charged. For rent and shortlets you can pay by card instead.";
