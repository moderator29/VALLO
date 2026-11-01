/**
 * THE FOUNDER'S GLYPH SET (1 November 2026).
 *
 * Four sheets, cut into one transparent 256px file each under
 * `public/brand/glyphs/`: deep royal blue clay with one warm orange accent,
 * no plate, no tile, no ring behind any of them, so each stands on its own in
 * the light theme and the dark one. A spot draws one bare, at the size the
 * spot is (about 20 to 28px in a row or a chip, 64 to 96px in an empty state),
 * never inside a container.
 */
export const GLYPHS = [
  // places and things
  "house", "apartment", "hotel", "map-pin", "rental-key", "bed", "land", "shield-check",
  "villa", "wallet", "handshake", "calendar", "search", "chat", "shop", "saved",
  // empty states
  "empty-inbox", "empty-support", "empty-notifications", "empty-tenancy", "empty-search", "empty-saved",
  "empty-payments", "empty-refunds", "empty-agreements", "empty-reviews", "empty-rewards", "empty-payouts",
  "empty-calendar", "empty-rooms", "empty-tables", "empty-photos",
  // booking states
  "booking-requested", "booking-confirmed", "booking-arrived", "booking-completed",
  "booking-cancelled", "booking-refunded", "booking-disputed", "booking-held",
  // listing states
  "listing-draft", "listing-in-review", "listing-approved", "listing-live",
  "listing-needs-changes", "listing-rejected", "listing-paused", "listing-let",
  // the assistant
  "ai-assistant", "ai-account", "ai-privacy", "ai-payment", "ai-security", "ai-permissions",
  "ai-protection", "ai-compare", "ai-photos", "ai-schedule", "ai-balance", "ai-reminder",
  "ai-saved", "ai-share", "ai-human-help", "ai-toggle",
] as const;

export type GlyphName = (typeof GLYPHS)[number];

export function glyphSrc(name: GlyphName): string {
  return `/brand/glyphs/${name}.png`;
}

/** A listing's status as its glyph. Unknown statuses draw nothing. */
export const LISTING_STATUS_GLYPH: Partial<Record<string, GlyphName>> = {
  DRAFT: "listing-draft",
  SUBMITTED: "listing-in-review",
  UNDER_REVIEW: "listing-in-review",
  MORE_INFO_REQUIRED: "listing-needs-changes",
  APPROVED: "listing-approved",
  PUBLISHED: "listing-live",
  REJECTED: "listing-rejected",
  SUSPENDED: "listing-paused",
  ARCHIVED: "listing-paused",
  RENTED: "listing-let",
  SOLD: "listing-let",
};
