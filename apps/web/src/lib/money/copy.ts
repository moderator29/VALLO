/**
 * THE SENTENCES THAT DESCRIBE HOW MONEY MOVES ON VALLO.
 *
 * The governing sentence (D50, the founder's own, 6 October 2026; "and
 * protect" dropped on 9 November 2026, because nothing on Vallo protects a
 * payment today):
 *
 *   Vallo uses regulated financial infrastructure partners to process
 *   eligible transactions. Vallo does not hold customer funds.
 *
 * THE MONEY COPY RULES OF 9 NOVEMBER 2026 (docs/handoff/FOUNDER_DECISIONS.md,
 * the money copy sweep in docs/handoff/MONEY_COPY_SWEEP.md). Vallo never holds
 * money. Stays, hotel rooms and restaurants are paid by card and split at the
 * moment of payment by the payment processor. Payment for rentals and sales is
 * not open on Vallo, and Vallo does not take payment for a property purchase
 * at any stage. The protected rail is built and switched off, and no sentence
 * a member reads describes it in the present tense. The Vallo Guarantee is
 * retired. Every replacement sentence lives here and nowhere else: a screen
 * imports it, and `money-copy-sweep.test.ts` fails when one is typed again
 * elsewhere or when a retired phrase comes back. The processor is named only
 * on five surfaces (the card receipt, the Terms, the Privacy Policy, the help
 * page on how paying works, and one quiet line on the payment step itself);
 * `paystack-naming.test.ts` holds that, and the constants allowed to name it
 * are listed in `PAYSTACK_NAMED`.
 *
 * Every surface that explains money reads its words from here, so the Terms,
 * the help centre, the emails and the screens cannot drift apart. The rules
 * every sentence below keeps:
 *
 *   - Never imply Vallo holds, keeps, owns or guarantees money. Never "100
 *     percent safe". Never a payment called successful before the provider has
 *     confirmed it.
 *   - Per rail. The DIRECT rail is live: the processor splits the charge in the
 *     same transaction and nothing is held by anybody. The PROTECTED rail (a
 *     licensed partner holds the payment until the payer confirms) is not live
 *     until ADR-0003 is accepted and the merchant account is live (D50
 *     condition 3), so its sentences are written and wait in `RAIL_COPY`; a
 *     live surface reads the rail it is actually on (`lib/money/rails.ts`).
 *   - "Protected payment" with members; "escrow" only in legal and technical
 *     text. The provider never leads a button; it is named where a rule, a
 *     receipt, the Terms or a KYC step requires it.
 *   - The Vallo Guarantee is retired (D51, guarantee_bps = 0). No sentence here
 *     offers it. What replaces it is what is true on the rail in use.
 *   - The lister pays the fee (whoPays: seller). A renter or guest sees exactly
 *     the advertised price: no fee line, no footnote, no asterisk.
 *   - Rates are policy data (basis points), never typed into a sentence: a
 *     sentence that needs a figure is a function that is handed it.
 *
 * Client-safe: constants and pure functions only.
 */

/* -------------------------------------------------------------------------- */
/* THE GOVERNING SENTENCE                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The founder's sentence, with "and protect" dropped (9 November 2026). The
 * processor is not named here: this is not one of the five surfaces.
 */
export const GOVERNING_SENTENCE =
  "Vallo uses regulated financial infrastructure partners to process eligible transactions. Vallo does not hold customer funds.";

/** The same sentence, shortened for a screen. */
export const PARTNERS_SHORT = "Payments are processed through Vallo's financial infrastructure partners.";

/** How money moves on the card (direct) rail, the only way to pay on Vallo today. */
export const CARD_RAIL_MOVES =
  "Vallo never holds your money. When you pay by card, the owner's or agent's share goes straight to their bank account through our payment processor, in the same transaction.";

/**
 * The promise (sweep item 2). It used to offer a licensed partner holding the
 * money "until the deal is confirmed", which is the protected rail, switched
 * off. The card rail is the only way to pay, so the promise is its sentence.
 * The Terms and the Disclaimer print this by reference.
 */
export const NO_CUSTODY_SENTENCE = CARD_RAIL_MOVES;

/** Where a refund goes. */
export const REFUND_ROUTE =
  "A refund goes back to the card or bank account you paid with, through our payment processor. Banks usually show it within 5 to 10 working days.";

/**
 * For a lister: how and when they are paid (sweep item 3). The first sentence
 * stands alone on the room request answer. No provider is named.
 */
export const PAYOUT_ANSWER =
  "Vallo never holds your share. When a card payment is made to you, our payment processor splits it and your share goes to the bank account on your payout details in the same transaction. The processor pays it into your bank on its normal settlement schedule.";

/** The supply page's last step for a host (/for-hosts), sweep item 4. */
export const HOST_PAYOUT_STEP =
  "When a guest pays by card, our payment processor splits the payment and your share goes straight to the bank account on your payout details.";

/* -------------------------------------------------------------------------- */
/* WHAT STANDS BEHIND A PAYMENT, PER RAIL (what replaced the Guarantee)       */
/* -------------------------------------------------------------------------- */

/** The two rails, in Vallo's own words. Never a provider's name. */
export type MoneyRail = "direct" | "protected";

/**
 * What stands behind a payment on the DIRECT rail, which is live. Said where
 * the Guarantee sentence used to be: the gate that opened the payment, the
 * terms fixed on the booking, and where a refund goes. Nothing is held.
 */
export const DIRECT_RAIL_STANDING =
  "What stands behind this payment: payment opened only after the agreement was confirmed and approved, the cancellation terms are fixed on your booking, and a refund due to you goes back to the card or account you paid with.";

/**
 * What stands behind a payment on the PROTECTED rail (not live). The
 * replacement trust story D51 names, with who holds the money said plainly.
 */
export const HELD_UNTIL_YOU_CONFIRM =
  "Your payment is held by Vallo's licensed payment partner until you confirm. It is released to the owner or agent only when you confirm, or when the agreed release condition is met. Vallo does not hold it.";

/** The protected rail's line for a screen, per D50. */
export const PROTECTED_SHORT = "Your payment is protected through Vallo's transaction infrastructure.";

export type RailCopy = {
  /** What a member is told stands behind the payment. */
  standing: string;
  /** How the money moves, in one sentence. */
  howItMoves: string;
  /** When the owner or agent receives it. */
  releaseCondition: string;
  /** Where a refund goes. */
  refund: string;
};

/** The words for each rail. A live surface picks the rail it is on, never the one it wishes it were. */
export const RAIL_COPY: Record<MoneyRail, RailCopy> = {
  direct: {
    standing: DIRECT_RAIL_STANDING,
    howItMoves: CARD_RAIL_MOVES,
    releaseCondition: "Paid to the owner or agent at the moment you pay, through our payment processor.",
    refund: REFUND_ROUTE,
  },
  protected: {
    standing: HELD_UNTIL_YOU_CONFIRM,
    howItMoves: `${PROTECTED_SHORT} ${GOVERNING_SENTENCE}`,
    releaseCondition: "Released to the owner or agent when you confirm, or when the agreed release condition is met.",
    refund:
      "If the payment does not go ahead, it goes back to you from the partner holding it, once the cancellation is agreed or decided.",
  },
};

/**
 * THE FRONT DOOR'S PROMISE, PER RAIL (the landing hero, P7, 7 October 2026).
 *
 * The founder asked for the hero to carry "Vallo does not hold your money; a
 * licensed provider does". The first half is true on both rails. The second
 * is true only on the protected rail, which is not live (`rails.ts`), so the
 * direct rail says what happens on it instead. When the protected rail goes
 * live the hero says the founder's sentence with no other change.
 */
export const RAIL_PROMISE: Record<MoneyRail, { lead: string; rest: string }> = {
  direct: {
    lead: "Vallo never holds your money.",
    rest: "When you pay, it goes through regulated payment partners straight to the owner or agent.",
  },
  protected: {
    lead: "Vallo never holds your money.",
    rest: "A licensed provider holds it until you confirm.",
  },
};

/* -------------------------------------------------------------------------- */
/* INSPECTION, THE OFF-PLATFORM RULE, THE GATE                                */
/* -------------------------------------------------------------------------- */

/** Stated on the inspection screen itself, not only in a policy. */
export const NO_INSPECTION_FEE =
  "Vallo charges no inspection fee. Viewing a property through Vallo is free.";

/** The same promise as a heading, in the words the founder set for the screen. */
export const NO_INSPECTION_FEE_HEADLINE = "VALLO CHARGES NO INSPECTION FEE";

/** The companion to NO_INSPECTION_FEE: a private arrangement is not ours. */
export const PRIVATE_FEE_NOTE =
  "If an owner or agent asks you for a fee to inspect, that is a private arrangement between you and them. It is not a Vallo charge, Vallo does not collect it, and you can report it to us.";

/** Everything happens on the platform. */
export const OFF_PLATFORM_SENTENCE =
  "Keep every message, agreement and payment on Vallo. Vallo is not responsible for anything arranged, discussed or paid outside the platform.";

/* The space detail's sentences about paying (/listing/[id]'s description),
   moved out of the page (Round 3 sweep, C3). The words are the page's own. */
/** A sale: inspect, then have the title checked before money moves. */
export const LISTING_SALE_ABOUT =
  "This property is for sale. Message the agent to ask questions and arrange an inspection, and have your own solicitor verify the title before any money changes hands.";
/** A rental: inspect before paying. */
export const LISTING_RENTAL_ABOUT =
  "This home is let on an annual tenancy. Message the agent to ask questions and arrange an inspection, then pay only after you have inspected the property.";
/** How a rent figure is quoted. */
export const LISTING_RENT_QUOTED = "The rent is quoted for a full year and agreed directly with the agent.";
/** A stay: reserve, inspect, then pay. */
export const LISTING_STAY_PAY_AFTER =
  "Reserve online, then arrange an inspection with the agent from your Inbox. Pay only after you have inspected the property.";

/** Rent: everything but the payment step (the founder's approved rent line). */
export const RENT_NOT_OPEN_SHORT = "Payment for rentals is not open on Vallo yet.";
/** What a renter can do instead, said under the short line where it is the heading. */
export const RENT_NOT_OPEN_NEXT = "You can view, inspect and agree terms now. Nothing has been charged.";
export const RENT_PAYMENT_NOT_OPEN = `${RENT_NOT_OPEN_SHORT} You can view, inspect and agree terms now.`;

/** A sale, rule (c) of 9 November 2026: never, at any stage. */
export const SALE_NEVER_PAID_ON_VALLO = "Vallo does not take payment for a property purchase at any stage.";

/** A purchase's payment step and refusals (sweep items 19, 21 and 24). */
export const SALE_PAYMENT_NOT_OPEN = "Payment for a purchase is not open on Vallo.";

/** Have the title checked before money changes hands, on every sale surface. */
export const SALE_TITLE_CHECK = "Have your own solicitor verify the title before any money changes hands.";

/**
 * What a rental or sale agreement leads to today (sweep item 5): the deal is
 * agreed on Vallo, and the payment is not taken on Vallo. Every surface about
 * an agreement for rent or a sale reads this, the Terms by reference.
 */
export const PAYMENT_GATE_SENTENCE = `${RENT_PAYMENT_NOT_OPEN} ${SALE_NEVER_PAID_ON_VALLO}`;

/**
 * The gate on an agreement a card payment does follow (a stay's agreement):
 * the sweep's first wording for item 5, true where the payment is by card.
 */
export const CARD_REVIEW_SOMETIMES =
  "A card payment waits for a person at Vallo only when something about the deal needs a second look.";
export const AGREEMENT_PAYMENT_OPENS = `Payment opens as soon as both of you confirm the agreement. ${CARD_REVIEW_SOMETIMES}`;

/** The confirm sheet's next step on a stay's agreement (sweep item 48). */
export const CONFIRM_PAYMENT_OPENS_BY_CARD = "Payment opens then, by card.";

/* The agreement page's money lines (/agreements/[id]), moved out of the page
   (Round 3 sweep, C3). The words are the page's own, unchanged. */
/** The renter's one action once the agreement is approved. `amount` is formatted. */
export function agreementPayLabel(amount: string): string {
  return `Pay ${amount}`;
}
/** Both parties confirmed and Vallo is reviewing. */
export const AGREEMENT_IN_REVIEW =
  "Both of you confirmed. Because this payment goes straight to the lister, a person at Vallo is checking the deal first. You will get an email and a notification the moment it is decided.";
/** The section an approved agreement opens. */
export const AGREEMENT_PAYMENT_OPEN_TITLE = "Payment is open";
/** When the lister's share reaches them (sweep item 6). Card is the only way to pay. */
export const OWNER_PAID_WHEN =
  "When they pay by card, our payment processor splits the payment and your share goes to the bank account on your payout details in the same transaction.";

/** The lister's line once the agreement is approved. */
export function agreementOwnerApproved(kind: "rent" | "stay"): string {
  return `The agreement is approved. The ${kind === "rent" ? "renter" : "guest"} can pay now. ${OWNER_PAID_WHEN}`;
}

