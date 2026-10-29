import Link from "next/link";
import { countOf, formatNumber, formatRating, type Locale } from "@vallo/i18n/core";
import type { AgentReview, AgentReviewsSummary } from "@/lib/agent/reviews-queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { ReplyForm } from "./ReplyForm";
import { IconPlate } from "@/components/ui/IconPlate";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";

/**
 * The host reviews console.
 *
 * A server component: the filter travels in the address bar, so the list itself
 * holds no state and the only client leaves are the reply form and the shared
 * chip rail.
 *
 * The opinion in the ordering is the same one the inbox takes. A host does not
 * primarily want their reviews newest first, they want the ones nobody has
 * answered, because an unanswered one-star review is the one costing them the
 * next booking. Newest wins inside that.
 */

export type ReviewsFilter = "unanswered" | "all";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-3xs" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        /* SOLID FOR THE SCORE, OUTLINE FOR THE REST. Every star was an
           outline and the only difference between a scored one and an unscored
           one was its colour and its opacity, which is rule 13 exactly: a host
           reading their own reviews in daylight, or anybody who cannot
           separate those two blues, counted five stars on a two-star review.
           `star` is authored as a closed silhouette, so `filled` is real here.
           The same treatment the chat card already uses. */
        <UiIcon
          key={i}
          name="star"
          size={16}
          filled={i < rating}
          className={
            i < rating ? "text-[var(--nf-rating)]" : "text-[var(--nf-content-muted)] opacity-40"
          }
        />
      ))}
    </span>
  );
}

function Summary({ summary, locale }: { summary: AgentReviewsSummary; locale: Locale }) {
  const most = Math.max(1, ...summary.distribution);
  return (
    <div className="nf-panel nf-panel--card block p-panel">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-sm">
        <IconPlate size="md" className="shrink-0">
          <UiIcon name="star" size={20} />
        </IconPlate>
        <p className="flex items-baseline gap-xs">
          <span className="nf-numeric text-[length:var(--nf-text-h2)] font-bold tracking-tight text-[var(--nf-content-primary)]">
            {formatRating(summary.average, locale)}
          </span>
          <span className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
            across {countOf(summary.total, "reviews", locale)}
          </span>
        </p>
      </div>

      <ul className="mt-md grid gap-xs border-t border-[var(--nf-border-subtle)] pt-md">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.distribution[star - 1] ?? 0;
          return (
            <li key={star} className="flex items-center gap-sm">
              <span className="nf-numeric w-3 shrink-0 text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                {star}
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-[var(--nf-radius-pill)] bg-[var(--nf-surface-secondary)]"
              >
                <span
                  className="block h-full rounded-[var(--nf-radius-pill)] bg-[var(--nf-brand-primary)]"
                  style={{ width: `${Math.round((count / most) * 100)}%` }}
                />
              </span>
              <span className="nf-numeric w-6 shrink-0 text-right text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                {count}
              </span>
              <span className="sr-only">
                {countOf(count, "reviews", locale)} at {countOf(star, "stars", locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewCard({ review }: { review: AgentReview }) {
  return (
    <li className="nf-panel nf-panel--card block p-md">
      <div className="flex flex-wrap items-center justify-between gap-x-sm gap-y-xs">
        <p className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
          <Stars rating={review.rating} />
          <span className="sr-only">{review.rating} out of 5.</span>
          <span className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
            {review.author}
          </span>
          <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{review.when}</span>
        </p>
        {review.response === null && (
          <span className="nf-badge nf-badge--brand">Needs a reply</span>
        )}
      </div>

      <Link
        href={`/listing/${review.listingId}`}
        className="nf-tap mt-xs flex min-w-0 items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)] hover:text-[var(--nf-content-secondary)]"
      >
        {/* `min-w-0` on both, or the truncate never fires: a flex child's
            minimum width is its content by default, so "Luxury 2 bedroom
            apartment with a sea view" pushed this row 21px past the right
            edge of a 390px screen and gave the whole page a horizontal
            scroll. */}
        <UiIcon name="location" size={12} className="shrink-0" />
        <span className="min-w-0 truncate">{review.listingTitle}</span>
      </Link>

      {review.body ? (
        <p className="mt-sm whitespace-pre-line text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {review.body}
        </p>
      ) : (
        <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
          This guest rated the stay and did not write anything.
        </p>
      )}

      <ReplyForm
        reviewId={review.id}
        existing={review.response?.body ?? null}
        existingWhen={review.response?.when ?? null}
      />
    </li>
  );
}

export function ReviewsWorkspace({
  reviews,
  summary,
  filter,
  locale,
}: {
  reviews: AgentReview[];
  summary: AgentReviewsSummary;
  filter: ReviewsFilter;
  locale: Locale;
}) {
  const shown = filter === "unanswered" ? reviews.filter((r) => r.response === null) : reviews;

  const chips: { key: ReviewsFilter; label: string; count: number }[] = [
    { key: "unanswered", label: "Needs a reply", count: summary.unanswered },
    { key: "all", label: "All reviews", count: summary.total },
  ];

  if (summary.total === 0) {
    return (
      <EmptyState
        icon="reviews"
        art="stay-rated"
        title="No reviews yet"
        body="A guest can review a stay once the stay is over and paid. The first one lands here, and you get the chance to answer it in public."
        action={
          <ButtonLink href="/agent/listings" variant="glass">
            Your listings
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div>
      <Summary summary={summary} locale={locale} />

      {/*
        The shared rail. Selection used to be `.nf-chip--active`, a hue shift on
        a hairline, which at arm's length on a phone in daylight is not a state
        change; the primitive draws a real ring and a fill tint instead. The
        counts stay locale-formatted and tabular.
      */}
      <nav aria-label="Filter reviews" className="mt-5">
        <ChipRow bleed={false}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              behaviour="link"
              href={chip.key === "all" ? "/agent/reviews?filter=all" : "/agent/reviews"}
              selected={chip.key === filter}
            >
              {chip.label}
              {/* The count stays locale-formatted, so `count` is not used here:
                  that prop renders the raw number. */}
              <span className="nf-numeric ml-xs opacity-70">
                {formatNumber(chip.count, locale)}
              </span>
            </Chip>
          ))}
        </ChipRow>
      </nav>

      {shown.length > 0 ? (
        /*
          `grid-cols-1`, NOT A BARE `grid`.

          A grid with no declared columns gets one implicit `auto` track, and
          an `auto` track will not shrink below its item's min-content. The
          review cards' min-content is about 361px, so at 390 the whole list
          drew 395px wide and the page carried a horizontal scroll: the second
          card's listing title ran off the right edge. `grid-cols-1` is
          `repeat(1, minmax(0, 1fr))`, which clamps the track to the container
          and lets the truncation inside the card do its job.
        */
        <ul className="mt-md grid grid-cols-1 gap-sm">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="reviews"
          art="stay-rated"
          className="mt-md"
          title="Every review has your answer"
          body="A host who answers reads as a host who cares, and that is what the next guest is looking for on the page."
          action={
            <ButtonLink href="/agent/reviews?filter=all" variant="glass">
              See all reviews
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
