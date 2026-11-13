import "server-only";

import { UNAVAILABLE, adminReader, type Read } from "./shared";
import { isMissingFunction } from "@/lib/listings/stats/record";
import {
  dayRows,
  totalsOf,
  weekly,
  rankedRows,
  RANGE_DAYS,
  type DayFigures,
  type RankedGroup,
  type RankedRow,
  type StatsRange,
} from "./listing-stats-model";

/**
 * THE LISTINGS DESK'S READS (Analytics > Listings, founder, 13 November 2026).
 *
 * Everything comes from SQL functions over the daily rollup
 * (`public.listing_daily_stats`) and the lifetime counters, never from a scan
 * of saved_items, conversations or inspection_requests per request (pending
 * migration `listing_stats_2026-11-13.sql`). The functions answer only an
 * admin or super admin with a proved security key, a staff member with the
 * read-only analyst scope, or the service role the console hands a scoped
 * staff member after `requireAdmin("analyst")` proved the scope; anybody else
 * gets no rows.
 *
 * THREE HONEST STATES. `ok` with figures; `missing` while the pending SQL is
 * not applied (the desk says the stats are not switched on yet, never zeros);
 * `unavailable` when a read failed.
 */

export type { DayFigures, RankedGroup, RankedRow, StatsRange };
export type StatsRead<T> = Read<T> | { state: "missing" };
const MISSING = { state: "missing" } as const;

type Rpc = { rpc: (fn: string, args: object) => PromiseLike<{ data: unknown; error: unknown }> };

function n(value: unknown): number {
  const v = typeof value === "string" ? Number(value) : value;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

async function call(db: Rpc, fn: string, args: object): Promise<{ data: unknown } | "missing" | null> {
  try {
    const { data, error } = await db.rpc(fn, args);
    if (error) return isMissingFunction(error) ? "missing" : null;
    return { data };
  } catch {
    return null;
  }
}

async function reader(): Promise<Rpc | null> {
  return (await adminReader("analyst")) as unknown as Rpc | null;
}

/**
 * The window's days and the window before it (for the change), one read:
 * `2n` days, split here. Optionally for one listing.
 */
export async function getListingStatsDays(
  range: StatsRange,
  listingId: string | null = null,
): Promise<StatsRead<{ current: DayFigures[]; previous: DayFigures[] }>> {
  const db = await reader();
  if (!db) return UNAVAILABLE;
  const days = RANGE_DAYS[range];
  const got = await call(db, "admin_listing_stats_daily", { p_days: days * 2, p_listing: listingId });
  if (got === "missing") return MISSING;
  if (!got) return UNAVAILABLE;
  const rows = dayRows(got.data);
  if (rows.length !== days * 2) return UNAVAILABLE;
  return { state: "ok", data: { previous: rows.slice(0, days), current: rows.slice(days) } };
}

/** The window grouped by listing, area or lister, ordered by views or saves. */
export async function getListingStatsRanked(
  range: StatsRange,
  group: RankedGroup,
  order: "views" | "saves",
  limit = 10,
): Promise<StatsRead<RankedRow[]>> {
  const db = await reader();
  if (!db) return UNAVAILABLE;
  const got = await call(db, "admin_listing_stats_ranked", {
    p_days: RANGE_DAYS[range],
    p_group: group,
    p_order: order,
    p_limit: limit,
  });
  if (got === "missing") return MISSING;
  if (!got) return UNAVAILABLE;
  return { state: "ok", data: rankedRows(got.data) };
}

export type ListingHead = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  status: string;
  isDemo: boolean;
  publishedAt: string | null;
  lister: string | null;
  views: number;
  saves: number;
};

/** One listing's head and lifetime figures, for its detail page. */
export async function getListingStatsHead(listingId: string): Promise<StatsRead<ListingHead | null>> {
  const db = await reader();
  if (!db) return UNAVAILABLE;
  try {
    const client = db as unknown as {
      from: (table: string) => {
        select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
      };
    };
    const [head, life] = await Promise.all([
      client
        .from("listings")
        .select("id, title, area, city, status, is_demo, published_at, agents!listings_agent_id_fkey(display_name)")
        .eq("id", listingId)
        .maybeSingle(),
      call(db, "admin_listing_stats_lifetime", { p_listing: listingId }),
    ]);
    if (life === "missing") return MISSING;
    if (head.error || !life) return UNAVAILABLE;
    const row = head.data as {
      id: string;
      title: string;
      area: string | null;
      city: string | null;
      status: string;
      is_demo: boolean;
      published_at: string | null;
      agents: { display_name: string | null } | { display_name: string | null }[] | null;
    } | null;
    if (!row) return { state: "ok", data: null };
    const lifetime = Array.isArray(life.data) ? (life.data[0] as { views?: unknown; saves?: unknown } | undefined) : undefined;
    const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents;
    return {
      state: "ok",
      data: {
        id: row.id,
        title: row.title,
        area: row.area,
        city: row.city,
        status: row.status,
        isDemo: row.is_demo,
        publishedAt: row.published_at,
        lister: agent?.display_name ?? null,
        views: n(lifetime?.views),
        saves: n(lifetime?.saves),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Views on real listings in the last `windowDays`, and in as many days before
 * (for the Analytics desk's figure). The rollup function answers up to 400
 * days, so a twelve-month window comes back without a previous period and the
 * figure draws no change rather than an invented one.
 */
export async function getListingViewTotals(
  windowDays: number,
): Promise<StatsRead<{ views: number; previous: number | null; spark: number[] }>> {
  const db = await reader();
  if (!db) return UNAVAILABLE;
  const both = windowDays * 2 <= 400;
  const got = await call(db, "admin_listing_stats_daily", { p_days: both ? windowDays * 2 : windowDays, p_listing: null });
  if (got === "missing") return MISSING;
  if (!got) return UNAVAILABLE;
  const rows = dayRows(got.data);
  if (rows.length !== (both ? windowDays * 2 : windowDays)) return UNAVAILABLE;
  const current = both ? rows.slice(windowDays) : rows;
  return {
    state: "ok",
    data: {
      views: totalsOf(current).views,
      previous: both ? totalsOf(rows.slice(0, windowDays)).views : null,
      spark: weekly(current).map((b) => b.views),
    },
  };
}
