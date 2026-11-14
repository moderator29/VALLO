import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { cardStatItems, compactCount, countPhrase, type StatsFigures } from "@/lib/listings/stats/format";
import { shownRating } from "@/lib/listings/stats/rating";

/**
 * THE CARD'S SIGNAL LINE (founder, 14 November 2026). One quiet row at the
 * foot of the card's words, with two ends:
 *
 *   ★ 2.5 New                                                   eye 1.2k
 *
 * THE RATING at the start: one small filled star, the figure in the card's
 * ink, then how many reviews stand behind it in muted ink. An unreviewed
 * listing shows the 2.5 it starts at, with "New".
 *
 * THE VIEWS COUNT at the end: the eye glyph and a bare compact figure, from
 * the first view. Saves and shares appear only on the listing page (founder:
 * "the likes should be when the listing been clicked").
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
    <p className={["nf-sc__sub nf-signal nf-numeric", className ?? ""].filter(Boolean).join(" ")} data-testid="card-counts">
      <span className="nf-signal__rating" data-stat="rating" data-rated={shown.rated ? "true" : "false"}>
        <UiIcon name="star" size={12} filled className="nf-signal__star" />
        <span className="nf-signal__figure" aria-hidden="true">
          {shown.text}
        </span>
        <span className="nf-signal__note" aria-hidden="true">
          {shown.rated ? `(${compactCount(shown.count, locale)})` : words.rating.isNew}
        </span>
        <span className="sr-only">{ratingSentence} </span>
      </span>
      {items.length > 0 ? (
        <span className="nf-signal__counts">
          {items.map((item) => (
            <span key={item.key} className="nf-signal__count" data-stat={item.key}>
              <UiIcon name="eye" size={12} className="shrink-0" />
              <span aria-hidden="true">{item.text}</span>
              <span className="sr-only">{item.full}. </span>
            </span>
          ))}
        </span>
      ) : null}
    </p>
  );
}
