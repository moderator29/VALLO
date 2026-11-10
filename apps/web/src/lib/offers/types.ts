/**
 * THE OFFER CONTRACT (10 November 2026). One typed module that maps the
 * agreement tables to the words a buyer and a seller use. A sale offer is a
 * `deal_agreements` row with kind = 'sale': `renter_id` is the BUYER,
 * `owner_id` is the SELLER (the lister's user, who may be an agent holding a
 * sale mandate). Nothing outside `lib/offers` says renter or owner for a sale.
 *
 * `approved` on a sale means TERMS AGREED. It is never "sold". The interface
 * says "Terms agreed" and shows what is still to happen. `paid` is
 * unreachable for a sale (database check) and has no word here.
 */

export type Side = "buyer" | "seller";

/** The status the database holds for a sale, as an offer state a person reads. */
export type OfferState =
  | "open" // awaiting_parties, nobody has agreed a version yet
  | "agreed" // approved: both sides confirmed the same version
  | "declined" // rejected
  | "withdrawn"
  | "expired"
  | "cancelled";

export const OFFER_STATES: readonly OfferState[] = ["open", "agreed", "declined", "withdrawn", "expired", "cancelled"];

/** How the buyer proposes to pay. A stated intention, never verified funds. */
export type PaymentPreference = "cash" | "mortgage" | "instalment";

/** Recorded stages. They advance on recorded events, never on time. */
export type DealStage =
  | "offer" // Offer submitted
  | "negotiating" // Seller reviewing / Negotiation
  | "agreed" // Offer accepted (terms agreed)
  | "due_diligence" // Inspection and due diligence
  | "documentation" // Documentation
  | "closing" // Closing
  | "completed"; // Completed (recorded by both sides, never by Vallo's money)

export const DEAL_STAGES: readonly DealStage[] = ["offer", "negotiating", "agreed", "due_diligence", "documentation", "closing", "completed"];

export type RequirementKey = "government_id" | "minimum_age" | "phone" | "email";
export type RequirementState = "met" | "required" | "in_progress" | "needs_review";

export type Requirement = {
  key: RequirementKey;
  label: string;
  state: RequirementState;
  /** The control that fixes it: a route in the existing verification flow, or null when nothing the buyer can do. */
  fixHref: string | null;
};

export type Eligibility = {
  eligible: boolean;
  requirements: Requirement[];
};

export type Money = { minor: number; currency: "NGN" };

/** A cost line of the listing, shown only where real configured data exists. */
export type CostLine = {
  label: string;
  amountMinor: number;
  /** How sure we are. Never invented: a line exists only if the listing carries it. */
  basis: "confirmed" | "estimated" | "optional" | "paid_to_third_party";
};

export type PriceBlock = {
  askingMinor: number;
  costs: CostLine[];
  /** True only when every component of the total is real data. */
  totalIsComplete: boolean;
  totalMinor: number | null;
};

export type OfferTerms = {
  paymentPreference: PaymentPreference;
  /** Mortgage or instalment: what the buyer proposes to the seller. Vallo is not a lender. */
  deposit_minor?: number | null;
  instalment_months?: number | null;
  instalment_minor?: number | null;
  targetClosing?: string | null; // ISO date, labelled "proposed"
  note?: string | null;
  proposedBy: Side;
  /** The offer figure was left blank and resolved to the asking price. */
  atAskingPrice: boolean;
};

export type OfferVersion = {
  version: number;
  amountMinor: number;
  terms: OfferTerms;
  proposedBy: Side;
  at: string;
  /** What changed from the version before, in words and figures. Empty for version 1. */
  changes: string[];
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
};

export type OfferEvent = {
  id: string;
  at: string;
  actor: Side | "vallo" | "system";
  actorName: string | null;
  action: string;
  note: string | null;
  version: number;
};

export type DocumentCategory =
  | "certificate_of_occupancy"
  | "deed_of_assignment"
  | "survey_plan"
  | "building_approval"
  | "agent_authorisation"
  | "governors_consent"
  | "agreement_draft"
  | "inspection_report"
  | "other";

/** Uploaded, reviewed and verified are three different things. Never collapse them. */
export type DocumentState = "requested" | "uploaded" | "under_review" | "approved" | "rejected" | "more_information";

export type DealDocument = {
  id: string;
  category: DocumentCategory;
  state: DocumentState;
  uploadedByName: string | null;
  uploadedAt: string | null;
  version: number;
  reviewedByName: string | null;
  reviewedAt: string | null;
  note: string | null;
};

export type MandateLine = {
  /** "This agent holds a signed sale mandate from the owner." Null when there is none. */
  held: boolean;
  reviewedOn: string | null;
  expiresOn: string | null;
};

/** One offer as a list row (buyer's My offers, seller's Offers received). */
export type OfferRow = {
  id: string;
  reference: string;
  listingId: string;
  listingTitle: string;
  listingThumb: string | null;
  askingMinor: number;
  amountMinor: number;
  differenceMinor: number;
  differencePct: number;
  state: OfferState;
  stage: DealStage;
  /** Whose move it is. "you" is resolved against the viewer. */
  turn: Side | null;
  viewerSide: Side;
  counterpartyName: string;
  paymentPreference: PaymentPreference;
  targetClosing: string | null;
  submittedAt: string;
  lastActivityAt: string;
  expiresAt: string | null;
  unread: boolean;
  version: number;
};

export type DealRoom = {
  offer: OfferRow;
  viewerSide: Side;
  versions: OfferVersion[];
  events: OfferEvent[];
  documents: DealDocument[];
  mandate: MandateLine;
  conversationId: string | null;
  inspectionId: string | null;
  /** Buyer's eligibility OUTCOME only. Never an id number, image or date of birth. */
  buyerEligible: boolean;
  /** The next action as one obvious button, or null when nothing is waiting on the viewer. */
  next: NextAction | null;
};

export type NextAction = {
  kind: "respond" | "wait" | "accept_counter" | "schedule_inspection" | "upload_document" | "review_document" | "mark_closing" | "none";
  label: string;
  /** What is true now, in plain words. Never a promise Vallo has not made. */
  detail: string;
};

/** Seller's four answers. A counteroffer is a NEW version, never an edit of the buyer's. */
export type SellerResponse = "accept" | "decline" | "counter" | "request_info";

/** The statuses the doors return, mapped to a sentence in `words.ts`. */
export type DoorStatus =
  | "ok"
  | "not_found"
  | "not_signed_in"
  | "not_eligible"
  | "listing_unavailable"
  | "offers_off"
  | "own_listing"
  | "no_mandate"
  | "bad_amount"
  | "amount_too_large"
  | "price_changed"
  | "already_open"
  | "rate_limited"
  | "locked"
  | "expired"
  | "superseded"
  | "wrong_turn"
  | "not_a_party"
  | "version_changed"
  | "idempotent_replay";
