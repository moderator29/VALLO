/** Shared, client-safe shapes for the COO desk. */

export const ESCALATION_SOURCE_DESKS = [
  "listing_approval",
  "moderation",
  "support",
  "agreements",
  "operations",
  "business_development",
  "social_media",
  "other",
] as const;
export type EscalationSourceDesk = (typeof ESCALATION_SOURCE_DESKS)[number];

export const ESCALATION_SOURCE_DESK_LABEL: Record<EscalationSourceDesk, string> = {
  listing_approval: "Listings",
  moderation: "Moderation",
  support: "Support",
  agreements: "Agreements",
  operations: "Operations",
  business_development: "Business development",
  social_media: "Social media",
  other: "Other",
};
