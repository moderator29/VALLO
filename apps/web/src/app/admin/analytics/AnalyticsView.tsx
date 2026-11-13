import { formatDate, formatNumber, getDictionary, type Locale } from "@vallo/i18n";
import { tx } from "@/app/admin/_components/shell-text";
import { MeterBar } from "@/components/agent/charts/MeterBar";
import type { BookingOutcomes, CollectedRange, PriceCheckDemand, ThinAreas } from "@/lib/admin/reads/shapes";
import { GroupedBarChart } from "@/components/agent/charts/GroupedBarChart";
import { niceTicks, periodDelta } from "../_components/metrics";
import {
  CalmNote,
  EmptyChart,
  KpiGrid,
  PageHead,
  Panel,
  PanelUnavailable,
  ReadOnlyNote,
  type KpiItem,
} from "../_components/panels";
import { RangeSelect } from "../_components/RangeSelect";
import { DeskSections } from "../_components/DeskSections";

/**
 * ANALYTICS, drawn from 01F7DFC7 panel three: four KPI cards, demand against
 * supply, top areas, areas with the fewest listings, requests against
 * results, and the most common refusals.
 *
 * DEMAND IS THE PRICE CHECK LOG. `price_check_events` (23 September) is the
 * platform's first record of people asking about a place: every check
 * submitted, whether it was answered, the local government asked about and
 * the reason when it was refused. The render's searches panels are drawn from
 * it and named for what they count (price checks), so no figure pretends to
 * be site search, which is still not recorded. Listing views come from the
 * listing stats rollup (founder, 13 November 2026; the Listings desk under
 * this one) and read "Not recorded" until its pending SQL is applied.
 * Examples are excluded from every supply figure.
 */
export type AnalyticsProps = {
  locale: Locale;
  range: CollectedRange;
  bookings: BookingOutcomes | null;
  supply: { start: string; listings: number }[] | null;
  thin: ThinAreas | null;
  demand: PriceCheckDemand | null;
  /** Why listings were sent back, counted from reason codes; only reasons with a count. Null when there is nothing to show. */
  sentBack?: { code: string; label: string; count: number }[] | null;
  /** Listing views in the range: null when the read failed, "missing" until the listing stats SQL is applied. */
  views?: { views: number; previous: number | null; spark: number[] } | null | "missing";
};

/** Which buckets carry a date under the axis: every month, every third week, every seventh day. */
function tickFor(index: number, range: CollectedRange): boolean {
  if (range === "12m") return true;
  return index % (range === "90d" ? 3 : 7) === 0;
}

function bucketLabel(start: string, monthly: boolean, withYear: boolean, locale: Locale): string {
  return formatDate(new Date(`${start.length === 7 ? `${start}-01` : start}T12:00:00+01:00`), locale, {
    timeZone: "Africa/Lagos",
    ...(monthly ? { month: "short" } : { day: "numeric", month: "short" }),
    ...(withYear ? { year: "numeric" } : null),
  });
}