/* -------------------------------------------------------------------------- */
/* WHO PAYS THE FEE (D51: the lister; the renter sees exactly the price)      */
/* -------------------------------------------------------------------------- */

/**
 * The whole fee story in one sentence, for the help centre, the supply pages
 * and the assistant. Rate-free, so it is true whatever the policy row says.
 * NOT for a renter's checkout or a listing's price: there the price is the
 * price, and nothing is said about fees at all.
 */
export const WHO_PAYS_SENTENCE =
  "Renters and guests pay exactly the price on the listing, with nothing added. Listing is free; when a payment is made, Vallo's platform fee comes out of the lister's share and is shown to the lister in naira.";

/**
 * Vallo's charges, said to anybody: the renter side first, because that is
 * the promise. Replaces the line that called the commission zero and offered
 * the Guarantee contribution (lib/trust/standards.ts reads this).
 */
export const NO_RENTER_FEES_LINE =
  "Vallo charges renters and guests nothing: no fee to look, to book or to pay, and nothing added to the price on the listing. Listing is free. When a payment is made, Vallo's platform fee comes out of the lister's share.";

/**
 * A payment made BEFORE the Guarantee was retired carried a contribution, and
 * its claim window is honoured: shown only on an agreement whose frozen terms
 * carry a non-zero `guarantee_bps`. Never on a new payment.
 */
export const LEGACY_GUARANTEE_CLAIM =
  "This payment was made while the Vallo Guarantee was running, and a contribution was set aside from the lister's share. You can still claim on it inside the window below. A person at Vallo reviews every claim before anything is paid.";

/**
 * The lister's line on an agreement paid while the Guarantee ran: what was set
 * aside from their share. `percentText` is the frozen `guarantee_bps` as a
 * percentage ("1.5"). Drawn only when that frozen rate is above zero, never on
 * a new payment (D51). Moved from the agreement page word for word (A9).
 */
export function legacyReserveSentence(percentText: string): string {
  return `Under the terms you agreed, ${percentText}% of the total was set aside from your share for the Vallo Guarantee reserve.`;
}

/* -------------------------------------------------------------------------- */
/* THE LISTER'S FEE, BEFORE PUBLISHING (D51, the agreement gate)              */
/* -------------------------------------------------------------------------- */

/** What the lister's figure is called, by what they are listing. */
export type ListerFigureKind = "rent" | "stay" | "sale";

export const LISTER_FIGURE_LABEL: Record<ListerFigureKind, string> = {
  rent: "Rent you set",
  stay: "Nightly price you set",
  sale: "Price you set",
};

/**
 * THE WORDING'S VERSION, recorded with every acceptance (D61: the record
 * stores the terms version). Change any sentence in this block that the
 * lister reads on the fee screen and this changes with it, so a record can
 * always say which words were accepted.
 */
export const LISTER_FEE_TERMS_VERSION = "lister-fee-2026-11-09.1";

/**
 * D61. The rail is not knowable when the lister accepts, so the fee is a
 * range anchored on the worst case, and the second two percent is named for
 * what it buys. "Escrow" is used here, against the member-copy habit of
 * "protected payment", because this screen forms part of an agreement and
 * D61 sets these words. No sentence here says "you keep N percent" or
 * compares Vallo with what anybody else charges.
 */
export const PLATFORM_FEE_LABEL = "Platform fee";

/** "Vallo, 2%". The percentage is the policy's, handed in as text. */
export function valloFeeLabel(percentText: string, capped: boolean): string {
  return capped ? `Vallo, ${percentText}%, capped` : `Vallo, ${percentText}%`;
}

/**
 * "Escrow protection, 2%": the escrow partner's fee, never called Vallo's.
 * Drawn ONLY while the protected rail is live (sweep items 7 to 9): the fee
 * screen hides the row otherwise (`listerFeeShown` in `lister-fee.ts`).
 */
export function escrowProtectionLabel(percentText: string): string {
  return `Escrow protection, ${percentText}%`;
}
export const ESCROW_PROTECTION_WHEN = "when a buyer pays into escrow";

/**
 * The payment processor's fee, which the lister bears on a card payment (the
 * split's bearer). Worded as the payout record words it
 * (`PAYOUT_PROCESSING_LABEL`), so the line the lister accepted is the line
 * they later find on their payout. Not named: the fee screen is not one of
 * the five surfaces that name the processor.
 */
export const PROCESSOR_FEE_LABEL = "Payment processing";
export const PROCESSOR_FEE_WHEN = "on a card payment";
export function upToText(amountText: string): string {
  return `up to ${amountText}`;
}

/** "36,000 to 72,000", or the one figure when both ends are the same. */
export function feeRangeText(lowText: string, highText: string): string {
  return lowText === highText ? lowText : `${lowText} to ${highText}`;
}
/** The top of "You receive", set small beside the headline figure. */
export function rangeUpperText(highText: string): string {
  return `to ${highText}`;
}

export const LISTER_RECEIVE_LABEL = "You receive";

export const FEE_GATE_TITLE = "What you receive";

/** Under the range: which figure to count on. The lower one, always. */
export function receiveRangeNote(escrowIsLowest: boolean): string {
  return escrowIsLowest
    ? "Count on the lower figure: it is what you receive when a buyer pays into escrow. When a buyer pays directly, you receive more."
    : "Count on the lower figure: it is the least you receive, however the buyer pays.";
}

/**
 * WHO PAYS THE SECOND FEE, SAID PLAINLY (VALLO_PRICING sections 2 and 6, as
 * corrected on 6 October): the protected provider's fee is borne by the `seller`, and the lister is the
 * split's bearer on a direct payment, so the lister bears it on both rails,
 * always. The arithmetic already takes it off the lister's side; this says so
 * in words, so nobody reads the "when" lines as a fee the buyer might pay.
 */
export function listerBearsFeesSentence(escrow: boolean, processor: boolean): string | null {
  if (escrow && processor)
    return "You pay escrow protection when a buyer pays into escrow, and payment processing when a buyer pays directly. The buyer pays neither.";
  if (escrow) return "You pay escrow protection when a buyer pays into escrow. The buyer never pays it.";
  if (processor) return "You pay payment processing when a renter or guest pays by card. They never pay it.";
  return null;
}

/** Under the arithmetic: what the renter sees. The renter's side, said to the lister. */
export function renterSeesSentence(priceText: string): string {
  return `Renters and guests see ${priceText}, exactly. Nothing is added to it.`;
}

/**
 * D60: the screen while the blocking flag is off. There is no checkbox, and
 * this says why: nothing is recorded, and sending does not wait.
 */
export const FEE_PREVIEW_NOTE =
  "Nothing is recorded yet. Accepting these figures is not open, and sending your listing for review does not wait for it.";

export const FEE_ACCEPT_LABEL = "I accept these figures for this listing";
export const FEE_ACCEPT_ACTION = "Accept and continue";
export const FEE_ACCEPTED = "Accepted";

/** What accepting records, and the promise about a rate change. */
export const FEE_ACCEPT_RECORD =
  "Vallo records your acceptance with the date, both rates and these figures. If a rate changes, we ask you again, and you keep the rates you accepted until you accept new ones.";

/** The policy could not be read: the gate says so and does not guess a rate. */
export const FEE_UNREADABLE_TITLE = "We cannot show your fee figures just now";
export const FEE_UNREADABLE_BODY =
  "Publishing waits until we can show you, in naira, exactly what you receive. Nothing about your listing has changed. Try again in a moment.";
/** The same, while the blocking flag is off (D60): nothing waits on it. */
export const FEE_UNREADABLE_BODY_OPEN =
  "Nothing about your listing has changed, nothing is recorded, and sending it for review does not wait for these figures.";

/** The acceptance could not be recorded: nothing was sent for review. */
export const FEE_ACCEPT_UNRECORDED =
  "Your acceptance could not be recorded just now, so the listing has not been sent. Nothing has changed. Try again in a moment.";

/** The rate version moved between reading and accepting. */
export const FEE_RATE_MOVED =
  "The rate changed while you were reading. Check the new figures and accept them again.";

/** The lister has not typed a figure yet. */
export const FEE_NEEDS_FIGURE = "Set your price above and the figures appear here.";

/* -------------------------------------------------------------------------- */
/* THE DOCS' FEE CALCULATOR (DOCS_AND_PRESENCE_UPGRADE.md 4.6, 10 November     */
/* 2026): the lines the worked example in /docs/what-vallo-costs prints that   */
/* no sentence above already says. Every figure beside them is computed from  */
/* the rates in force, never typed; rent and sales are never offered (the     */
/* calculator prints PAYMENT_GATE_SENTENCE instead), and the protected rail's */
/* fees are not shown.                                                        */
/* -------------------------------------------------------------------------- */

export const FEE_CALC = {
  title: "Work it out",
  kindLabel: "What is being paid for",
  kinds: { stay: "A shortlet", hotel: "A hotel room", restaurant: "A restaurant table" },
  nights: "Nights",
  tables: "Tables seated in a month",
  columns: { line: "Line", amount: "Amount", who: "Who receives it" },
  guestPays: "The guest pays",
  dinerPays: "The diner pays for the booking",
  restaurantBill: "Vallo bills the restaurant",
  toHost: "The host, to their bank account",
  toVallo: "Vallo",
  toProcessor: "Our payment processor",
  toRestaurant: "Nobody: booking a table is free",
  youReceive: "You receive",
  nothing: "Nothing",
} as const;

/** The calculator's figure for a host when the processor's most is not known (signed out). */
export const FEE_CALC_RECEIVE_BEFORE_PROCESSING = "You receive, before payment processing";

/** Signed out, the processor's cap is not read: said, never guessed. */
export const FEE_CALC_PROCESSING_SIGNED_OUT =
  "Payment processing also comes off the host's share on a card payment. Sign in to see the most it can be, in naira.";

/** The restaurant fee, said beside the worked bill. */
export const FEE_CALC_RESTAURANT_NOTE =
  "Vallo bills the restaurant once a month for each table seated from a Vallo booking. A no-show or a cancelled table costs the restaurant nothing.";

/** The rates could not be read: the calculator says so and shows no figure. */
export const FEE_CALC_UNREADABLE =
  "The figures come from the rates in force, and they could not be read just now. Nothing here is a guess, so nothing is shown. Try again in a moment.";

/* -------------------------------------------------------------------------- */
/* THE HISTORY SCREENS: /payments, the earnings history, the Money desk.      */
/*                                                                            */
/* A history is a record of money that has already moved, read at the moment */
/* of asking from the payment and refund records. It is never a figure Vallo  */
/* is keeping for anybody, so no sentence below may read like one: nothing is */
/* "available", nothing is "in" an account here, nothing can be taken out.    */
/* -------------------------------------------------------------------------- */

/** Under every history's total, on every side. */
export const HISTORY_NOT_A_BALANCE =
  "This is a record of payments that have already moved. Vallo never holds your money.";

/** For a lister, under their earnings total. */
export const EARNINGS_SETTLEMENT =
  "Your share of each card payment went to the bank account on your payout details in the same transaction, split by our payment processor.";

/** The payer's total card. */
export const PAYMENTS_TOTAL_LABEL = "Paid through Vallo";
/** Beside the payer's total, when any refund has been processed. */
export const PAYMENTS_REFUNDED_LABEL = "Refunded to you";

/** The lister's total card. */
export const EARNINGS_TOTAL_LABEL = "Your share, after reversals";
export const EARNINGS_GROSS_LABEL = "Renters and guests paid";
export const EARNINGS_REVERSED_LABEL = "Reversed by refunds";

/** The payer's empty history. */
export const PAYMENTS_EMPTY_TITLE = "No payments yet";
export const PAYMENTS_EMPTY_BODY =
  "When you pay for a rental or a stay through Vallo, the payment appears here, and so does any refund that comes back to your card or bank account.";

/** A lister's empty history. */
export const EARNINGS_EMPTY_TITLE = "Nothing has been paid to you yet";
export const EARNINGS_EMPTY_BODY =
  "When a renter or guest pays for one of your listings, your share appears here. Vallo never holds it: our payment processor splits each card payment and your share goes straight to your bank account.";

/** A host's empty history: how a host is paid, in the kit's 180 characters. */
export const HOST_EARNINGS_EMPTY_BODY =
  "When a guest pays for a stay, your share appears here. Our payment processor sends it to the bank account on your payout details in the same card payment.";

/** A read that failed. Said plainly, and never drawn as an empty list. */
export const HISTORY_UNAVAILABLE_TITLE = "Your history could not be loaded";
export const HISTORY_UNAVAILABLE_BODY =
  "We could not read your payment records just now. Nothing has changed with your money. Refresh the page to try again.";

/** The link to the page before this one. */
export const HISTORY_EARLIER = "Show earlier";
/** Under the last page, so the end of the list is a fact and not a guess. */
export const HISTORY_END = "That is everything.";

/** The Money desk's history panel. */
export const ADMIN_HISTORY_NOTE =
  "Every payment and refund on the platform, read from the transaction and refund records at the moment of asking. Vallo holds none of it: a card payment was split by Paystack in the same transaction, and an escrow payment is held by the licensed partner.";
