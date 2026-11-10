import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { formatNumber } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { fixText } from "@/lib/agent/funnel";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { Figure } from "@/components/ui/Amount";
import { RangeSwitch } from "@/components/agent/intel/RangeSwitch";
import { lagosDayOf, parseRange, rangesFor } from "@/components/agent/intel/space-model";
import { ListingPitch } from "../../../list/ListingPitch";
import { fill } from "../../../_copy";
import { readOneFunnel, readRequests } from "../../../_intel/space-read";
import { bookingsMetricViews } from "../../../_intel/space-views";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.experienceFeatures.analytics.week.title, robots: { index: false, follow: false } };
}

/**
 * `/agent/analytics/listings/<id>`: ONE LISTING'S WEEK, COMPLETELY (D25;
 * north star 16.6, "per-listing funnel").
 *
 * The six stages of `public.listing_funnel` in their own order (seen in
 * results, opened, saved, enquired, viewing booked, viewed), each a figure
 * with the middle figure for similar homes under it, then the funnel's one
 * fix, then this listing's booking requests by period. The stages are
 * figure tiles rather than a chart: each is one number over one fixed week,
 * and they are not shares of each other (a save is counted from signed-in
 * people, a view once a day per person), so a funnel drawn as narrowing bars
 * would imply a conversion the platform does not measure (`shape.funnel`
 * says so: "there is still no conversion rate").
 *
 * The comparison is the database's: a median only when five other listers'
 * similar listings are live, never one rival's figure. "Missing" covers a
 * wrong id and somebody else's listing alike, so the page never confirms a
 * listing it will not show.
 */
export default async function ListingWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ listingId }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = getDictionary(locale);
  const a = t.experienceFeatures.analytics;
  const w = a.week;
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

  const [read, requests] = await Promise.all([
    readOneFunnel(context.supabase, context.agent.id, listingId),
    readRequests(context.supabase, context.agent.id),
  ]);
  const profile = agentProfileFrom(context.agent);

  if (read.state !== "ok") {
    const words =
      read.state === "missing"
        ? w.missing
        : read.state === "example"
          ? w.example
          : read.state === "not-live"
            ? w.notLive
            : w.unavailable;
    return (
      <AgentShell t={t} locale={locale} active="/agent/analytics" profile={profile} chromeBack={false}>
        {/* The frame's header carries the one way back, to Analytics, where
            the text link above the title used to. */}
        <PageFrame title={w.title} fallback="/agent/analytics">
        <div>
          <EmptyState
            icon="chart-growth"
            title={"title" in read ? read.title : w.title}
            body={words}
            action={
              read.state === "not-live" || read.state === "example" ? (
                <ButtonLink href={`/agent/list?id=${listingId}`} variant="secondary">
                  {w.edit}
                </ButtonLink>
              ) : (
                <ButtonLink href="/agent/analytics" variant="secondary">
                  {a.back}
                </ButtonLink>
              )
            }
            data-testid="listing-week-state"
          />
        </div>
        </PageFrame>
      </AgentShell>
    );
  }

  const { listing } = read;
  const noMedian = listing.funnel.rows.every((row) => row.median === null);
  /* This listing's requests only, and its days before it went live hatched
     rather than counted as quiet: nobody could ask for it then. */
  const liveFrom = listing.publishedAt ? lagosDayOf(listing.publishedAt) : null;
  const own =
    requests.state === "ok"
      ? {
          rows: requests.rows.filter((row) => row.listingId === listing.id),
          ctx: { ...requests.ctx, joinedKey: liveFrom ?? requests.ctx.joinedKey },
        }
      : null;

  return (
    <AgentShell t={t} locale={locale} active="/agent/analytics" profile={profile} chromeBack={false}>
      <PageFrame title={listing.title} subtitle={w.lede} fallback="/agent/analytics">
      <div>
        <section aria-labelledby="week-stages" data-testid="listing-week">
          <h2 id="week-stages" className="nf-section-label">
            {w.title} · {a.span["7d"]}
          </h2>
          <div className="nf-figure-tiles mt-sm">
            {listing.funnel.rows.map((row) => (
              <div key={row.stage} className="nf-kpi">
                <p className="nf-kpi__head">
                  <span className="nf-kpi__label">{t.shape.funnel.stages[row.stage]}</span>
                </p>
                <p className="nf-kpi__figure">
                  <Figure value={row.mine} locale={locale} count />
                </p>
                <p className="nf-kpi__sub">
                  {row.median === null
                    ? w.similarTooFew
                    : fill(w.similar, { median: formatNumber(Math.round(row.median), locale) })}
                </p>
              </div>
            ))}
          </div>
          <p className="nf-caption mt-sm max-w-[68ch] text-[var(--nf-content-muted)]">
            {noMedian ? `${t.shape.funnel.noMedian} ` : ""}
            {t.shape.funnel.howCounted}
          </p>
        </section>

        {listing.fix ? (
          <p
            className="nf-panel nf-panel--card nf-body-sm mt-lg block p-md text-[var(--nf-content-primary)]"
            data-testid="funnel-fix"
          >
            <strong>{t.shape.funnel.fixLabel}</strong>{" "}
            {fixText(t.shape.funnel.fixes[listing.fix.key], listing.fix.values)}
          </p>
        ) : null}

        <div className="mt-lg">
          {own ? (
            <RangeSwitch
              views={bookingsMetricViews("requests", own, null, t, locale).map((view) => ({ ...view, rows: [] }))}
              initial={parseRange(query.range, rangesFor("requests"))}
              periodLabel={a.period}
              caption={a.metrics.requests.title}
              testId="listing-requests"
            />
          ) : (
            <p
              className="rounded-[var(--nf-container-radius)] p-md text-[length:var(--nf-text-caption)] font-semibold leading-relaxed"
              style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
              role="status"
            >
              {a.requestsUnavailable}
            </p>
          )}
        </div>

        <div className="mt-lg flex flex-wrap gap-sm">
          <ButtonLink href={`/agent/listings/${listing.id}/health`} variant="primary">
            {w.health}
          </ButtonLink>
          <ButtonLink href={`/agent/list?id=${listing.id}`} variant="secondary">
            {w.edit}
          </ButtonLink>
        </div>
      </div>
      </PageFrame>
    </AgentShell>
  );
}
