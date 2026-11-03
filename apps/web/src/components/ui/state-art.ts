import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import type { Icon3DName } from "./icon-3d";
import type { GlyphName } from "@/design-system/icons/glyphs";

/**
 * THE FOUNDER'S 3D OBJECTS IN EMPTY STATES (30 September): "use them in every
 * area used". A state that names an object (`icon`) draws its 3D twin when
 * the founder's sheets have one; everything else keeps the line glyph on the
 * flat plate. A call site can still pick an object (`art`) or opt out
 * (`art={false}`).
 *
 * Only clear matches: an error or a chat has no 3D twin and stays a glyph.
 * (The receipt's coin carries a "$", so `receipt-check` keeps the wallet.)
 */
export const STATE_ART: Partial<Record<BrandIconName, Icon3DName>> = {
  "bell-badge": "bell",
  chat: "local-talks",
  "chat-duo": "local-talks",
  "chat-ring": "local-talks",
  "search-ring": "search",
  "listing-search": "search",
  "home-search": "search",
  "search-home": "search",
  "calendar-check": "calendar-booked",
  "calendar-home": "calendar-booked",
  "calendar-clock": "calendar-pending",
  "calendar-grid": "calendar-pending",
  "shield-check": "shield",
  "user-verified": "id-check",
  "globe-pin": "explore",
  "card-lock": "card-secure",
  "keys-home": "keys",
  "home-ring": "home-small",
  "heart-home": "saved-heart",
  "ledger-book": "earnings",
  reviews: "stay-rated",
  "hotel-bed": "stay-rated",
  hotel: "hotel",
  "concierge-bell": "restaurant",
  "bank-column": "earnings",
  "receipt-check": "pay",
  hourglass: "clock",
  // The wishlist sheet (30 September).
  camera: "camera",
  "contract-sign": "contract",
  "report-stats": "analytics",
  "support-chat": "support",
  "doc-home": "folder",
  "doc-lock": "folder",
};

export function stateArtFor(icon: BrandIconName | undefined, art?: Icon3DName | false): Icon3DName | undefined {
  if (art === false) return undefined;
  if (art) return art;
  return icon ? STATE_ART[icon] : undefined;
}

/**
 * THE FOUNDER'S GLYPH FOR EACH STATE (1 November 2026: "apply it all clean,
 * small in small areas and big in big areas, no container"). Chosen by what
 * the state is about, from the object a call site already names (`icon`) or
 * the 3D object it picked (`art`). Every empty state on the platform names one
 * of these, so one table moves all of them; anything unmatched keeps its old
 * drawing until a glyph exists for it.
 */
export const STATE_GLYPH: Partial<Record<string, GlyphName>> = {
  // objects a call site names
  "bell-badge": "empty-notifications",
  chat: "chat",
  "chat-duo": "chat",
  "chat-ring": "chat",
  "support-chat": "empty-support",
  "search-ring": "search",
  "listing-search": "empty-search",
  "home-search": "empty-search",
  "search-home": "empty-search",
  "calendar-check": "booking-confirmed",
  "calendar-home": "empty-tenancy",
  "calendar-clock": "booking-requested",
  "calendar-grid": "empty-calendar",
  "shield-check": "shield-check",
  "user-verified": "ai-permissions",
  "globe-pin": "map-pin",
  "card-lock": "ai-payment",
  "keys-home": "rental-key",
  "home-ring": "house",
  "heart-home": "empty-saved",
  "ledger-book": "empty-payouts",
  reviews: "empty-reviews",
  "hotel-bed": "empty-rooms",
  hotel: "hotel",
  "concierge-bell": "empty-tables",
  "bank-column": "empty-payouts",
  "receipt-check": "empty-payments",
  hourglass: "listing-in-review",
  camera: "empty-photos",
  "contract-sign": "empty-agreements",
  "report-stats": "map-pin",
  "map-route": "map-pin",
  "doc-home": "listing-draft",
  "doc-lock": "ai-security",
  "doc-review": "listing-in-review",
  "doc-shield": "ai-protection",
  "chart-growth": "listing-live",
  "clock-check": "ai-schedule",
  gift: "empty-rewards",
  "alert-triangle": "booking-disputed",
  // 3D objects a call site picked
  checklist: "listing-in-review",
  "stay-rated": "empty-reviews",
  envelope: "empty-inbox",
  boxes: "empty-tenancy",
  "id-check": "ai-permissions",
  "calendar-booked": "booking-confirmed",
  "calendar-pending": "booking-requested",
  "local-talks": "chat",
  "saved-heart": "empty-saved",
  earnings: "empty-payouts",
  pay: "empty-payments",
  folder: "listing-draft",
  support: "empty-support",
  contract: "empty-agreements",
  analytics: "map-pin",
  restaurant: "empty-tables",
  keys: "rental-key",
  explore: "map-pin",
  "card-secure": "ai-payment",
  shield: "shield-check",
  bell: "empty-notifications",
  clock: "ai-schedule",
};

/** The glyph a state draws, or undefined to keep its older drawing. `art={false}` keeps the plate. */
export function stateGlyphFor(icon: string | undefined, art?: Icon3DName | false): GlyphName | undefined {
  if (art === false) return undefined;
  return (art ? STATE_GLYPH[art] : undefined) ?? (icon ? STATE_GLYPH[icon] : undefined);
}
