import type { Listing } from "@/lib/listings/types";
import { rankRecommended } from "@/lib/listings/ranking";
import { bestMatches, type MatchReason, type MatchSignals } from "@/lib/search/best-matches";
import type { ForYouReason, IntelligenceKind } from "./contract";

/**
 * VALLO INTELLIGENCE: WHAT THE EMPTY SCREEN RECOMMENDS, AND WHY (round 3,
 * 16 November 2026).
 *
 * Pure: no network, no clock unless one is passed. The server reads the
 * catalogue and the member's own records (`discover.ts`, `for-you.ts`) and
 * hands them here; nothing here invents a row, a count or a reason.
 *
 *   categoryFacts   per listing side: how many real (not example) listings
 *                   are published, how many of them in the last week, the
 *                   areas they are in, and the newest of them
 *   trendingAreas   areas with two or more real listings published in the
 *                   last 30 days, busiest first
 *   forYouPicks     three rails for a member:
 *                     matches     `bestMatches` from `lib/search/best-matches.ts`,
 *                                 the same reasons /search prints (a saved
 *                                 search, the area of a saved home, a kind
 *                                 they said they came for), over the
 *                                 Recommended order (`rankRecommended`)
 *                     lastSearch  what their last search finds today
 *                     newSince    real listings published after that search
 *                   A saved home is never recommended back, an item appears
 *                   in one rail only, and an example listing in none.
 */

export const DAY_MS = 86_400_000;
export const RAIL_MAX = 8;
const AREAS_MAX = 8;
const LATEST_MAX = 6;

export type Side = Extract<IntelligenceKind, "property" | "stay" | "restaurant">;
export const LISTING_SIDES: readonly Side[] = ["property", "stay", "restaurant"];

type SideOf = (listing: Listing) => IntelligenceKind;

const real = (l: Listing) => !l.isDemo;
const publishedMs = (l: Listing) => (l.publishedAt ? Date.parse(l.publishedAt) : Number.NaN);
const newestFirst = (a: Listing, b: Listing) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/** "Lekki Phase 1" in "Lagos"; an area that only repeats its city names no area. */
function areaOf(l: Listing): { name: string; city: string } | null {
  const name = l.area.trim();
  const city = l.city.trim();
  if (!name || name.toLowerCase() === city.toLowerCase()) return null;
  return { name, city };
}

/** The areas these listings sit in, most listings first, then by name. */
function areasOf(listings: readonly Listing[], limit: number): { name: string; city: string; n: number }[] {
  const counts = new Map<string, { name: string; city: string; n: number }>();
  for (const l of listings) {
    const area = areaOf(l);
    if (!area) continue;
    const key = `${area.name.toLowerCase()}|${area.city.toLowerCase()}`;
    const seen = counts.get(key);
    if (seen) seen.n += 1;
    else counts.set(key, { ...area, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit);
}

export type CategoryFactsRaw = {
  tab: Side;
  live: number;
  newThisWeek: number;
  areas: { name: string; city: string }[];
  latest: Listing[];
};

export function categoryFacts(catalogue: readonly Listing[], sideOf: SideOf, nowMs: number): CategoryFactsRaw[] {
  const weekAgo = nowMs - 7 * DAY_MS;
  return LISTING_SIDES.map((tab) => {
    const mine = catalogue.filter((l) => real(l) && sideOf(l) === tab);
    return {
      tab,
      live: mine.length,
      newThisWeek: mine.filter((l) => publishedMs(l) >= weekAgo && publishedMs(l) <= nowMs).length,
      areas: areasOf(mine, AREAS_MAX).map(({ name, city }) => ({ name, city })),
      latest: mine.filter((l) => l.publishedAt).sort(newestFirst).slice(0, LATEST_MAX),
    };
  });
}

export function trendingAreas(
  catalogue: readonly Listing[],
  nowMs: number,
  { days = 30, min = 2, limit = 6 }: { days?: number; min?: number; limit?: number } = {},
): { area: string; city: string; newListings: number }[] {
  const from = nowMs - days * DAY_MS;
  const recent = catalogue.filter((l) => real(l) && publishedMs(l) >= from && publishedMs(l) <= nowMs);
  return areasOf(recent, Number.MAX_SAFE_INTEGER)
    .filter((a) => a.n >= min)
    .slice(0, limit)
    .map((a) => ({ area: a.name, city: a.city, newListings: a.n }));
}

/** A best-matches reason as the contract carries it. "recent" (a device's memory) never reaches the server. */
export function reasonOf(reason: MatchReason): ForYouReason | null {
  switch (reason.key) {
    case "areaBudget":
    case "areaSaved":
    case "nearSaved":
      return { key: reason.key, area: reason.area };
    case "budget":
    case "saved":
      return { key: reason.key };
    case "kind":
      return { key: "kind", kind: reason.kind };
    default:
      return null;
  }
}

export type ForYouPick = { listing: Listing; reason: ForYouReason };
export type ForYouRailRaw = { id: "matches" | "lastSearch" | "newSince"; query?: string; since?: string; items: ForYouPick[] };

export type ForYouInput = {
  /** Every published listing, as the catalogue reads it. */
  catalogue: readonly Listing[];
  /** The member's saved searches, saved homes and stated interests (`recentPlaces` stays empty on the server). */
  signals: MatchSignals;
  /** The member's newest search, with what the catalogue returns for it today. */
  lastSearch?: { query: string; at: string; rows: readonly Listing[] };
};

export function forYouPicks({ catalogue, signals, lastSearch }: ForYouInput): ForYouRailRaw[] {
  const shown = new Set<string>(signals.savedHomes.map((h) => h.id));
  const take = (listings: readonly Listing[], reason: (l: Listing) => ForYouReason | null): ForYouPick[] => {
    const out: ForYouPick[] = [];
    for (const listing of listings) {
      if (out.length >= RAIL_MAX) break;
      if (!real(listing) || shown.has(listing.id)) continue;
      const why = reason(listing);
      if (!why) continue;
      shown.add(listing.id);
      out.push({ listing, reason: why });
    }
    return out;
  };

  const rails: ForYouRailRaw[] = [];
  const pool = rankRecommended(catalogue.filter(real));
  const matched = bestMatches(pool, signals, RAIL_MAX * 2);
  const reasons = new Map(matched.map((m) => [m.listing.id, reasonOf(m.reason)] as const));
  const matches = take(
    matched.map((m) => m.listing),
    (l) => reasons.get(l.id) ?? null,
  );
  if (matches.length > 0) rails.push({ id: "matches", items: matches });

  if (lastSearch) {
    const like = take(lastSearch.rows, () => ({ key: "lastSearch", query: lastSearch.query }));
    if (like.length > 0) rails.push({ id: "lastSearch", query: lastSearch.query, items: like });
    const since = Date.parse(lastSearch.at);
    if (Number.isFinite(since)) {
      const fresh = catalogue.filter((l) => publishedMs(l) > since).sort(newestFirst);
      const added = take(fresh, () => ({ key: "newSince", since: lastSearch.at }));
      if (added.length > 0) rails.push({ id: "newSince", since: lastSearch.at, items: added });
    }
  }
  return rails;
}
