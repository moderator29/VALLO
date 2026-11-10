import type { ChipState } from "@/components/ui/StatusChip";
import type {
  DealStage,
  DocumentCategory,
  DocumentState,
  DoorStatus,
  OfferRow,
  OfferState,
  PaymentPreference,
  RequirementState,
  Side,
} from "./types";

/**
 * EVERY WORD THE OFFER SCREENS SAY ABOUT A STATE (section 7 of
 * OFFERS_AND_DEAL_ROOM.md). One module so a sentence is true everywhere or
 * nowhere. The rules these words keep:
 *
 *   - an accepted offer is TERMS AGREED, never a sale;
 *   - Vallo takes no money for a purchase, at any stage;
 *   - uploaded, under review and approved are different, and nothing here says
 *     "verified" about a document;
 *   - Cash is an intention, never verified funds;
 *   - Vallo is not a lender;
 *   - the title is not verified by Vallo;
 *   - a deadline is stated only when the data has one.
 */

/* ------------------------------------------------------- standing sentences */

export const NOTHING_CHARGED = "Nothing is charged. The seller reviews it and responds.";
export const NO_MONEY_TAKEN = "Vallo takes no money for a purchase at any stage: no deposit, no commitment fee and no payment to secure a property.";
export const AGREED_IS_NOT_SALE =
  "Terms agreed is not a sale. The terms are agreed and recorded. The inspection, the documents, the solicitors and the transfer still have to happen.";
export const TITLE_NOT_VERIFIED = "Vallo does not verify title. Check the documents with your own solicitor before you commit.";
export const NOT_A_LENDER = "Vallo is not a lender. A mortgage or instalment plan is only what you propose to the seller.";
export const CASH_INTENTION = "Cash states how you intend to pay. Vallo has not checked any funds.";
export const OTHER_COSTS_NOT_ITEMISED = "Other closing costs will apply and are not yet itemised for this property.";
export const DOCUMENT_NOT_VERIFIED = "Uploaded is not checked. A document is only approved once someone has reviewed it, and Vallo does not verify title.";
export const NOT_SIGNED_MANDATE = "No signed sale mandate is on record for this agent.";

/* ------------------------------------------------------------------ states */

export type StateWord = { chip: ChipState; word: string };

/**
 * The chip for an offer as the viewer sees it: a word, with colour in support.
 * "Awaiting you" only when the data says the move is the viewer's.
 */
export function offerChip(row: Pick<OfferRow, "state" | "turn" | "viewerSide">): StateWord {
  switch (row.state) {
    case "agreed":
      return { chip: "success", word: "Terms agreed" };
    case "declined":
      return { chip: "failed", word: "Declined" };
    case "withdrawn":
      return { chip: "neutral", word: "Withdrawn" };
    case "expired":
      return { chip: "neutral", word: "Expired" };
    case "cancelled":
      return { chip: "neutral", word: "Cancelled" };
    case "open":
      if (row.turn === row.viewerSide) return { chip: "pending", word: "Awaiting you" };
      if (row.turn) return { chip: "protected", word: row.viewerSide === "buyer" ? "With the seller" : "With the buyer" };
      return { chip: "protected", word: "Open" };
  }
}

