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

/*
 * A SMALL WEBP FOR THE PLAIN IMAGE SPOTS (performance audit, 7 November
 * 2026). A plain `<img>` gets no resizing from the image optimiser, so the
 * listing page's empty reviews state fetched the whole 249px PNG (57.6 KB)
 * to draw it at 88px. A glyph named here also ships as a 176px WebP (88px at
 * twice the density, 7.8 KB), which `glyphSrc` hands out. `glyphMasterSrc`
 * stays the full PNG for `Icon3D`, whose optimiser cuts its own sizes and
 * may draw a glyph at 144px or more.
 */
const SMALL_WEBP: ReadonlySet<GlyphName> = new Set<GlyphName>(["empty-reviews"]);

export function glyphMasterSrc(name: GlyphName): string {
  return `/brand/glyphs/${name}.png`;
}

export function glyphSrc(name: GlyphName): string {
  return SMALL_WEBP.has(name) ? `/brand/glyphs/${name}.webp` : glyphMasterSrc(name);
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

/**
 * The founder's 3D stickers that the glyph set now draws instead (`Icon3D`).
 * A spot that must keep its older sticker (the landing page, the category and
 * property-type tiles that match the home's realistic objects) passes
 * `classic`.
 */
export const ICON3D_GLYPH: Partial<Record<string, GlyphName>> = {
  hotel: "hotel",
  shortlet: "house",
  restaurant: "empty-tables",
  "local-talks": "chat",
  buy: "house",
  rent: "rental-key",
  pay: "empty-payments",
  list: "listing-draft",
  bell: "empty-notifications",
  assistant: "ai-assistant",
  "calendar-booked": "booking-confirmed",
  "calendar-pending": "booking-requested",
  shield: "shield-check",
  search: "search",
  explore: "map-pin",
  verified: "shield-check",
  "id-check": "ai-permissions",
  "card-secure": "ai-payment",
  "home-verified": "listing-approved",
  "home-small": "house",
  villa: "villa",
  city: "apartment",
  apartment: "apartment",
  land: "land",
  "stay-rated": "empty-reviews",
  earnings: "empty-payouts",
  coin: "ai-balance",
  handover: "rental-key",
  keys: "rental-key",
  camera: "empty-photos",
  checklist: "listing-in-review",
  contract: "empty-agreements",
  receipt: "empty-payments",
  boxes: "empty-tenancy",
  bank: "empty-payouts",
  support: "empty-support",
  folder: "listing-draft",
  clock: "ai-schedule",
  "report-flag": "booking-disputed",
  "saved-heart": "saved",
  envelope: "empty-inbox",
  "phone-code": "ai-security",
  "passcode-lock": "ai-security",
  gift: "empty-rewards",
  map: "map-pin",
  power: "listing-live",
};
