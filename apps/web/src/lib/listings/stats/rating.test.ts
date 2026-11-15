import { describe, expect, it } from "vitest";
import { shownRating, UNRATED_RATING } from "./rating";

/**
 * THE RATING A LISTING SHOWS (founder, 14 November 2026): a listing nobody
 * has reviewed starts at 2.5 and is never passed off as rated; a reviewed one
 * shows its own average.
 */
describe("the rating a listing shows", () => {
  it("starts an unreviewed listing at 2.5, marked as not rated", () => {
    for (const listing of [{}, { rating: 0, reviewCount: 0 }, { rating: null, reviewCount: null }, { rating: 4.8, reviewCount: 0 }, { rating: 0, reviewCount: 3 }]) {
      expect(shownRating(listing), JSON.stringify(listing)).toEqual({ value: 2.5, stars: 2.5, rated: false, count: 0 + (Number(listing.reviewCount) || 0), text: "2.5" });
    }
    expect(UNRATED_RATING).toBe(2.5);
  });

  it("shows a reviewed listing's own average, with stars in halves", () => {
    expect(shownRating({ rating: 4.6, reviewCount: 12 })).toEqual({ value: 4.6, stars: 4.5, rated: true, count: 12, text: "4.6" });
    expect(shownRating({ rating: 4.8, reviewCount: 2 }).stars).toBe(5);
    expect(shownRating({ rating: 1, reviewCount: 1 })).toMatchObject({ value: 1, stars: 1, text: "1.0" });
    /* A real 2.5 is rated: only the absence of reviews makes the figure a starting one. */
    expect(shownRating({ rating: 2.5, reviewCount: 4 })).toMatchObject({ value: 2.5, rated: true, count: 4 });
  });

  it("never draws outside the scale", () => {
    expect(shownRating({ rating: 9, reviewCount: 1 }).value).toBe(5);
    expect(shownRating({ rating: -3, reviewCount: 1 })).toMatchObject({ value: 2.5, rated: false });
  });
});
