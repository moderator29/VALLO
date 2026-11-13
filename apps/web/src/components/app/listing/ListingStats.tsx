import type { Locale } from "@vallo/i18n/core";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { listingStatItems } from "@/lib/listings/stats/format";
import { readListingStats } from "@/lib/listings/stats/read";
import { ListingStatsRow } from "./ListingStatsRow";

/**
 * The listing page's stats row, read on its own (founder, 13 November 2026).
 *
 * Mounted inside its own `Suspense`, so the page never waits for it: the row
 * streams in beside the description when its one cached read answers. An
 * example listing returns before any read. A failed read, or the pending SQL
 * not yet applied, draws nothing at all (`listingStatItems` fails closed).
 */
export async function ListingStats({
  listingId,
  isDemo,
  publishedAt,
  locale,
  className,
}: {
  listingId: string;
  isDemo: boolean;
  publishedAt: string | null | undefined;
  locale: Locale;
  className?: string;
}) {
  if (isDemo) return null;
  const figures = await readListingStats(listingId);
  const items = listingStatItems({ isDemo, publishedAt, figures, now: new Date(), locale });
  return <ListingStatsRow items={items} label={listingStatsEn.rowLabel} className={className} />;
}
