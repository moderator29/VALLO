import Link from "next/link";
import { formatDate, formatNumber, type Locale } from "@vallo/i18n/core";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { AreaTimeChart } from "@/components/agent/charts/AreaTimeChart";
import { GroupedBarChart } from "@/components/agent/charts/GroupedBarChart";
import { MeterBar } from "@/components/agent/charts/MeterBar";
import { totalsOf, weekly, type DayFigures, type RankedRow, type StatsRange } from "@/lib/admin/reads/listing-stats-model";
import { conversionPercent } from "@/lib/listings/stats/format";
import { niceTicks, periodDelta } from "../../_components/metrics";
import { CalmNote, KpiGrid, Panel, PanelUnavailable, type KpiItem } from "../../_components/panels";

/**
 * THE LISTINGS DESK (Analytics > Listings, founder, 13 November 2026).
 *
 * Built only from the console's own furniture (`KpiGrid`, `Panel`,
 * `CalmNote`, the distribution rows and `MeterBar`) and its existing charts
 * (`AreaTimeChart` for views, `GroupedBarChart` for saves, enquiries and
 * viewing requests), so it reads as one more desk, not a new product.
 *
 * Every figure is a sum the database returned from the daily rollup; nothing
 * is estimated. A range with nothing in it draws the calm note, and a desk
 * whose SQL is not applied yet says so instead of drawing zeros. Pure
 * presentation: the page reads, this draws, a fixture can draw it too.
 */

const w = listingStatsEn.desk;

export type Slice<T> = { state: "ok"; data: T } | { state: "missing" } | { state: "unavailable" };

export type ListingStatsDeskProps = {
  locale: Locale;
  range: StatsRange;
  days: Slice<{ current: DayFigures[]; previous: DayFigures[] }>;
  topViews: Slice<RankedRow[]>;
  topSaves: Slice<RankedRow[]>;
  areas: Slice<RankedRow[]>;
  listers: Slice<RankedRow[]>;
  /** False on one listing's page: no top lists, areas or listers. */
  ranked?: boolean;
};

function dayLabel(day: string, locale: Locale, withYear = false): string {
  return formatDate(new Date(`${day}T12:00:00+01:00`), locale, {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : null),
  });
}

/** The desk's buckets: days for 7 and 30, weeks for 90. Pure. */
export function bucketsFor(range: StatsRange, days: readonly DayFigures[]): DayFigures[] {
  return range === "90d" ? weekly(days) : [...days];
}

function tickEvery(range: StatsRange): number {
  return range === "7d" ? 1 : range === "30d" ? 7 : 3;
}