export const ADMIN_HISTORY_UNAVAILABLE =
  "The platform history could not be read just now. This does not mean there were no payments.";

/* -------------------------------------------------------------------------- */
/* THE CHECKOUT THAT UNDERSTANDS THE TRANSACTION (D50 section 3)              */
/* -------------------------------------------------------------------------- */

export const CHECKOUT_TX_TITLE = "What this payment is";

export const CHECKOUT_TX_LABEL = {
  space: "For",
  agreement: "Agreement",
  payer: "Paid by",
  payee: "Paid to",
  amount: "Amount",
  standing: "What stands behind it",
  conditions: "Conditions",
  release: "When the owner or agent receives it",
  references: "References",
} as const;

export const CHECKOUT_PAYER_YOU = "You";
/** The payee's name could not be read: said as the role, never invented. */
export const CHECKOUT_PAYEE_ROLE = "The owner or agent on the agreement";
/** The agreement does not exist yet (a request the host has not accepted). */
export const CHECKOUT_NO_AGREEMENT = "No agreement yet. Payment opens once there is one and Vallo has approved it.";
/** The amount, said as the advertised price and nothing else (D51). */
export const CHECKOUT_AMOUNT_NOTE = "The price on the listing, in full.";

/* -------------------------------------------------------------------------- */
/* THE REFERENCE SYSTEM                                                       */
/* -------------------------------------------------------------------------- */

export const REFERENCES_NOTE =
  "Each reference names a different record. Quote the transaction reference to Vallo, and the partner reference to your bank.";

/** The checkout's conditions, said only when each is true of this booking. */
export const CHECKOUT_CONDITION_APPROVED = "Vallo approved the agreement before payment opened.";
export const CHECKOUT_CONDITION_CANCEL = "The cancellation terms below are fixed on this booking.";

/* -------------------------------------------------------------------------- */
/* THE REWARDS BALANCE (D51). Requested by Session 3 C3 for the referral      */
/* dashboard (`app/(app)/rewards`, `components/app/referral`).                */
/*                                                                            */
/* A Rewards Balance is Vallo owing a member money for referrals that         */
/* qualified: a debt, not custody, paid from Vallo's marketing float through  */
/* Paystack transfers. It is never called a wallet. No rate is written here:  */
/* `{reward}`, `{cap}` and `{minimum}` are filled from `money_policy`.         */
/* -------------------------------------------------------------------------- */

/** Under the Rewards Balance figures. */
export const REWARDS_NOT_HELD =
  "Your Rewards Balance is what Vallo owes you for referrals that qualified. It is not money held for you, and it does not expire.";

/**
 * How a referral earns (D85, the founder, 8 October 2026: it counts when the
 * person signs up fully, with no payment). `{reward}` is formatted money and
 * `{cap}` a number, both from the live campaign. What "signs up fully" means
 * is the campaign's own steps, said beside it (`signedUpFullySentence` in
 * `lib/referral/requirements.ts`), never written here, so a successor
 * campaign that adds the phone step changes the screens without a deploy.
 */
export const REWARDS_QUALIFY =
  "Each friend who signs up fully with your link adds {reward} to your Rewards Balance, for up to {cap} friends a month.";

/**
 * When a reward can be withdrawn, with the live campaign's review window.
 * `{days}` is a count of days ("7 days"). Used where the read gives the window; otherwise
 * REWARDS_PENDING_THEN_AVAILABLE says the same without a length.
 */
export const REWARDS_REVIEW_WINDOW =
  "Each reward is Pending for {days} from the day your friend signs up fully, while Vallo's review period runs. After that it is Available, and Available is what you can withdraw.";

/**
 * While `referral_policy.payouts_enabled` is off (no separate marketing-float
 * account yet). No date, because none is decided; nothing earned is lost.
 */
export const REWARDS_WITHDRAW_NOT_OPEN =
  "Withdrawals are not open yet. Every reward you earn is recorded in your Rewards Balance and stays yours, and you can withdraw it here once withdrawals open.";

/** Stated before anybody starts earning. `{minimum}` is formatted money. */
export const REWARDS_WITHDRAW_MINIMUM = "You can withdraw once your Rewards Balance reaches {minimum}.";

/** On the withdraw screen, before anything is prepared. */
export const REWARDS_FEE_SHOWN_FIRST =
  "The processing fee is set by our payout partner when your withdrawal is prepared. You see it, and what you will receive, before you confirm.";

/** Where a reward withdrawal is paid from. */
export const REWARDS_PAID_FROM =
  "Rewards are paid from Vallo's own funds to the bank account you choose, through our payment processor.";

/** The scheme question, answered plainly. */
export const REWARDS_NOT_INVESTMENT =
  "Rewards are not an investment. There is nothing to pay in, and only the people you invite yourself are counted.";

/**
 * D64. Under "Rewards are paused this month", on every rewards surface and the
 * invite hub. A pause stops new referrals qualifying; it never reaches
 * backwards, so what is already earned is still the member's and still paid.
 * "As usual" keeps the review window and the withdrawal rules in force.
 */
export const REWARDS_PAUSED_EARNED =
  "The pause does not touch anything you have already earned. Every reward from a referral that qualified is still yours and will be paid as usual.";

/**
 * D62's lifecycle, said before anybody invites (the invite hub, How invites
 * work, the invite's first run, while the programme runs). Pending is already
 * qualified and waits out the campaign's review window; Available is what can
 * be withdrawn. No length is written: the window is campaign configuration,
 * and the read does not carry it yet. It promises nothing about a Pending
 * reward beyond the review, because a review can still take one back.
 */
export const REWARDS_PENDING_THEN_AVAILABLE =
  "A reward is Pending from the day the referral qualifies, while Vallo's review period runs. After that it is Available, and Available is what you can withdraw.";

/**
 * D64, in one plain line, on the same three surfaces while the programme
 * runs: the platform budget, and that a pause never reaches backwards.
 */
export const REWARDS_MONTHLY_BUDGET =
  "Rewards have one monthly budget across Vallo. If it is used up, rewards pause and no new referral qualifies until it opens again; what you have already earned is still paid.";

/* -------------------------------------------------------------------------- */
/* THE TRANSACTION TIMELINE, IN SENTENCES (never a status name on screen)     */
/* -------------------------------------------------------------------------- */

/**
 * One sentence per thing that happened, from each side. `{amount}` is the
 * figure formatted once by the caller. A partner is "our payment partner" in
 * the product's voice and is named on a receipt, never in a timeline row.
 */
export const TIMELINE_SENTENCE: Record<
  | "agreement_approved"
  | "payment_started"
  | "payment_confirmed"
  | "protected"
  | "release_requested"
  | "released"
  | "settled_to_payee"
  | "refund_requested"
  | "refund_sent"
  | "refund_arrived"
  | "review_opened"
  | "review_closed"
  | "payment_failed"
  | "cancelled",
  { payer: string; payee: string }
> = {
  agreement_approved: {
    payer: "Vallo approved the agreement, and payment opened.",
    payee: "Vallo approved the agreement, and payment opened for the renter or guest.",
  },
  payment_started: {
    payer: "You started a payment of {amount}.",
    payee: "The renter or guest started a payment of {amount}.",
  },
  payment_confirmed: {
    payer: "Our payment partner confirmed your payment of {amount}.",
    payee: "Our payment partner confirmed a payment of {amount} to you.",
  },
  protected: {
    payer: "Your payment of {amount} is held by our licensed payment partner until you confirm.",
    payee: "The payment of {amount} is held by our licensed payment partner until the renter or guest confirms.",
  },
  release_requested: {
    payer: "You confirmed, so the payment is being released to the owner or agent.",
    payee: "The renter or guest confirmed, so the payment is being released to you.",
  },
  released: {
    payer: "The payment was released to the owner or agent.",
    payee: "The payment was released to you.",
  },
  settled_to_payee: {
    payer: "The owner's or agent's share was paid to their bank account.",
    payee: "Your share of {amount} was paid to your bank account.",
  },
  refund_requested: {
    payer: "You asked for a refund of {amount}.",
    payee: "A refund of {amount} was asked for.",
  },
  refund_sent: {
    payer: "Your refund of {amount} was sent to the card or account you paid with.",
    payee: "A refund of {amount} was sent to the person who paid.",
  },
  refund_arrived: {
    payer: "Our payment partner completed your refund of {amount}. Your bank may take a few days to show it.",
    payee: "The refund of {amount} was completed.",
  },
  review_opened: {
    payer: "A person at Vallo is looking at this payment.",
    payee: "A person at Vallo is looking at this payment.",
  },
  review_closed: {
    payer: "The review is closed, and its outcome is on the agreement.",
    payee: "The review is closed, and its outcome is on the agreement.",
  },
  payment_failed: {
    payer: "The payment did not go through.",
    payee: "The renter's or guest's payment did not go through.",
  },
  cancelled: {
    payer: "The payment was cancelled.",
    payee: "The payment was cancelled.",
  },
};

export const TIMELINE_TITLE = "What has happened";
export const TIMELINE_NEXT = "Next";
export const TIMELINE_EMPTY = "Nothing has happened to this payment yet.";

/* -------------------------------------------------------------------------- */
/* THE MONEY CENTRE: AVAILABLE AND PROTECTED (protected rail; not live)        */
/*                                                                            */
/* Both figures are the member's own account at the licensed partner, read   */
/* from the partner. Vallo holds neither, and every sentence says who does.   */
/* -------------------------------------------------------------------------- */

export const MONEY_CENTRE_TITLE = "Your money";
export const AVAILABLE_LABEL = "Available";
export const AVAILABLE_WORD = "Yours to withdraw to your bank.";
export const PROTECTED_LABEL = "Protected";
export const PROTECTED_WORD =
  "Held in protected payments until each one's release condition is met. Not yours to withdraw yet.";

/** Who holds both figures, named, with the governing sentence. */
export function heldBySentence(heldBy: string): string {
  return `Both figures are held in your own account with ${heldBy}. ${GOVERNING_SENTENCE}`;
}

/** When the partner said so. A balance without a time is never shown. */
export function balanceAsOf(heldBy: string, when: string): string {
  return `As ${heldBy} reported it, ${when}.`;
}

/** The honest state while the protected rail is not live, or the read is absent. */
export const MONEY_CENTRE_ABSENT_TITLE = "There is no balance to show";
export const MONEY_CENTRE_ABSENT_BODY =
  "Payments on Vallo go straight to the owner's or agent's bank account in the same transaction, so nothing waits in an account for you. Your payments and refunds are below.";

/* -------------------------------------------------------------------------- */
/* WITHDRAWAL: THE MATHS BEFORE THE CONFIRM (D51)                              */
/*                                                                            */
/* The fee is READ BACK from the partner's payment intent, never computed     */
/* from a table, and the screen waits for it. No estimate is ever dressed as  */
/* a total.                                                                   */
/* -------------------------------------------------------------------------- */

export const WITHDRAW_TITLE = "Withdraw to your bank";
export const WITHDRAW_AMOUNT = "Amount";
export const WITHDRAW_FEE = "Processing fee";
export const WITHDRAW_RECEIVE = "You'll receive";
export const WITHDRAW_WAITING_FEE = "Being set by our payment partner";
export const WITHDRAW_WAITING_BODY =
  "Our payment partner sets the fee on this withdrawal when it is prepared. The total appears here once they have, and you confirm only after you have seen it.";
export const WITHDRAW_FEE_NOTE =
  "This fee was set by our payment partner on this withdrawal and read back from it. It is not an estimate.";
export const WITHDRAW_EXPIRED =
  "This withdrawal was not confirmed in time, so its fee no longer holds. Prepare it again to see the current fee.";
export const WITHDRAW_FAILED =
  "We could not prepare this withdrawal, so no fee was set and nothing has moved. Try again in a moment.";
export const WITHDRAW_CONFIRM = "Confirm withdrawal";

export function withdrawDestination(accountName: string, bankName: string, last4: string): string {
  return `To ${accountName}, ${bankName}, account ending ${last4}.`;
}

/** The minimum, from policy (D51: 1,000 naira today), handed in already formatted. */
export function withdrawMinimum(minimumText: string): string {
  return `The smallest withdrawal is ${minimumText}.`;
}

/* -------------------------------------------------------------------------- */
/* THE RECEIPT VAULT, MEMBER REFUNDS, PAYOUTS (R3-05)                          */
/* -------------------------------------------------------------------------- */

export const RECEIPTS_TITLE = "Receipts";
export const RECEIPTS_LEDE =
  "Every payment you made through Vallo and every refund that came back, each with its receipt. Open one to print or save it.";
export const RECEIPTS_SEARCH_LABEL = "Search your receipts";
export const RECEIPTS_SEARCH_HINT = "A place, or a reference";
export const RECEIPTS_FILTER = { all: "All", payment: "Payments", refund: "Refunds" } as const;
export const RECEIPTS_EMPTY_TITLE = "No receipts yet";
export const RECEIPTS_EMPTY_BODY =
  "A receipt is issued when a payment through Vallo is confirmed by our payment partner, and when a refund comes back to you.";
