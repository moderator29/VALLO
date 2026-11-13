import { formatNumber, type Dictionary, type Locale, formatRating } from "@vallo/i18n/core";
import type { ListingReview } from "@/lib/reviews/queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON, TYPE } from "@/components/app/Screen";
import { DetailGlyph } from "./DetailGlyph";
import { ReportSheet } from "@/components/app/ReportSheet";
import { RatingStars } from "@/components/ui/RatingStars";
import { RatingSummary, type RatingBreakdown } from "@/components/ui/RatingSummary";
import { RATING_MIN } from "@/lib/reviews/model";

/**
 * Reviews.
 *
 * THE TWO BEHAVIOURS THAT MATTER HERE ARE BOTH PRESERVED EXACTLY.
 *
 *   1. A listing with no rating and no written reviews renders the empty state
 *      and NOTHING ELSE. It does not invent a testimonial, borrow one from
 *      another property, or show a placeholder shaped like a review. On a
 *      platform with no completed stays this is what every listing shows, so it
 *      is the honest answer and it is the common one.
 *   2. A count of zero is suppressed rather than printed. A listing that
 *      carries a rating but no written reviews states the rating alone; it
 *      never renders "(0 reviews)".
 *
 * Reviewer names come from each review row's own `author_label`, which a
 * database trigger writes from the reviewer's profile. The client never
 * supplies it, and no profile row has to be exposed to read it.
 *
 * The surface changed and the facts did not: this was an `.nf-card` nested
 * inside the detail page's glass sheet, with a second bordered block inside it
 * for the review list. It is a section on the ground now, and the reviews are a
 * hairline-divided list rather than a box inside a box.
 */

export function ListingReviews({
  rating,
  reviewCount,
  reviews,
  locale,
  t,
  signedIn,
  tenancy = false,
}: {
  rating: number;
  reviewCount: number;
  /** Written reviews from the platform. Empty for a catalogue-only listing. */
  reviews: ListingReview[];
  locale: Locale;
  t: Dictionary;
  /**
   * Whether the reader is signed in. When given, every written review carries
   * its own report control (STORE-P2-01); a surface that does not pass it
   * (a static preview) draws none.
   */
  signedIn?: boolean;
  /** UX-21: a tenancy is lived in, not stayed at; its empty state says so. */
  tenancy?: boolean;
}) {
  if (reviewCount === 0 && reviews.length === 0) {
    return (
      /* One quiet row, the glyph on the page's plate beside two lines, not
         a large centred tile over blank space (founder, 13 November 2026:
         the empty section was mostly empty). The words are unchanged. */
      <div className="flex items-start gap-sm" data-testid="reviews-empty">
        <DetailGlyph name="star" className="shrink-0" />
        <div className="min-w-0">
          <p className="nf-body font-semibold text-[var(--nf-content-primary)]">No reviews yet</p>
          <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">
            {tenancy
              ? "Tenants can review a place after they move in, and a review appears only once one has."
              : "Nobody has stayed here through Vallo yet. A review appears once a guest actually has, and never before."}
          </p>
        </div>
      </div>
    );
  }

  const breakdown: RatingBreakdown | undefined =
    reviews.length >= 3
      ? reviews.reduce<RatingBreakdown>(
          (acc, r) => {
            const idx = Math.max(0, Math.min(4, Math.round(r.rating) - RATING_MIN));
            acc[idx as 0 | 1 | 2 | 3 | 4]++;
            return acc;
          },
          [0, 0, 0, 0, 0],
        )
      : undefined;

  return (
    <div>
      {reviews.length >= 3 ? (
        <RatingSummary
          rating={rating}
          count={reviewCount}
          breakdown={breakdown}
          locale={locale}
        />
      ) : (
        <p className="flex items-baseline gap-inline">
          <span className="nf-numeric text-[1.75rem] font-bold tracking-tight text-[var(--nf-content-primary)]">
            {formatRating(rating, locale)}
          </span>
          {reviewCount > 0 && (
            <span className={TYPE.bodyLg}>
              {formatNumber(reviewCount, locale)} {t.common.reviews}
            </span>
          )}
        </p>
      )}

      {reviews.length > 0 ? (
        <ul className="mt-block divide-y divide-[var(--nf-panel-hair)]">
          {reviews.map((review) => (
            <li key={review.id} className="py-md first:pt-0">
              <p className="flex flex-wrap items-center gap-x-inline gap-y-inline-tight">
                <RatingStars rating={review.rating} />
                <span className="sr-only">{review.rating} out of 5.</span>
                <span className={TYPE.rowTitle}>{review.author}</span>
                <span className={TYPE.caption}>{review.when}</span>
              </p>
              {review.body && <p className={`mt-row ${TYPE.body}`}>{review.body}</p>}
              {signedIn !== undefined && (
                <div className="mt-row" data-testid="review-report">
                  <ReportSheet
                    targetType="review"
                    targetId={review.id}
                    targetLabel={`A review by ${review.author}`}
                    signedIn={signedIn}
                  />
                </div>
              )}
              {/* The host's answer, indented under the review it answers. One
                  per review, and it can never alter a word of the review
                  itself: it is a separate row in a separate table. */}
              {review.response && (
                <div className="mt-row border-l-2 border-[var(--nf-panel-edge)] pl-md">
                  <p className={`flex flex-wrap items-center gap-x-inline ${TYPE.rowMeta}`}>
                    <UiIcon
                      name="verified"
                      size={ICON.inline}
                      className="shrink-0 text-[var(--nf-brand-primary)]"
                    />
                    <span className="font-semibold text-[var(--nf-content-primary)]">
                      Reply from the agent
                    </span>
                    <span>{review.response.when}</span>
                  </p>
                  <p className={`mt-inline-tight whitespace-pre-line ${TYPE.body}`}>
                    {review.response.body}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-group flex items-start gap-inline ${TYPE.body}`}>
          <UiIcon name="star" size={ICON.inline} className="mt-3xs shrink-0" />
          Written reviews from stays booked and finished on Vallo will appear here
          once guests share them.
        </p>
      )}
    </div>
  );
}
