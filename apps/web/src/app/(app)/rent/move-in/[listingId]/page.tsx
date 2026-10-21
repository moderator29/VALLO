import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, plural, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getListingRepository } from "@/lib/listings/repository";
import { readOpenInspectionFor } from "@/lib/inspections/queries";
import { inspectionAccepted } from "@/lib/rent/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { MoveInLedger } from "./MoveInLedger";
import { areaComparison, isTenancy, ledgerLines } from "./ledger-model";
import { unexplainedRemainder } from "@/lib/rent/ledger";
import { RequestInspection } from "@/components/app/inspections/RequestInspection";
import { ButtonLink } from "@/components/ui/Button";
import { AuthGate } from "@/components/auth/AuthGate";
import { EmptyState } from "@/components/app/Screen";
import "@/app/css/catalogue.css";

export const metadata: Metadata = {
  title: "Move-in cost",
  robots: { index: false, follow: false },
};

/**
 * The move-in ledger, to 9F384CFE.
 *
 * The listing summary, every cost the agent named as its own row, the total
 * (stated by the agent, or the sum of the named parts marked as such), an
 * area comparison ONLY when enough other rentals in the same area carry a
 * rent to average, and the one real next step: pay the rent once an
 * inspection has been accepted, and until then, request the inspection.
 */
export default async function MoveInPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.catalogue.ledger;

  const repo = getListingRepository();
  const listing = await repo.byId(listingId);
  if (!listing) notFound();

  if (!isTenancy(listing)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={copy.title} fallback={`/listing/${listing.id}`} />
        <EmptyState
          icon="ledger-book"
          art="boxes"
          title={copy.notRental}
          body={listing.title}
          action={
            <ButtonLink href={`/listing/${listing.id}`} variant="primary">
              {t.common.back}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const [peers, inspection] = await Promise.all([
    repo.search({ kind: listing.kind, q: listing.city }),
    listing.isDemo ? Promise.resolve(null) : readOpenInspectionFor(listing.id),
  ]);

  const named = ledgerLines(listing, t, locale);
  const stated = listing.moveInCostStated === true && (listing.moveInCostMinor ?? 0) > 0;
  const total = stated ? listing.moveInCostMinor! : named.reduce((sum, line) => sum + line.minor, 0);
  /* V-13. What the stated total asks for beyond the rows above it is a row
     of its own, in words, so the gap is never folded silently into the sum. */
  const remainder = unexplainedRemainder(total, named.map((line) => line.minor), stated);
  const lines =
    remainder > 0
      ? [
          ...named,
          {
            key: "remainder",
            icon: "info" as const,
            label: t.afterTheGate.remainder.line,
            hint: t.afterTheGate.remainder.note,
            minor: remainder,
          },
        ]
      : named;
  const comparison = areaComparison(listing, peers);

  /* The one real path. An accepted inspection (lib/rent's own rule) opens
     the rent payment step at /rent/pay/<inspectionId>; anything before that
     is the inspection request itself, the same control the listing carries. */
  const payHref =
    inspection && inspectionAccepted(inspection.state, inspection.outcome ?? null)
      ? `/rent/pay/${inspection.id}`
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={copy.title}
        subtitle={copy.lede}
        fallback={`/listing/${listing.id}`}
        actions={listing.verified ? <span className="nf-detail-verified">{copy.verified}</span> : undefined}
      />

      <MoveInLedger
        listing={listing}
        lines={lines}
        totalMinor={total}
        stated={stated}
        comparison={comparison}
        locale={locale}
        t={t}
        proceed={
          listing.isDemo ? (
            <ButtonLink
              href={`/search?q=${encodeURIComponent(listing.area || listing.city)}`}
              variant="primary"
              full
              size="lg"
            >
              {t.experienceMoney.ledger.similar}
            </ButtonLink>
          ) : payHref ? (
            <AuthGate action="pay">
              <ButtonLink href={payHref} variant="primary" full size="lg" trailingIcon="arrow-right" data-testid="ledger-pay">
                {copy.proceedPay}
              </ButtonLink>
            </AuthGate>
          ) : (
            <div data-testid="ledger-inspect">
              <RequestInspection listingId={listing.id} existing={inspection} locale={locale} copy={t.visit.entry} zone={t.visit.tiles.lagos} />
              <p className="nf-caption mt-row text-center text-[var(--nf-content-muted)]">{copy.inspectFirst}</p>
            </div>
          )
        }
      />

      <p className="nf-caption mt-block text-center text-[var(--nf-content-muted)]">
        <Link href={`/listing/${listing.id}`} className="nf-link-quiet nf-tap text-[var(--nf-content-link)]">
          {t.common.back}
        </Link>
        {" · "}
        {plural(lines.length, t.units.lines, locale)}
      </p>
    </div>
  );
}
