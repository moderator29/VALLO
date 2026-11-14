import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import type { Locale } from "@vallo/i18n/core";
import { StarMeter } from "@/components/ui/StarMeter";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { cardStatItems, compactCount, countPhrase, type StatsFigures } from "@/lib/listings/stats/format";
import { shownRating } from "@/lib/listings/stats/rating";

/**
 * THE CARD'S SIGNAL LINE (founder, 14 November 2026): the rating, then how
 * many people have looked and saved, on one quiet line under the card's facts.
 *
 *   [ ★★⯪☆☆ 2.5 New ]   eye 1.2k   heart 24
 *
 * The rating sits in its own soft capsule, five stars filled to the half, so
 * every card carries it in the same place. A listing with reviews shows its
 * average and how many reviews; one with none shows the 2.5 every listing
 * starts at and the word "New", and a screen reader is told it is not yet
 * rated (`lib/listings/stats/rating.ts`). The counts are bare figures beside
 * their glyphs: views from the first, saves from the first, never a zero
 * (`cardStatItems`). Its own line, never a cell of the facts row, so it can
 * never push the facts to wrap at 390. Server and client safe.
 */
export function CardCounts({
  stats,
  rating,
  reviewCount,
  locale,
  className,
}: {
  stats: StatsFigures | null | undefined;
  rating?: number | null;
  reviewCount?: number | null;
  locale: Locale;
  className?: string;
}) {
  const words = listingStatsEn;
  const shown = shownRating({ rating, reviewCount }, locale);
  const items = cardStatItems({ stats, locale }) ?? [];
  const ratingSentence = shown.rated
    ? `${words.rating.outOf.replace("{rating}", shown.text)}, ${countPhrase(shown.count, words.rating.reviews, locale).full}.`
    : words.rating.startsAt.replace("{rating}", shown.text);
  return (
    <p
      className={["nf-sc__sub nf-signal nf-numeric", className ?? ""].filter(Boolean).join(" ")}
      data-testid="card-counts"
    >
      <span className="nf-signal__rating" data-stat="rating" data-rated={shown.rated ? "true" : "false"}>
        <StarMeter stars={shown.stars} size={12} />
        <span className="nf-signal__figure" aria-hidden="true">
          {shown.text}
        </span>
        <span className="nf-signal__note" aria-hidden="true">
          {shown.rated ? `(${compactCount(shown.count, locale)})` : words.rating.isNew}
        </span>
        <span className="sr-only">{ratingSentence} </span>
      </span>
      {items.map((item) => (
        <span key={item.key} className="nf-signal__count" data-stat={item.key}>
          <UiIcon name={item.key === "views" ? "eye" : "heart"} size={13} className="shrink-0" />
          <span aria-hidden="true">{item.text}</span>
          <span className="sr-only">{item.full}. </span>
        </span>
      ))}
    </p>
  );
}
