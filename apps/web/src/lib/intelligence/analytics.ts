import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { reportReadFault } from "@/lib/observability/read-error";
import { faults, isNotLive } from "@/lib/features/degrade";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { IntelligenceKind, IntelligenceTab } from "./contract";
import { anonClient, type Viewer } from "./viewer";
import { cleanQuery, foldKey, hasLongDigitRun } from "./text";
import { PLACES } from "./places";

/**
 * VALLO INTELLIGENCE: WHAT IS KEPT ABOUT A SEARCH, AND WHAT IS READ BACK.
 *
 * Everything here talks to the pending SQL
 * (`supabase/migrations/pending/intelligence_search_2026-11-16.sql`) and
 * degrades to nothing until it is applied, the way `lib/features/degrade.ts`
 * says: no analytics, no staff aliases, no popular list, no server-side recent
 * searches. The search itself never waits on any of it.
 *
 *   search_event_record      one row per search or click: the normalised
 *                            words (dropped by the database when they carry a
 *                            long run of digits), the kind, the tab, the
 *                            result count, the time taken, the clicked kind
 *                            and a salted hash of the visit. No user id and no
 *                            address. Service role only, called after the
 *                            response (`after()`).
 *   search_aliases_active    the staff synonyms, read anonymously and cached.
 *   search_popular_queries   only queries at least three distinct visits
 *                            searched in 30 days (the privacy floor).
 *   search_recent_*          the member's own recent searches, through their
 *                            own session.
 */

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/** The privacy floor for anything aggregated from searches. Mirrors the SQL. */
export const POPULAR_FLOOR = 3;

/* --------------------------------------------------------------- events */

export type SearchEvent = {
  event: "search" | "click";
  query: string;
  kind?: IntelligenceKind;
  tab: IntelligenceTab;
  results?: number;
  tookMs?: number;
  place?: string;
  clickedKind?: IntelligenceKind;
  position?: number;
  /** An opaque visit key (the analytics cookie, or the member id); hashed by the database. */
  session: string | null;
};

/** The words as they may be stored: normalised, capped, never with a long digit run. */
export function storableQuery(query: string): string | null {
  const q = foldKey(cleanQuery(query));
  if (!q || hasLongDigitRun(q)) return null;
  return q.slice(0, 120);
}

export async function recordSearchEvent(e: SearchEvent): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const admin = createAdminClient() as unknown as Rpc;
    const { error } = await admin.rpc("search_event_record", {
      p_event: e.event,
      p_query: storableQuery(e.query),
      p_kind: e.kind ?? null,
      p_tab: e.tab,
      p_results: e.results ?? null,
      p_took_ms: e.tookMs ?? null,
      p_place: e.place && PLACES.some((p) => e.place!.startsWith(p.name)) ? e.place.slice(0, 80) : null,
      p_clicked_kind: e.clickedKind ?? null,
      p_position: e.position ?? null,
      p_session: e.session,
    });
    if (error && !isNotLive(error)) await reportReadFault("read.intelligence.event", ...faults(error));
  } catch {
    /* A lost analytics row is never worth a broken search. */
  }
}

/* --------------------------------------------------------------- aliases */

export type StaffAliases = { words: Record<string, string>; places: Record<string, string> };

const EMPTY_ALIASES: StaffAliases = { words: {}, places: {} };
let aliasCache: { at: number; value: StaffAliases } | null = null;
const ALIAS_TTL_MS = 5 * 60_000;

