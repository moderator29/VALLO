import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { formatNumber } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getListingStatsDays, getListingStatsHead } from "@/lib/admin/reads/listing-stats";
import { STATS_RANGES, type StatsRange } from "@/lib/admin/reads/listing-stats-model";
import { daysLive, timeOnVallo } from "@/lib/listings/stats/format";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { LiveRefresh } from "../../../_components/LiveRefresh";
import { KpiStrip, PageHead, ReadOnlyNote, type KpiItem } from "../../../_components/panels";
import { RangeSelect } from "../../../_components/RangeSelect";
import { ListingStatsDesk } from "../ListingStatsDesk";

export const metadata: Metadata = { title: listingStatsEn.desk.title, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const w = listingStatsEn.desk;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readAt(): Date {
  return new Date();
}

/**
 * Analytics > Listings > one listing: its lifetime views and current saves,
 * its time on Vallo, and the same day charts as the desk for this listing
 * alone. Same access and the same reads as the desk.
 */
export default async function ListingAnalyticsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const access = await requireAdmin("analyst");
  if (access.state !== "admin") notFound();
  const [{ listingId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  if (!UUID.test(listingId)) notFound();
  const range: StatsRange = STATS_RANGES.find((r) => r === query.range) ?? "30d";
  const [head, days] = await Promise.all([getListingStatsHead(listingId), getListingStatsDays(range, listingId)]);
  if (head.state === "ok" && head.data === null) notFound();
  const listing = head.state === "ok" ? head.data : null;
  const age = listing ? daysLive(listing.publishedAt, readAt()) : null;
  const strip: KpiItem[] = listing
    ? [
        { key: "views", icon: { tier: "ui", name: "eye" }, label: w.lifetimeViews, value: formatNumber(listing.views, locale), count: listing.views, locale },
        { key: "saves", icon: { tier: "ui", name: "heart" }, label: w.currentSaves, value: formatNumber(listing.saves, locale), count: listing.saves, locale },
        {
          key: "age",
          icon: { tier: "ui", name: "calendar-clock" },
          label: w.daysOnVallo,
          value: listing.isDemo ? w.example : age === null ? w.notLive : timeOnVallo(age, locale),
        },
      ]
    : [];
  return (
    <div className="nf-admin-stack">
      <LiveRefresh />
      <PageHead
        lead={
          <Link href="/admin/analytics/listings" className="nf-caption inline-flex items-center gap-2xs">
            <UiIcon name="arrow-left" size={14} />
            {w.back}
          </Link>
        }
        title={listing ? w.detailTitle.replace("{title}", listing.title) : w.title}
        lede={[w.detailLede, listing ? [listing.area, listing.city, listing.lister].filter(Boolean).join(", ") : ""].filter(Boolean).join(" ")}
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
      {strip.length > 0 ? <KpiStrip items={strip} label={w.title} /> : null}
      <ListingStatsDesk
        locale={locale}
        range={range}
        days={head.state === "missing" ? head : days}
        topViews={{ state: "missing" }}
        topSaves={{ state: "missing" }}
        areas={{ state: "missing" }}
        listers={{ state: "missing" }}
        ranked={false}
      />
    </div>
  );
}
