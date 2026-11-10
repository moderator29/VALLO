import type { DealDocument, DealStage, OfferEvent, OfferState, OfferVersion, MandateLine, PaymentPreference } from "@/lib/offers/types";

/**
 * THE OFFERS AND DEALS DESK: THE SHAPES IT READS.
 *
 * Written against the contract in `lib/offers/types.ts`; the reads in
 * `reads.ts` are filled from SQL by the lead. Staff see the deal, never a
 * buyer's identity data: only the eligibility outcome. Private messages are
 * not part of this model at all (they are reached under the Trust and Safety
 * permissions, justified and audited, from the cases desk).
 */

export type AdminOfferRow = {
  id: string;
  reference: string;
  listingId: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  /** The agent who lists it for the seller, when the lister is not the owner. */
  agentName: string | null;
  askingMinor: number;
  amountMinor: number;
  state: OfferState;
  stage: DealStage;
  version: number;
  paymentPreference: PaymentPreference;
  submittedAt: string;
  lastActivityAt: string;
  expiresAt: string | null;
  /** A concern has been raised and is open in the cases desk. */
  disputed: boolean;
  caseId: string | null;
  /** A live signed sale mandate stands behind the lister. */
  mandateHeld: boolean;
};

export type MetricKey =
  | "submitted"
  | "new"
  | "awaiting_seller"
  | "negotiating"
  | "agreed"
  | "withdrawn"
  | "expired"
  | "completed"
  | "disputed";

export type OffersOverview = {
  windowDays: number;
  counts: Record<MetricKey, number>;
  /** Hours from arrival to the seller's first action, over offers that have had one. Null with none. */
  medianResponseHours: number | null;
  /** Terms agreed over offers that reached an answer (agreed or declined). Null with none. */
  acceptance: { agreed: number; answered: number } | null;
};

export type AdminDeal = {
  row: AdminOfferRow;
  versions: OfferVersion[];
  events: OfferEvent[];
  documents: DealDocument[];
  mandate: MandateLine;
  /** The buyer's eligibility outcome only. */
  buyerEligible: boolean;
};

/** Each metric with its stated definition. A number with no definition is not shown. */
export const METRICS: { key: MetricKey; label: string; definition: string }[] = [
  { key: "submitted", label: "Submitted", definition: "Offers sent in the last {days} days." },
  { key: "new", label: "New", definition: "Open offers the seller has not acted on or opened since they arrived." },
  { key: "awaiting_seller", label: "Awaiting seller", definition: "Open offers where the next move is the seller's." },
  { key: "negotiating", label: "Negotiating", definition: "Open offers with more than one version." },
  { key: "agreed", label: "Terms agreed", definition: "Offers where both sides confirmed the same version. Not sales." },
  { key: "withdrawn", label: "Withdrawn", definition: "Offers the buyer withdrew." },
  { key: "expired", label: "Expired", definition: "Offers that passed their stated expiry with no answer." },
  { key: "completed", label: "Completed", definition: "Deals where both sides recorded completion." },
  { key: "disputed", label: "Disputed", definition: "Deals with a concern open in the cases desk." },
];

export const RESPONSE_DEFINITION = "Median hours from an offer arriving to the seller's first action, over offers that have had one.";
export const ACCEPTANCE_DEFINITION = "Terms agreed divided by offers that reached an answer (agreed or declined) in the window. Open, withdrawn and expired offers are not counted.";
export const NO_REVENUE_NOTE = "Vallo takes no money for a purchase. The value of agreed offers is not Vallo revenue and is not shown as a total.";
