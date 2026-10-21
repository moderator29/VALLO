import type { UiIconName } from "@/design-system/icons/UiIcon";

/**
 * The help centre's topics: the id each topic's section carries (so the index
 * at the top of the page can jump to it) and the glyph on its plate.
 *
 * A plain module, not part of the client search component, so the server page
 * and the client list agree on one id without the server calling into a
 * client file.
 */
export function topicId(category: string): string {
  return `help-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const TOPIC_GLYPH: Record<string, UiIconName> = {
  "Property and Stays": "house",
  "Booking a stay": "calendar-booking",
  "Payments and refunds": "wallet",
  "Verification and trust": "shield-check",
  "Listing your property": "key",
  "Using the app": "sliders",
  Viewings: "calendar-booking",
  Messages: "chat-bubble",
  Hosting: "key",
  "Languages and accessibility": "globe",
  Around: "feed",
  "Your account and data": "user-check",
};

/** A topic's plate glyph; a topic nobody has drawn one for gets the document. */
export function topicGlyph(category: string): UiIconName {
  return TOPIC_GLYPH[category] ?? "document";
}
