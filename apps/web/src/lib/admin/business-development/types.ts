/**
 * Shared shapes for the Business Development desk's partnership pipeline
 * (`/admin/business-development`). No server-only imports here: this file
 * is safe for a client component to import too.
 */

export const BD_CATEGORIES = ["landlord", "agent", "hotel", "shortlet_host", "restaurant", "other"] as const;
export type BdCategory = (typeof BD_CATEGORIES)[number];

export const BD_CATEGORY_LABEL: Record<BdCategory, string> = {
  landlord: "Landlord",
  agent: "Estate agent",
  hotel: "Hotel",
  shortlet_host: "Shortlet operator",
  restaurant: "Restaurant",
  other: "Other business",
};

/** Pipeline stages. "onboarded" is the terminal positive stage and is NOT
 * the same fact as a submitted or approved listing: the two are reported
 * separately (founder's ruling, 10 November 2026). */
export const BD_STAGES = [
  "new",
  "contacted",
  "interested",
  "meeting_scheduled",
  "negotiation",
  "proposal_sent",
  "agreement_pending",
  "onboarded",
  "rejected",
] as const;
export type BdStage = (typeof BD_STAGES)[number];

export const BD_STAGE_LABEL: Record<BdStage, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  meeting_scheduled: "Meeting scheduled",
  negotiation: "Negotiation",
  proposal_sent: "Proposal sent",
  agreement_pending: "Agreement pending",
  onboarded: "Onboarded",
  rejected: "Rejected",
};

export const BD_ACTIVITY_KINDS = ["contact", "follow_up", "note", "stage_change"] as const;
export type BdActivityKind = (typeof BD_ACTIVITY_KINDS)[number];

export type BdProspect = {
  id: string;
  contactName: string;
  businessName: string;
  category: BdCategory;
  email: string | null;
  phone: string | null;
  location: string | null;
  stage: BdStage;
  notes: string | null;
  assignedTo: string | null;
  createdBy: string;
  listingId: string | null;
  onboardedAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BdActivity = {
  id: string;
  prospectId: string;
  kind: BdActivityKind;
  body: string;
  outcome: string | null;
  actorId: string;
  createdAt: string;
};

/** The read result every table-backed function here answers with: "ok" once
 * the pending migration has landed, "unavailable" (a real read error),
 * or "not_set_up" while `bd_prospects` does not exist yet. */
export type BdRead<T> =
  | { state: "ok"; data: T }
  | { state: "unavailable" }
  | { state: "not_set_up" };