export const RECEIPTS_NO_MATCH = "No receipt matches that search.";
/** Honest about scope: the search runs over the receipts this page read. */
export function receiptsSearchScope(count: number): string {
  /* No English plural branch (the no-english-plurals rule): the count is a
     figure beside a fixed noun phrase, true at any number. */
  return `Searching the records on this page (${count}). Show earlier to search further back.`;
}
export const RECEIPT_OPEN = "Open receipt";
export const RECEIPT_PRIVACY_TITLE = "Sharing a receipt";
export const RECEIPT_PRIVACY_BODY =
  "A rent receipt can be shared with a code instead of the document. Whoever checks the code sees the amount, the month, first names and the area, and never the address, a phone number or an email.";
export const RECEIPT_PRIVACY_ACTION = "Check a receipt code";
/**
 * The complaint pack's receipt-code line while the move-in is not paid in
 * full (a flatmate's share settled, the rest not). `create_receipt_code`
 * answers `not_paid` until `private.tenancy_paid`, and the tenancy file draws
 * the code panel only on a paid file, so "make a receipt code" was untrue.
 */
export const RECEIPT_CODE_AFTER_FULL_PAYMENT =
  "A receipt code can be made in the tenancy file once the move-in is paid in full.";
/**
 * The same line once the charge is void (cancelled, refunded or reversed):
 * `create_receipt_code` answers `not_paid` and `verify_receipt` answers
 * `not_found` for a void tenancy, so no code can be made or checked.
 */
export const RECEIPT_CODE_VOID =
  "A receipt code cannot be made or checked for a move-in that was cancelled, refunded or reversed.";
/** The complaint pack's money section on a void charge: the state said, under the total. */
export const TENANCY_VOID_STATEMENT = "This move-in was cancelled, refunded or reversed, so nothing is owed on it.";

export const REFUNDS_TITLE = "Refunds";
export const REFUNDS_LEDE =
  "Every refund on a payment you made, and where each one is. A refund goes back the way the money came.";
export const REFUNDS_EMPTY_TITLE = "No refunds";
export const REFUNDS_EMPTY_BODY =
  "If a stay is cancelled or a payment has to come back to you, the refund appears here with where it stands.";
export const REFUNDS_HOW_TITLE = "Asking for a refund";
export const REFUNDS_HOW_BODY =
  "Ask from the booking itself, so the request is dated and tied to the payment. The booking shows the cancellation terms that apply.";
export const REFUNDS_SCOPE = "Refunds among the payments and refunds on this page.";

export const PAYOUTS_TITLE = "Payouts";
export const PAYOUTS_LEDE =
  "What renters and guests paid for your spaces, the platform fee, and what reached your bank, payment by payment.";
export const PAYOUT_PAID_LABEL = "Renter or guest paid";
export const PAYOUT_FEE_LABEL = "Platform fee";
export const PAYOUT_RECEIVED_LABEL = "You received";
export const PAYOUT_REVERSED_LABEL = "Reversed by a refund";
/** A row whose fee parts the record does not carry: said, never computed. */
export const PAYOUT_FEE_UNRECORDED = "Not on this record";
export const PAYOUTS_EMPTY_TITLE = "No payouts yet";
/** Under the Payouts row in Settings: who the page is for, and what it records. */
export const PAYOUTS_ROW_SUB = "For listers: what renters and guests paid for your spaces, and what reached your bank.";
export const PAYOUTS_SAME_FIGURES =
  "Each payout shows the lines a lister sees before publishing, for the way that buyer paid: what was paid, the platform fee, payment processing where it applies, and what you received.";
/** The processor's own fee on a direct-rail payout, borne by the lister and named. */
export const PAYOUT_PROCESSING_LABEL = "Payment processing";

/* -------------------------------------------------------------------------- */
/* /payments, THE PAYER'S OWN MONEY SCREEN (R3-04)                             */
/* -------------------------------------------------------------------------- */

export const PAYMENTS_DOORS_LABEL = "Your records";
export const PAYMENTS_DOOR = {
  receipts: { title: "Receipts", sub: "Search, open, print or save every receipt" },
  refunds: { title: "Refunds", sub: "Every refund and where it stands" },
  methods: { title: "Payment methods", sub: "Saved cards and bank accounts" },
  agreements: { title: "Agreements", sub: "What each payment rests on" },
} as const;

/* -------------------------------------------------------------------------- */
/* /settings/payments (R3-04)                                                  */
/* -------------------------------------------------------------------------- */

export const SETTINGS_PAY_RECORDS = "Records";
export const SETTINGS_PAY_PAID_TITLE = "How you are paid";
export const SETTINGS_PAY_DOOR = {
  receipts: { title: "Receipts", sub: "Every payment and refund, with its receipt" },
  refunds: { title: "Refunds", sub: "Where each refund stands" },
  payouts: { title: "Payouts", sub: "What you received, with the platform fee in naira" },
} as const;

/* -------------------------------------------------------------------------- */
/* /host/bookings: a hotel answering a room request (C5, the route sweep)      */
/* -------------------------------------------------------------------------- */

/** Under the room bookings heading, after how accepting works. */
export const HOST_ROOM_BOOKING_PAYMENT =
  "Once it is approved on Vallo, the guest pays by card and your share goes straight to your default bank account.";
/** The total on the accept sheet: what the guest is asked for, not what the host receives. */
export const HOST_ROOM_TOTAL_LABEL = "Total the guest pays";
/** The last step after accepting. */
export const HOST_ROOM_GUEST_PAYS_NEXT = "The guest pays by card once it is approved.";

/* -------------------------------------------------------------------------- */
/* /host/earnings and /host/earnings/statement (C5, the route sweep)           */
/* -------------------------------------------------------------------------- */

/** A host's earnings before anybody has paid. */
export const HOST_EARNINGS_EMPTY_TITLE = "No guest has paid yet";
/** Under each month in the list of statements. */
export const HOST_STATEMENT_ROW_SUB = "Every payment, line by line, with a CSV";
/** The statement's door for somebody signed out. It said "what Vallo kept", which reads as Vallo keeping money. */
export const HOST_STATEMENT_SIGNED_OUT_BODY =
  "Sign in to see every payment, the platform fee on it, and what reached your bank.";
/** A month with no payment in it. Same correction: the fee is named, nothing is "kept". */
export const HOST_STATEMENT_EMPTY_TITLE = "No payments this month";
export const HOST_STATEMENT_EMPTY_BODY =
  "When a guest pays, the payment appears here line by line: what they paid, the platform fee, and your share.";

/* -------------------------------------------------------------------------- */
/* /cancellations and /safety (C6, the route sweep): the money sentences the  */
/* two pages wrote for themselves, moved here word for word. One changed:     */
/* /safety's "Vallo keeps no balance for you, so there is nothing to          */
/* withdraw" is untrue beside the Rewards Balance (D51, a debt Vallo owes and */
/* pays out), so both pages now say the narrower true thing about a refund;  */
/* and the payment reference opens from Plans, the name the app gives what   */
/* this sentence called Bookings.                                             */
/* -------------------------------------------------------------------------- */

/** A refund, after REFUND_ROUTE: nothing on Vallo holds it on the way back. Both pages. */
export const REFUND_NO_BALANCE =
  "There is no Vallo balance for a refund to sit in, so it always goes back the way the money came.";

/*
 * WHAT NO BALANCE HOLDS (A9, 6 October). /docs, the FAQ and both assistant
 * prompts said "Vallo keeps no balance in your name ... nothing to top up and
 * nothing to withdraw" and "There is no Vallo wallet, balance or escrow".
 * Beside the Rewards Balance (D51, a debt Vallo owes and pays out) the broad
 * version is untrue. This is the narrower thing that is: no balance holds a
 * payment. The Rewards Balance is named as separate, and never a wallet.
 */

/** /docs chapter 6 and the FAQ: no Vallo balance holds a payment. */
export const NO_PAYMENT_BALANCE =
  "No Vallo balance holds your rent or any other payment, and no payment of yours waits with Vallo to be withdrawn.";

/** After NO_PAYMENT_BALANCE, wherever somebody may be asking about rewards. */
export const REWARDS_BALANCE_SEPARATE =
  "Referral rewards are separate: where they run, they are counted as a Rewards Balance, which is what Vallo owes you and never money held for you.";

/** /docs chapter 6: who it is when somebody claims Vallo is holding money. */
export const HELD_MONEY_NOT_US =
  "If anybody tells you that Vallo is holding money for you, or asks you to send money to be held, it is not us.";

/** /cancellations, the lede: the terms are fixed when the stay is paid. */
export const CANCEL_LEDE =
  "A stay listed by an owner or agent follows the three steps below. A hotel, shortlet or serviced apartment run as a business picks one of four policies and shows its terms before you book. Either way the terms are fixed on your booking when you pay, so they cannot change afterwards.";

/** /cancellations: a hold nobody has paid for. */
export const CANCEL_BEFORE_PAID =
  "A reservation you have not paid for is a hold on the calendar and nothing more. Cancel it from Plans, at any hour, for nothing, and the nights reopen for somebody else immediately. A hold you walk away from releases itself, so you cannot accidentally block an agent's calendar by forgetting about it.";

/** /cancellations: a paid stay is cancelled by a person, and where the refund goes. */
export const CANCEL_AFTER_PAID =
  "Once money has moved, a cancellation is handled by a person rather than by a button, because a refund is somebody's money and it deserves a name against the decision. Ask from the booking in Plans, or write to support with your booking reference. We apply the terms fixed on your booking exactly as they are written, the refund goes back to the card or account you paid with, and you get the amount and the reason in writing.";

/** /cancellations: the agent cancels. `{hours}` is FULL_REFUND_HOURS, set as a figure by the page. */
export const CANCEL_BY_AGENT =
  "You get everything back, whenever it happens, including inside the last {hours} hours. The schedule above never applies to a cancellation you did not choose.";

/** /cancellations: the place is not what was listed. */
export const CANCEL_NOT_AS_LISTED =
  "Do not cancel. Report it from the listing on the day, with photographs if you have them. A misrepresented property is a standards matter, not a cancellation, and it is refunded in full once a person has looked at it.";

/** /cancellations: the guest could not get in. */
export const CANCEL_NO_ENTRY =
  "A gate that will not open, an estate that has no record of you, a key nobody brings. Message the agent in the thread so there is a time stamp, then report it. Same treatment: full refund once it is confirmed.";

/** /cancellations: a restaurant table. */
export const CANCEL_TABLE =
  "Nothing is taken for a table, so nothing has to come back. You ask a restaurant for a date, a time and a party size, and the restaurant confirms it or turns it down. Cancel from the reservation at any hour, for nothing, and tell them in its own conversation if you are simply running late. You pay the restaurant when you eat, and the schedule above has nothing to say about any of it.";

/** /safety, under the one rule: why nobody should send an account number. */
export const SAFETY_NO_ACCOUNT_NUMBER =
  "We add nothing to the price you are shown, and every payment happens inside the platform. So there is no honest reason for anyone to send you an account number, and if somebody does, they are not doing platform business. Report them and stop replying.";

/** /safety, how paying works: after NO_CUSTODY_SENTENCE, the processor and both sides (sweep item 13). */
export const SAFETY_PAY_THROUGH_VALLO =
  "Every payment on Vallo goes through the checkout screen with our licensed payment processor, using a card or a bank transfer the processor raises. On both sides there is no step where somebody sends you an account number.";

/** /safety, how paying works: the price is whole, and whose fees are whose. */
export const SAFETY_PRICE_IS_WHOLE =
  "The total you see before you commit is the lister's own number for that market, whole: the move-in total on a yearly tenancy, the nights, any cleaning charge and every charge listed for the door on a stay, the asking price on a sale or a lease. Where an agent charges a fee of their own it is theirs, it belongs on the listing, and it is named as theirs. A host may ask at the door only for a charge listed before you booked. Nothing of ours is added at the end. If your bank or card network takes something of their own, that is theirs and it is named as theirs too.";

/** /safety, how paying works: the reference every payment leaves. */
export const SAFETY_PAYMENT_RECORD =
  "Every payment writes a reference against your booking that you can open from Plans and from Agreements. If anything goes wrong, that reference is what a person on our side works from. A transfer you made to somebody's personal account has no such record and cannot be traced by us.";

/** /safety, how paying works: a table is not a payment. */
export const SAFETY_TABLE_NOT_A_PAYMENT =
  "A restaurant reservation is a request, not a payment. You ask for a date, a time and a party size, the restaurant answers, and you pay the restaurant when you eat. Nobody on Vallo has any reason to take money from you for a table, and anybody asking for one is not doing platform business.";

/** /safety, already paid outside: what Vallo can and cannot do. */
export const SAFETY_OUTSIDE_NOT_RECOVERABLE =
  "We cannot recover money that never came through the platform, and we will not pretend otherwise, but we can remove the account, hold the listing, and stop the same person from doing it to the next person.";