export const STATE_FILTER_LABEL: Record<OfferState | "all" | "awaiting_you", string> = {
  all: "All",
  awaiting_you: "Awaiting you",
  open: "Open",
  agreed: "Terms agreed",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** One plain sentence on whose turn it is. */
export function turnSentence(row: Pick<OfferRow, "state" | "turn" | "viewerSide">): string {
  if (row.state !== "open") {
    return row.state === "agreed" ? "Nothing is waiting on the offer itself. The next steps are below." : "This offer is closed. Nothing is waiting.";
  }
  if (!row.turn) return "Nobody has been asked to act.";
  if (row.turn === row.viewerSide) return "It is your move.";
  return row.viewerSide === "buyer" ? "Waiting for the seller." : "Waiting for the buyer.";
}

export function sideWord(side: Side, viewer: Side): string {
  return side === viewer ? "You" : side === "buyer" ? "The buyer" : "The seller";
}

export function holderLine(row: Pick<OfferRow, "state" | "turn" | "viewerSide" | "counterpartyName">): string {
  if (row.state !== "open") return "Nobody. This offer is closed.";
  if (!row.turn) return "Nobody yet.";
  return row.turn === row.viewerSide ? "You" : row.counterpartyName;
}

/* ------------------------------------------------------------------ stages */

export const STAGE_LABEL: Record<DealStage, string> = {
  offer: "Offer submitted",
  negotiating: "Negotiation",
  agreed: "Offer accepted",
  due_diligence: "Inspection and due diligence",
  documentation: "Documentation",
  closing: "Closing",
  completed: "Completed",
};

export const STAGE_DETAIL: Record<DealStage, string> = {
  offer: "The offer has been sent. The seller reviews it.",
  negotiating: "Both sides are agreeing the terms. Each new proposal is kept as its own version.",
  agreed: "The terms are agreed and recorded. This is not yet a sale.",
  due_diligence: "Inspect the property and check what you are buying.",
  documentation: "Collect and review the documents, with your solicitors.",
  closing: "The parties complete the transfer between themselves.",
  completed: "Both sides have recorded completion. Vallo took no money and does not hold the title.",
};

/** The end states that are not a stage of progress. */
export const END_STATE_LABEL: Record<Exclude<OfferState, "open" | "agreed">, string> = {
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
  cancelled: "Cancelled",
};

/* ----------------------------------------------------------------- payment */

export const PAYMENT_LABEL: Record<PaymentPreference, string> = {
  cash: "Cash",
  mortgage: "Mortgage",
  instalment: "Instalment",
};

export const PAYMENT_DETAIL: Record<PaymentPreference, string> = {
  cash: "You intend to pay in full without borrowing.",
  mortgage: "You intend to fund part of the price with a mortgage from your own lender.",
  instalment: "You propose to pay the seller in stages.",
};

/** What each choice means in the summary, with the honest caveat. */
export const PAYMENT_CAVEAT: Record<PaymentPreference, string> = {
  cash: CASH_INTENTION,
  mortgage: "Your lender and the terms are your own to arrange. Vallo does not lend or arrange mortgages.",
  instalment: NOT_A_LENDER,
};

/* ------------------------------------------------------------- requirements */

export const REQUIREMENT_STATE_WORD: Record<RequirementState, string> = {
  met: "Done",
  required: "Required",
  in_progress: "In progress",
  needs_review: "Needs review",
};

export function requirementChip(state: RequirementState): ChipState {
  return state === "met" ? "success" : state === "required" ? "failed" : "pending";
}

export const REQUIREMENT_FIX_LABEL: Record<RequirementState, string | null> = {
  met: null,
  required: "Fix",
  in_progress: "Continue",
  needs_review: null,
};

/* --------------------------------------------------------------- documents */

export const DOCUMENT_STATE_WORD: Record<DocumentState, string> = {
  requested: "Requested",
  uploaded: "Uploaded",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  more_information: "More information needed",
};

export const DOCUMENT_STATE_DETAIL: Record<DocumentState, string> = {
  requested: "Nobody has uploaded this yet.",
  uploaded: "Uploaded. Nobody has checked it yet.",
  under_review: "Someone is looking at it. It is not yet approved.",
  approved: "A reviewer approved this document. That is not a check of title.",
  rejected: "A reviewer did not accept this document.",
  more_information: "A reviewer needs more from the uploader.",
};

/** Distinct shapes for six states: colour never carries the meaning alone. */
export function documentChip(state: DocumentState): ChipState {
  switch (state) {
    case "approved":
      return "success";
    case "rejected":
      return "failed";
    case "under_review":
      return "protected";
    case "more_information":
      return "disputed";
    case "uploaded":
      return "pending";
    case "requested":
      return "neutral";
  }
}

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  certificate_of_occupancy: "Certificate of Occupancy",
  deed_of_assignment: "Deed of Assignment",
  survey_plan: "Survey plan",
  building_approval: "Building approval",
  agent_authorisation: "Agent's authority to sell",
  governors_consent: "Governor's consent",
  agreement_draft: "Agreement draft",
  inspection_report: "Inspection report",
  other: "Other document",
};