export function ListingStatsDesk({ locale, range, days, topViews, topSaves, areas, listers, ranked = true }: ListingStatsDeskProps) {
  if (days.state === "missing") {
    return (
      <Panel id="ls-not-installed">
        <CalmNote kind="unwired" title={w.notInstalledTitle} fills={w.notInstalledFills} creates={w.notInstalledCreates} />
      </Panel>
    );
  }
  const fmt = (v: number) => formatNumber(v, locale);
  const now = days.state === "ok" ? totalsOf(days.data.current) : null;
  const before = days.state === "ok" ? totalsOf(days.data.previous) : null;
  const buckets = days.state === "ok" ? bucketsFor(range, days.data.current) : [];
  const retry = "Did not load; it retries every minute";
  const kpi = (key: "views" | "saves" | "enquiries" | "viewings", label: string, icon: KpiItem["icon"]): KpiItem => ({
    key,
    icon,
    label,
    value: now ? fmt(now[key]) : null,
    count: now ? now[key] : undefined,
    locale,
    delta: now && before ? periodDelta(now[key], before[key]) : null,
    caption: w.vsPrevious,
    spark: now ? { id: `ls-${key}`, values: buckets.map((b) => b[key]), label } : null,
    pending: retry,
  });
  const kpis: KpiItem[] = [
    kpi("views", w.views, { tier: "ui", name: "eye" }),
    kpi("saves", w.saves, { tier: "ui", name: "heart" }),
    kpi("enquiries", w.enquiries, { tier: "ui", name: "chat-bubble" }),
    kpi("viewings", w.viewings, { tier: "ui", name: "calendar-booking" }),
  ];
  const nothing = now !== null && now.views + now.saves + now.enquiries + now.viewings === 0;
  const weekly90 = range === "90d";

  return (
    <div className="nf-admin-stack">
      <KpiGrid items={kpis} label={w.title} />

      <Panel id="ls-conversion" className="nf-admin-anchor" title={w.conversionTitle}>
        {now === null ? (
          <PanelUnavailable what={w.conversionTitle} locale={locale} />
        ) : (
          <Conversion totals={now} locale={locale} />
        )}
      </Panel>

      <div className="nf-admin-grid nf-admin-grid--halves">
        <Panel id="ls-views" className="nf-admin-anchor" title={weekly90 ? w.viewsPerWeek : w.viewsPerDay}>
          {now === null ? (
            <PanelUnavailable what={w.views} locale={locale} />
          ) : nothing || now.views === 0 ? (
            <CalmNote title={w.nothingTitle} fills={w.nothingFills} creates={w.nothingCreates} />
          ) : (
            <AreaTimeChart
              label={weekly90 ? w.viewsPerWeek : w.viewsPerDay}
              points={buckets.map((b) => ({
                key: b.day,
                tick: dayLabel(b.day, locale),
                readout: dayLabel(b.day, locale, true),
                value: b.views,
                display: fmt(b.views),
              }))}
              yTicks={niceTicks(Math.max(...buckets.map((b) => b.views))).map((v) => ({ value: v, label: fmt(v) }))}
              tickEvery={tickEvery(range)}
              height={180}
            />
          )}
        </Panel>
        <Panel id="ls-actions" className="nf-admin-anchor" title={weekly90 ? w.actionsPerWeek : w.actionsPerDay}>
          {now === null ? (
            <PanelUnavailable what={w.saves} locale={locale} />
          ) : now.saves + now.enquiries + now.viewings === 0 ? (
            <CalmNote title={w.nothingTitle} fills={w.nothingFills} />
          ) : (
            <GroupedBarChart
              label={weekly90 ? w.actionsPerWeek : w.actionsPerDay}
              series={[
                { key: "saves", label: w.saves },
                { key: "enquiries", label: w.enquiries },
                { key: "viewings", label: w.viewings },
              ]}
              groups={buckets.map((b, i) => ({
                key: b.day,
                tick: i % tickEvery(range) === 0 || i === buckets.length - 1 ? dayLabel(b.day, locale) : "",
                readout: dayLabel(b.day, locale, true),
                values: [b.saves, b.enquiries, b.viewings],
              }))}
              yTicks={niceTicks(Math.max(...buckets.flatMap((b) => [b.saves, b.enquiries, b.viewings]))).map((v) => ({
                value: v,
                label: fmt(v),
              }))}
              height={180}
            />
          )}
        </Panel>
      </div>

      {ranked ? (
      <>
      <div className="nf-admin-grid nf-admin-grid--halves">
        <Panel id="ls-top-views" className="nf-admin-anchor" title={w.topByViews} flush>
          <Ranked slice={topViews} measure="views" head={w.listing} locale={locale} linkListings />
        </Panel>
        <Panel id="ls-top-saves" className="nf-admin-anchor" title={w.topBySaves} flush>
          <Ranked slice={topSaves} measure="saves" head={w.listing} locale={locale} linkListings />
        </Panel>
      </div>

      <div className="nf-admin-grid nf-admin-grid--halves">
        <Panel id="ls-areas" className="nf-admin-anchor" title={w.byArea} flush>
          <Ranked slice={areas} measure="views" head={w.area} locale={locale} />
        </Panel>
        <Panel id="ls-listers" className="nf-admin-anchor" title={w.byLister} flush>
          <Ranked slice={listers} measure="views" head={w.lister} locale={locale} />
        </Panel>
      </div>
      </>
      ) : null}
      <p className="nf-caption">{w.since}</p>
    </div>
  );
}

