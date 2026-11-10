import type { Metadata } from "next";
import { DemandBoard } from "@/components/agent/DemandBoard";
import { readDemandBoard } from "@/lib/demand/queries";
import { EnquiryFunnel, LostByAreaPanel } from "@/components/agent/EnquiryDesk";
import { readDeskStages, readLostReasonsByArea } from "@/lib/enquiry/queries";
import { countByStage } from "@/lib/enquiry/stage";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { readAgentAnalytics } from "@/lib/agent/analytics-queries";
import { ButtonLink } from "@/components/ui/Button";
import { ListingPitch } from "../list/ListingPitch";
import { AnalyticsWorkspace } from "./AnalyticsWorkspace";
import { ListingWeeks } from "@/components/agent/intel/ListingWeeks";
import { RangeSwitch } from "@/components/agent/intel/RangeSwitch";
import { NOT_COUNTED, parseRange } from "@/components/agent/intel/space-model";
import { readFunnels, readRequests } from "../_intel/space-read";
import { overviewViews } from "../_intel/space-views";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agentAnalytics.title, robots: { index: false, follow: false } };
}

/**
 * /agent/analytics: what the host's properties have actually done.
 *
 * The last AgentComingSoon stub in the workspace, and the one it was most
 * tempting to fill with a demonstration. A placeholder chart on an analytics
 * screen is not a placeholder in the sense the other stubs were: a host reads
 * it as their own performance and prices a flat, declines a guest or borrows
 * money on the strength of it. So the screen ships with real reads or with
 * nothing, and the empty state is written to be read rather than to be
 * replaced.
 *
 * Shaped exactly like /agent/bookings and /agent/earnings: the server page
 * resolves who is asking, reads under their own RLS-bound client, and hands
 * the figures to a plain rendering component. Nothing here mutates, so the
 * workspace stays a server component with no client JavaScript to ship, and
 * there is no revalidation path to think about.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/analytics" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/analytics" profile={null}>
        <div className="mx-auto max-w-md py-10 text-center">
          <IconPlate size="lg">
            <UiIcon name="chart-bar" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-5">{t.agentAnalytics.title}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            {t.agentAnalytics.unconfigured}
          </p>
          <ButtonLink href="/agent/dashboard" variant="secondary" className="mt-lg">
            {t.agent.nav.dashboard}
          </ButtonLink>
        </div>
      </AgentShell>
    );
  }

  /* The analytics first run (north star 14.1): what these figures count and
     what they leave out, once, before the first read. */
  const query = await searchParams;
  await gateFirstRun("analytics", "/agent/analytics", query);

  /*
   * A throw here would take the whole screen down, and every individual read
   * inside readAgentAnalytics already degrades to a null its own panel knows
   * how to draw. This catch exists for the one failure those cannot cover,
   * which is the function itself not returning, and it resolves to null so the
   * page falls through to the same "we could not read this" rendering rather
   * than to an error boundary.
   */
  const [analytics, funnels, requests, demand, stages, lost] = await Promise.all([
    readAgentAnalytics(context).catch(() => null),
    /* J3: every published listing's week (not only the ten most recent), so
       the seven-day figures on the Space Analytics card can be true totals. */
    readFunnels(context.supabase, context.agent.id),
    readRequests(context.supabase, context.agent.id),
    readDemandBoard(4),
    readDeskStages(),
    readLostReasonsByArea(12),
  ]);

  /*
   * SPACE ANALYTICS (feature register J3, north star 16.6): the period, the
   * headline figure and one chart, then every counted figure as a row that
   * opens its own page. Built for every period on the server so a change of
   * period is instant on the phone. When the requests cannot be read the card
   * says so in its place rather than drawing zeroes.
   */
  const views = overviewViews(requests.state === "ok" ? requests : null, funnels, t, locale);
  const a = t.experienceFeatures.analytics;
  const hero = views ? (
    <RangeSwitch
      views={views}
      initial={parseRange(query.range)}
      periodLabel={a.period}
      caption={a.metrics.requests.title}
      rowsLabel={a.metricsTitle}
      testId="space-analytics"
    />
  ) : (
    <p
      className="rounded-[var(--nf-container-radius)] p-md text-[length:var(--nf-text-caption)] font-semibold leading-relaxed"
      style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
      role="status"
    >
      {a.requestsUnavailable}
    </p>
  );

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/analytics"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      <PageFrame title={t.agentAnalytics.title} subtitle={t.agentAnalytics.lede} fallback="/agent/dashboard" width="wide">
      <div>

      {analytics ? (
        <AnalyticsWorkspace
          t={t.agentAnalytics}
          /* The counted hours phrase already exists in all four languages on
             the bookings card. It is handed down rather than duplicated under
             a second key. */
          hours={{ one: t.agentBookings.card.hoursOne, other: t.agentBookings.card.hours }}
          statusLabels={t.agentListings.workspace.status}
          analytics={analytics}
          locale={locale}
          /* V-73: once the funnel is counting, the "views are not counted"
             line would be false, so it is replaced by what is counted. */
          {...(funnels.state === "ok" ? { viewsLine: t.shape.funnel.viewsCounted } : {})}
          hero={hero}
          absent={NOT_COUNTED.map((key) => a.absent[key])}
          funnels={
            funnels.state === "ok" ? <ListingWeeks listings={funnels.listings} t={t} locale={locale} /> : null
          }
        />
      ) : (
        <div className="space-y-lg">
          {/* The card has its own read, so it still answers when the rest of
              the page cannot. */}
          {hero}
          <p
            className="rounded-[var(--nf-container-radius)] p-md text-[length:var(--nf-text-body-sm)] font-semibold leading-relaxed"
            style={{
              background: "var(--nf-state-warning-surface)",
              color: "var(--nf-state-warning)",
            }}
            role="alert"
          >
            {t.agentAnalytics.unavailable}
          </p>
        </div>
      )}

      {/* V-10: what renters asked for and could not find, by neighbourhood. */}
      <DemandBoard rows={demand} copy={t.frontDoor.demand} locale={locale} listHref="/agent/list" />

      {/* V-72: the lister's enquiries by stage, and why enquiries are lost by area. */}
      <EnquiryFunnel counts={stages ? countByStage(stages.values()) : null} copy={t.frontDoor.desk} />
      <LostByAreaPanel areas={lost} copy={t.frontDoor.desk} />
      </div>
      </PageFrame>
    </AgentShell>
  );
}