/* -------------------------------------------------------------------------- */
/* THE LOCK ON MONEY (V-81)                                                   */
/* -------------------------------------------------------------------------- */
/*
 * What the phone's lock guards, said as it is: Vallo holds no money, so there
 * is no wallet to send from and nothing to withdraw (`lib/security/money-intent.ts`).
 * The lock stands in front of the accounts a person's money is paid into: a
 * bank account or payout account added, made the default or removed, and the
 * lock itself removed. The dictionary's "Sending and withdrawing" lines said
 * otherwise and are no longer read on this screen.
 */

/** /settings/privacy/money-lock, the lede: what the lock is for. */
export const MONEY_LOCK_WHAT =
  "Use this phone's face or fingerprint lock before anybody adds, changes or removes the account your money is paid into, so a stolen unlocked phone cannot redirect it.";

/** /settings/privacy, the row's line under "Lock money with this phone". */
export const MONEY_LOCK_ROW =
  "Face or fingerprint before your payout account changes";

/** The money-lock group's note while nothing has happened. */
export const MONEY_LOCK_BODY =
  "Adding, changing or removing the bank or payout account your money is paid into will ask for this phone's face or fingerprint lock. If the lock will not answer, your password still works.";

/** After a phone is added as the lock. */
export const MONEY_LOCK_DONE = "Done. Changing where your money is paid will now ask for this phone's lock.";

/** After a phone is removed as the lock. */
export const MONEY_LOCK_REMOVED = "Removed. This phone no longer guards where your money is paid.";

/* -------------------------------------------------------------------------- */
/* PAID PROMOTION (D3, D60, docs/promotion/VALLO_PROMOTION.md)                */
/* -------------------------------------------------------------------------- */
/*
 * Promotion is Vallo's own revenue: a single-party charge settled to Vallo's
 * payment account and posted to `ledger_vallo_revenue` (D51). No split, no
 * subaccount, nothing held for anybody. It cannot be sold until the company
 * payment account exists (D38), so the onboarding's fourth screen and the
 * purchase section say buying is not open and draw no pay button. These are
 * their sentences (`components/app/feature-onboarding/first-runs.ts`,
 * `components/promotion/PromotionPurchase.tsx`). The prices themselves are
 * confirmed (founder, 6 October) and formatted from `lib/promotion/tiers.ts`.
 */

/** Promotion's fourth onboarding screen, the body: buying is not open yet. */
export const PROMOTION_NOT_ON_SALE =
  "Buying opens when payments for promotion are live. Nothing can be paid for here yet.";

/** Over the four tiers: what each row's figures are. */
export const PROMOTION_TIERS_CAPTION =
  "What each costs, for how many days, and what that comes to a day. Each costs more because it reaches further, not because it lasts longer.";

/**
 * One tier's price line: the price, its days and its naira a day, each
 * already formatted (`perDayKobo` in `lib/promotion/tiers.ts` does the
 * integer maths). `{days}` is a whole number.
 */
export function promotionTierPriceText(priceText: string, days: string, perDayText: string): string {
  return `${priceText} for ${days} days, ${perDayText} a day`;
}

/** When a promotion starts. Never before the processor confirms the payment. */
export const PROMOTION_STARTS = "When our payment processor confirms your payment, and never before.";

/** When it ends. */
export const PROMOTION_ENDS = "By itself, when its days are up, on the end date shown before you pay.";

/**
 * Statement 5: front door slots cannot be oversold. The published count is
 * said beside it, before payment, from `FRONT_DOOR_RAIL` (the dictionary's
 * `promotion.frontDoor.count`).
 */
export const PROMOTION_FULL_DAYS =
  "When a day is full the sale is refused, with the reason and the next date that is free. You are never charged for a day that is full.";

/** Statement 7 and the refund route. */
export const PROMOTION_REFUNDED =
  "It stops appearing as the refund is recorded, and the refund goes back to the card or bank account you paid with, through our payment processor.";

/* -------------------------------------------------------------------------- */
/* STEP 8, FUNDED (D68d, B.3.5): the protected payment, held by the provider   */
/* -------------------------------------------------------------------------- */

/** The licensed provider that holds a protected payment, as members read it. */
export const HELD_PROVIDER_NAME = "our licensed provider";

/** The renter's headline once the money is held. */
export const HELD_TITLE_RENTER = "Your money is held, not paid";
/** The lister's headline once the money is held. */
export const HELD_TITLE_LISTER = "The renter's payment is held for you";

/** Who holds it, in one line, for both sides. Vallo never holds it. */
export const HELD_BY_LINE =
  "Held by our licensed provider until the move-in is confirmed. Vallo never holds it.";

/** What releases it, in the order it happens. */
export const HELD_RELEASE_STEPS: readonly { title: string; body: string }[] = [
  { title: "You move in", body: "Inspect the home on the move-in date and collect the keys." },
  { title: "You confirm", body: "Only you can release it, with a deliberate swipe. Nobody else can confirm for you." },
  { title: "The lister is paid", body: "Our licensed provider pays the lister. Its fee comes out of the lister's share, not yours." },
];

/** The lister's view of the same steps. */
export const HELD_RELEASE_STEPS_LISTER: readonly { title: string; body: string }[] = [
  { title: "The renter moves in", body: "Hand over the keys on the move-in date." },
  { title: "The renter confirms", body: "Their confirmation releases the payment to you." },
  { title: "You are paid", body: "Our licensed provider pays you, less its fee for holding it." },
];

/** If something is wrong, before release. */
export const HELD_IF_WRONG =
  "Something not as agreed? Do not confirm. Raise it from this page and the money stays held while it is looked at.";

/** Vallo has paused the release while it looks at the deal. */
export const HELD_PAUSED =
  "Vallo is looking at this deal. The money stays held by our licensed provider until it is done; nothing moves meanwhile.";

/** The swipe that releases it. */
export const RELEASE_SWIPE_LABEL = "Swipe to release to the lister";
export const RELEASE_ARMED_LABEL = "Press again to release";

/* -------------------------------------------------------------------------- */
/* STEP 7, FUND (D77): the renter pays the agreed rent into escrow             */
/* -------------------------------------------------------------------------- */

/**
 * The page's title and the renter's headline (sweep item 14). The route itself
 * redirects to the agreement while the protected rail is off, so neither is
 * drawn today.
 */
export const FUND_TITLE = "Pay for this deal";
/** Under the figure: who will hold it, and until when. */
export const FUND_BY_LINE = "Our licensed provider holds it until you confirm the move-in. Vallo never holds it.";
/** The renter pays exactly the agreed rent; the escrow fee is the lister's (VALLO_PRICING section 6). */
export const FUND_NO_FEE_LINE = "No fee for you. The partner's fee comes out of the lister's share.";
/** What happens, in order, from this screen. */
export const FUND_STEPS: readonly { title: string; body: string }[] = [
  { title: "You pay it in", body: "From Wallet: the agreed rent, and nothing more." },
  { title: "Our partner holds it", body: "The lister can see it is there, and cannot touch it." },
  { title: "You confirm the move-in", body: "Only your swipe releases it to the lister." },
];
/** The swipe. */
export const FUND_SWIPE_LABEL = "Swipe to pay into escrow";
export const FUND_ARMED_LABEL = "Press again to pay";
export const FUND_CONFIRMING_LABEL = "Paying it into escrow";
export const FUND_CONFIRMED_LABEL = "Paid in. Opening your escrow";
/** The wallet row's words (D78: the screen is called Wallet). */
export const FUND_FROM_BALANCE = "From Wallet";
export const FUND_TOP_UP = "Add money to Wallet";
export const FUND_OPEN_BALANCE = "Open Wallet";
/** Why the screen cannot take a payment yet, each in one sentence. */
export const FUND_CLOSED = {
  not_renter: "Only the renter pays. You will see it on the agreement when they do.",
  not_rent: "This booking is paid by card.",
  direct: "This deal is paid by card.",
  not_approved: "Payment opens once both of you have confirmed the agreement.",
  review_required: "A person at Vallo is looking at this deal before payment opens. Nothing has been taken.",
  /* Rule (b) of 9 November 2026: never "paused". The route redirects first. */
  not_live: "You pay by card through Paystack. Nothing has been charged yet.",
  balance_unreadable: "Wallet could not be read just now. Nothing has been taken; refresh to try again.",
} as const;
/** The server's refusals, as the renter reads them. */
export const FUND_REFUSED: Record<string, string> = {
  switched_off: FUND_CLOSED.not_live,
  not_found: "We could not find that agreement on your account.",
  not_payable: FUND_CLOSED.not_approved,
  review_required: FUND_CLOSED.review_required,
  buyer_not_onboarded: "Open Wallet first, then pay from it.",
  seller_not_onboarded: "The lister has not finished setting up to receive this payment. Nothing has been taken.",
  below_provider_minimum: "This amount is below what our licensed provider can hold. Talk to the lister about how to pay.",
  move_in_unreadable: "The agreement has no move-in date our licensed provider can hold it against. Ask the lister to add one.",
  provider_refused: "Our licensed provider did not take the payment. Check that your balance covers it; nothing has moved.",
  unavailable: "That could not be done just now. Nothing has been taken; try again in a moment.",
  /* pov05: the payer chose card, so this deal is never also held. */
  not_escrow: "This payment is set to Pay by card, not escrow. Nothing has been taken. Go back to choose escrow.",
};

/* A stay at a listing paid into escrow (ruling 2, 13 October 2026): the same
   steps, in a guest's words. */
export const FUND_STEPS_STAY: readonly { title: string; body: string }[] = [
  { title: "You pay it in", body: "The price of the stay, and nothing more." },
  { title: "Our partner holds it", body: "The host can see it is there, and cannot touch it." },
  { title: "You confirm your check-in", body: "Only your swipe releases it to the host." },
];

/* -------------------------------------------------------------------------- */
/* PAY ON VALLO (founder rulings, 13 October 2026)                            */
/* -------------------------------------------------------------------------- */
/*
 * Every payment for a deal happens inside Vallo, and Vallo never holds it.
 * On a rent or a shortlet the payer picks, at the payment step, escrow (the
 * default) or card (`lib/payments/rail-choice.ts`); a sale is escrow only; a
 * hotel room is card only. The option labels are in `payChoice` in
 * `@vallo/i18n`; the sentences about where the money goes are here.
 */

/**
 * The one calm line where people decide: the listing, a chat about money, the
 * agreement before payment. Rule (a) of 9 November 2026, the founder's words
 * exactly: "not covered" implied a cover inside Vallo, and there is none.
 */
export const PAY_ONLY_THROUGH_VALLO =
  "Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong.";

/** The safety rule in Messages, on a rental's page and on the safety card (sweep item 54). */
export const KEEP_IT_INSIDE_VALLO = `For your safety, keep every chat inside Vallo. ${PAY_ONLY_THROUGH_VALLO} Pay only after you have inspected the property.`;

/**
 * Under "Escrow" on the payment step: who holds it, and until when. Drawn ONLY
 * in the two-option choice, which the server offers only while the protected
 * rail is live (`readPayChoice(data, protectedRailLive())`); never today.
 * Aligned with the founder's approved line for when the rail opens (the sweep,
 * class B): a licensed bank, never "a licensed partner holds".
 */
export const PAY_CHOICE_ESCROW_REASON =
  "Your payment is held by a licensed bank until you confirm the deal, then paid to the lister. Vallo never holds your money.";

/** Under "Pay by card" on the payment step: where it goes, and when. */
export const PAY_CHOICE_CARD_REASON =
  "Your card is charged now, and the lister's share goes straight to their bank account in the same payment.";

/** The payment step's title on a purchase (sweep item 19; the dictionary's `payChoice.escrowOnlyTitle`). */
export const PAY_CHOICE_SALE_TITLE = "Paying for a purchase";

/** A purchase, said rather than asked (sweep item 19 with rule (c)). */
export const PAY_CHOICE_SALE_ONLY = `${SALE_PAYMENT_NOT_OPEN} Nothing has been charged. ${SALE_TITLE_CHECK} ${SALE_NEVER_PAID_ON_VALLO}`;

/** A hotel room: card at the price shown, said rather than asked. */
export const PAY_CHOICE_ROOM_ONLY = "A hotel room is paid by card at the price shown, with nothing added.";

/**
 * The protected rail is off (the server reads `protectedRailLive()` as false),
 * which is today: the payer pays by card. Rule (b) of 9 November 2026, the
 * founder's words exactly. Never "paused", "coming back" or "temporarily": it
 * never ran. This is the payment step's one quiet line naming the processor.
 */
export const PAY_CHOICE_ESCROW_PAUSED = "You pay by card through Paystack. Nothing has been charged yet.";

/*
 * The same moment on a purchase (sweep item 21 with rule (c)) is said by the
 * purchase's own reason, PAY_CHOICE_SALE_ONLY, which already carries "Nothing
 * has been charged" and that Vallo takes no payment for a purchase. The note
 * that repeated it ("escrow is paused ... Try again later") is gone.
 */

