import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/listings/types";
import type { MatchSignals } from "@/lib/search/best-matches";
import type { IntelligenceKind } from "./contract";
import { categoryFacts, DAY_MS, forYouPicks, RAIL_MAX, reasonOf, trendingAreas } from "./recommend";

/**
 * Round 3's recommendations are real or absent: counts and areas only from
 * listings that are not examples, a saved home never recommended back, an
 * item in one rail only, and every pick carrying the reason it is there.
 * Fixtures only: no real listing, no real person.
 */
const NOW = Date.parse("2026-11-16T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

function home(over: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    slug: over.id,
    title: "A fixture home",
    kind: "rental",
    intent: "rent",
    pricePeriod: "year",
    area: "Yaba",
    city: "Lagos",
    state: "Lagos",
    priceMinor: 2_000_000_00,
    moveInCostMinor: 3_000_000_00,
    moveInCostStated: true,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    rating: 0,
    reviewCount: 0,
    verified: false,
    isDemo: false,
    instantBook: false,
    amenities: [],
    photos: [],
    hue: 0,
    publishedAt: ago(40),
    ...over,
  };
}

/* The side is the fixture's kind: "stay" kinds are stays, "restaurant" restaurants. */
const sideOf = (l: Listing): IntelligenceKind => (l.kind === "shortlet" ? "stay" : l.kind === "restaurant" ? "restaurant" : "property");
const NONE: MatchSignals = { savedSearches: [], savedHomes: [], interests: [], recentPlaces: [] };

describe("category facts", () => {
  it("counts only real listings, says how many are new this week, and names their areas most first", () => {
    const facts = categoryFacts(
      [
        home({ id: "a", area: "Yaba", publishedAt: ago(2) }),
        home({ id: "b", area: "Yaba", publishedAt: ago(20) }),
        home({ id: "c", area: "Lekki Phase 1", publishedAt: ago(1) }),
        home({ id: "x", area: "Ikoyi", isDemo: true, publishedAt: ago(1) }),
        home({ id: "s", kind: "shortlet", area: "Wuse 2", city: "Abuja", publishedAt: ago(3) }),
      ],
      sideOf,
      NOW,
    );
    const property = facts.find((f) => f.tab === "property")!;
    expect(property.live).toBe(3);
    expect(property.newThisWeek).toBe(2);
    expect(property.areas).toEqual([
      { name: "Yaba", city: "Lagos" },
      { name: "Lekki Phase 1", city: "Lagos" },
    ]);
    expect(property.latest.map((l) => l.id)).toEqual(["c", "a", "b"]);
    const stay = facts.find((f) => f.tab === "stay")!;
    expect(stay).toMatchObject({ live: 1, newThisWeek: 1, areas: [{ name: "Wuse 2", city: "Abuja" }] });
  });

  it("an empty catalogue, or one of examples only, gives zeros and no areas for every tile", () => {
    for (const catalogue of [[], [home({ id: "x", isDemo: true }), home({ id: "y", kind: "shortlet", isDemo: true })]]) {
      const facts = categoryFacts(catalogue, sideOf, NOW);
      expect(facts.map((f) => f.tab)).toEqual(["property", "stay", "restaurant"]);
      for (const f of facts) expect(f).toEqual({ tab: f.tab, live: 0, newThisWeek: 0, areas: [], latest: [] });
    }
  });

  it("an area that only repeats its city names no area", () => {
    const facts = categoryFacts([home({ id: "a", area: "Lagos", city: "Lagos" })], sideOf, NOW);
    expect(facts[0]!.areas).toEqual([]);
    expect(facts[0]!.live).toBe(1);
  });
});

describe("trending areas", () => {
  it("needs two or more real listings published in the last 30 days, busiest first", () => {
    const trending = trendingAreas(
      [
        home({ id: "a", area: "Yaba", publishedAt: ago(1) }),
        home({ id: "b", area: "Yaba", publishedAt: ago(5) }),
        home({ id: "c", area: "Yaba", publishedAt: ago(9) }),
        home({ id: "d", area: "Ikeja GRA", publishedAt: ago(3) }),
        home({ id: "e", area: "Ikeja GRA", publishedAt: ago(4) }),
        home({ id: "f", area: "Surulere", publishedAt: ago(2) }),
        home({ id: "g", area: "Surulere", publishedAt: ago(45) }),
        home({ id: "h", area: "Ikoyi", isDemo: true, publishedAt: ago(1) }),
        home({ id: "i", area: "Ikoyi", isDemo: true, publishedAt: ago(1) }),
      ],
      NOW,
    );
    expect(trending).toEqual([
      { area: "Yaba", city: "Lagos", newListings: 3 },
      { area: "Ikeja GRA", city: "Lagos", newListings: 2 },
    ]);
  });

  it("is empty when nothing real is new", () => {
    expect(trendingAreas([], NOW)).toEqual([]);
    expect(trendingAreas([home({ id: "a", publishedAt: ago(60) }), home({ id: "b", publishedAt: ago(61) })], NOW)).toEqual([]);
  });
});

