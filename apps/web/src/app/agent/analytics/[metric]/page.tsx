import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { Figure } from "@/components/ui/Amount";
import { Bars } from "@/components/ui/charts/Bars";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { RangeSwitch } from "@/components/agent/intel/RangeSwitch";
import {
  METRIC_SOURCE,
  METRIC_STAGE,
  funnelTotals,
  isSpaceMetric,
  parseRange,
  rangesFor,
  stageOf,
  type SpaceMetric,
} from "@/components/agent/intel/space-model";
import { ListingPitch } from "../../list/ListingPitch";
import { fill } from "../../_copy";
import { readFunnels, readListingTitles, readRequests, type FunnelsRead } from "../../_intel/space-read";
import { bookingsMetricViews, metricTitles } from "../../_intel/space-views";
import { State } from "@/components/ui/State";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ metric: string }> }): Promise<Metadata> {
  const { metric } = await params;
  const t = getDictionary(await getLocale());
  const title = isSpaceMetric(metric) ? metricTitles(t)[metric] : t.agentAnalytics.title;
  return { title, robots: { index: false, follow: false } };
}

/**
 * `/agent/analytics/<metric>`: ONE FIGURE, ANSWERED COMPLETELY (D25; north
 * star 16.6, "per-metric breakdown").
 *
 * The overview names every figure in one row; this page is that figure on
 * its own: what it counts, its periods (only the ones its source can answer),
 * its chart, and the split by listing, each row opening that listing's week.
 *
 * Two families, because the two sources answer different periods:
 *
 *   bookings (requests, confirmed, requests confirmed)  four periods, the
 *     same card as the overview, the split by listing under the chart.
 *   the funnel (seen, opened, saved, enquired, viewing booked)  seven days
 *     only, so no period control: the total (when every live listing was
 *     read), one bar per listing, and each listing beside the middle figure
 *     for similar homes, which the database gives only when five other
 *     listers' listings exist to take it from.
 *
 * States, each in this page's own words inside the workspace shell: the
 * pitch (not a lister), unconfigured, could not read, nothing yet, and the
 * figure. An unknown metric is a 404, never an empty page.
 */
export default async function MetricPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ metric }, query] = await Promise.all([params, searchParams]);
  if (!isSpaceMetric(metric)) notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const a = t.experienceFeatures.analytics;
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/analytics" profile={null}>
        {context.state === "unconfigured" ? (
          <p className="nf-body mx-auto max-w-md py-section text-center text-[var(--nf-content-secondary)]">
            {t.agentAnalytics.unconfigured}
          </p>
        ) : (
          <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
        )}
      </AgentShell>
    );
  }

  const title = metricTitles(t)[metric];
  const blurb = a.metrics[metric].blurb;

  let content: React.ReactNode;
  if (METRIC_SOURCE[metric] === "bookings") {
    const which = metric as "requests" | "confirmed" | "conversion";
    const [requests, titles] = await Promise.all([
      readRequests(context.supabase, context.agent.id),
      readListingTitles(context.supabase, context.agent.id),
    ]);
    content =
      requests.state !== "ok" ? (
        <Unavailable>{a.requestsUnavailable}</Unavailable>
      ) : (
        <RangeSwitch
          views={bookingsMetricViews(which, requests, titles, t, locale)}
          initial={parseRange(query.range, rangesFor(which))}
          periodLabel={a.period}
          caption={title}
          rowsLabel={a.byListing}
          testId="metric-figure"
        />
      );
  } else {
    const funnels = await readFunnels(context.supabase, context.agent.id);
    content = <FunnelFigure metric={metric} title={title} funnels={funnels} t={t} locale={locale} />;
  }

  return (
    <AgentShell t={t} locale={locale} active="/agent/analytics" profile={agentProfileFrom(context.agent)}>
      <div className="mx-auto max-w-3xl">
        <Link href="/agent/analytics" className="nf-caption font-semibold text-[var(--nf-content-muted)]">
          {a.back}
        </Link>
        <h1 className="nf-h1 mt-xs">{title}</h1>
        <p className="mt-2xs max-w-[62ch] text-[var(--nf-content-secondary)]">{blurb}</p>
        <div className="mt-lg">{content}</div>
      </div>
    </AgentShell>
  );
}

