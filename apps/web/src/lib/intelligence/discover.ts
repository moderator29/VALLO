import "server-only";

import { catalogueReader } from "@/lib/catalogue/listings";
import { isSocialEnabled } from "@/lib/social/flag";
import type { DiscoverResponse } from "./contract";
import { readPopularQueries, readRecentSearches } from "./analytics";
import { readForYou } from "./for-you";
import { categoryFacts, trendingAreas } from "./recommend";
import type { EngineDeps } from "./engine";
import { runSearch } from "./engine";
import { listingResult, sideOf } from "./sources/listings";
import { peopleToFollow } from "./sources/social";
import type { Viewer } from "./viewer";

/**
 * VALLO INTELLIGENCE: THE EMPTY SCREEN.
 *
 *   popular   searches at least three distinct visits made in 30 days
 *             (the database applies the floor, `search_popular_queries`);
 *             empty until enough people searched, never invented;
 *   recent    the member's own, through their own session;
 *   fresh     the newest published listings that are not examples;
 *   people    the platform's "People to follow" (signed in), never the viewer;
 *   examples  searches that return results today, each run before it is offered.
 *
 * Round 3 (16 November 2026), each field optional on the wire:
 *
 *   categories  the explore tiles' facts per listing side (`recommend.ts`):
 *               real listings only, so a catalogue of examples, or none,
 *               gives zeros and the tiles print no count;
 *   trending    areas with two or more real listings new in 30 days;
 *   forYou      a member's own rails (`for-you.ts`), through their own session.
 */

/* Candidate example searches. Each is offered only after it returns at least one result. */
export const EXAMPLE_CANDIDATES = [
  "2 bedroom apartment in Lekki",
  "apartments in Lagos",
  "hotels in Abuja",
  "shortlets in Lekki",
  "restaurants in Victoria Island",
  "houses for sale",
  "homes in Ibadan",
  "furnished shortlet in Lekki",
  "land for sale",
  "office space in Lagos",
  "homes in Port Harcourt",
  "how to list a property",
  /* Help and screens: they answer even on a day the catalogue is empty. */
  "how to find a roommate",
  "how does escrow work",
  "verify my identity",
] as const;

let exampleCache: { at: number; value: string[] } | null = null;
const EXAMPLE_TTL_MS = 10 * 60_000;

/** The candidates that return at least one public result right now (checked as a visitor). */
export async function verifiedExamples(deps: EngineDeps, viewer: Viewer, nowMs = Date.now()): Promise<string[]> {
  if (exampleCache && nowMs - exampleCache.at < EXAMPLE_TTL_MS) return exampleCache.value;
  const visitor: Viewer = { signedIn: false, userId: null, db: viewer.signedIn ? null : viewer.db };
  /* Three at a time, with a longer deadline than a person's search: this
     runs once per ten minutes and must not fail an example for being slow. */
  const checks: (string | null)[] = [];
  for (let i = 0; i < EXAMPLE_CANDIDATES.length; i += 3) {
    const batch = await Promise.all(
      EXAMPLE_CANDIDATES.slice(i, i + 3).map(async (q) => {
        try {
          const answer = await runSearch({ q, tab: "all", viewer: visitor }, { ...deps, model: undefined, deadlineMs: 5_000 });
          const pointed = answer.understood.kind;
          const hits = pointed ? answer.results.filter((r) => r.kind === pointed || (pointed === "guide" && r.kind === "screen")) : answer.results;
          return hits.length > 0 && !answer.showing ? q : null;
        } catch {
          return null;
        }
      }),
    );
    checks.push(...batch);
  }
  const value = checks.filter((q): q is string => Boolean(q)).slice(0, 6);
  exampleCache = { at: nowMs, value };
  return value;
}

export async function discover(viewer: Viewer, deps: EngineDeps): Promise<DiscoverResponse> {
  const now = deps.now?.() ?? new Date();
  const [popular, recent, read, people, examples] = await Promise.all([
    readPopularQueries(8).catch(() => []),
    readRecentSearches(viewer, 8).catch(() => []),
    catalogueReader()
      .search({})
      .catch(() => null),
    (async () => {
      if (!viewer.signedIn || !viewer.db || !(await isSocialEnabled())) return [];
      return peopleToFollow(viewer.db, viewer.userId, null, 6);
    })().catch(() => []),
    verifiedExamples(deps, viewer).catch(() => []),
  ]);
  const catalogue = read ?? [];
  const forYou = await readForYou(viewer, catalogue, recent, now).catch(() => []);
  const fresh = catalogue
    .filter((l) => !l.isDemo && l.publishedAt)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 8)
    .map((l) => listingResult(l, { raw: "", via: "rules" }, viewer, sideOf(l)));
  return {
    popular: popular.map((query) => ({ query })),
    recent,
    fresh,
    people: people.filter((p) => !p.person?.isYou),
    examples,
    /* No facts when the catalogue could not be read: zeros would be a claim. */
    ...(read
      ? {
          categories: categoryFacts(catalogue, sideOf, now.getTime()).map((facts) => ({
            ...facts,
            latest: facts.latest.map((l) => listingResult(l, { raw: "", via: "rules" }, viewer, facts.tab)),
          })),
          trending: trendingAreas(catalogue, now.getTime()),
        }
      : {}),
    ...(viewer.signedIn ? { forYou } : {}),
  };
}