describe("for you", () => {
  const catalogue = [
    home({ id: "saved-1", area: "Yaba", publishedAt: ago(30) }),
    home({ id: "near-1", area: "Yaba", publishedAt: ago(20) }),
    home({ id: "near-2", area: "Yaba", publishedAt: ago(1) }),
    home({ id: "demo-1", area: "Yaba", isDemo: true, publishedAt: ago(1) }),
    home({ id: "lekki-1", area: "Lekki Phase 1", publishedAt: ago(10) }),
    home({ id: "lekki-2", area: "Lekki Phase 1", publishedAt: ago(0.5) }),
  ];
  const saved: MatchSignals = { ...NONE, savedHomes: [{ id: "saved-1", area: "Yaba", city: "Lagos" }] };

  it("no signal and no last search: no rails at all", () => {
    expect(forYouPicks({ catalogue, signals: NONE })).toEqual([]);
  });

  it("a saved home brings its area's real listings, never the home itself and never an example", () => {
    const rails = forYouPicks({ catalogue, signals: saved });
    expect(rails).toHaveLength(1);
    expect(rails[0]!.id).toBe("matches");
    const ids = rails[0]!.items.map((i) => i.listing.id);
    expect(ids.sort()).toEqual(["near-1", "near-2"]);
    expect(rails[0]!.items[0]!.reason).toEqual({ key: "nearSaved", area: "Yaba" });
  });

  it("the last search gives 'more like' and 'new since', each item in one rail only", () => {
    const rails = forYouPicks({
      catalogue,
      signals: saved,
      lastSearch: { query: "2 bed in lekki", at: ago(2), rows: [catalogue[4]!, catalogue[5]!, catalogue[3]!] },
    });
    expect(rails.map((r) => r.id)).toEqual(["matches", "lastSearch"]);
    const like = rails[1]!;
    expect(like.query).toBe("2 bed in lekki");
    expect(like.items.map((i) => i.listing.id)).toEqual(["lekki-1", "lekki-2"]);
    expect(like.items[0]!.reason).toEqual({ key: "lastSearch", query: "2 bed in lekki" });
    /* near-2 and lekki-2 are new since, but each already sits in a rail above. */
    const all = rails.flatMap((r) => r.items.map((i) => i.listing.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("'new since' lists only real listings published after the last search, newest first", () => {
    const rails = forYouPicks({ catalogue, signals: NONE, lastSearch: { query: "hotels in abuja", at: ago(2), rows: [] } });
    expect(rails.map((r) => r.id)).toEqual(["newSince"]);
    expect(rails[0]!.since).toBe(ago(2));
    expect(rails[0]!.items.map((i) => i.listing.id)).toEqual(["lekki-2", "near-2"]);
    expect(rails[0]!.items[0]!.reason).toEqual({ key: "newSince", since: ago(2) });
  });

  it("caps each rail", () => {
    const many = Array.from({ length: 20 }, (_, i) => home({ id: `n${i}`, publishedAt: ago(0.1) }));
    const rails = forYouPicks({ catalogue: many, signals: NONE, lastSearch: { query: "homes", at: ago(1), rows: many } });
    expect(rails[0]!.items).toHaveLength(RAIL_MAX);
  });

  it("maps every best-matches reason the server can know, and drops the device-only one", () => {
    expect(reasonOf({ key: "areaBudget", area: "Yaba" })).toEqual({ key: "areaBudget", area: "Yaba" });
    expect(reasonOf({ key: "saved" })).toEqual({ key: "saved" });
    expect(reasonOf({ key: "kind", kind: "rental" })).toEqual({ key: "kind", kind: "rental" });
    expect(reasonOf({ key: "recent", area: "Yaba" })).toBeNull();
  });
});