/** The payer moved a system-approved deal to card and a risk check asks a person first (pov04, sweep item 22). */
export const TOLD_WHEN_IT_OPENS = "You are told by email and in the app when it opens.";
export const PAY_CHOICE_CARD_REVIEW = `A person at Vallo looks at this deal before a card payment opens. Nothing has been charged. ${TOLD_WHEN_IT_OPENS}`;

/** The payment step's refusals that carried escrow (sweep item 24; `payChoice.refused` in the dictionary). */
export const PAY_REFUSED_SALE = `${SALE_PAYMENT_NOT_OPEN} ${SALE_NEVER_PAID_ON_VALLO}`;
export const PAY_REFUSED_NOT_OPEN = "This payment is not open on Vallo.";
/* The refusal's first sentence as it stood, with "Escrow is open." removed, so
   the existing Yoruba, Hausa and Igbo stay true by the same deletion. */
export const PAY_REFUSED_CARD_REVIEW =
  "Paying by card is not open on this deal now, because it would need a person at Vallo to check it first.";

/* The calm fallback from the escrow step to card (founder instruction,
   13 October 2026: nobody is stranded). */
export const SWITCH_TO_CARD_LABEL = "Pay by card instead";
export const SWITCH_TO_CARD_LEAD =
  "You can pay this by card. Our payment processor sends the lister's share straight to their bank account.";
export const SWITCH_TO_CARD_REFUSED: Record<string, string> = {
  card_not_allowed: "This payment can only go through escrow. Nothing has been charged.",
  held: "Your money is already with the payment partner, so this is paid. Open the payment to see where it is.",
  moving: "Your escrow payment is still being confirmed by the payment partner. Nothing is charged twice; check back in a few minutes.",
  provider_refused: "The payment partner did not let us close the escrow payment, so it may have been paid. Open the payment to see where it is.",
  unknown: "We could not confirm the escrow payment was closed. Nothing is charged twice; check back in a few minutes.",
  locked: "A payment for this deal is already moving, so it cannot change now. Nothing is charged twice.",
  unavailable: "That could not be done just now. Nothing has been charged; try again in a moment.",
};

/**
 * For a hotel (ruling 3): Vallo's fee on a paid room, from the hotel's share.
 * `percentText` is formatted from the rate (`bpsAsPercentText`), never typed.
 */
export function hotelRoomFeeSentence(percentText: string): string {
  return `When a guest pays for a room, Vallo's fee is ${percentText} of the charge, taken from your share. The guest pays the price you set, with nothing added, and there is no fee on a booking that is not paid.`;
}

/* -------------------------------------------------------------------------- */
/* THE DOCS' AND THE HELP CENTRE'S MONEY RULES (9 November 2026)              */
/* -------------------------------------------------------------------------- */
/*
 * Moved here from `app/(site)/docs/facts.ts`, which re-exports them, so the
 * docs, the help centre, the guides and the support chat read the one module.
 * The escrow sentences they replaced ("Escrow, which is selected for you",
 * "a licensed payment partner holds your payment", "a sale is always paid
 * through escrow", "if escrow is paused") are retired with the protected rail
 * (sweep items 26 to 31).
 */

/** Rule 1: every payment for a deal is made inside Vallo (sweep item 26, with rule (a)). */
export const PAY_INSIDE_VALLO = `Every payment for a deal happens inside Vallo. ${PAY_ONLY_THROUGH_VALLO}`;

/** Rule 2: who holds money (sweep item 27). The processor is not named here. */
export const VALLO_NEVER_HOLDS =
  "Vallo never holds customer money. Card payments are processed by our payment processor, which splits each payment to the owner, agent or host.";

/** Stays and hotel rooms: card, the only way to pay on Vallo today. */
export const STAYS_PAID_BY_CARD = "Shortlets and hotel rooms are paid by card, through our payment processor.";

/** Rule 3: how each kind of deal is paid (sweep item 28, which replaced the escrow-or-card choice). */
export const HOW_EACH_DEAL_IS_PAID = `${STAYS_PAID_BY_CARD} ${RENT_PAYMENT_NOT_OPEN}`;

/** Where an answer needs to say it (sweep item 29). */
export const ESCROW_NOT_OFFERED = "Vallo does not offer escrow.";

/** What paying by card does. */
export const CARD_MEANS =
  "When you pay by card, your payment goes to the owner, agent or host through our payment processor as soon as it clears.";

/** Rule 4: a sale (sweep item 30, with rule (c)). */
export const SALE_NOT_PAID = `${SALE_PAYMENT_NOT_OPEN} ${SALE_TITLE_CHECK} ${SALE_NEVER_PAID_ON_VALLO}`;

/** The docs' troubleshooting line where "if escrow is paused" was (sweep item 31). */
export const RENT_AND_SALE_NOT_OPEN = PAYMENT_GATE_SENTENCE;

/** A lister on a rental: terms agreed now, the payment not open (sweep item 40). */
export const LISTER_AGREE_TERMS =
  "You agree terms with the renter on Vallo. Payment for rentals is not open yet; for stays, our payment processor sends your share to the bank account on your payout details.";

/**
 * THE HELP PAGE ON HOW PAYING WORKS names the processor (one of the five
 * surfaces, 9 November 2026): card details go to Paystack, never to Vallo.
 * Read only by the /docs/paying-on-vallo chapter.
 */
export const HOW_PAYING_PROCESSOR_NAMED =
  "Card payments on Vallo are processed by Paystack, a licensed payment processor. You enter your card details in Paystack's own payment window, and Vallo never sees your full card number.";

/** A lister's share on a card payment, in the docs and the help centre (sweep items 35 and 45). */
export const CARD_SHARE_WHEN_CLEARS = "When a guest pays by card, your share goes to your bank account when the payment clears.";

/** The help centre's "What payment methods can I use?" (sweep item 44, the processor not named). */
export const PAYMENT_METHODS_ANSWER =
  "You pay in naira, inside Vallo, in our payment processor's own payment window, with a Nigerian card or a bank transfer the processor raises. Vallo never sees your full card number.";

/** A refund route the docs can state without the escrow leg (sweep item 36). */
export const REFUND_TO_CARD_BY_DAY_FIVE =
  "A refund due to you goes back to the card or account you paid with, through our payment processor. Vallo starts it by the end of the fifth Nigerian business day after you ask.";

/** The newsletter's "Buying and selling, done carefully" (sweep item 53, with rule (c)). */
export const NEWSLETTER_SALE_LINE = `Property for sale with the title stated up front, and an agreement both sides confirm before any money moves. ${SALE_NEVER_PAID_ON_VALLO}`;

/** The assistant's payment review card: a caution deposit is not held by anybody on Vallo (sweep item 56). */
export const CAUTION_DEPOSIT_LABEL = "Caution deposit (returnable under your agreement)";

/* -------------------------------------------------------------------------- */
/* THE ASSISTANT AND SUPPORT PROMPTS (sweep item 57, rule (i))                */
/* -------------------------------------------------------------------------- */

/**
 * Added to both prompts so the model never offers what is switched off. Rule
 * (i) asked for "Escrow and protected payment are not offered on Vallo. Never
 * offer them."; the claims gate (lib/trust/claims.ts) reads that "protected" as
 * an unbacked claim, so the lead's wording of 9 November 2026 says the same
 * thing without the claim word.
 */
export const PROMPT_NO_ESCROW = "Vallo does not offer escrow or payment held by a bank. Never offer them.";

/* -------------------------------------------------------------------------- */
/* MONEY SENTENCES KEPT AS DICTIONARY KEYS (rule (d), 9 November 2026)        */
/* -------------------------------------------------------------------------- */
/*
 * These sentences are read through `@vallo/i18n` (so a screen keeps its
 * locale plumbing), but the English value must equal the constant here:
 * `money-copy-sweep.test.ts` maps each dictionary path to its constant. The
 * Yoruba, Hausa and Igbo values are this English until a native reader
 * translates them; nobody here invents a translation.
 */

/** `platform.devices.notMeConfirm` and `.notMeWorking` (sweep item 49): Vallo never holds a member's money. */
export const NOT_ME_CONFIRM = "Tap again to pause payments";
export const NOT_ME_WORKING = "Pausing payments";

/** `chargebacks.hold.means` and the lost and re-owed notices (sweep items 50 to 52, no Guarantee, no escrow). */
export const CHARGEBACK_HOLD_MEANS =
  "While it is owed, Vallo pauses withdrawals from your Rewards Balance. Card payments still reach your payout account at the moment of payment. Nothing else on your account changes.";
export const CHARGEBACK_LOST_BODY =
  "The payer's bank reversed {amount}. It is owed back. Until it is settled, Vallo pauses withdrawals from your Rewards Balance.";
export const CHARGEBACK_REOWED_BODY =
  "The reversed {amount} is owed again. Until it is settled, Vallo pauses withdrawals from your Rewards Balance.";

/** `afterTheGate` caution escalation, worded by the lead (9 November 2026): Vallo looks into it, nothing is guaranteed. */
export const CAUTION_ESCALATED = "With Vallo staff";
export const CAUTION_ESCALATE_HELP =
  "It was due back by {date}. {amount} is still owed and not in dispute. Vallo can look into it, using the inspection report and your messages as the record.";
export const CAUTION_ESCALATE_SUBMIT = "Ask Vallo to look into it";
export const CAUTION_ESCALATE_OPEN = "Vallo staff are looking into the caution that is still owed.";

/** `afterTheGate.refund`: where a stay's refund is, without naming the processor (rule (e)). */
export const REFUND_LANDED = "Refunded to your card {date}. Our payment processor confirmed it went through.";
export const REFUND_INITIATED =
  "Our payment processor started the refund to your card on {date}. Banks usually show it within a few business days.";
export const REFUND_INITIATED_LATE =
  "Our payment processor started the refund to your card on {date}, after the latest date promised, {due}.";
export const REFUND_SENDING =
  "The refund is decided and is being sent to our payment processor, back to the card or account you paid with.";

/** `bookingsPage.step2Body` (the "How booking works" steps): card, never named there. */
export const BOOKING_STEP_PAY = "Payment in naira, by card. You are never charged early.";

/** `platform.inflight.pendingVerdict`: a payment that lost its connection. */
export const INFLIGHT_PENDING_VERDICT = "Our payment processor has not told us yet";

/** `subscriptions.terms.price`: the plan page, above the buttons (the pay sheet names the processor once). */
export const PLAN_PRICE_LINE = "{price} a month, paid by card.";

/** `subscriptions.confirm` and `subscriptions.errors.cancel_failed`: after the pay step, never named. */
export const PLAN_CONFIRM_BODY =
  "We are waiting for our payment processor to confirm the charge. This page updates on its own; you do not need to pay again.";
export const PLAN_CONFIRM_FAILED_BODY =
  "What our payment processor reported did not match the plan, so nothing was turned on. Vallo staff have been alerted to look at it.";
export const PLAN_CONFIRM_DECLINED_BODY =
  "Our payment processor says the charge failed, so nothing was taken for a plan. You can try again from the Vallo Pro page.";
export const PLAN_CONFIRM_SLOW_BODY =
  "Our payment processor has not confirmed this charge yet. If you paid, your plan turns on as soon as it does. You do not need to pay again.";
export const PLAN_CANCEL_FAILED = "We could not cancel with our payment processor just now. Nothing has changed. Try again in a moment.";

/* -------------------------------------------------------------------------- */
/* WHERE THE PROCESSOR IS NAMED (rule (e), 9 November 2026)                   */
/* -------------------------------------------------------------------------- */

/** The five surfaces, plus staff screens, which are not member copy. */
export type PaystackSurface = "receipt" | "terms" | "privacy" | "help-paying" | "pay-step" | "staff";

/**
 * The only constants in this module that may say "Paystack", each with the
 * one surface it is drawn on. `paystack-naming.test.ts` fails when any other
 * constant names the processor, and when one of these is imported by a file
 * outside its surface.
 */
export const PAYSTACK_NAMED: Readonly<Record<string, PaystackSurface>> = {
  PAY_CHOICE_ESCROW_PAUSED: "pay-step",
  FUND_CLOSED: "pay-step",
  FUND_REFUSED: "pay-step",
  HOW_PAYING_PROCESSOR_NAMED: "help-paying",
  ADMIN_HISTORY_NOTE: "staff",
};

/* ======================================================================
 * THE PROTECTED PAYMENT SCREENS (PROTECTED_PAYMENTS_SPECS spec two, 10
 * November 2026). Built switched off: these sentences are drawn only by
 * components/money/protected-rail, which no live page mounts while
 * `payments_escrowpay_on` is off and no category is approved. Every sentence
 * that says a payment is protected or held is drawn only on a state the
 * provider confirmed (lib/money/protected-journey.ts reads the recorded
 * state, never the browser). The provider's own funds wording is in
 * protected-wording.ts and is used unaltered.
 * ==================================================================== */

