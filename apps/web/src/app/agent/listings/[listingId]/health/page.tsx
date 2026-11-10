import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HealthReport } from "@/components/agent/intel/HealthReport";
import { listingHealth } from "@/components/agent/intel/health-model";
import { ListingPitch } from "../../../list/ListingPitch";
import { readListingHealth } from "../../../_intel/health-read";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.experienceFeatures.health.title, robots: { index: false, follow: false } };
}

/**
 * `/agent/listings/<id>/health`: LISTING HEALTH (feature register J4; D25).
 *
 * One question, answered completely: what does this listing's record hold,
 * what is it missing, and what can the lister do about it today. The six
 * explanations are rows in a fixed order, each naming what is present (with
 * its date where the record has one: a fact is a date, never a tick) or
 * missing; the recommendations are only those a rule the platform already
 * enforces asks for (`health-model.ts` names every rule). There is no score:
 * nothing computes one, and inventing a weighting here would be deciding a
 * business rule on a presentation layer.
 *
 * States, each in this page's own words inside the workspace shell: the
 * pitch (not a lister), not theirs or gone, an example (never measured), a
 * failed read, and the health. "Not theirs" and "gone" read the same, so the
 * page never confirms a listing it will not show.
 */
export default async function ListingHealthPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const h = t.experienceFeatures.health;
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  const read = await readListingHealth(context.supabase, context.agent.id, listingId);
  const profile = agentProfileFrom(context.agent);

  if (read.state !== "ok") {
    const words = read.state === "missing" ? h.missing : read.state === "example" ? h.example : h.unavailable;
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={profile} chromeBack={false}>
        {/* The frame's header carries the one way back, to My listings, where
            the text link above the title used to. */}
        <PageFrame title={h.title} fallback="/agent/listings">
        <div>
          <EmptyState
            icon="doc-review"
            title={read.state === "example" ? read.title : h.title}
            body={words}
            action={
              <ButtonLink href="/agent/listings" variant="secondary">
                {t.agent.nav.myListings}
              </ButtonLink>
            }
            data-testid="health-state"
          />
        </div>
        </PageFrame>
      </AgentShell>
    );
  }

  const health = listingHealth(read.facts);
  const live = read.status === "PUBLISHED";

  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={profile} chromeBack={false}>
      <PageFrame title={h.title} subtitle={read.title} fallback="/agent/listings">
      <div data-testid="listing-health">
        <p className="max-w-[62ch] text-[var(--nf-content-secondary)]">{h.lede}</p>

        <HealthReport health={health} listingId={read.id} t={t} locale={locale} />

        {live ? (
          <div className="mt-lg">
            <ButtonLink href={`/agent/analytics/listings/${read.id}`} variant="secondary" arrow>
              {t.experienceFeatures.analytics.week.title}
            </ButtonLink>
          </div>
        ) : null}
      </div>
      </PageFrame>
    </AgentShell>
  );
}

