import type { OfferGate } from "@/lib/offers/queries";
import { dealRoomHref, makeOfferHref, offersTabHref } from "@/lib/offers/routes";

/**
 * WHAT THE LISTING'S PRIMARY ACTION SAYS FOR A PROPERTY FOR SALE. Pure, so the
 * rule is tested without a page. The server already decided who may offer; this
 * only chooses the one button:
 *
 *   the seller (or the listing's own agent)   View offers
 *   somebody with a live offer                View your offer
 *   somebody whose form may open (even with a
 *   requirement still to finish)              Make an offer
 *   a closed listing, no mandate, offers off  nothing (the page keeps the visit)
 *   a signed-out reader                       Make an offer (sign-in, then back)
 *
 * It is never used for a rental.
 */
export type OfferAction = { label: string; href: string };

export function offerActionFor(args: { listingId: string; signedIn: boolean; gate: OfferGate | null }): OfferAction | null {
  const { listingId, signedIn, gate } = args;
  if (!gate) return signedIn ? null : { label: "Make an offer", href: makeOfferHref(listingId) };
  if (gate.viewerSide === "seller") return { label: "View offers", href: offersTabHref("received") };
  if (gate.existingOfferId) return { label: "View your offer", href: dealRoomHref(gate.existingOfferId) };
  if (gate.canOpenForm) return { label: "Make an offer", href: makeOfferHref(listingId) };
  return null;
}