/** Each screen's written label (spec: never a financial state by colour alone). */
export const PROTECTED_STAGE_LABEL = {
  awaiting_transfer: "Awaiting transfer",
  confirming: "Transfer being confirmed",
  expired: "Transfer details expired",
  protected: "Protected",
  release_processing: "Release in progress",
  released: "Released",
  disputed: "In dispute",
  refund_processing: "Refund in progress",
  refunded: "Refunded",
  requires_review: "With a person at Vallo",
  failed: "Not completed",
} as const;

/* Screen 1, choose how to pay. */
export const PROTECTED_CHOOSE_EYEBROW = "Complete your booking";
export const PROTECTED_CHOOSE_TITLE = "Choose how you want to pay";
export const PROTECTED_OPTION_TITLE = "Protected bank transfer";
export const PROTECTED_OPTION_RECOMMENDED = "Recommended";
export const PROTECTED_ROW_METHOD = "Payment method";
export const PROTECTED_ROW_METHOD_VALUE = "Bank transfer";
export const PROTECTED_ROW_FEE = "Protection fee";
export const PROTECTED_ROW_FEE_LISTER_PAYS = "Paid by the lister";
export const PROTECTED_ROW_TOTAL = "Total to transfer";
export const PROTECTED_FEE_NOTE = "The exact fee and any other charges are shown before you continue.";
export const CARD_OPTION_TITLE = "Pay by card";
export const CARD_OPTION_LINE = "Standard card checkout";
export const CARD_OPTION_NOTE =
  "Card payments follow the standard payment terms and may not include the protected holding arrangement.";
export const PROTECTED_CHOOSE_CONDITIONS = "The payment and release conditions are set out in your agreement.";
export const PROTECTED_CHOOSE_CTA = "Continue with protected transfer";
export const CARD_CHOOSE_CTA = "Continue to card payment";
export const PROTECTED_UNAVAILABLE_FEE =
  "We could not work out the fee just now, so this cannot be paid yet. Nothing has been charged.";
export const PROTECTED_UNAVAILABLE_SERVICE =
  "The payment service is not answering just now. Nothing has been charged. Try again in a moment.";
export const PROTECTED_UNAVAILABLE_AGREEMENT =
  "This agreement has changed since it was approved, so it cannot be paid. Open the agreement to see the current version.";

/* Screen 2, review the protection agreement. */
export const PROTECTED_REVIEW_TITLE = "Before you protect this payment";
export function protectedReviewLead(amount: string, place: string): string {
  return `You are paying ${amount} for ${place}.`;
}
export const PROTECTED_REVIEW_HELD =
  "The funds will be held by the designated licensed bank after your transfer is confirmed. They will remain held until you confirm that the agreed handover has taken place, or an authorised outcome is reached through the dispute process.";
export const PROTECTED_REVIEW_DISPUTE =
  "If there is a problem, you can submit evidence through Vallo. The funds remain held while the dispute is reviewed, subject to the agreement and applicable rules.";
export const PROTECTED_REVIEW_ROWS = {
  property: "Property",
  payer: "Paying",
  payee: "Receiving",
  amount: "Amount",
  dates: "Dates",
  release: "Released when",
  refunds: "Refunds",
  fee: "Protection fee",
} as const;
export const PROTECTED_RELEASE_WHEN = {
  check_in: "You confirm check-in",
  keys: "You confirm you have the keys",
} as const;
export const PROTECTED_REVIEW_CHECKBOX = "I have reviewed the agreement, payment conditions and refund process.";
export const PROTECTED_REVIEW_CTA = "Agree and continue";
export const PROTECTED_REVIEW_FULL = "Read the full agreement";

/* Screen 3, funding instructions. */
export const PROTECTED_FUNDING_EYEBROW = "Vallo payment reference";
export const PROTECTED_FUNDING_EXACT = "Transfer the exact amount shown below.";
export const PROTECTED_FUNDING_ROWS = {
  bank: "Bank",
  accountName: "Account name",
  accountNumber: "Account number",
  reference: "Transfer reference",
} as const;
export function protectedExpiresIn(clock: string): string {
  return `Transfer expires in ${clock}`;
}
export const PROTECTED_FUNDING_NO_EXPIRY = "No time limit was given for these details.";
export const PROTECTED_FUNDING_WARNING =
  "Use the exact account details and reference. A transfer to another account may not be matched to this payment.";
export const PROTECTED_FUNDING_CTA = "I've made the transfer";
export const PROTECTED_FUNDING_CTA_NOTE = "This does not confirm payment. We'll verify the transfer with the bank.";
export const PROTECTED_COPIED = {
  accountNumber: "Account number copied",
  reference: "Reference copied",
} as const;
export const PROTECTED_EXPIRED_TITLE = "These transfer details have expired";
export const PROTECTED_EXPIRED_BODY =
  "Do not send money to them now. If you already sent a transfer, contact support with the reference below so it can be traced.";
export const PROTECTED_EXPIRED_CTA = "Get new transfer details";

/* Screen 4, waiting for the transfer. */
export const PROTECTED_WAITING_TITLE = "We're checking for your transfer";
export const PROTECTED_WAITING_BODY = "Your payment instructions are ready. We're waiting for confirmation from the bank.";
export const PROTECTED_WAITING_CLOSE = "You can close Vallo. We'll keep checking and update this payment when the bank confirms it.";
export function protectedLastUpdated(time: string): string {
  return `Updated ${time}`;
}
export const PROTECTED_WAITING_REFRESH = "Refresh status";
export const PROTECTED_NEED_HELP = "I need help";
export const PROTECTED_STILL_WAITING =
  "Still waiting for confirmation. Bank transfers can take a while to be confirmed. If you are worried, contact support with your reference.";

/* Screen 5, the payment held. */
export const PROTECTED_HERO_EYEBROW = "Payment confirmed";
export const PROTECTED_HERO_TITLE = "Your payment is protected.";
export const PROTECTED_HERO_PROMISE = {
  check_in: "Your payment is held by a licensed bank until you confirm check-in. Vallo never holds your money.",
  keys: "Your payment is held by a licensed bank until you confirm you have the keys. Vallo never holds your money.",
} as const;
export const PROTECTED_NEXT_TITLE = "What happens next";
export const PROTECTED_STEP_LABEL = {
  transfer: "Transfer received by the bank",
  held: "Funds held by the bank",
  milestone: { check_in: "Confirm check-in", keys: "Confirm you have the keys" },
  release: "Funds released under your agreement",
} as const;
export const PROTECTED_WHEN_PAID_TITLE = "When is the lister paid?";
export const PROTECTED_WHEN_PAID = {
  check_in:
    "Once you confirm check-in and the agreed handover is complete, Vallo will instruct the release of funds under your agreement.",
  keys: "Once you confirm you have the keys and the agreed handover is complete, Vallo will instruct the release of funds under your agreement.",
} as const;
export const PROTECTED_WHERE_TITLE = "Where is your money?";
export const PROTECTED_WHERE_VALLO = "Vallo does not hold your funds.";
export const PROTECTED_HOW_LINK = "How protection works";
export const PROTECTED_VIEW_DETAILS = "View transaction details";

/* Screen 6, the milestone, by category. */
export const PROTECTED_MILESTONE = {
  check_in: {
    title: "Have you checked in?",
    body: "Confirm that you received access to the accommodation described in your agreement.",
    yes: "Yes, I've checked in",
  },
  keys: {
    title: "Do you have the keys?",
    body: "Confirm that you received the keys and possession of the property described in your agreement.",
    yes: "Yes, I have the keys",
  },
} as const;
export const PROTECTED_MILESTONE_PROBLEM = "Something is wrong";
export const PROTECTED_MILESTONE_CONFIRM_TITLE = "Release the payment?";
export const PROTECTED_MILESTONE_CONFIRM_BODY =
  "Confirming tells Vallo to instruct the bank to release the payment to the lister. This cannot be undone.";
export const PROTECTED_MILESTONE_CONFIRM_CTA = "Confirm and release";
export const PROTECTED_NOT_YET = "Not yet";

/* Screens 7 and 9, release and refund. */
export const PROTECTED_RELEASE_PROCESSING_TITLE = "We have asked the bank to release the payment";
export const PROTECTED_RELEASE_PROCESSING_BODY = "The lister is paid when the bank confirms the release. Nothing more is needed from you.";
export const PROTECTED_RELEASED_TITLE = "Payment released";
export const PROTECTED_RELEASED_BODY = "The bank confirmed the release to the lister. Your receipt is ready.";
export const PROTECTED_REFUND_PROCESSING_TITLE = "We have asked the bank to refund you";
export const PROTECTED_REFUND_PROCESSING_BODY = "The refund is complete when the bank confirms it. You will see it here.";
export const PROTECTED_REFUNDED_TITLE = "Refund confirmed";
export const PROTECTED_REFUNDED_BODY = "The bank confirmed your refund. Your receipt is ready.";
export const PROTECTED_DOWNLOAD_RECEIPT = "Download receipt";

/* Screen 8, dispute. */
export const PROTECTED_DISPUTE_TITLE = "You raised a problem";
export const PROTECTED_DISPUTE_BODY =
  "The payment stays held while the dispute is reviewed, subject to your agreement. Add what you have: photos, messages and a short statement.";
export const PROTECTED_DISPUTE_ADD = "Add evidence";
export const PROTECTED_DISPUTE_NEXT =
  "A person at Vallo reads both sides, may ask either of you for more, and tells you the outcome here.";

/* The states nobody asks for. */
export const PROTECTED_REVIEW_STATE_TITLE = "A person at Vallo is looking at this payment";
export const PROTECTED_REVIEW_STATE_BODY =
  "Something about this transfer needs a closer look, for example an amount that does not match. Nothing moves until it is resolved, and you will see the outcome here.";
export const PROTECTED_FAILED_TITLE = "This payment did not go through";
export const PROTECTED_FAILED_BODY = "If money left your account, contact support with the reference below.";

/* Screen 10, the lister's side. */
export const PROTECTED_LISTER_AMOUNT = "Protected transaction amount";
export const PROTECTED_LISTER_NOT_BALANCE = "This is not a balance you can spend. It becomes yours when the bank releases it.";
export const PROTECTED_LISTER_STAGE = {
  awaiting_transfer: "The payer has their transfer details. No money has arrived yet.",
  confirming: "The payer says they have transferred. The bank has not confirmed it yet.",
  expired: "The payer's transfer details expired before any money arrived.",
  protected: "The bank confirmed the payment is held. It is released to you once the payer confirms the handover.",
  release_processing: "The payer confirmed the handover. Vallo has asked the bank to release the payment to you.",
  released: "The bank confirmed the release to your payout account.",
  disputed: "The payer raised a problem. The payment stays held while the dispute is reviewed. Add your side below.",
  refund_processing: "Vallo has asked the bank to refund the payer.",
  refunded: "The bank confirmed the refund to the payer.",
  requires_review: "A person at Vallo is looking at this payment. Nothing moves until it is resolved.",
  failed: "This payment did not go through. No money reached the bank.",
} as const;

/* Screen 11, the persistent timeline. */
export const PROTECTED_TIMELINE_TITLE = "This payment, step by step";
export const PROTECTED_TIMELINE_STOPPED = "Stopped here";

/* The screens nobody asks for (spec two, A, B, C and the delays), 10
   November 2026. Each is a state of the same screens: words, an icon and
   what to do next. None blames the payer and none promises a time. */
export const PROTECTED_ISSUE = {
  partner_unavailable: {
    label: "Partner not answering",
    title: "We can't reach the payment partner just now",
    body: "Your payment is still here and nothing has moved because of this. Below is the last status we confirmed, with the time we confirmed it.",
    next: "We'll keep trying and update this page when the partner answers. You don't need to do anything or pay again.",
  },
  amount_mismatch: {
    label: "Different amount received",
    title: "We received a different amount",
    body: "The amount received doesn't match your agreement, so this payment needs a review before it can continue.",
    next: "A person at Vallo will look at the transfer and tell you here what happens next. Please don't send another transfer to make up a difference: any further payment is agreed separately and linked to this one.",
  },
  late_transfer: {
    label: "Arrived after expiry",
    title: "A transfer arrived after the details expired",
    body: "Money reached the bank after these transfer details had expired, so this payment needs a review before it can continue.",
    next: "A person at Vallo will match the transfer to this payment and tell you here what happens next. Please don't send another transfer in the meantime.",
  },
  duplicate_transfer: {
    label: "More than one transfer",
    title: "We received more than one transfer",
    body: "The bank reported more than one transfer for this payment, so it needs a review before it can continue.",
    next: "A person at Vallo will look at every transfer and tell you here what happens to the extra one. Please don't send another transfer.",
  },
  release_delayed: {
    label: "Release taking longer",
    title: "The release is taking longer than usual",
    body: "Vallo asked the bank to release the payment, and the bank has not confirmed it yet. Nothing more is needed from you.",
    next: "We're following it up with the payment partner and will update this page when the bank confirms. If you have a question, contact support with the reference below.",
  },
  refund_delayed: {
    label: "Refund taking longer",
    title: "Your refund is taking longer than usual",
    body: "Vallo asked the bank to refund you, and the bank has not confirmed it yet. Nothing more is needed from you.",
    next: "We're following it up with the payment partner and will update this page when the bank confirms. If you have a question, contact support with the reference below.",
  },
  payout_missing: {
    label: "Payout account needed",
    title: "Add a payout account to be paid",
    body: "A released payment goes to your payout account, and there isn't one on your Vallo account yet.",
    next: "Add it now, so nothing waits on you when a release is confirmed. Nothing changes for the payer.",
  },
} as const;
export const PROTECTED_ISSUE_NEXT_TITLE = "What happens now";
export const PROTECTED_ISSUE_ROWS = {
  agreed: "Agreed amount",
  received: "Amount received",
  difference: "Difference",
  lastConfirmed: "Last confirmed status",
  askedAt: "Asked of the bank",
} as const;
export const PROTECTED_ADD_PAYOUT = "Add a payout account";
export function protectedLastConfirmed(time: string): string {
  return `Last confirmed ${time}`;
}
/** The lister's line beside the payer's delay, in the lister's words. */
export const PROTECTED_LISTER_ISSUE = {
  partner_unavailable: "We can't reach the payment partner just now. Below is the last status we confirmed; nothing has moved because of this.",
  amount_mismatch: "The amount the bank received doesn't match the agreement. A person at Vallo is reviewing it before anything continues.",
  late_transfer: "A transfer arrived after the payer's details had expired. A person at Vallo is reviewing it before anything continues.",
  duplicate_transfer: "The bank reported more than one transfer. A person at Vallo is reviewing it before anything continues.",
  release_delayed: "The release is taking longer than usual. Vallo is following it up and will update this page when the bank confirms.",
  refund_delayed: "The refund to the payer is taking longer than usual. Vallo is following it up with the payment partner.",
} as const;

