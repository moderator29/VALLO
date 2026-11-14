import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { cardStatItems, compactCount, countPhrase, type StatsFigures } from "@/lib/listings/stats/format";
import { shownRating } from "@/lib/listings/stats/rating";

/**
 * THE CARD'S SIGNAL LINE (founder, 14 November 2026: "make them small icon in
 * the preview with the rating"). One quiet row at the foot of the card's
 * words, with two ends:
 *
 *   ★ 2.5 New                                   eye 1.2k   heart 24   share 7
 *
 * THE RATING leads, at the start: one small filled star, the figure in the
 * card's ink, then how many reviews stand behind it in muted ink. A listing
 * nobody has reviewed shows the 2.5 every listing starts at and the word
 * "New" where the review count would be, and a screen reader is told it is
 * not yet rated (`lib/listings/stats/rating.ts`).
 *
 * THE COUNTS sit at the end, small and muted: a 12px glyph and a bare figure
 * each, views, saves, shares, from the first of each and never a zero
 * (`cardStatItems`). They are evidence, not a headline, so they never
 * compete with the price above them.
 *
 * Its own line, never a cell of the facts row, so it can never push the
 * facts to wrap at 390. Server and client safe.
 */
const GLYPH: Record<"views" | "saves" | "shares", UiIconName> = { views: "eye", saves: "heart", shares: "share" };

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
              <UiIcon name={GLYPH[item.key as keyof typeof GLYPH]} size={12} className="shrink-0" />
              <span aria-hidden="true">{item.text}</span>
              <span className="sr-only">{item.full}. </span>
            </span>
          ))}
        </span>
      ) : null}
    </p>
  );
}
