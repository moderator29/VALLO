import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "@/lib/listings/types";
import { readIntentTuning } from "@/lib/interests/queries";
import { SAVED_SEARCH_COLUMNS, type SavedSearchRow } from "@/lib/saved/searches-db";
import { toSavedSearchView } from "@/lib/saved/searches-queries";
import { savedSearchSignal } from "@/lib/search/saved-search-signal";
import type { SavedSearchSignal } from "@/lib/search/best-matches";
import type { ForYouRail, IntelligenceKind } from "./contract";
import type { RecentSearch } from "./analytics";
import { forYouPicks, LISTING_SIDES, type Side } from "./recommend";
import { catalogueMatches, listingResult, sideOf } from "./sources/listings";
import { understand } from "./understand";
import type { Viewer } from "./viewer";

/**
 * "FOR YOU" ON THE EMPTY SCREEN: THE MEMBER'S OWN SIGNALS, THEIR OWN SESSION.
 *
 * Every read here goes through the member's own RLS-bound client and names
 * their own id (the same rule `sources/personal.ts` keeps): their saved homes
 * (`saved_items`), their saved searches (`saved_searches`), the kinds they said
 * they came for (`readIntentTuning`, their own profile row) and their newest
 * search (`search_recent`, already read by the caller). Never the service key.
 *
 * Each read that fails is simply a signal not had: the rail it fed is left
 * out, and the screen is complete without it. A visitor gets nothing.
 */

const SAVED_MAX = 50;
const SEARCHES_MAX = 10;

async function savedIds(db: SupabaseClient, me: string): Promise<string[]> {
  const { data, error } = await db.from("saved_items").select("listing_id").eq("user_id", me).order("created_at", { ascending: false }).limit(SAVED_MAX);
  if (error) throw error;
  return ((data ?? []) as { listing_id: string | null }[]).map((r) => r.listing_id).filter((id): id is string => Boolean(id));
}

async function savedSearches(db: SupabaseClient, me: string): Promise<SavedSearchSignal[]> {
  const { data, error } = await db.from("saved_searches").select(SAVED_SEARCH_COLUMNS).eq("user_id", me).order("created_at", { ascending: false }).limit(SEARCHES_MAX);
  if (error) throw error;
  return ((data ?? []) as unknown as SavedSearchRow[]).map((row) => savedSearchSignal(toSavedSearchView(row).params));
}

/** What the member's newest search finds in the catalogue today, or null when it was not about places. */
async function lastSearchRows(query: string, now: Date): Promise<Listing[] | null> {
  const { understood } = understand(query, { now });
  const kind: IntelligenceKind | undefined = understood.kind;
  if (kind !== undefined && !(LISTING_SIDES as readonly string[]).includes(kind)) return null;
  const side: Side = (kind as Side | undefined) ?? "property";
  const { rows } = await catalogueMatches(understood, side);
  return rows;
}

export async function readForYou(viewer: Viewer, catalogue: readonly Listing[], recent: readonly RecentSearch[], now: Date): Promise<ForYouRail[]> {
  const db = viewer.signedIn ? viewer.db : null;
  const me = viewer.userId;
  if (!db || !me) return [];
  const last = recent[0];
  const [ids, searches, tuning, rows] = await Promise.all([
    savedIds(db, me).catch(() => [] as string[]),
    savedSearches(db, me).catch(() => [] as SavedSearchSignal[]),
    readIntentTuning().catch(() => ({ signedIn: false, interests: [] as string[] })),
    last ? lastSearchRows(last.query, now).catch(() => null) : Promise.resolve(null),
  ]);
  const byId = new Map(catalogue.map((l) => [l.id, l] as const));
  const savedHomes = ids
    .map((id) => byId.get(id))
    .filter((l): l is Listing => Boolean(l))
    .map((l) => ({ id: l.id, area: l.area, city: l.city }));
  /* Saved homes no longer published still keep themselves out of the rails. */
  const gone = ids.filter((id) => !byId.has(id)).map((id) => ({ id, area: "", city: "" }));
  const rails = forYouPicks({
    catalogue,
    signals: { savedSearches: searches, savedHomes: [...savedHomes, ...gone], interests: tuning.interests, recentPlaces: [] },
    lastSearch: last && rows ? { query: last.query, at: last.at, rows } : undefined,
  });
  return rails.map((rail) => ({
    ...rail,
    items: rail.items.map(({ listing, reason }) => ({ result: listingResult(listing, { raw: "", via: "rules" }, viewer, sideOf(listing)), reason })),
  }));
}
