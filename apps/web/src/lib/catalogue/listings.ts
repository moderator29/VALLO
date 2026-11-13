import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getListingRepository } from "../listings/repository";
import { isListingReference } from "../listings/reference";
import { SupabaseListingRepository } from "../listings/supabase-repository";
import type { Listing, ListingRepository, ListingSearchFilter, ListingSearchOptions } from "../listings/types";
import type { Database } from "../supabase/database.types";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase/env";
import { CATALOGUE_LISTS_TAG, catalogueCached, listingTag } from "./cache";

/**
 * THE PUBLISHED LISTINGS, AS EVERY PAGE DRAWS THEM, FROM THE SHARED CACHE.
 *
 * The same interface as `getListingRepository()`, so a page swaps one call for
 * the other and nothing else changes. Use this one for what a PAGE DRAWS of the
 * public catalogue: search results, shelves, a listing's detail, similar
 * listings, the map. Keep `getListingRepository()` for a server action, a
 * booking, an offer or anything that acts on a price or an availability, which
 * must read the live row.
 *
 * WHY ONE ANSWER FITS EVERY READER. Each read here asks for `status =
 * 'PUBLISHED'` rows and only public columns. `listings_select_published`
 * shows those rows to `anon` and `authenticated` alike, and every other
 * listings policy only ADDS rows (an owner's drafts, an admin's queue) that
 * these reads exclude by their own filter. So the anonymous answer is the
 * member's answer, and it is read through a cookie-free anonymous client, which
 * makes "nothing private can be kept" a property of the database grants rather
 * than of this code.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function anonymousRepository(): SupabaseListingRepository {
  return new SupabaseListingRepository(
    async () =>
      createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    true,
  );
}

/** A stable key for a filter: the same search, asked with keys in any order, is one entry. */
export function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableKey(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

class CachedCatalogueReader implements ListingRepository {
  readonly isSeed = true;
  private readonly live = anonymousRepository();

  /* A failed read throws inside the cache (nothing is kept) and is answered
     here the way the platform repository always answered it: empty. */
  private async held<T>(key: string[], tags: string[], load: () => Promise<T>, empty: T): Promise<T> {
    try {
      return await catalogueCached(key, tags, load);
    } catch {
      return empty;
    }
  }

  search(filter: ListingSearchFilter = {}, opts: ListingSearchOptions = {}): Promise<Listing[]> {
    return this.held(
      ["search", stableKey(filter), stableKey(opts)],
      [CATALOGUE_LISTS_TAG],
      () => this.live.search(filter, opts),
      [] as Listing[],
    );
  }

  recommended(limit = 6): Promise<Listing[]> {
    return this.held(["recommended", String(limit)], [CATALOGUE_LISTS_TAG], () => this.live.recommended(limit), [] as Listing[]);
  }

  async byId(id: string): Promise<Listing | null> {
    if (!UUID_RE.test(id)) return null;
    return this.held(["by-id", id.toLowerCase()], [listingTag(id.toLowerCase())], () => this.live.byId(id), null);
  }

  async byReference(reference: string): Promise<Listing | null> {
    if (!isListingReference(reference)) return null;
    /* Keyed on the code, tagged with the lists tag: any listing change expires it. */
    return this.held(["by-reference", reference], [CATALOGUE_LISTS_TAG], () => this.live.byReference(reference), null);
  }
}

/**
 * The cached public reader, or the ordinary repository where there is nothing
 * to cache (no Supabase configured, or the platform API source).
 */
export function catalogueReader(): ListingRepository {
  if (process.env.NF_DATA_SOURCE === "api" || !isSupabaseConfigured()) return getListingRepository();
  return new CachedCatalogueReader();
}
