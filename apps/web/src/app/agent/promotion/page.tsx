import type { Metadata } from "next";
import { formatDate, formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { agentProfileFrom, getAgentContext, readMyListings } from "@/lib/agent/listings-queries";
import { PROMOTION_NOT_ON_SALE } from "@/lib/money/copy";
import { PROMOTION_HUB_HREF, canPromote, promotionHref } from "@/lib/promotion/links";
import { firstRunPath } from "@/components/app/feature-onboarding/first-runs";
import { readMyPromotionPurchases } from "@/lib/promotion/my-purchases-read";
import { purchasePhase } from "@/lib/promotion/my-purchases";
import { ListingPitch } from "../list/ListingPitch";
import { requestNow } from "@/lib/format/when";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.experienceFeatures.promotion.hub.title, robots: { index: false, follow: false } };
}

/**
 * `/agent/promotion`: THE WORKSPACE'S DOOR INTO PAID PROMOTION (D60).
 *
 * The promotion screen is per listing (`/agent/listings/<id>/promotion`), so
 * a row in the rail needs somewhere to land that is not one listing: this
 * page. It lists the lister's LIVE listings, read through their own RLS-bound
 * client, each opening that listing's promotion screen, and one row to how
 * promotion works (its first run, which returns here).
 *
 * WHAT IT NEVER DOES. It sells nothing and shows no figure: buying is not open
 * until payments for promotion are live, and it says so in the money sentence
 * `PROMOTION_NOT_ON_SALE` from `lib/money/copy.ts`. A draft or a listing in
 * review is not listed, because nothing a renter can see means nothing to
 * promote; with no live listing the page says that and offers the listings.
 */
export default async function PromotionHubPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const p = t.experienceFeatures.promotion;
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active={PROMOTION_HUB_HREF} profile={null}>
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

  const [listings, purchases] = await Promise.all([
    readMyListings(context.supabase, context.agent.id),
    // What this lister has already paid for, from their own rows only.
    readMyPromotionPurchases(context.supabase),
  ]);
  const live = (listings ?? []).filter(canPromote);
  const now = requestNow();
  const howHref = `${firstRunPath("promotion")}?next=${encodeURIComponent(PROMOTION_HUB_HREF)}`;

  return (
    <AgentShell t={t} locale={locale} active={PROMOTION_HUB_HREF} profile={agentProfileFrom(context.agent)}>
      <div className="mx-auto flex max-w-2xl flex-col gap-group py-lg" data-testid="promotion-hub">
        <div>
          <h1 className="nf-h2">{p.hub.title}</h1>
          <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{p.hub.lede}</p>
        </div>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="note" data-testid="promotion-hub-not-on-sale">
          {PROMOTION_NOT_ON_SALE}
        </p>

        {listings === null ? (
          <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status">
            {p.hub.unavailable}
          </p>
        ) : live.length === 0 ? (
          <EmptyState
            icon="doc-home"
            title={p.hub.emptyTitle}
            body={p.hub.emptyBody}
            action={
              <ButtonLink href="/agent/listings" variant="secondary" size="lg">
                {p.hub.emptyAction}
              </ButtonLink>
            }
            data-testid="promotion-hub-empty"
          />
        ) : (
          <ListGroup label={p.hub.listLabel} labelAs="h2">
            {live.map((listing) => (
              <ListRow
                key={listing.id}
                href={promotionHref(listing.id)}
                leading={
                  <IconPlate size="sm" shape="round" tone="brand">
                    <UiIcon name="trending-up" size={20} />
                  </IconPlate>
                }
                title={<span className="line-clamp-2 [overflow-wrap:anywhere]">{listing.title}</span>}
                sub={[listing.area, listing.city].filter(Boolean).join(", ") || undefined}
                value={p.promote}
                chevron
                data-testid="promotion-hub-listing"
              />
            ))}
          </ListGroup>
        )}

        {purchases === null ? (
          <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status">
            {t.adminCoverage.promotionPurchases.unavailable}
          </p>
        ) : purchases.length > 0 ? (
          <ListGroup label={t.adminCoverage.promotionPurchases.title} labelAs="h2">
            {purchases.map((purchase) => {
              const pp = t.adminCoverage.promotionPurchases;
              const phase = purchasePhase(purchase, now);
              const day = (iso: string) =>
                formatDate(new Date(iso), locale, { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });
              const title = (listings ?? []).find((l) => l.id === purchase.listingId)?.title ?? pp.listing;
              const statusWords = pp.status as Record<string, string | undefined>;
              return (
                <ListRow
                  key={purchase.id}
                  title={<span className="line-clamp-2 [overflow-wrap:anywhere]">{title}</span>}
                  sub={[
                    p.tiers[purchase.tier].name,
                    purchase.startsAt && purchase.endsAt
                      ? pp.runsRange.replace("{from}", day(purchase.startsAt)).replace("{to}", day(purchase.endsAt))
                      : pp.notStarted,
                  ].join(" · ")}
                  value={formatMoney(purchase.amountMinor, locale, purchase.currency)}
                  status={
                    <span className="nf-caption">
                      {phase === "running" ? pp.running : phase === "finished" ? pp.finished : (statusWords[purchase.status] ?? purchase.status)}
                    </span>
                  }
                  data-testid="promotion-purchase"
                />
              );
            })}
          </ListGroup>
        ) : null}

        <ListGroup>
          <ListRow
            href={howHref}
            leading={
              <IconPlate size="sm">
                <UiIcon name="info" size={20} />
              </IconPlate>
            }
            title={p.hub.how}
            sub={p.hub.howSub}
            chevron
            data-testid="promotion-hub-how"
          />
        </ListGroup>
      </div>
    </AgentShell>
  );
}
