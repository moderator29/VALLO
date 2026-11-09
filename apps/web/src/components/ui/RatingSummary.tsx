import type { CSSProperties } from "react";

import { countOf, formatRating, type Locale } from "@vallo/i18n/core";
import { RATING_MAX, RATING_MIN } from "@/lib/reviews/model";
import { RatingStars } from "./RatingStars";
import "./rating-summary.css";

/**
 * App Store-style rating summary.
 *
 * ```
 *   4.6        ★★★★★  5  ████████████████  32
 *  out of 5    ★★★★☆  4  ██████████        18
 *  87 ratings  ★★★☆☆  3  ████              7
 *              ★★☆☆☆  2  ██                3
 *              ★☆☆☆☆  1  █                 2
 * ```
 *
 * `breakdown` is an array of five counts: [count of 1-star, ..., count of
 * 5-star]. When absent, the component shows the large number, stars and count
 * without the breakdown bars (the inline variant that the listing detail uses).
 *
 * Honours reduced motion: the bars render at their final width immediately
 * when `prefers-reduced-motion` is active.
 */

export type RatingBreakdown = [
  oneStar: number,
  twoStar: number,
  threeStar: number,
  fourStar: number,
  fiveStar: number,
];

export function RatingSummary({
  rating,
  count,
  breakdown,
  locale,
}: {
  /** Average rating, 1 to 5. */
  rating: number;
  /** Total number of ratings. */
  count: number;
  /** Counts per star, index 0 = 1 star. When absent the bars are hidden. */
  breakdown?: RatingBreakdown;
  locale: Locale;
}) {
  const total = breakdown ? breakdown.reduce((a, b) => a + b, 0) : count;
  const max = breakdown ? Math.max(...breakdown, 1) : 1;

  return (
    <div
      className="nf-rating-summary"
      role="figure"
      aria-label={`${formatRating(rating, locale)} out of ${RATING_MAX}, ${countOf(count, "ratings", locale)}`}
    >
      {/* Left column: the large number, stars and count. */}
      <div className="nf-rating-summary__score">
        <span className="nf-rating-summary__number">
          {formatRating(rating, locale)}
        </span>
        <span className="nf-rating-summary__label">out of {RATING_MAX}</span>
        <RatingStars rating={rating} size={16} />
        {total > 0 && (
          <span className="nf-rating-summary__count">
            {countOf(total, "ratings", locale)}
          </span>
        )}
      </div>

      {/* Right column: the breakdown bars. */}
      {breakdown && (
        <div className="nf-rating-summary__bars" aria-hidden="true">
          {Array.from({ length: RATING_MAX }, (_, i) => {
            const star = RATING_MAX - i; // 5 down to 1
            const value = breakdown[star - RATING_MIN] ?? 0;
            const pct = total > 0 ? (value / max) * 100 : 0;
            return (
              <div key={star} className="nf-rating-summary__row">
                <span className="nf-rating-summary__star-label">{star}</span>
                <div className="nf-rating-summary__track">
                  <div
                    className="nf-rating-summary__fill"
                    style={{ "--nf-rating-scale": (pct / 100).toFixed(4) } as CSSProperties}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