/** View to save, to enquiry and to viewing request, as shares of views. */
export function Conversion({ totals, locale }: { totals: Omit<DayFigures, "day">; locale: Locale }) {
  const rows = [
    { key: "save", label: w.viewToSave, part: totals.saves },
    { key: "enquiry", label: w.viewToEnquiry, part: totals.enquiries },
    { key: "viewing", label: w.viewToViewing, part: totals.viewings },
  ];
  return (
    <>
      <div className="nf-admin-dist" role="table" aria-label={w.conversionTitle}>
        {rows.map((row, i) => {
          const pct = conversionPercent(row.part, totals.views);
          return (
            <div key={row.key} className="nf-admin-dist__row nf-admin-dist__row--area" role="row">
              <span className="nf-admin-dist__name" role="cell">
                {row.label}
                <span className="nf-admin-dt__sub">
                  {formatNumber(row.part, locale)} of {formatNumber(totals.views, locale)}
                </span>
              </span>
              <span role="cell">
                <MeterBar value={pct ?? 0} max={100} rank={i} />
              </span>
              <span className="nf-admin-dist__num nf-numeric" role="cell">
                {pct === null ? "–" : `${formatNumber(pct, locale, { maximumFractionDigits: 1 })}%`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="nf-caption mt-xs">{w.conversionNote}</p>
    </>
  );
}

function Ranked({
  slice,
  measure,
  head,
  locale,
  linkListings = false,
}: {
  slice: Slice<RankedRow[]>;
  measure: "views" | "saves";
  head: string;
  locale: Locale;
  linkListings?: boolean;
}) {
  if (slice.state === "missing") return null;
  if (slice.state !== "ok") return <PanelUnavailable what={head} locale={locale} />;
  const fmt = (v: number) => formatNumber(v, locale);
  const header = (
    <div className="nf-admin-dist__row nf-admin-dist__row--head nf-admin-dist__row--area" role="row">
      <span role="columnheader">{head}</span>
      <span role="columnheader">
        <span className="sr-only">Share</span>
      </span>
      <span role="columnheader" className="nf-admin-dist__num">
        {measure === "views" ? w.views : w.saves}
      </span>
    </div>
  );
  const rows = slice.data.filter((r) => r[measure] > 0);
  if (rows.length === 0) {
    return (
      <div className="nf-admin-panel__pad">
        <div className="nf-admin-dist" aria-hidden="true">{header}</div>
        <CalmNote title={w.nothingTitle} fills={w.nothingFills} />
      </div>
    );
  }
  const max = rows[0]?.[measure] ?? 0;
  return (
    <div className="nf-admin-dist nf-admin-panel__pad" role="table" aria-label={head}>
      {header}
      {rows.map((row, i) => {
        const others = [
          measure === "views" ? `${fmt(row.saves)} ${w.saves.toLowerCase()}` : `${fmt(row.views)} ${w.views.toLowerCase()}`,
          `${fmt(row.enquiries)} ${w.enquiries.toLowerCase()}`,
          `${fmt(row.viewings)} ${w.viewings.toLowerCase()}`,
          ...(linkListings ? [] : [`${fmt(row.listings)} ${w.listings.toLowerCase()}`]),
        ].join(", ");
        return (
          <div key={row.key} className="nf-admin-dist__row nf-admin-dist__row--area" role="row">
            <span className="nf-admin-dist__name" role="cell">
              {linkListings ? (
                <Link href={`/admin/analytics/listings/${row.key}`} className="[overflow-wrap:anywhere] underline-offset-2 hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
              <span className="nf-admin-dt__sub">{[row.sub, others].filter(Boolean).join(". ")}</span>
            </span>
            <span role="cell">
              <MeterBar value={row[measure]} max={max} rank={i} />
            </span>
            <span className="nf-admin-dist__num nf-numeric" role="cell">
              {fmt(row[measure])}
            </span>
          </div>
        );
      })}
    </div>
  );
}
