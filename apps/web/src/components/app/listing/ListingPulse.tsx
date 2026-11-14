import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { StarMeter } from "@/components/ui/StarMeter";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { PulseTile } from "@/lib/listings/stats/format";
import type { ShownRating } from "@/lib/listings/stats/rating";

/**
 * THE LISTING PAGE'S PULSE (founder, 14 November 2026: "make ours
 * different"). Where the page used to carry one muted line of text, it now
 * carries a row of tiles: the figure large in tabular digits, its glyph in a
 * soft brand disc beside it, the word under it. Views, saves and shares, then
 * the rating with its five stars; the time on Vallo sits under the row as a
 * caption. Four across from 390 up, the row never scrolls.
 *
 * Everything arrives already decided and worded (`listingPulse`,
 * `shownRating`). A null `tiles` (the figures could not be read) draws the
 * rating alone: a count is never guessed. A compact figure ("1.2k") is read
 * out whole. Server and client safe.
 */
const GLYPH: Record<PulseTile["key"], UiIconName> = { views: "eye", saves: "heart", shares: "share" };

export function ListingPulse({
  tiles,
  rating,
  age,
  label = listingStatsEn.rowLabel,
  className,
}: {
  tiles: readonly PulseTile[] | null;
  rating: ShownRating;
  /** "12 days on Vallo", or null when the listing has no honest age. */
  age?: string | null;
  label?: string;
  className?: string;
}) {
  const counts = tiles ?? [];
  const words = listingStatsEn;
  const ratingSentence = rating.rated
    ? words.rating.outOf.replace("{rating}", rating.text)
    : words.rating.startsAt.replace("{rating}", rating.text);
  return (
    <div role="group" aria-label={label} className={["nf-pulse", className ?? ""].filter(Boolean).join(" ")} data-testid="listing-stats">
      <ul className="nf-pulse__row" role="list" data-count={counts.length + 1}>
        {counts.map((tile) => (
          <li key={tile.key} className="nf-pulse__tile" data-stat={tile.key}>
            <span className="nf-pulse__disc" aria-hidden="true">
              <UiIcon name={GLYPH[tile.key]} size={14} />
            </span>
            <span className="nf-pulse__figure nf-numeric" aria-hidden="true">
              {tile.value}
            </span>
            <span className="nf-pulse__word" aria-hidden="true">
              {tile.label}
            </span>
            <span className="sr-only">{tile.full}</span>
          </li>
        ))}
        <li className="nf-pulse__tile nf-pulse__tile--rating" data-stat="rating" data-rated={rating.rated ? "true" : "false"}>
          <span className="nf-pulse__disc nf-pulse__disc--rating" aria-hidden="true">
            <UiIcon name="star" size={14} filled />
          </span>
          <span className="nf-pulse__figure nf-numeric" aria-hidden="true">
            {rating.text}
          </span>
          <span className="nf-pulse__word" aria-hidden="true">
            <StarMeter stars={rating.stars} size={10} />
          </span>
          <span className="sr-only">{ratingSentence}</span>
        </li>
      </ul>
      {age || !rating.rated ? (
        <p className="nf-pulse__foot">
          {age ? <span data-stat="days">{age}</span> : null}
          {!rating.rated ? (
            <span data-stat="rating-note" aria-hidden="true">
              {words.rating.notRated}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
