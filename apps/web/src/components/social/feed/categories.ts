import type { PostView } from "./PostCard";

/**
 * THE FEED'S CATEGORIES (founder, 7 November 2026: For you, Properties,
 * Stays, Restaurants). A category is a filter over REAL posts, read from what
 * a post actually carries, never a guess from its words:
 *
 *   properties   a post that features a listing to rent or buy
 *   stays        a post that features a nightly stay
 *   restaurants  a post that features a restaurant
 *
 * The kind comes from `listing.kind` when the read supplies it, and otherwise
 * from the listing's own price period (a nightly price is a stay). A post with
 * no listing belongs to no category, so it shows under For you and Friends
 * only. Until a post can feature a restaurant, Restaurants is honestly empty.
 */
export const FEED_CATEGORIES = ["properties", "stays", "restaurants"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export function isFeedCategory(value: string | undefined | null): value is FeedCategory {
  return !!value && (FEED_CATEGORIES as readonly string[]).includes(value);
}

export function postCategory(post: Pick<PostView, "listing">): FeedCategory | null {
  const listing = post.listing;
  if (!listing) return null;
  if (listing.kind === "restaurant") return "restaurants";
  if (listing.kind === "stay") return "stays";
  if (listing.kind === "property") return "properties";
  return listing.periodLabel === "a night" ? "stays" : "properties";
}

export function inCategory(post: Pick<PostView, "listing">, category: FeedCategory | null): boolean {
  return category === null || postCategory(post) === category;
}