export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  "certificate_of_occupancy",
  "deed_of_assignment",
  "survey_plan",
  "building_approval",
  "agent_authorisation",
  "governors_consent",
  "agreement_draft",
  "inspection_report",
  "other",
];

/* ------------------------------------------------------------------ events */

const EVENT_WORD: Record<string, string> = {
  submitted: "Offer submitted",
  opened: "Offer opened",
  countered: "Counteroffer proposed",
  confirmed: "Terms confirmed",
  accepted: "Offer accepted",
  approved: "Terms agreed",
  declined: "Offer declined",
  rejected: "Offer declined",
  withdrawn: "Offer withdrawn",
  expired: "Offer expired",
  cancelled: "Offer cancelled",
  info_requested: "More information requested",
  info_provided: "More information provided",
  stage: "Stage recorded",
  disputed: "Dispute raised",
  document: "Document activity",
  intervened: "Vallo staff note",
};

export function eventWord(action: string): string {
  const known = EVENT_WORD[action];
  if (known) return known;
  const spaced = action.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Update";
}

/* ------------------------------------------------------------------- doors */

const DOOR_SENTENCE: Record<DoorStatus, string> = {
  ok: "Done.",
  not_found: "We could not find that offer.",
  not_signed_in: "Sign in to continue.",
  not_eligible: "You need to finish the requirements before you can send an offer.",
  listing_unavailable: "This property is not open to offers right now.",
  offers_off: "Offers are not turned on for this property.",
  own_listing: "You cannot make an offer on your own listing.",
  no_mandate: "This agent has no signed sale mandate on record, so offers are closed.",
  bad_amount: "Enter an amount above zero, or leave it blank to offer the asking price.",
  amount_too_large: "That amount is too large. Check the figure.",
  price_changed: "The asking price changed. Check the new price and send again.",
  already_open: "You already have an open offer on this property.",
  rate_limited: "You have sent several offers quickly. Please wait a little and try again.",
  locked: "Someone else is updating this offer. Try again in a moment.",
  expired: "This offer has expired.",
  superseded: "Newer terms have replaced the ones you were looking at. Read them and try again.",
  wrong_turn: "It is not your move on this offer.",
  not_a_party: "You are not part of this offer.",
  version_changed: "The terms changed while you were reading. Check the latest and try again.",
  idempotent_replay: "That was already sent.",
};

export function doorSentence(status: DoorStatus): string {
  return DOOR_SENTENCE[status];
}

/* --------------------------------------------------------------- the lines */

export function mandateLine(held: boolean, reviewedOn: string | null, expiresOn: string | null, fmt: (iso: string) => string): string | null {
  if (!held) return null;
  const reviewed = reviewedOn ? `, reviewed on ${fmt(reviewedOn)}` : "";
  const expiring = expiresOn ? `, expiring ${fmt(expiresOn)}` : "";
  return `This agent holds a signed sale mandate from the owner${reviewed}${expiring}.`;
}

export const WHAT_HAPPENS_NEXT_BUYER = [
  "The seller reads your offer. They can accept it, decline it, counter it or ask you a question.",
  "Each change is kept as its own version, so nothing is overwritten.",
  "If you agree terms, the Deal Room carries on with the inspection and the documents.",
];

export function offerBasis(atAsking: boolean): string {
  return atAsking ? "Your offer is the asking price." : "Your offer differs from the asking price.";
}
