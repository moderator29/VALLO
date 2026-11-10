import { countOf, getDictionary, type Locale } from "@vallo/i18n";
import type { HostReviewsRead } from "@/lib/host/reviews";
import { RATING_TREND_MIN, averageRating } from "@/lib/host/review-contest";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { HostReviewCard } from "./HostReviewCard";
import "@/app/host/host-desk.css";

/** The host's reviews, drawn (C4); the page reads, the preview harness draws fixtures. */
export function HostReviewsView({
  read,
  locale,
}: {
  read: Exclude<HostReviewsRead, { state: "signed-out" }>;
  locale: Locale;
}) {
  const copy = getDictionary(locale).experienceHost;
  const words = copy.reviews;
  const tag = locale === "en" ? "en-NG" : locale;
  const when = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
  const reviews = read.state === "ok" ? read.reviews : [];
  const visible = reviews.filter((r) => !r.hiddenAt);
  const average = averageRating(visible.map((r) => r.rating));
  const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: visible.filter((r) => r.rating === stars).length }));

  return (
    <PageFrame
      fallback="/host"
      width="wide"
      title={copy.screens.reviews}
      subtitle={
        read.state !== "ok"
          ? words.subtitle
          : reviews.length === 0
            ? words.none
            : countOf(reviews.length, "reviewsOfYourStays", locale)
      }
    >

      <div className="grid gap-md">
        {read.state === "not-ready" ? (
          <EmptyState
            icon="reviews"
            title={words.notReadyTitle}
            body={words.notReadyBody}
          />
        ) : read.state === "unavailable" ? (
          <p className="nf-body" role="alert">
            {words.unavailable}
          </p>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="reviews"
            title={words.none}
            body={words.emptyBody}
          />
        ) : (
          <>
            {visible.length >= RATING_TREND_MIN && average !== null ? (
              <SummaryCard
                label={words.ratingLabel}
                figure={
                  <span className="nf-numeric">
                    {average.toFixed(1)}
                    <span className="nf-caption"> {words.ofFive}</span>
                  </span>
                }
                sentence={words.ratingSentence.replace("{count}", String(visible.length))}
                segments={counts
                  .filter((c) => c.count > 0)
                  .map((c) => ({
                    key: String(c.stars),
                    label: countOf(c.stars, "stars", locale),
                    count: c.count,
                    tone: c.stars >= 4 ? ("success" as const) : c.stars === 3 ? ("warning" as const) : ("error" as const),
                  }))}
                barLabel={words.barLabel}
              />
            ) : (
              <p className="nf-caption">{words.ratingPending.replace("{min}", String(RATING_TREND_MIN))}</p>
            )}
            <div className="nf-hreview-grid">
              {reviews.map((review) => (
                <HostReviewCard key={review.id} review={review} when={when.format(new Date(review.createdAt))} />
              ))}
            </div>
          </>
        )}
      </div>
    </PageFrame>
  );
}
