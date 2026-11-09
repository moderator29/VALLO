import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { PromotionPurchase } from "@/components/promotion/PromotionPurchase";
import { PromotionResults } from "@/components/promotion/PromotionResults";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { measurementRows, sourceSplit } from "@/lib/promotion/measurement";
import { readListingMeasurement } from "@/lib/promotion/measurement-read";
import { readFrontDoorDays } from "@/lib/promotion/inventory-read";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { ListingPitch } from "../../../list/ListingPitch";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.experienceFeatures.promotion.measure.title, robots: { index: false, follow: false } };
}

/**
 * `/agent/listings/<id>/promotion`: A LISTING'S PROMOTION RESULTS (D3, D60;
 * `VALLO_PROMOTION.md`, "The measurement surface"; F4's ten figures).
 *
 * LINKED, AND SELLING NOTHING. It was linked from nowhere and the founder could
 * not find it; it now opens from the Promote action on a live listing's row
 * and from `/agent/promotion` (the rail's and the dashboard's door), both
 * through `lib/promotion/links.ts`. Promotion still cannot be sold until the
 * company payment account exists (D38), and Session 2's inventory and
 * purchase do not exist, so buying says so. What this page CAN show is real:
 * the listing's own last thirty days, read through the lister's own client
 * (`readListingMeasurement`), labelled as what it did without promotion. A
 * figure the lister cannot read reads "No data" with its reason, never a
 * zero (`lib/promotion/measurement.test.ts`). The split by where an
 * impression was served is not recorded yet, and the page says so.
 *
 * Then the tiers by reach with price, days and naira a day, the published
 * front door count, and no pay button (`PromotionPurchase`).
 *
 * It never says what a promotion "will get you": no projection, average or
 * "listings like yours" figure is computed anywhere, so none can be printed.
 * The first visit shows promotion's first run once (`gateFirstRun`), carrying
 * this page as `next`, so the run's third screen reads this listing.
 */
export default async function PromotionResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ listingId }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = getDictionary(locale);
  const p = t.experienceFeatures.promotion;
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
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

  await gateFirstRun("promotion", `/agent/listings/${encodeURIComponent(listingId)}/promotion`, query);
  const [read, days] = await Promise.all([
    readListingMeasurement(context.supabase, context.agent.id, listingId),
    readFrontDoorDays(listingId),
  ]);
  const measurement = read.state === "ok" ? read.measurement : null;
  const blocked = read.state === "missing" ? p.measure.missing : read.state === "example" ? p.measure.example : read.state === "unavailable" ? p.measure.unavailable : null;

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/listings"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      <PageFrame title={p.measure.title} subtitle={p.measure.lede} fallback="/agent/listings">
      <div className="flex flex-col gap-group" data-testid="promotion-page">
        {blocked ? (
          <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status">
            {blocked}
          </p>
        ) : (
          <PromotionResults
            rows={measurementRows(measurement)}
            split={sourceSplit(measurement)}
            notice={{ title: p.measure.baselineTitle, body: p.measure.baselineBody }}
            copy={p}
            locale={locale}
          />
        )}
        {read.state === "ok" ? <PromotionPurchase days={days} copy={p} locale={locale} /> : null}
        <div>
          <ButtonLink href="/agent/listings" variant="secondary">
            {p.measure.back}
          </ButtonLink>
        </div>
      </div>
      </PageFrame>
    </AgentShell>
  );
}
