/**
 * IS PAYMENT FOR A RENTAL OPEN ON VALLO? (launch position, 9 November 2026).
 *
 * No. A rental can be viewed, inspected and agreed on Vallo, and stops at the
 * payment step: the protected rail it was built for is switched off, waiting
 * on the signed agreement, and a card payment for rent was never offered in
 * its place. Until this switch existed the payment step fell back to card
 * whenever the protected rail was off (`card_escrow_paused`), so rent was
 * payable by card in code even though every sentence said it was not.
 *
 * Every rent money path reads this one value: the payer's choice card on the
 * agreement, the rent payment screen, and the two server actions that open or
 * charge a rent payment (`lib/rent/actions.ts`). The server actions refuse on
 * their own, so a stale page or a hand-built request opens nothing. Stays,
 * hotel rooms and restaurants are not rentals and are not touched.
 *
 * Opening it is a founder decision, changed here in code with its date, never
 * a flag a desk can flip by accident. Pure and client-safe.
 */
export const RENT_PAYMENT_OPEN: boolean = false;
