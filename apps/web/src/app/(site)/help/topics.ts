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
  Viewings: "calendar-check",
  Messages: "chat-bubble",
  Hosting: "building-hotel",
  "Languages and accessibility": "globe",
  Around: "feed",
  "Your account and data": "user-check",
};

/** A topic's plate glyph; a topic nobody has drawn one for gets the document. */
export function topicGlyph(category: string): UiIconName {
  return TOPIC_GLYPH[category] ?? "document";
}

/**
 * THE SHORT ANCHORS (DOCS_AND_PRESENCE_UPGRADE.md 8: every document gets a
 * stable URL). The search sheet's popular topics (`POPULAR_TOPICS` in
 * `components/docs/DocSearchSheet.tsx`) and links from inside the product
 * land on `/help#bookings`, `/help#payouts` and the rest, which survive a
 * topic being renamed: the topic ids above are built from the topic's name,
 * these are not. Each points at a whole topic or at the one answer that IS
 * the topic, and `topics.test.ts` holds every alias to a topic or question
 * the help centre still has, and every `/help#` link the sheet makes to an
 * alias here.
 */
export const HELP_ANCHORS: Readonly<Record<string, { category: string } | { question: string }>> = {
  bookings: { category: "Booking a stay" },
  verification: { category: "Verification and trust" },
  refunds: { question: "How do refunds work?" },
  payouts: { question: "When do owners, agents and hosts get paid?" },
  inspections: { category: "Viewings" },
  account: { category: "Your account and data" },
};

/** The short anchors that land on a whole topic, keyed by the topic. */
export function topicAliases(category: string): string[] {
  return Object.entries(HELP_ANCHORS)
    .filter(([, target]) => "category" in target && target.category === category)
    .map(([alias]) => alias);
}

/** The short anchor that lands on one answer, if it has one. */
export function questionAlias(question: string): string | undefined {
  return Object.entries(HELP_ANCHORS).find(([, target]) => "question" in target && target.question === question)?.[0];
}
