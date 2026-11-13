import type { Dictionary, Locale } from "@vallo/i18n/core";
import { forListingCard } from "@/lib/i18n/slice";
import { catalogueReader } from "@/lib/catalogue/listings";
import { isPropertyMarket, marketOf } from "@/lib/listings/market";
import type { Listing } from "@/lib/listings/types";
import { ListingCard } from "@/components/app/ListingCard";
import { FeaturedBand } from "@/components/app/home/FeaturedBand";

/**
 * MORE LIKE THIS, AT THE FOOT OF A LISTING.
 *
 * The one card (`ListingCard`, the same object home and search draw) on the
 * same sideways shelf home draws (`FeaturedBand`), so the last thing on a
 * listing is the next real listing rather than a dead end. Real rows only:
 * the catalogue's own search, same market, the same area first and the same
 * city when the area has too few, this listing left out. Nothing at all is
 * drawn when there is nothing to show, never an empty band.
 *
 * Streamed by the page inside a `Suspense` with no fallback, so its read never
 * holds the listing's first paint.
 */
export async function SimilarListings({
  listing,
  locale,
  t,
  savedIds,
  title,
  seeAllLabel,
}: {
  listing: Listing;
  locale: Locale;
  t: Dictionary;
  savedIds: ReadonlySet<string>;
  title: string;
  seeAllLabel: string;
}) {
  const repo = catalogueReader();
  const intent = listing.intent;
  const near = listing.area || listing.city;
  const keep = (rows: Listing[]) =>
    rows.filter((row) => row.id !== listing.id && isPropertyMarket(marketOf(row)));

  let rows: Listing[] = [];
  try {
    rows = keep(await repo.search({ intent, areas: [near], propertySide: true }, { limit: 8 }));
    if (rows.length < 2 && listing.city && listing.city !== near) {
      const wider = keep(await repo.search({ intent, areas: [listing.city], propertySide: true }, { limit: 8 }));
      const seen = new Set(rows.map((row) => row.id));
      rows = [...rows, ...wider.filter((row) => !seen.has(row.id))];
    }
  } catch {
    /* A failed read is an absent shelf, never an error on somebody's listing. */
    return null;
  }
  const shelf = rows.slice(0, 6);
  if (shelf.length === 0) return null;

  const market = intent === "sale" ? "buy" : "rent";
  const cardT = forListingCard(t);
  return (
    <FeaturedBand
      title={title}
      seeAllHref={`/search?q=${encodeURIComponent(near)}&market=${market}`}
      seeAllLabel={seeAllLabel}
      count={shelf.length}
      testId="similar-listings"
      empty={null}
    >
      {shelf.map((row, index) => (
        <li key={row.id} className="nf-feature-row__item">
          <ListingCard listing={row} locale={locale} t={cardT} index={index} saved={savedIds.has(row.id)} />
        </li>
      ))}
    </FeaturedBand>
  );
}
