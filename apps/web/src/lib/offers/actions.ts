"use server";

import { fail, type ActionResult } from "../actions/envelope";
import type { PaymentPreference } from "./types";

/**
 * THE DOORS FOR OFFERS. Lead-owned: signatures are the contract, bodies are
 * filled by the lead (each calls a `sale_offer_*_as` definer function with the
 * session's user id). The screens call these and show `error` in the banner.
 * Every write that a retry could duplicate carries an idempotency key made
 * once per form mount.
 */

const NOT_BUILT = "That is not available yet.";

export type SubmitOfferInput = {
  listingId: string;
  /** Naira as typed. Blank or null means the asking price; the figure is resolved server-side. */
  amountNaira: string | null;
  paymentPreference: PaymentPreference;
  depositNaira?: string | null;
  instalmentMonths?: number | null;
  /** ISO date, proposed. */
  targetClosing?: string | null;
  note?: string | null;
  idempotencyKey: string;
};

export async function submitOffer(_input: SubmitOfferInput): Promise<ActionResult<{ offerId: string; reference: string }>> {
  return fail(NOT_BUILT);
}

/** Seller: accept the version they are looking at (the version is checked server-side). */
export async function acceptOffer(_input: { offerId: string; version: number; idempotencyKey: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

export async function declineOffer(_input: { offerId: string; reason?: string | null }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

/** Either side proposes new terms: a NEW version. Never an edit of the version before. */
export async function counterOffer(_input: {
  offerId: string;
  amountNaira: string;
  paymentPreference?: PaymentPreference;
  targetClosing?: string | null;
  note?: string | null;
  idempotencyKey: string;
}): Promise<ActionResult<{ version: number }>> {
  return fail(NOT_BUILT);
}

export async function requestMoreInformation(_input: { offerId: string; question: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

export async function answerInformationRequest(_input: { offerId: string; answer: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

/** Buyer: accept the seller's counter (confirms that exact version). */
export async function acceptCounter(_input: { offerId: string; version: number; idempotencyKey: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

export async function withdrawOffer(_input: { offerId: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

/** Recorded stage advance after agreement (due diligence, documentation, closing). Never by elapsed time. */
export async function markStage(_input: { offerId: string; stage: "due_diligence" | "documentation" | "closing" | "completed" }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

export async function raiseDealDispute(_input: { offerId: string; reason: string; detail: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

export async function requestDocument(_input: { offerId: string; category: string }): Promise<ActionResult<{ documentId: string }>> {
  return fail(NOT_BUILT);
}

/** Returns a short-lived signed upload URL; the file never touches a public bucket. */
export async function startDocumentUpload(_input: { offerId: string; documentId: string; fileName: string; contentType: string; sizeBytes: number }): Promise<ActionResult<{ uploadUrl: string; path: string }>> {
  return fail(NOT_BUILT);
}

export async function finishDocumentUpload(_input: { offerId: string; documentId: string; path: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

/** A signed, time-limited read URL. Every call is logged. */
export async function openDocument(_input: { offerId: string; documentId: string }): Promise<ActionResult<{ url: string; expiresInSeconds: number }>> {
  return fail(NOT_BUILT);
}

export async function reviewDocument(_input: { offerId: string; documentId: string; decision: "under_review" | "approved" | "rejected" | "more_information"; note?: string | null }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}

/** Admin (step-up MFA): intervention that never rewrites agreed terms. */
export async function adminIntervene(_input: { offerId: string; action: "cancel" | "note" | "flag_dispute" | "resolve_dispute"; note: string }): Promise<ActionResult<null>> {
  return fail(NOT_BUILT);
}
