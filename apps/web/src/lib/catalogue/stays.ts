import "server-only";

import { cache } from "react";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase/env";
import type { StaysClient } from "../stays/db";
import {
  getRestaurantDetail,
  getStayDetail,
  listRestaurantRows,
  listStaysShelf,
  restaurantCardsFrom,
  type RestaurantRows,
} from "../stays/queries";
import { openState } from "../stays/hours";
import { businessCoverPairs } from "../stays/business-photos";
import { PAGE_SIZE } from "../stays/filters";
import type { RestaurantCard, RestaurantDetail, StayDetail, StaySearchRow } from "../stays/types";
import { CATALOGUE_LISTS_TAG, catalogueCached, stayTag, venueTag } from "./cache";
import { stableKey } from "./listings";

/**
 * STAYS AND RESTAURANTS, AS THE PUBLIC PAGES DRAW THEM, FROM THE SHARED CACHE.
 *
 * The same rule as `./listings.ts`: only what a stranger may read, read through
 * a cookie-free anonymous client, so the database's `anon` grants decide what
 * can be kept (no address, no phone, no email). A failed read is never kept.
 *
 * Two things are NOT cached, on purpose:
 *   - The clock. A restaurant's open-now line is worked out on every request
 *     from the kept service windows, so "Open now" is never an hour old.
 *   - Checkout. `/checkout` keeps the live `getStayDetail`, because it takes a
 *     payment at the rate it shows.
 *
 * A stay or venue that the anonymous read cannot see (an unpublished one,
 * opened by its own host to preview it) falls back to the live read through
 * the request's own client, exactly as before, so a host still sees their own.
 */

function anonymousClient(): StaysClient {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as StaysClient;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function held<T>(key: string[], tags: string[], load: () => Promise<T>): Promise<T | undefined> {
  try {
    return await catalogueCached(key, tags, load);
  } catch {
    return undefined;
  }
}

/** One stay's detail, once per request, from the shared cache. */
export const publicStayDetail = cache(async (id: string): Promise<StayDetail | null> => {
  if (!isSupabaseConfigured() || !UUID_RE.test(id)) return getStayDetail(id);
  const key = id.toLowerCase();
  const kept = await held(["stay", key], [stayTag(key)], () => getStayDetail(id, { client: anonymousClient(), strict: true }));
  /* Not visible to a stranger, or the read failed: the live read decides. */
  return kept ?? getStayDetail(id);
});

/** One venue's detail, once per request, with open-now on this request's clock. */
export const publicRestaurantDetail = cache(async (id: string): Promise<RestaurantDetail | null> => {
  if (!isSupabaseConfigured() || !UUID_RE.test(id)) return getRestaurantDetail(id);
  const key = id.toLowerCase();
  const kept = await held(["venue", key], [venueTag(key)], () =>
    getRestaurantDetail(id, new Date(), { client: anonymousClient(), strict: true }),
  );
  if (!kept) return getRestaurantDetail(id);
  const state = openState(kept.windows, new Date());
  return { ...kept, open_now: state.open_now, hours: state.hours };
});

/** The stays shelf (`stays_search`), from the shared cache. */
export async function publicStaysShelf(
  scope: { stateCode?: string; city?: string } = {},
  limit = PAGE_SIZE,
): Promise<StaySearchRow[]> {
  if (!isSupabaseConfigured()) return [];
  const kept = await held(["stays-shelf", stableKey(scope), String(limit)], [CATALOGUE_LISTS_TAG], () =>
    listStaysShelf(scope, limit, { client: anonymousClient(), strict: true }),
  );
  return kept ?? listStaysShelf(scope, limit);
}

/** Published restaurants, from the shared cache, with open-now on this request's clock. */
export async function publicRestaurants(
  scope: { stateCode?: string; city?: string; openNow?: boolean } = {},
  limit = PAGE_SIZE,
): Promise<RestaurantCard[]> {
  if (!isSupabaseConfigured()) return [];
  const where = { stateCode: scope.stateCode, city: scope.city };
  const rows: RestaurantRows[] | undefined = await held(["restaurants", stableKey(where), String(limit)], [CATALOGUE_LISTS_TAG], () =>
    listRestaurantRows(where, limit, { client: anonymousClient(), strict: true }),
  );
  return restaurantCardsFrom(rows ?? (await listRestaurantRows(where, limit)), new Date(), scope.openNow === true);
}

/** The venues' cover photographs (public bucket URLs), from the shared cache. */
export async function publicBusinessCovers(businessIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(businessIds)].sort();
  if (!isSupabaseConfigured() || ids.length === 0) return new Map();
  const kept = await held(["covers", stableKey(ids)], [CATALOGUE_LISTS_TAG], () =>
    businessCoverPairs(ids, { client: anonymousClient() as unknown as SupabaseClient<Database>, strict: true }),
  );
  return new Map(kept ?? (await businessCoverPairs(ids)));
}