/* Raising a problem (spec screen 8): the reasons, the statement and what
   happens after. A statement once sent is never edited; more evidence is a
   new entry. */
export const PROTECTED_PROBLEM_TITLE = "Something isn't right?";
export const PROTECTED_PROBLEM_LEAD =
  "Tell us what happened. Your payment will be reviewed under the agreement, and the funds remain held where the partner's arrangement permits.";
export const PROTECTED_PROBLEM_REASONS = {
  not_as_described: "The property is not as described",
  no_access: "I could not access the property",
  no_keys: "The keys or access were not provided",
  unusable: "The property is unusable",
  unresponsive: "The host or agent is unresponsive",
  other: "Something else",
} as const;
export const PROTECTED_PROBLEM_REASON_LABEL = "What went wrong";
export const PROTECTED_PROBLEM_STATEMENT_LABEL = "What happened";
export const PROTECTED_PROBLEM_STATEMENT_HINT =
  "Say what happened and when. Avoid passwords, card details or unrelated personal information.";
export const PROTECTED_PROBLEM_DRAFT_KEPT = "Your draft is kept on this device until you send it.";
export const PROTECTED_PROBLEM_SUBMIT = "Send the report";
export const PROTECTED_PROBLEM_SENT =
  "Your report has been submitted. The payment is now under review, and we'll update this page when the other party responds or there is news.";

/* The server's refusals for the protected actions. */
export const PROTECTED_ACTION_REFUSED = {
  rail_off: "Protected payment is not open on Vallo yet. Nothing has been sent and nothing has moved.",
  not_found: "We could not find that payment on your account.",
  too_many: "That was asked a lot just now. Wait a moment, then try again.",
  bad_input: "Something in that request was not right. Nothing was sent.",
  unavailable: "That could not be done just now. Nothing has moved; try again in a moment.",
} as const;

/** The plain statement the trust page and the payment step lean on. It names no date. */
export const PROTECTED_NOT_OPEN =
  "Protected payment is not open on Vallo yet. This page explains how it will work, so you know what to expect before it opens; nothing on Vallo is paid this way today.";

/* The protected receipt (BUILD 7.4): the custodian in the provider's own
   words, the provider's reference, and the release or refund history. */
export const PROTECTED_RECEIPT_TITLE = "Payment record";
export const PROTECTED_RECEIPT_ROWS = {
  reference: "Vallo reference",
  providerReference: "Partner reference",
  agreement: "Agreement version",
  custodian: "Where the money was held",
  rail: "Paid by",
  status: "Status",
} as const;
export const PROTECTED_RECEIPT_RAIL = "Bank transfer to the designated account";
export const PROTECTED_RECEIPT_HISTORY = "History";
export const PROTECTED_RECEIPT_EVENT = {
  funded: "Transfer confirmed by the bank",
  release_requested: "Release asked of the bank",
  released: "Release confirmed by the bank",
  refund_requested: "Refund asked of the bank",
  refunded: "Refund confirmed by the bank",
} as const;
export function protectedAgreementVersion(version: number): string {
  return `Version ${version}`;
}
export const PROTECTED_RECEIPT_NOTE =
  "This is a Vallo transaction record with the partner's references. It is not a bank statement.";
export const PROTECTED_RECEIPT_HELP = {
  wrong: "Something wrong with this payment?",
  where: "Where is my money?",
  who: "Who is holding this?",
} as const;

/* The payments list (BUILD 7.5). */
export const PROTECTED_PAYMENTS_HEADING = "Bank transfer payments";

/* "How protection works" (BUILD 7.7), the trust page at
   /docs/how-protection-works. Written to be read by a nervous person: who
   holds the money, how it moves, what each state means, the fees (always
   computed from protected-fees.ts, never typed), what it does not cover and
   what happens when something goes wrong. The provider's and the
   custodian's names come from protected-wording.ts. */
export const PROTECTED_HOW = {
  title: "How protection works",
  category: "Money",
  summary:
    "A protected payment is a bank transfer that a licensed bank holds under your agreement until the handover you agreed has happened. This page explains who holds the money, how it moves, what it costs, and what it does not cover.",
  notOpenTitle: "Not open yet",
  glance: [
    "The money is held by a licensed bank, never by Vallo.",
    "It is released only when you confirm the handover, or through the dispute process.",
    "The lister pays the fee; you transfer the agreed amount and no more.",
    "Shortlets, hotel rooms and restaurants are paid by card instead.",
  ],
  who: {
    title: "Who holds the money",
    lead: "When protected payment opens, the money you transfer goes to a designated account at a licensed bank. In the partner's own words:",
    vallo:
      "Vallo provides the marketplace, the agreement and the screens you see. Vallo does not hold your funds at any point, and cannot spend, lend or keep them.",
  },
  flow: {
    title: "How a protected payment moves",
    label: "A protected payment, from agreement to release",
    end: "Every step after your transfer is moved by the bank's own confirmation, never by a button you press.",
    steps: [
      { title: "Agree the terms", outcome: "Both of you approve the agreement, and you read the protection terms before paying." },
      { title: "Get the transfer details", outcome: "A designated account, the exact amount and a unique reference, all copyable." },
      { title: "Make the transfer", outcome: "From your own Nigerian bank account, in naira. Saying you've paid only asks us to look again." },
      { title: "The bank confirms", outcome: "Only now does the payment read as protected, with the bank named on screen." },
      { title: "Confirm the handover", outcome: "Check-in for a stay, the keys for a rental. Confirm only when it has really happened." },
      { title: "The money is released", outcome: "Vallo instructs the release; the payment is final when the bank confirms it." },
    ],
  },
  states: {
    title: "What each state means",
    caption: "The states of a protected payment",
    columns: { state: "State", means: "What it means", you: "What you do" },
    rows: {
      awaiting_transfer: { means: "Transfer details issued. No payment has been confirmed.", you: "Transfer the exact amount with the reference." },
      confirming: { means: "We're waiting for the bank to confirm your transfer.", you: "Nothing. You can close Vallo." },
      protected: { means: "The bank confirmed it holds the payment under your agreement.", you: "Confirm the handover when it happens." },
      release_processing: { means: "Vallo asked the bank to release the payment.", you: "Nothing. The receipt follows." },
      released: { means: "The bank confirmed the release to the lister.", you: "Keep the receipt." },
      disputed: { means: "A problem was raised. No release decision has been made.", you: "Add evidence and answer questions." },
      refund_processing: { means: "Vallo asked the bank to refund the payer.", you: "Nothing. We update you here." },
      refunded: { means: "The bank confirmed the refund to the original account.", you: "Check your bank account." },
      requires_review: { means: "Something needs a person, such as an amount that doesn't match.", you: "Wait for us; don't send another transfer." },
    },
  },
  deals: {
    title: "Which deals can use it",
    caption: "How each kind of deal is paid",
    columns: { deal: "Deal", how: "How it is paid", release: "Released when" },
    rent: "Protected bank transfer, from a Nigerian account",
    stays: "Card, from any country",
    sale: "Not paid on Vallo",
    keys: "You confirm you have the keys",
    checkIn: "Not held: card terms apply",
    none: "Not applicable",
    names: { rent: "Renting a home", stays: "Shortlets and hotel rooms", sale: "Buying property or land" },
    approval:
      "A kind of deal can use this only after the partner has approved it in writing. Until then the option is simply not shown.",
  },
  fees: {
    title: "What it costs",
    lead: "The partner charges a protection fee on the money that comes in. The lister pays it, so you transfer exactly the agreed amount.",
    caption: "The protection fee",
    columns: { amount: "Amount transferred", fee: "Fee", who: "Who pays" },
    examplesCaption: "Worked examples",
    exampleColumns: { amount: "Agreed amount", fee: "Protection fee", payer: "You transfer", lister: "Reaches the lister" },
    lister: "The lister",
    aboveBand: "Above that, the fee is agreed in advance with the partner before any payment opens.",
    payout: "When the money is released, the partner also charges a small transfer fee on the payout to the lister:",
    identity: "Identity checks are carried out once per member by a third party and are charged to Vallo, not to you.",
  },
  limits: {
    title: "What protection does not cover",
    items: [
      "Money sent any other way: cash, a transfer to a personal account, or a payment arranged outside Vallo.",
      "A transfer to the wrong account or with the wrong reference may not be matched to your payment.",
      "It does not decide every dispute in your favour. An outcome follows the agreement and the evidence from both sides.",
      "It does not judge the property itself. Inspect before you agree, and read what the listing says.",
      "It is not insurance against bank failure or fraud by a third party.",
    ],
  },
  dispute: {
    title: "If something goes wrong",
    steps: [
      "Tap Something is wrong on the payment, choose what happened and say it in your own words.",
      "Add photos or documents. A statement once sent is never edited; anything new is a new, dated entry.",
      "The release stays paused while the dispute is reviewed, where the partner's arrangement permits.",
      "The lister sees what was reported and can answer with their own evidence.",
      "A person at Vallo reads both sides and records the decision and the reason on the payment.",
      "A refund goes back to the account the money came from, once the bank confirms it.",
    ],
    timing: "We don't promise how long a review or a refund takes. Each step shows on the payment the moment it is confirmed.",
  },
  does: {
    title: "What Vallo does, and does not do",
    caption: "What Vallo does and does not do",
    columns: { what: "What", vallo: "Vallo does it" },
    rows: [
      { what: "Shows you the agreement, the fees and the total before you pay", yes: true },
      { what: "Issues the transfer details from the partner and shows them unchanged", yes: true },
      { what: "Instructs the release or the refund under your agreement", yes: true },
      { what: "Runs the dispute process and records every step", yes: true },
      { what: "Holds, keeps or lends your money", yes: false },
      { what: "Marks a payment as paid because you said you paid", yes: false },
      { what: "Releases money because the lister asked", yes: false },
    ],
  },
  related: {
    paying: "Paying on Vallo",
    refunds: "Refunds and cancellations",
    terms: "Terms of service",
  },
} as const;

export function protectedFeeBand(percent: string, fixed: string, cap: string | null): string {
  return cap ? `${percent} plus ${fixed}, at most ${cap}` : `${percent} plus ${fixed}`;
}
export function protectedFeeRange(from: string | null, to: string): string {
  return from ? `${from} to ${to}` : `Up to ${to}`;
}
export function protectedPayoutFee(small: string, upTo: string, large: string): string {
  return `${small} on a payout up to ${upTo}, and ${large} above that.`;
}
export function protectedPartnerLine(provider: string): string {
  return `Vallo's payment partner for this is ${provider}. The partner never holds members' money itself: the bank named above does, and it moves only on Vallo's instruction under your agreement.`;
}

/* The real read's wording for a deal's dates and refunds. */
export function protectedMoveIn(date: string): string {
  return `Move-in ${date}`;
}
export function protectedStayDates(from: string, to: string): string {
  return `${from} to ${to}`;
}
export const PROTECTED_REFUND_TERMS_DEFAULT = "As set out in your agreement";
export const PROTECTED_PLACE_DEFAULT = "Your home";
export const PROTECTED_PAYER_DEFAULT = "The payer";
export const PROTECTED_PAYEE_DEFAULT = "The lister";
export const PROTECTED_RECEIPT_FIGURE = "Amount";
export const PROTECTED_RECEIPT_TOTAL = "Total transferred";
export const PROTECTED_RECEIPT_KEEP = "More ways to keep this record";
export const PROTECTED_PAGE_TITLE = "Your payment";
