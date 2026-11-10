/**
 * THE PROTECTED PAYMENT'S WORDS, AND THE ONLY PLACE THEY LIVE.
 *
 * The provider (EscrowPay) and its custodian bank may be named to a member
 * only with wording the provider has agreed. These are those words, copied
 * unaltered from the provider's own document "How EscrowPay appears on your
 * platform" (docs/handoff/PROTECTED_PAYMENTS_SPECS.md, appendix, "The funds
 * wording"). Never paraphrase, soften, translate, split or reorder them, and
 * never retype them on a screen: import them from here.
 * `protected-wording.test.ts` fails the build on any file that names the
 * provider or the custodian without coming through this module, and on any
 * near-miss of either sentence.
 *
 * Where each one goes (PROTECTED_PAYMENTS_BUILD.md section 3):
 *  - SHORT at the payment step, beside the pay button.
 *  - FULL on the confirmation and on every protected payment receipt.
 *
 * Nothing here is shown while the rail is off (`payments_escrowpay_on`, the
 * category switchboard in `protected-categories.ts`, the kill switch). The
 * rail has never held a naira; until the signed agreement and the founder's
 * word, these strings are built and tested, not displayed.
 */

/** The provider, as its agreement names it. */
export const PROTECTED_PROVIDER_NAME = "EscrowPay";

/** The custodian bank, in the provider's agreed full form. */
export const PROTECTED_CUSTODIAN_NAME = "Rubies Microfinance Bank";

/** The provider's FULL funds wording: confirmation screen and receipt. */
export const PROTECTED_FUNDS_WORDING_FULL =
  "Your payment is held by Rubies Microfinance Bank, licensed by the Central Bank of Nigeria, and released to the seller once you confirm delivery.";

/** The provider's SHORT funds wording: the payment step. */
export const PROTECTED_FUNDS_WORDING_SHORT =
  "Held by Rubies MFB, a CBN licensed bank, until you confirm delivery.";

/**
 * Vallo's own promise line, separate from the provider's wording
 * (PROTECTED_PAYMENTS_BUILD.md section 2). It never replaces the provider's
 * sentence; it may sit beside it.
 */
export const VALLO_NEVER_HOLDS_PROMISE =
  "Your payment is held by a licensed bank until you confirm check-in. Vallo never holds your money.";

/**
 * The line every member reads before paying (appendix, "True under every
 * option": members are told in the flow, not only in the Terms, that the
 * identity check and the holding of funds are done by third parties). It
 * names nobody on purpose: the custodian may be named only in the provider's
 * agreed words, so the funds wording beside it does the naming.
 */
export const THIRD_PARTIES_LINE =
  "Your identity check and the holding of your payment are carried out by third parties, not by Vallo.";

/**
 * The partner mark beside the pay button (Option 2, "Secured by" mark). The
 * exact text and the mark asset come from the provider. TODO(provider): replace
 * with the supplied wording and asset before go-live; until then the mark is
 * not drawn (`partnerMarkReady` is false).
 */
export const PARTNER_MARK_TEXT = "Secured by EscrowPay";
export const partnerMarkReady = false;
