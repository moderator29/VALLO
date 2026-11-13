import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getListingStatsDays, getListingStatsRanked } from "@/lib/admin/reads/listing-stats";
import { STATS_RANGES, type StatsRange } from "@/lib/admin/reads/listing-stats-model";
import { LiveRefresh } from "../../_components/LiveRefresh";
import { PageHead, ReadOnlyNote } from "../../_components/panels";
import { RangeSelect } from "../../_components/RangeSelect";
import { ListingStatsDesk } from "./ListingStatsDesk";

export const metadata: Metadata = { title: listingStatsEn.desk.title, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const w = listingStatsEn.desk;

/**
 * Analytics > Listings (founder, 13 November 2026): views, saves, enquiries
 * and viewing requests over 7, 30 or 90 days, the conversion from a view to
 * each, the top listings, and the figures by area and by lister. Admins, and
 * staff with the read-only analyst scope. Every read is one SQL function over
 * the daily rollup (`lib/admin/reads/listing-stats.ts`), all in parallel.
 */
export default async function ListingAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const access = await requireAdmin("analyst");
  if (access.state !== "admin") notFound();
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const range: StatsRange = STATS_RANGES.find((r) => r === params.range) ?? "30d";
  const [days, topViews, topSaves, areas, listers] = await Promise.all([
    getListingStatsDays(range),
    getListingStatsRanked(range, "listing", "views", 10),
    getListingStatsRanked(range, "listing", "saves", 10),
    getListingStatsRanked(range, "area", "views", 10),
    getListingStatsRanked(range, "lister", "views", 10),
  ]);
  return (
    <div className="nf-admin-stack">
      <LiveRefresh />
      <PageHead
        title={w.title}
        lede={w.lede}
        action={
          <RangeSelect
            value={range}
            options={{ "7d": w.range7, "30d": w.range30, "90d": w.range90 }}
            short={{ "7d": w.rangeShort7, "30d": w.rangeShort30, "90d": w.rangeShort90 }}
            label={w.rangeLabel}
          />
        }
      />
      <ReadOnlyNote locale={locale} />
      <ListingStatsDesk
        locale={locale}
        range={range}
        days={days}
        topViews={topViews}
        topSaves={topSaves}
        areas={areas}
        listers={listers}
      />
    </div>
  );
}
