import "server-only";

import { PROTECTED_FUNDS_WORDING_FULL } from "./protected-wording";
import { protectedRailLive } from "./rail-live";

/**
 * WHAT EVERY VALLO AI SAYS ABOUT ESCROW (the founder, 16 November 2026: "our
 * AI is lying... you know we use escrow").
 *
 * The prompts carried "Vallo does not offer escrow or payment held by a bank.
 * Never offer them.", written on 9 November while the escrow rail was paused
 * so that no model would offer what was switched off. The rail has since been
 * built end to end on the licensed escrow partner (lib/money/protected-rail.ts,
 * lib/payments/providers/escrowpay), and the old line made the assistant tell a
 * member that Vallo "doesn't use escrow at all", which is false.
 *
 * The intent of the old line stands: never offer escrow while it is off. So the
 * line is read from the live state on every request (`protectedRailLive`: the
 * provider's key configured for the deployment, the environment stop not set,
 * the founder's switch `payments_escrowpay_on` on), and says the true thing for
 * that state. Switched on, it uses the provider's own agreed funds wording,
 * unaltered, from `protected-wording.ts`; switched off, it names nobody.
 */

export const ESCROW_PROMPT_OFF =
  "Escrow: Vallo is built on escrow. A payment made through Vallo's escrow is held by a licensed bank through Vallo's licensed escrow partner, never by Vallo, and released to the lister once the payer confirms. Escrow payment is not switched on yet, so never tell anybody they can pay by escrow today, and never say Vallo does not use or offer escrow. Where payment is open today, it is by card.";

export const ESCROW_PROMPT_ON = `Escrow: Vallo offers escrow payment through its licensed escrow partner. When you describe where the money is, use these words exactly: "${PROTECTED_FUNDS_WORDING_FULL}" Vallo itself never holds the money. Offer escrow only where the payment screen offers it, and never say a payment is held until the payment screen shows it as held.`;

/** The line for a known state. */
export function escrowPromptLineFor(live: boolean): string {
  return live ? ESCROW_PROMPT_ON : ESCROW_PROMPT_OFF;
}

/** The line for this request, read from the live switch. Any failure reads as off. */
export async function escrowPromptLine(): Promise<string> {
  const live = await protectedRailLive().catch(() => false);
  return escrowPromptLineFor(live);
}
