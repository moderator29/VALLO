import type { Listing } from "@/lib/listings/types";

/**
 * NEWEST PUBLISHED FIRST, BY THE DATE THE LISTING FIRST WENT LIVE.
 *
 * `published_at` is written by the review desk only when it is empty, so a
 * listing sent back to draft and published again keeps its age and cannot jump
 * the queue, and nobody can buy a fresher copy (there is no push-up to buy).
 * A row with no date, or one that does not parse, has no honest age and goes
 * last rather than first. Equal dates keep the order they came in.
 *
 * Pure, so the order is proved without a database.
 */
const publishedAt = (listing: Listing): number => {
  const at = Date.parse(listing.publishedAt ?? "");
  return Number.isFinite(at) ? at : 0;
};

export function newestFirst(listings: readonly Listing[], limit: number): Listing[] {
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort((a, b) => publishedAt(b.listing) - publishedAt(a.listing) || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.listing);
}

/** A listing is "just listed" for this long after it first went live. */
export const JUST_LISTED_DAYS = 30;

/**
 * THE NEW SHELF, REAL LISTINGS FIRST (4 November 2026, the founder: real
 * listings go to the top, and new ones are noticed on Home).
 *
 * Real listings that went live within `JUST_LISTED_DAYS` come first, newest
 * first; examples only fill what is left, so the shelf is never empty on a
 * young platform but a real listing always outranks an example.
 */
export function newShelf(listings: readonly Listing[], limit: number, now: number): Listing[] {
  const cutoff = now - JUST_LISTED_DAYS * 24 * 60 * 60 * 1000;
  const real = newestFirst(
    listings.filter((l) => !l.isDemo && publishedAt(l) >= cutoff),
    limit,
  );
  if (real.length >= limit) return real;
  const taken = new Set(real.map((l) => l.id));
  return [...real, ...newestFirst(listings.filter((l) => !taken.has(l.id)), limit - real.length)];
}
