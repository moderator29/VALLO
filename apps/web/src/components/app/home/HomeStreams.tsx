import "server-only";

import type { Dictionary, Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { getListingRepository } from "@/lib/listings/repository";
import { isPropertyMarket, marketOf } from "@/lib/listings/market";
import { listSavedSearches } from "@/lib/saved/searches-queries";
import { filterFor } from "@/lib/saved/search-alerts";
import {
  BestMatchesAsk,
  BestMatchesNone,
  BestMatchesRow,
  NewListings,
  bestMatchRows,
} from "@/components/app/home/HomeLists";
import { hasSignals, pickBestMatches } from "@/components/app/home/best-matches";
import { newShelf } from "@/components/app/home/new-listings";

/**
 * THE TWO LISTS HOME STREAMS (13 October 2026).
 *
 * Both need reads the first paint should not wait for (the saved searches and
 * what the catalogue returns for them; the newest published rows), so the page
 * hands them to `Suspense` with a skeleton in each list's own shape and they
 * arrive when they arrive. Neither throws: a read that fails reduces to the
 * honest empty state, because Home is not worth taking down for a shelf.
 */

/** How many saved searches are asked of the catalogue. Three keeps the page's reads bounded. */
const SEARCHES_READ = 3;
/** Places one saved search may contribute. */
const PER_SEARCH = 8;
/** Rows read before the newest are picked, so a handful of examples cannot crowd them out. */
const NEW_READ = 24;
export const NEW_SHOWN = 6;

const isProperty = (listing: Listing) => isPropertyMarket(marketOf(listing));

export async function BestMatchesStream({
  t,
  locale,
  interests,
  pool,
  saved,
  onScreen,
}: {
  t: Dictionary;
  locale: Locale;
  /** What they said they came for (`profiles.interests`). */
  interests: readonly string[];
  /** The page's ranked candidates (Property market only). */
  pool: readonly Listing[];
  /** The listings on the person's shortlist. */
  saved: readonly Listing[];
  /** Ids drawn higher on the screen. */
  onScreen: ReadonlySet<string>;
}) {
  let searches: { label: string; listings: Listing[] }[] = [];
  try {
    const state = await listSavedSearches();
    if (state.state === "signed-in") {
      const repo = getListingRepository();
      searches = await Promise.all(
        state.searches.slice(0, SEARCHES_READ).map(async (search) => ({
          label: search.label,
          listings: (await repo.search(filterFor(search.params), { limit: PER_SEARCH })).filter(isProperty),
        })),
      );
    }
  } catch {
    searches = [];
  }

  const signals = { interests, searches: searches.map((s) => ({ ...s })), saved };
  const rows = bestMatchRows(pickBestMatches({ pool, ...signals, onScreen }), t, locale);
  return (
    <BestMatchesRow
      rows={rows}
      t={t}
      locale={locale}
      empty={hasSignals(signals) ? <BestMatchesNone t={t} /> : <BestMatchesAsk t={t} />}
    />
  );
}

export async function NewListingsStream({ t, locale }: { t: Dictionary; locale: Locale }) {
  let listings: Listing[] = [];
  try {
    /* Property and stays together: a real shortlet that just went live is as
       new as a flat. Real ones first (`newShelf`). */
    const rows = await getListingRepository().search({}, { limit: NEW_READ });
    listings = newShelf(rows, NEW_SHOWN, Date.now());
  } catch {
    listings = [];
  }
  return <NewListings listings={listings} t={t} locale={locale} />;
}