export function AnalyticsView({ locale, range, bookings, supply, thin, demand, sentBack, views = "missing" }: AnalyticsProps) {
  const shell = getDictionary(locale).admin.shell;
  const x = getDictionary(locale).experienceAdmin;
  const c = shell.analytics;
  const notRecorded = (request: string) => ({ value: null, missingWord: shell.states.notRecorded, pending: `Nothing records this yet. Request ${request}.` });
  const period = { "30d": c.vsPrev30, "90d": c.vsPrev90, "12m": c.vsPrev12 }[range];
  const retry = "Did not load; it retries every minute";
  const answeredShare = demand && demand.checks > 0 ? Math.round((demand.answered / demand.checks) * 100) : null;
  const kpis: KpiItem[] = [
    {
      key: "checks",
      icon: { tier: "ui", name: "search" },
      label: c.priceChecks,
      value: demand ? formatNumber(demand.checks, locale) : null,
      delta: demand ? periodDelta(demand.checks, demand.checksPrev) : null,
      caption: period,
      spark: demand ? { id: "an-checks", values: demand.buckets.map((b) => b.checks), label: c.priceChecks } : null,
      pending: retry,
    },
    views === "missing"
      ? { key: "views", icon: { tier: "ui", name: "eye" }, label: c.listingViews, ...notRecorded("A8") }
      : {
          key: "views",
          icon: { tier: "ui", name: "eye" },
          label: c.listingViews,
          value: views ? formatNumber(views.views, locale) : null,
          delta: views ? periodDelta(views.views, views.previous) : null,
          caption: views && views.previous !== null ? period : undefined,
          spark: views ? { id: "an-views", values: views.spark, label: c.listingViews } : null,
          href: "/admin/analytics/listings",
          pending: retry,
        },
    {
      key: "bookings",
      icon: { tier: "ui", name: "calendar-booking" },
      label: c.successfulBookings,
      value: bookings ? formatNumber(bookings.successful, locale) : null,
      delta: bookings ? periodDelta(bookings.successful, bookings.successfulPrev) : null,
      caption: period,
      href: "/admin/bookings",
      pending: retry,
    },
    {
      key: "answered",
      icon: { tier: "admin", name: "bars" },
      label: c.checksAnswered,
      value: demand ? (answeredShare === null ? "\u2013" : `${answeredShare}%`) : null,
      caption: demand ? `${formatNumber(demand.answered, locale)} of ${formatNumber(demand.checks, locale)}` : undefined,
      pending: retry,
    },
  ];
  const monthly = range === "12m";
  const sections = [
    { id: "an-figures", label: x.sections.figures, icon: "chart-bar" as const },
    { id: "an-demand", label: c.demandSupply, icon: "trending-up" as const },
    { id: "an-top-areas", label: c.topAreasChecks, icon: "location" as const },
    { id: "an-thin", label: c.thinAreas, icon: "map" as const },
    { id: "an-results", label: c.checksVsAnswered, icon: "search" as const },
    { id: "an-refusals", label: c.refusalsTitle, icon: "alert-triangle" as const },
    ...(sentBack && sentBack.length > 0 ? [{ id: "an-sent-back", label: x.sections.sentBack, icon: "flag" as const }] : []),
  ];

  return (
    <div className="nf-admin-stack">
      <PageHead
        title={c.title}
        lede={c.lede}
        action={
          <RangeSelect
            value={range}
            options={{ "30d": shell.overview.range30, "90d": shell.overview.range90, "12m": shell.overview.range12 }}
            label={shell.overview.range30}
          />
        }
      />
      <ReadOnlyNote locale={locale} />
      <DeskSections sections={sections} label={x.sections.navLabel} toggleLabel={x.sections.toggle} />
      <div id="an-figures" className="nf-admin-anchor">
        <KpiGrid items={kpis} label={c.title} />
      </div>

      <Panel id="an-demand" className="nf-admin-anchor" title={c.demandSupply}>
        <DemandSupply supply={supply} demand={demand} range={range} locale={locale} />
      </Panel>

      <div className="nf-admin-grid nf-admin-grid--halves">
        <Panel id="an-top-areas" className="nf-admin-anchor" title={c.topAreasChecks}>
          <TopAreas demand={demand} locale={locale} />
        </Panel>
        <Panel id="an-thin" className="nf-admin-anchor" title={c.thinAreas}>
          <ThinAreasTable thin={thin} locale={locale} />
        </Panel>
      </div>

      <div className="nf-admin-grid nf-admin-grid--halves">
        <Panel id="an-results" className="nf-admin-anchor" title={c.checksVsAnswered}>
          {!demand ? (
            <PanelUnavailable what={c.priceChecks} locale={locale} />
          ) : demand.checks === 0 ? (
            <EmptyChart
              height={160}
              yLabels={niceTicks(10, 5).map((v) => String(v))}
              legend={[c.checksLegend, c.answeredLegend]}
              xLabels={demand.buckets.map((b, i) => (tickFor(i, range) ? bucketLabel(b.start, monthly, false, locale) : ""))}
              note={{ title: c.noChecksTitle, fills: c.noChecksFills, creates: c.noChecksCreates }}
            />
          ) : (
            <GroupedBarChart
              label={c.checksVsAnswered}
              series={[
                { key: "checks", label: c.checksLegend },
                { key: "answered", label: c.answeredLegend },
              ]}
              groups={demand.buckets.map((b, i) => ({
                key: b.start,
                tick: tickFor(i, range) ? bucketLabel(b.start, monthly, false, locale) : "",
                readout: bucketLabel(b.start, monthly, true, locale),
                values: [b.checks, b.answered],
              }))}
              yTicks={niceTicks(Math.max(...demand.buckets.map((b) => b.checks))).map((v) => ({ value: v, label: formatNumber(v, locale) }))}
              height={160}
            />
          )}
        </Panel>
        <Panel id="an-refusals" className="nf-admin-anchor" title={c.refusalsTitle}>
          <Refusals demand={demand} locale={locale} />
        </Panel>
      </div>

      {/* C8: why listings were sent back, counted from the reason codes. */}
      {sentBack && sentBack.length > 0 ? (
        <Panel id="an-sent-back" className="nf-admin-anchor" title="Why listings were sent back, last 30 days">
          <ul className="nf-body-sm grid gap-2xs">
            {sentBack.map((r) => (
              <li key={r.code} className="flex justify-between gap-md">
                <span>{r.label}</span>
                <span className="nf-numeric font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
          <p className="nf-caption mt-xs">Counted since reason codes began on 30 September 2026. A review can carry several.</p>
        </Panel>
      ) : null}
    </div>
  );
}

function DemandSupply({
  supply,
  demand,
  range,
  locale,
}: {
  supply: { start: string; listings: number }[] | null;
  demand: PriceCheckDemand | null;
  range: CollectedRange;
  locale: Locale;
}) {
  const c = getDictionary(locale).admin.shell.analytics;
  if (!supply || !demand) return <PanelUnavailable what={c.demandSupply} locale={locale} />;
  const monthly = range === "12m";
  const total = supply.reduce((sum, b) => sum + b.listings, 0) + demand.checks;
  if (total === 0) {
    return (
      <EmptyChart
        height={200}
        yLabels={niceTicks(10, 5).map((v) => String(v))}
        legend={[c.checksLegend, c.listingsCreated]}
        xLabels={supply.map((b, i) => (tickFor(i, range) ? bucketLabel(b.start, monthly, false, locale) : ""))}
        note={{
          title: c.noChecksTitle,
          fills: c.noChecksFills,
          creates: c.noChecksCreates,
          action: { href: "/admin/supply", label: "Open Supply" },
        }}
      />
    );
  }
  const max = Math.max(...supply.map((b) => b.listings), ...demand.buckets.map((b) => b.checks));
  return (
    <GroupedBarChart
      label={c.demandSupply}
      series={[
        { key: "checks", label: c.checksLegend },
        { key: "listings", label: c.listingsCreated },
      ]}
      groups={supply.map((b, i) => ({
        key: b.start,
        tick: tickFor(i, range) ? bucketLabel(b.start, monthly, false, locale) : "",
        readout: bucketLabel(b.start, monthly, true, locale),
        values: [demand.buckets[i]?.checks ?? 0, b.listings],
      }))}
      yTicks={niceTicks(max).map((v) => ({ value: v, label: formatNumber(v, locale) }))}
      height={200}
    />
  );
}

function TopAreas({ demand, locale }: { demand: PriceCheckDemand | null; locale: Locale }) {
  const c = getDictionary(locale).admin.shell.analytics;
  if (!demand) return <PanelUnavailable what={c.topAreasChecks} locale={locale} />;
  const head = (
    <div className="nf-admin-dist__row nf-admin-dist__row--head nf-admin-dist__row--area" role="row">
      <span role="columnheader">{c.area}</span>
      <span role="columnheader">
        <span className="sr-only">Share</span>
      </span>
      <span role="columnheader" className="nf-admin-dist__num">{c.checksColumn}</span>
    </div>
  );
  if (demand.topAreas.length === 0) {
    return (
      <>
        <div className="nf-admin-dist" aria-hidden="true">{head}</div>
        <CalmNote title={c.noAreasTitle} fills={c.noAreasFills} creates={c.noChecksCreates} />
      </>
    );
  }
  const max = demand.topAreas[0]?.checks ?? 0;
  return (
    <div className="nf-admin-dist" role="table" aria-label={c.topAreasChecks}>
      {head}
      {demand.topAreas.map((row, i) => (
        <div key={`${row.area}-${row.state ?? ""}`} className="nf-admin-dist__row nf-admin-dist__row--area" role="row">
          <span className="nf-admin-dist__name" role="cell">
            {row.area}
            {row.state && <span className="nf-admin-dt__sub">{row.state}</span>}
          </span>
          <span role="cell">
            <MeterBar value={row.checks} max={max} rank={i} />
          </span>
          <span className="nf-admin-dist__num nf-numeric" role="cell">{formatNumber(row.checks, locale)}</span>
        </div>
      ))}
    </div>
  );
}

function Refusals({ demand, locale }: { demand: PriceCheckDemand | null; locale: Locale }) {
  const c = getDictionary(locale).admin.shell.analytics;
  if (!demand) return <PanelUnavailable what={c.refusalsTitle} locale={locale} />;
  const head = (
    <div className="nf-admin-dist__row nf-admin-dist__row--head nf-admin-dist__row--area" role="row">
      <span role="columnheader">{c.reason}</span>
      <span role="columnheader">
        <span className="sr-only">Share</span>
      </span>
      <span role="columnheader" className="nf-admin-dist__num">{c.count}</span>
    </div>
  );
  if (demand.refusals.length === 0) {
    return (
      <>
        <div className="nf-admin-dist" aria-hidden="true">{head}</div>
        <CalmNote title={c.noRefusalsTitle} fills={c.noRefusalsFills} />
      </>
    );
  }
  const words = c.refusal as Record<string, string | undefined>;
  const max = demand.refusals[0]?.count ?? 0;
  return (
    <div className="nf-admin-dist" role="table" aria-label={c.refusalsTitle}>
      {head}
      {demand.refusals.map((row, i) => (
        <div key={row.code} className="nf-admin-dist__row nf-admin-dist__row--area" role="row">
          <span className="nf-admin-dist__name" role="cell">
            {words[row.code] ?? row.code.replace(/_/g, " ")}
            <span className="nf-admin-dt__sub">
              {demand.refused > 0 ? `${Math.round((row.count / demand.refused) * 100)}%` : ""}
            </span>
          </span>
          <span role="cell">
            <MeterBar value={row.count} max={max} rank={i} />
          </span>
          <span className="nf-admin-dist__num nf-numeric" role="cell">{formatNumber(row.count, locale)}</span>
        </div>
      ))}
    </div>
  );
}

function ThinAreasTable({ thin, locale }: { thin: ThinAreas | null; locale: Locale }) {
  if (!thin) return <PanelUnavailable what={tx(locale, "anSupplyByArea")} locale={locale} />;
  if (thin.rows.length === 0) {
    return (
      <>
        <div className="nf-admin-dist" aria-hidden="true">
          <div className="nf-admin-dist__row nf-admin-dist__row--head nf-admin-dist__row--area">
            <span>Area</span>
            <span />
            <span className="nf-admin-dist__num">Listings</span>
          </div>
        </div>
        <CalmNote
          title={tx(locale, "anNoRealListingLiveIn")}
          fills={tx(locale, "anTheAreasWithTheLeast")}
          creates={tx(locale, "anAreasAppearAsOwnersAgents")}
          action={{ href: "/admin/listings", label: "Open the listings queue" }}
        />
      </>
    );
  }
  const max = Math.max(...thin.rows.map((r) => r.count));
  return (
    <div className="nf-admin-dist" role="table" aria-label="Areas with fewest listings">
      <div className="nf-admin-dist__row nf-admin-dist__row--head nf-admin-dist__row--area" role="row">
        <span role="columnheader">Area</span>
        <span role="columnheader">
        <span className="sr-only">Share</span>
      </span>
        <span role="columnheader" className="nf-admin-dist__num">Listings</span>
      </div>
      {thin.rows.map((row) => (
        <div key={`${row.area}-${row.city ?? ""}`} className="nf-admin-dist__row nf-admin-dist__row--area" role="row">
          <span className="nf-admin-dist__name" role="cell">
            {row.area}
            {row.city && <span className="nf-admin-dt__sub">{row.city}</span>}
          </span>
          <span role="cell">
            <MeterBar value={row.count} max={max} rank={1} />
          </span>
          <span className="nf-admin-dist__num nf-numeric" role="cell">{formatNumber(row.count, locale)}</span>
        </div>
      ))}
    </div>
  );
}
