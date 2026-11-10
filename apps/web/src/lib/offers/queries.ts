import "server-only";

import type { DealRoom, Eligibility, MandateLine, OfferRow, OfferState, PriceBlock, Side } from "./types";

/**
 * READS FOR THE OFFER SCREENS. Lead-owned: the bodies are filled by the lead
 * from the SQL; the signatures below are the contract the screens build on.
 * Every read is the signed-in member's own (the session id comes from the
 * server, never the URL) and a stranger gets null / [] and never learns the
 * thing exists.
 */

export type OfferGate = {
  listingId: string;
  listingTitle: string;
  price: PriceBlock;
  eligibility: Eligibility;
  mandate: MandateLine;
  /** Can this viewer open the offer form right now? If not, `reason` says why in one plain sentence. */
  canOffer: boolean;
  reason: string | null;
  viewerSide: Side | "none";
  /** The viewer already has a live offer on this listing: the action area says "View your offer". */
  existingOfferId: string | null;
};

export type OfferCounts = Record<OfferState | "all" | "awaiting_you", number>;

export async function getOfferGate(_listingId: string): Promise<OfferGate | null> {
  return null;
}

export async function listMyOffers(): Promise<{ rows: OfferRow[]; counts: OfferCounts }> {
  return { rows: [], counts: emptyCounts() };
}

export async function listOffersReceived(_filter?: { state?: OfferState | "awaiting_you"; listingId?: string }): Promise<{ rows: OfferRow[]; counts: OfferCounts }> {
  return { rows: [], counts: emptyCounts() };
}

export async function getDealRoom(_offerId: string): Promise<DealRoom | null> {
  return null;
}

export function emptyCounts(): OfferCounts {
  return { all: 0, awaiting_you: 0, open: 0, agreed: 0, declined: 0, withdrawn: 0, expired: 0, cancelled: 0 };
}
