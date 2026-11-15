import type { Locale } from "@vallo/i18n/core";
import { daysLive, listingPulse, timeOnVallo } from "@/lib/listings/stats/format";
import { shownRating } from "@/lib/listings/stats/rating";
import { readListingStats } from "@/lib/listings/stats/read";
import { ListingPulse } from "./ListingPulse";

/**
 * The listing page's pulse, read on its own (founder, 13 and 14 November 2026).
 *
 * Mounted inside its own `Suspense`, so the page never waits for it: the
 * tiles stream in beside the description when the one cached read answers.
 * An example listing shows its counts like any other, but never a time on
 * Vallo. A failed read, or the SQL not yet applied, draws the rating alone:
 * a count is never guessed.
 */
export async function ListingStats({
  listingId,
  isDemo,
  publishedAt,
  rating,
  reviewCount,
  locale,
  className,
}: {
  listingId: string;
  isDemo: boolean;
  publishedAt: string | null | undefined;
  rating?: number | null;
  reviewCount?: number | null;
  locale: Locale;
  className?: string;
}) {
  const figures = await readListingStats(listingId);
  const days = isDemo || !figures ? null : daysLive(publishedAt, new Date());
  return (
    <ListingPulse
      tiles={listingPulse({ figures, locale })}
      rating={shownRating({ rating, reviewCount }, locale)}
      age={days === null ? null : timeOnVallo(days, locale)}
      className={className}
    />
  );
}