/** The live staff synonyms, cached for five minutes. Empty until the SQL is applied. */
export async function readStaffAliases(now = Date.now()): Promise<StaffAliases> {
  if (aliasCache && now - aliasCache.at < ALIAS_TTL_MS) return aliasCache.value;
  const db = anonClient() as unknown as Rpc | null;
  if (!db) return EMPTY_ALIASES;
  let value = EMPTY_ALIASES;
  try {
    const { data, error } = await db.rpc("search_aliases_active");
    if (error) {
      if (!isNotLive(error)) await reportReadFault("read.intelligence.aliases", ...faults(error));
    } else if (Array.isArray(data)) {
      value = { words: {}, places: {} };
      for (const row of data as { from_text?: unknown; to_text?: unknown; kind?: unknown }[]) {
        const from = typeof row.from_text === "string" ? foldKey(row.from_text) : "";
        const to = typeof row.to_text === "string" ? cleanQuery(row.to_text) : "";
        if (!from || !to || from.length > 60 || to.length > 60) continue;
        if (row.kind === "place") {
          /* A place alias may only point at a name on the closed list. */
          if (PLACES.some((p) => p.name.toLowerCase() === to.toLowerCase())) value.places[from] = to;
        } else if (row.kind === "word") {
          value.words[from] = foldKey(to);
        }
      }
    }
  } catch {
    /* No aliases is the honest answer to a read that failed. */
  }
  aliasCache = { at: now, value };
  return value;
}

/** For tests and for the admin desk after a change. */
export function forgetStaffAliases(): void {
  aliasCache = null;
}

/* --------------------------------------------------------------- popular */

let popularCache: { at: number; value: string[] } | null = null;
const POPULAR_TTL_MS = 10 * 60_000;

/** Queries above the privacy floor, most searched first. Empty until the SQL is applied. */
export async function readPopularQueries(limit = 8, now = Date.now()): Promise<string[]> {
  if (popularCache && now - popularCache.at < POPULAR_TTL_MS) return popularCache.value.slice(0, limit);
  const db = anonClient() as unknown as Rpc | null;
  if (!db) return [];
  let value: string[] = [];
  try {
    const { data, error } = await db.rpc("search_popular_queries", { p_days: 30, p_limit: 20 });
    if (error) {
      if (!isNotLive(error)) await reportReadFault("read.intelligence.popular", ...faults(error));
    } else if (Array.isArray(data)) {
      value = (data as { query?: unknown }[])
        .map((r) => (typeof r.query === "string" ? cleanQuery(r.query) : ""))
        .filter((q) => q.length > 0 && !hasLongDigitRun(q));
    }
  } catch {
    value = [];
  }
  popularCache = { at: now, value };
  return value.slice(0, limit);
}

/* --------------------------------------------------------------- recent */

export type RecentSearch = { query: string; at: string };

function own(viewer: Viewer): Rpc | null {
  return viewer.signedIn && viewer.db ? (viewer.db as unknown as Rpc) : null;
}

/** The member's own recent searches, newest first. Empty for a visitor or before the SQL. */
export async function readRecentSearches(viewer: Viewer, limit = 8): Promise<RecentSearch[]> {
  const db = own(viewer);
  if (!db) return [];
  try {
    const { data, error } = await (viewer.db as SupabaseClient)
      .from("search_recent")
      .select("query, searched_at")
      .order("searched_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (!isNotLive(error)) await reportReadFault("read.intelligence.recent", ...faults(error));
      return [];
    }
    return ((data ?? []) as { query: string; searched_at: string }[]).map((r) => ({ query: r.query, at: r.searched_at }));
  } catch {
    return [];
  }
}

/** Keep one search on the member's own list (the database keeps the newest 20). */
export async function rememberSearch(viewer: Viewer, query: string): Promise<void> {
  const db = own(viewer);
  const q = cleanQuery(query);
  if (!db || q.length < 2 || hasLongDigitRun(q)) return;
  try {
    const { error } = await db.rpc("search_recent_remember", { p_query: q });
    if (error && !isNotLive(error)) await reportReadFault("read.intelligence.recent", ...faults(error));
  } catch {
    /* A recent search is a convenience. */
  }
}

/** Forget one recent search, or all of them. True when the database said so. */
export async function forgetRecentSearches(viewer: Viewer, query: string | null): Promise<"ok" | "not-set-up" | "failed" | "signed-out"> {
  const db = own(viewer);
  if (!db) return "signed-out";
  try {
    const { error } = query === null
      ? await db.rpc("search_recent_clear")
      : await db.rpc("search_recent_forget", { p_query: cleanQuery(query) });
    if (!error) return "ok";
    if (isNotLive(error)) return "not-set-up";
    await reportReadFault("read.intelligence.recent", ...faults(error));
    return "failed";
  } catch {
    return "failed";
  }
}
