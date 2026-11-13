import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { deadlineFetch } from "@/lib/supabase/deadline-fetch";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { StatsFigures } from "./format";

/**
 * LISTING STATS, THE READS (founder, 13 November 2026).
 *
 * The listing page's two numbers come from `public.listing_public_stats`, one
 * primary-key read of `public.listing_counters` (pending migration
 * `listing_stats_2026-11-13.sql`). It is read through a cookie-free anonymous
 * client, because the figures are the same for every visitor, and held per
 * instance for a minute, so a busy listing costs one database read a minute
 * per instance and never one per visit. The row is drawn inside its own
 * Suspense boundary, so this read never holds the page.
 *
 * FAIL CLOSED AND QUIET. Until the SQL is applied the function does not exist,
 * the call errors, this returns null and the page draws no row and no error.
 * A read past its deadline (2.5 s) is the same null. A failure is held for a
 * shorter time than a figure, so the row returns soon after the SQL lands.
 */

export const STATS_TTL_MS = 60_000;
const FAILURE_TTL_MS = 20_000;
const HELD_MAX = 2_000;
const READ_DEADLINE_MS = 2_500;

type Held = { value: StatsFigures | null; expires: number };
const held = new Map<string, Held>();

/** A loose RPC surface: the pending functions are not in the generated types yet. */
type Rpc = {
  rpc: (fn: string, args?: object) => PromiseLike<{ data: unknown; error: unknown }>;
};

let anonymous: Rpc | null = null;
function anonymousClient(): Rpc {
  anonymous ??= createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: deadlineFetch({ ms: READ_DEADLINE_MS }) },
  }) as unknown as Rpc;
  return anonymous;
}

function whole(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** One row of `listing_public_stats` or `my_listing_stats` into figures, or null when it is not a true row. */
export function figuresFrom(row: unknown): StatsFigures | null {
  if (!row || typeof row !== "object") return null;
  const r = row as { views?: unknown; saves?: unknown };
  const views = whole(r.views);
  const saves = whole(r.saves);
  return views === null || saves === null ? null : { views, saves };
}

/** The uncached read, given a client. Exported for tests. */
export async function fetchListingStats(client: Rpc, listingId: string): Promise<StatsFigures | null> {
  try {
    const { data, error } = await client.rpc("listing_public_stats", { p_listing: listingId });
    if (error || !Array.isArray(data) || data.length !== 1) return null;
    return figuresFrom(data[0]);
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page's figures for one live, real listing, or null (draw no row). Never throws. */
export async function readListingStats(listingId: string, now: number = Date.now()): Promise<StatsFigures | null> {
  if (!UUID.test(listingId) || !isSupabaseConfigured() || process.env.NF_DATA_SOURCE === "api") return null;
  const hit = held.get(listingId);
  if (hit && hit.expires > now) return hit.value;
  const value = await fetchListingStats(anonymousClient(), listingId);
  if (held.size >= HELD_MAX) {
    for (const [key, entry] of held) if (entry.expires <= now || held.size >= HELD_MAX) held.delete(key);
  }
  held.set(listingId, { value, expires: now + (value ? STATS_TTL_MS : FAILURE_TTL_MS) });
  return value;
}

/** For tests. */
export function clearListingStats(): void {
  held.clear();
  anonymous = null;
}

/**
 * The signed-in lister's own figures, keyed by listing id, through their own
 * session (`my_listing_stats` answers only `auth.uid()`'s listings). Null when
 * the read failed or the SQL is not applied: the rows then draw no figures.
 */
export async function readMyListingStats(client: SupabaseClient | Rpc): Promise<Record<string, StatsFigures> | null> {
  try {
    const { data, error } = await (client as unknown as Rpc).rpc("my_listing_stats");
    if (error || !Array.isArray(data)) return null;
    const out: Record<string, StatsFigures> = {};
    for (const row of data as { listing_id?: unknown }[]) {
      const figures = figuresFrom(row);
      if (figures && typeof row.listing_id === "string") out[row.listing_id] = figures;
    }
    return out;
  } catch {
    return null;
  }
}