/**
 * A funnel figure: seven days only, so no period control. The total (when
 * every live listing was read), one bar per listing, then each listing
 * beside the middle figure for similar homes.
 */
function FunnelFigure({
  metric,
  title,
  funnels,
  t,
  locale,
}: {
  metric: SpaceMetric;
  title: string;
  funnels: FunnelsRead;
  t: Dictionary;
  locale: Locale;
}) {
  const a = t.experienceFeatures.analytics;
  const stage = METRIC_STAGE[metric];
  if (funnels.state !== "ok" || !stage) return <Unavailable>{a.funnelUnavailable}</Unavailable>;
  const rows = funnels.listings
    .map((listing) => ({ listing, figure: stageOf(listing.funnel, stage) }))
    .sort((x, y) => y.figure.mine - x.figure.mine || x.listing.title.localeCompare(y.listing.title));
  const total = funnelTotals(funnels.listings)[stage];
  const any = rows.some((row) => row.figure.mine > 0);

  return (
    <section
      className="nf-panel nf-panel--card nf-panel--figure block p-md sm:p-panel"
      aria-labelledby="metric-caption"
      data-testid="metric-figure"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 id="metric-caption" className="nf-section-label">
          {title}
        </h2>
        <p className="nf-caption text-[var(--nf-content-secondary)]">{a.span["7d"]}</p>
      </div>
      <p className="mt-sm text-[length:var(--nf-text-figure)] font-semibold leading-none tracking-tight text-[var(--nf-content-primary)]">
        {funnels.complete ? (
          <Figure value={total} locale={locale} count />
        ) : (
          <span className="text-[length:var(--nf-text-body)] text-[var(--nf-content-muted)]">{a.notCounted}</span>
        )}
      </p>
      <p className="nf-caption mt-sm max-w-[68ch] text-[var(--nf-content-secondary)]">
        {funnels.complete ? a.sevenDays : a.noTotal}
      </p>

      {rows.length === 0 ? (
        <State compact kind="empty" icon="report-stats" title={t.shape.funnel.empty} className="mt-md" />
      ) : (
        <>
          {/* "Which listing had most": magnitude across listings, so
              horizontal bars sorted by size on the one blue's ramp, each bar
              naming itself and carrying its figure (chart rule 1). Drawn only
              when at least one listing has any: a column of empty bars is a
              picture of nothing. */}
          {any ? (
            <Bars
              className="mt-md"
              label={`${title}, ${a.byListing}`}
              bars={rows.map((row) => ({ label: row.listing.title, count: row.figure.mine }))}
              limit={rows.length}
            />
          ) : (
            <State compact kind="empty" icon="report-stats" title={a.noneByListing} className="mt-md" />
          )}
          <ListGroup className="mt-md" label={a.byListing}>
            {rows.map(({ listing, figure }) => (
              <ListRow
                key={listing.id}
                title={listing.title}
                sub={
                  figure.median === null
                    ? a.week.similarTooFew
                    : fill(a.week.similar, { median: formatNumber(Math.round(figure.median), locale) })
                }
                value={<span className="nf-numeric font-semibold">{formatNumber(figure.mine, locale)}</span>}
                href={`/agent/analytics/listings/${listing.id}`}
                chevron
              />
            ))}
          </ListGroup>
          <p className="nf-caption mt-sm text-[var(--nf-content-muted)]">{t.shape.funnel.howCounted}</p>
        </>
      )}
    </section>
  );
}

/** A read that failed, said in the warning tone: nothing broke on the lister's side. */
function Unavailable({ children }: { children: string }) {
  return (
    <p
      className="rounded-[var(--nf-container-radius)] p-md text-[length:var(--nf-text-caption)] font-semibold leading-relaxed"
      style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
      role="status"
    >
      {children}
    </p>
  );
}
