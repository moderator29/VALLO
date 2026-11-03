import { formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { fill } from "@/app/agent/_copy";
import type { ListingFunnelRead } from "@/app/agent/_intel/space-read";
import { stageOf } from "./space-model";
import { State } from "@/components/ui/State";

/**
 * EACH LISTING'S WEEK, ONE ROW EACH (D25: the per-listing funnel is an inner
 * page; the overview keeps only the door to it).
 *
 * This used to be the whole funnel for ten listings, a card of six rows and
 * a median column apiece, stacked down the analytics page: a wall. Now each
 * listing is one Plate row carrying the three stages a lister scans for
 * (seen, opened, enquired) and opening its week on its own page, where the
 * six stages, the comparison and the one fix have room to be read.
 *
 * Server-rendered; the rows are links, so they prefetch and open in a new
 * tab like any other.
 */
export function ListingWeeks({
  listings,
  t,
  locale,
}: {
  listings: readonly Pick<ListingFunnelRead, "id" | "title" | "funnel">[];
  t: Dictionary;
  locale: Locale;
}) {
  const copy = t.experienceFeatures.analytics.listings;
  return (
    <section className="nf-panel nf-panel--card block p-md sm:p-panel" data-testid="listing-weeks">
      <h2 className="nf-h3">{copy.title}</h2>
      <p className="nf-caption mt-2xs max-w-[68ch] text-[var(--nf-content-secondary)]">{copy.blurb}</p>
      {listings.length === 0 ? (
        <State compact kind="empty" icon="report-stats" title={t.shape.funnel.empty} className="mt-md" />
      ) : (
        <ListGroup className="mt-md">
          {listings.map((listing) => (
            <ListRow
              key={listing.id}
              title={listing.title}
              sub={
                <span className="nf-numeric">
                  {fill(copy.line, {
                    seen: formatNumber(stageOf(listing.funnel, "seen").mine, locale),
                    opened: formatNumber(stageOf(listing.funnel, "opened").mine, locale),
                    enquired: formatNumber(stageOf(listing.funnel, "enquired").mine, locale),
                  })}
                </span>
              }
              href={`/agent/analytics/listings/${listing.id}`}
              chevron
            />
          ))}
        </ListGroup>
      )}
      <p className="nf-caption mt-sm text-[var(--nf-content-muted)]">{t.shape.funnel.howCounted}</p>
    </section>
  );
}
