import { formatNumber, type Locale } from "@vallo/i18n/core";

/**
 * THE RATING A LISTING SHOWS (founder, 14 November 2026).
 *
 * A listing people have reviewed shows the average of its counted reviews. A
 * listing nobody has reviewed starts at 2.5, the middle of the scale, so every
 * card carries the same five stars. The starting figure is never passed off
 * as a review: `rated` is false, the card says "New" beside it, the listing
 * page says "Not yet rated", and a screen reader hears that every listing
 * starts there. It is drawn, never stored: no row is written for it, and it
 * takes no part in any average or ranking.
 */
export const RATING_SCALE = 5;
export const UNRATED_RATING = 2.5;

export type ShownRating = {
  /** The figure drawn, 0 to 5. */
  value: number;
  /** The stars filled, in halves. */
  stars: number;
  /** True only when real reviews stand behind the figure. */
  rated: boolean;
  /** Counted reviews; 0 when unrated. */
  count: number;
  /** "4.6", "2.5". */
  text: string;
};

export function shownRating(
  listing: { rating?: number | null; reviewCount?: number | null },
  locale: Locale = "en",
): ShownRating {
  const count = Math.max(0, Math.floor(Number(listing.reviewCount) || 0));
  const average = Number(listing.rating) || 0;
  const rated = count > 0 && average > 0;
  const value = rated ? Math.min(RATING_SCALE, Math.max(0, Math.round(average * 10) / 10)) : UNRATED_RATING;
  return {
    value,
    stars: Math.round(value * 2) / 2,
    rated,
    count,
    text: formatNumber(value, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
}
