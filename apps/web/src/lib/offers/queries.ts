import "server-only";

import { getAdminClient } from "../supabase/service";
import { callAs } from "./server";
import { countsOf, dealRoomOf, eligibilityOf, mandateOf, offerRow, priceBlockOf } from "./map";
import type { DealRoom, Eligibility, MandateLine, OfferRow, OfferState, PriceBlock, Side } from "./types";

/**
 * READS FOR THE OFFER SCREENS. Every read is the signed-in member's own: the
 * session id comes from the server and the database function refuses anyone
 * who is not a party, so a stranger with a Deal Room link gets null and never
 * learns the deal exists. A buyer's identity data is never in an answer: the
 * seller reads an eligibility OUTCOME only.
 */

export type OfferGate = {
  listingId: string;
  listingTitle: string;
  price: PriceBlock;
  eligibility: Eligibility;
  mandate: MandateLine;
  /** Can this viewer SEND an offer right now (form open and every requirement met)? */
  canOffer: boolean;
  /** The form may be shown (it is unsubmittable while requirements are unmet). False when the property takes no offers. */
  canOpenForm: boolean;
  /** One plain sentence saying why not. */
  reason: string | null;
  viewerSide: Side | "none";
  existingOfferId: string | null;
};

export type OfferCounts = Record<OfferState | "all" | "awaiting_you", number>;

export async function getOfferGate(listingId: string): Promise<OfferGate | null> {
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return null;
  // A signed-out visitor still gets the gate (the price and the sign-in sentence); the database takes a null actor.
  const admin = getAdminClient();
  if (!admin) return null;
  const who = await callAs("sale_offer_gate_as", (userId) => ({ p_actor: userId, p_listing: listingId }));
  let answer = who.ok ? who.answer : null;
  if (!answer) {
    const anon = await (admin as unknown as { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown }> }).rpc("sale_offer_gate_as", { p_actor: null, p_listing: listingId });
    answer = (anon.data ?? null) as typeof answer;
  }
  if (!answer || answer.status !== "ok") return null;
  const asking = Number(answer.asking_minor ?? 0);
  return {
    listingId,
    listingTitle: String(answer.title ?? ""),
    price: priceBlockOf(asking),
    eligibility: eligibilityOf(answer.eligibility),
    mandate: mandateOf(answer.mandate),
    canOffer: answer.can_offer === true,
    canOpenForm: answer.can_open_form === true,
    reason: typeof answer.reason === "string" ? answer.reason : null,
    viewerSide: answer.viewer_side === "seller" ? "seller" : "none",
    existingOfferId: typeof answer.existing_offer_id === "string" ? answer.existing_offer_id : null,
  };
}

async function rows(side: "made" | "received"): Promise<OfferRow[]> {
  const result = await callAs("sale_offers_list_as", (userId) => ({ p_actor: userId, p_side: side }));
  if (!result.ok) return [];
  const list = result.answer as unknown;
  return Array.isArray(list) ? (list as Record<string, unknown>[]).map((r) => offerRow(r)) : [];
}

export async function listMyOffers(): Promise<{ rows: OfferRow[]; counts: OfferCounts }> {
  const list = await rows("made");
  return { rows: list, counts: countsOf(list) };
}

export async function listOffersReceived(filter?: { state?: OfferState | "awaiting_you"; listingId?: string }): Promise<{ rows: OfferRow[]; counts: OfferCounts }> {
  const all = await rows("received");
  const counts = countsOf(all);
  const list = all.filter((r) => {
    if (filter?.listingId && r.listingId !== filter.listingId) return false;
    if (!filter?.state) return true;
    if (filter.state === "awaiting_you") return r.state === "open" && r.turn === "seller";
    return r.state === filter.state;
  });
  // Counts stay the whole inbox, so a filter never makes a number lie.
  return { rows: list, counts };
}

export async function getDealRoom(offerId: string): Promise<DealRoom | null> {
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return null;
  const result = await callAs("sale_offer_room_as", (userId) => ({ p_actor: userId, p_agreement: offerId }));
  if (!result.ok || result.answer.status !== "ok") return null;
  return dealRoomOf(result.answer as Record<string, unknown>);
}

export function emptyCounts(): OfferCounts {
  return { all: 0, awaiting_you: 0, open: 0, agreed: 0, declined: 0, withdrawn: 0, expired: 0, cancelled: 0 };
}
