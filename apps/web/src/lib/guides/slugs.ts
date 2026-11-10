/**
 * A14. The guide addresses, in reading order. Client safe and dependency
 * free, so the sitemap can name them without importing the articles.
 * `articles.test.ts` holds this list and `GUIDES` to the same set.
 */
export const GUIDE_SLUGS = [
  "how-to-list",
  "avoiding-rental-scams",
  "what-a-move-in-total-includes",
  "renting-in-lagos",
  "renting-in-abuja",
  "how-stays-work-on-vallo",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}
