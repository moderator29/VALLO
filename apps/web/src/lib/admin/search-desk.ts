import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";
import { requireAdmin, type AdminAccess } from "./guard";

/**
 * THE SEARCH DESK (`/admin/search`): what people search for in VALLO
 * Intelligence, as aggregates only, and the staff aliases.
 *
 * Opened by an admin, or by staff holding `analyst`, `content` or `marketing`
 * (the console door is asked once per area until one admits). Every read is a
 * SECURITY DEFINER function called with the person's OWN client, because each
 * checks `auth.uid()` and the proved console key itself
 * (`admin_search_overview`, `admin_search_aliases`; pending SQL
 * `intelligence_search_2026-11-16.sql`). Until that SQL is applied every read
 * answers `not-set-up` and the desk says so.
 */

export const SEARCH_DESK_SCOPES = ["analyst", "content", "marketing"] as const;

export type SearchDeskDoor =
  | { state: "unconfigured" | "signed-out" | "not-admin" | "step-up" }
  | { state: "ok"; db: SupabaseClient; userId: string };

export async function searchDeskDoor(): Promise<SearchDeskDoor> {
  let last: AdminAccess | null = null;
  for (const scope of SEARCH_DESK_SCOPES) {
    const access = await requireAdmin(scope);
    if (access.state === "admin") return { state: "ok", db: access.userClient as unknown as SupabaseClient, userId: access.user.id };
    last = access;
    if (access.state !== "not-admin") break;
  }
  return { state: (last?.state ?? "not-admin") as "unconfigured" | "signed-out" | "not-admin" | "step-up" };
}

export type SearchOverview = {
  days: number;
  floor: number;
  searches: number;
  sessions: number;
  zeroResults: number;
  clicks: number;
  medianTookMs: number | null;
  p90TookMs: number | null;
  tabs: { tab: string; n: number }[];
  kinds: { kind: string; n: number }[];
  clickedKinds: { kind: string; n: number }[];
  places: { place: string; n: number }[];
  topQueries: { query: string; searches: number; sessions: number; zero: number }[];
  zeroQueries: { query: string; searches: number; sessions: number }[];
};

export type SearchAlias = { id: string; fromText: string; toText: string; kind: "word" | "place"; active: boolean; updatedAt: string };

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-set-up" } | { state: "forbidden" } | { state: "failed" };

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

export function parseOverview(raw: Record<string, unknown>): SearchOverview {
  return {
    days: num(raw.days),
    floor: num(raw.floor),
    searches: num(raw.searches),
    sessions: num(raw.sessions),
    zeroResults: num(raw.zero_results),
    clicks: num(raw.clicks),
    medianTookMs: numOrNull(raw.median_took_ms),
    p90TookMs: numOrNull(raw.p90_took_ms),
    tabs: list(raw.tabs).map((r) => ({ tab: String(r.tab), n: num(r.n) })),
    kinds: list(raw.kinds).map((r) => ({ kind: String(r.kind), n: num(r.n) })),
    clickedKinds: list(raw.clicked_kinds).map((r) => ({ kind: String(r.kind), n: num(r.n) })),
    places: list(raw.places).map((r) => ({ place: String(r.place), n: num(r.n) })),
    topQueries: list(raw.top_queries).map((r) => ({ query: String(r.query), searches: num(r.searches), sessions: num(r.sessions), zero: num(r.zero) })),
    zeroQueries: list(raw.zero_queries).map((r) => ({ query: String(r.query), searches: num(r.searches), sessions: num(r.sessions) })),
  };
}

async function call(db: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<DeskRead<Record<string, unknown>>> {
  try {
    const { data, error } = await (db as unknown as Rpc).rpc(fn, args);
    if (error) {
      if (isNotLive(error)) return { state: "not-set-up" };
      await reportReadFault("read.admin.search", error);
      return { state: "failed" };
    }
    const body = (data ?? {}) as Record<string, unknown>;
    if (body.status === "forbidden") return { state: "forbidden" };
    if (body.status !== "ok") return { state: "failed" };
    return { state: "ok", data: body };
  } catch {
    return { state: "failed" };
  }
}

export async function readSearchOverview(db: SupabaseClient, days: 7 | 30): Promise<DeskRead<SearchOverview>> {
  const read = await call(db, "admin_search_overview", { p_days: days });
  return read.state === "ok" ? { state: "ok", data: parseOverview(read.data) } : read;
}

export async function readSearchAliases(db: SupabaseClient): Promise<DeskRead<{ canEdit: boolean; aliases: SearchAlias[] }>> {
  const read = await call(db, "admin_search_aliases");
  if (read.state !== "ok") return read;
  return {
    state: "ok",
    data: {
      canEdit: read.data.can_edit === true,
      aliases: list(read.data.aliases).map((r) => ({
        id: String(r.id),
        fromText: String(r.from_text),
        toText: String(r.to_text),
        kind: r.kind === "place" ? "place" : "word",
        active: r.active === true,
        updatedAt: String(r.updated_at ?? r.created_at ?? ""),
      })),
    },
  };
}
