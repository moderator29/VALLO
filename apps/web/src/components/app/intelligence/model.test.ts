import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { IntelligenceResult, Understood } from "@/lib/intelligence/contract";
import {
  clearedFilters,
  filtersFrom,
  intelHref,
  parseIntelUrl,
  searchKey,
  withFilters,
  withoutFilters,
  EMPTY_STATE,
} from "@/lib/intelligence/client";
import { understand } from "@/lib/intelligence/understand";
import { shouldAskModel } from "@/lib/intelligence/model";
import { backTargetOf, isHome, ownState, parentOf, readIntelEntry } from "./intel-history";
import {
  assistRows,
  CHIP_ICON,
  countPhrase,
  filtersOfDraft,
  FILTER_FIELDS,
  groupSuggestions,
  mayAskModel,
  moveActive,
  personCardOf,
  postcardCities,
  postcardCityOf,
  priceOf,
  propertiesSearchHref,
  understoodChips,
  whyParts,
  wordOrigin,
  biggerBudget,
  caretAfterDigits,
  dayOf,
  digits,
  groupedAmount,
  forYouReasonText,
  lagosToday,
  refineChips,
  stayWindows,
  tileLine,
} from "./model";

const copy = getDictionary("en").intelligence;

describe("the address is the search", () => {
  it("reads and writes the same state, in one order, ignoring anything malformed", () => {
    const state = parseIntelUrl(new URLSearchParams("q=2%20bed%20%20in%20lekki&tab=property&beds=2&max=5000000&place=Lekki,%20Lagos&drop=kind,nonsense&min=abc&in=2026-12-01&furnished=1"));
    expect(state).toEqual({
      q: "2 bed in lekki",
      tab: "property",
      filters: { bedrooms: 2, maxPrice: 5_000_000, place: "Lekki, Lagos", checkIn: "2026-12-01", furnished: true },
      drop: ["kind"],
    });
    expect(intelHref(state)).toBe("/intelligence?q=2+bed+in+lekki&tab=property&place=Lekki%2C+Lagos&beds=2&max=5000000&furnished=1&in=2026-12-01&drop=kind");
    expect(parseIntelUrl(new URLSearchParams(searchKey(state)))).toEqual(state);
    expect(parseIntelUrl({ tab: "bogus", q: ["a", "b"] })).toEqual({ ...EMPTY_STATE, q: "a" });
    expect(intelHref(EMPTY_STATE)).toBe("/intelligence");
  });

  it("removing a filter drops it even when the words said it; setting one again lifts the drop", () => {
    const base = parseIntelUrl(new URLSearchParams("q=2 bed in lekki&beds=3"));
    const removed = withoutFilters(base, ["bedrooms"]);
    expect(removed.filters).toEqual({});
    expect(removed.drop).toEqual(["bedrooms"]);
    expect(intelHref(removed)).toBe("/intelligence?q=2+bed+in+lekki&drop=bedrooms");
    const again = withFilters(removed, { bedrooms: 1 });
    expect(again.drop).toEqual([]);
    expect(again.filters).toEqual({ bedrooms: 1 });
  });

  it("Clear drops every understood filter and keeps the words", () => {
    const u: Understood = { raw: "x", via: "rules", place: "Yaba, Lagos", maxPrice: 1, text: "quiet" };
    const cleared = clearedFilters(parseIntelUrl(new URLSearchParams("q=x&beds=2")), u);
    expect(cleared.q).toBe("x");
    expect(cleared.filters).toEqual({});
    expect([...cleared.drop].sort()).toEqual(["maxPrice", "place"]);
  });

  it("a clarify answer becomes filters the address can carry, and nothing else", () => {
    expect(filtersFrom({ intent: "rent", bedrooms: 2, raw: "ignored", via: "model" } as Partial<Understood>)).toEqual({ intent: "rent", bedrooms: 2 });
  });
});

describe("Search understood, as chips", () => {
  it("says what was read, in plain words, with removable keys", () => {
    const u: Understood = { raw: "2 bed in lekki under 5m", via: "rules", kind: "property", bedrooms: 2, place: "Lekki, Lagos", maxPrice: 5_000_000 };
    const chips = understoodChips(u, copy, "en");
    expect(chips.map((c) => c.label)).toEqual(["Properties", "2 bedrooms", "Lekki, Lagos", "Under ₦5,000,000"]);
    expect(chips.find((c) => c.id === "price")!.keys).toEqual(["maxPrice"]);
    /* The open tab is not repeated as a chip. */
    expect(understoodChips(u, copy, "en", "property").map((c) => c.id)).not.toContain("kind");
    expect(understoodChips({ raw: "x", via: "rules", bedrooms: 1, guests: 1 }, copy, "en").map((c) => c.label)).toEqual(["1 bedroom", "1 guest"]);
    const range = understoodChips({ raw: "x", via: "rules", minPrice: 100_000, maxPrice: 200_000, checkIn: "2026-12-12", checkOut: "2026-12-14" }, copy, "en");
    expect(range.map((c) => c.label)).toEqual(["₦100,000 to ₦200,000", "12 Dec to 14 Dec"]);
    expect(range[1]!.keys).toEqual(["checkIn", "checkOut"]);
  });
});

describe("people rows: You, Follow, or a link", () => {
  const base: IntelligenceResult = { key: "person:1", kind: "person", title: "Test Person", href: "/u/test" };
  it("the viewer's own row says You and never offers a Follow, even when the engine sent one", () => {
    const card = personCardOf({ ...base, person: { handle: "test", isYou: true }, actions: [{ id: "follow", label: "Follow" }] }, copy, "en");
    expect(card.action).toEqual({ kind: "you", label: "You", href: "/u/test" });
  });
  it("offers Follow only when the engine offered it and there is a handle, with the real follow state", () => {
    expect(personCardOf({ ...base, person: { handle: "test", following: true }, actions: [{ id: "follow", label: "Follow" }] }, copy, "en").action).toEqual({
      kind: "follow",
      handle: "test",
      following: true,
    });
    expect(personCardOf({ ...base, person: { following: false }, actions: [{ id: "follow", label: "Follow" }] }, copy, "en").action.kind).toBe("view");
    expect(personCardOf({ ...base, person: { handle: "test" } }, copy, "en").action.kind).toBe("view");
  });
  it("says the role and a real follower count, and invents neither", () => {
    const card = personCardOf({ ...base, person: { handle: "t", role: "agent" }, count: { value: 1, noun: "followers" } }, copy, "en");
    expect(card.roleWord).toBe("Agent");
    expect(card.facts).toEqual(["1 follower"]);
    expect(personCardOf(base, copy, "en").facts).toEqual([]);
    expect(personCardOf(base, copy, "en").roleWord).toBeNull();
  });
});

describe("the small decisions", () => {
  it("groups suggestions in a fixed order with one flat index for the keyboard", () => {
    const { groups, flat } = groupSuggestions([
      { key: "a", kind: "place", label: "Lekki", query: "lekki" },
      { key: "b", kind: "query", label: "lekki flats", query: "lekki flats" },
      { key: "c", kind: "recent", label: "yaba", query: "yaba" },
      { key: "d", kind: "property", label: "A flat", href: "/listing/1" },
      { key: "e", kind: "screen", label: "Nowhere" },
    ]);
    expect(groups.map((g) => g.key)).toEqual(["recent", "query", "place", "listing"]);
    expect(flat.map((s) => s.key)).toEqual(["c", "b", "a", "d"]);
    expect(groups[3]!.items[0]!.index).toBe(3);
  });

  it("wraps the active option", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });

  it("draws a price only when the record has one, and a count through the dictionary", () => {
    const r: IntelligenceResult = { key: "k", kind: "stay", title: "t", href: "/x", price: { amount: 45_000, per: "night" } };
    expect(priceOf(r, copy, "en")).toEqual({ amount: "₦45,000", unit: "a night" });
    expect(priceOf({ ...r, price: undefined }, copy, "en")).toBeNull();
    expect(countPhrase({ value: 3, noun: "members" }, copy, "en")).toBe("3 members");
    expect(countPhrase(undefined, copy, "en")).toBeNull();
  });

  it("sends See all properties to the marketplace search with what it can read", () => {
    const u: Understood = { raw: "2 bed in lekki under 5m", via: "rules", bedrooms: 2, place: "Lekki, Lagos", maxPrice: 5_000_000 };
    expect(propertiesSearchHref(u, u.raw)).toBe("/search?q=Lekki%2C+Lagos&max=5000000&beds=2");
    expect(propertiesSearchHref(null, "flats")).toBe("/search?q=flats");
  });

  it("offers the assistant only what is on screen, each with the search written in", () => {
    const rows = assistRows({ q: "flats in yaba", chips: [], results: [], place: undefined, copy });
    expect(rows.map((r) => r.id)).toEqual(["filters", "places", "where"]);
    expect(rows[0]!.href.startsWith("/assistant?q=")).toBe(true);
    expect(decodeURIComponent(rows[0]!.href.split("q=")[1]!.replace(/\+/g, " "))).toContain("flats in yaba");
    const two = assistRows({
      q: "x",
      chips: [{ id: "beds", label: "2 bedrooms", keys: ["bedrooms"] }],
      results: [
        { key: "a", kind: "property", title: "One", href: "/1" },
        { key: "b", kind: "property", title: "Two", href: "/2" },
      ],
      place: "Yaba, Lagos",
      copy,
    });
    expect(two.map((r) => r.id)).toEqual(["filters", "explain", "compare", "places", "where"]);
    expect(assistRows({ q: "", chips: [], results: [], place: undefined, copy }).map((r) => r.id)).toEqual(["where"]);
  });

  it("turns the drawer's answers into filters to set and filters to take away, per tab", () => {
    const draft = { intent: "rent" as const, place: " Yaba ", bedrooms: "", minPrice: "", maxPrice: "300000", furnished: false, checkIn: "", checkOut: "", guests: "" };
    expect(filtersOfDraft(draft, FILTER_FIELDS.property)).toEqual({
      set: { intent: "rent", place: "Yaba", maxPrice: 300_000 },
      cleared: ["bedrooms", "minPrice", "furnished"],
    });
    expect(filtersOfDraft(draft, FILTER_FIELDS.restaurant)).toEqual({ set: { place: "Yaba" }, cleared: [] });
  });
  it("never sends a search for nothing: lowest over highest change places, a stay ends after it starts, a party is capped", () => {
    const base = { intent: "" as const, place: "", bedrooms: "", minPrice: "", maxPrice: "", furnished: false, checkIn: "", checkOut: "", guests: "" };
    expect(filtersOfDraft({ ...base, minPrice: "5000000", maxPrice: "900000" }, FILTER_FIELDS.property).set).toEqual({ minPrice: 900_000, maxPrice: 5_000_000 });
    const stay = filtersOfDraft({ ...base, checkIn: "2026-12-12", checkOut: "2026-12-10", guests: "99" }, FILTER_FIELDS.stay);
    expect(stay.set).toEqual({ checkIn: "2026-12-12", guests: 30 });
    expect(stay.cleared).toContain("checkOut");
    /* A price past what the address keeps is held at it, not dropped on reload. */
    expect(filtersOfDraft({ ...base, maxPrice: "999999999999" }, FILTER_FIELDS.property).set).toEqual({ maxPrice: 100_000_000_000 });
  });

  it("reads an amount as typed with separators and keeps the caret after the same digits", () => {
    expect(digits("₦1,500,000")).toBe("1500000");
    expect(digits("0005")).toBe("5");
    expect(digits("abc")).toBe("");
    expect(groupedAmount("1500000", "en")).toBe("1,500,000");
    expect(groupedAmount("", "en")).toBe("");
    /* "1,|500,000": one digit before the caret. */
    expect(caretAfterDigits("1,500,000", 1)).toBe(1);
    expect(caretAfterDigits("1,500,000", 2)).toBe(3);
    expect(caretAfterDigits("1,500,000", 0)).toBe(0);
    expect(caretAfterDigits("1,500,000", 99)).toBe(9);
  });
});

describe("the screen's own history entries", () => {
  const search = parseIntelUrl(new URLSearchParams("q=lekki&tab=property"));
  const category = parseIntelUrl(new URLSearchParams("tab=stay"));
  it("knows its home, and sends a search or a category with nothing behind it home", () => {
    expect(isHome(EMPTY_STATE)).toBe(true);
    expect(isHome(category)).toBe(false);
    expect(parentOf(search)).toEqual(EMPTY_STATE);
    expect(parentOf(category)).toEqual(EMPTY_STATE);
    expect(parentOf(EMPTY_STATE)).toBeNull();
  });
  it("reads its own stamp and nothing else, and keeps an entry's other keys but never Next's", () => {
    expect(readIntelEntry({ nfIntel: { from: "/intelligence?q=a" } })).toEqual({ from: "/intelligence?q=a" });
    expect(readIntelEntry({ nfIntel: { from: "/intelligence", suggest: true } })).toEqual({ from: "/intelligence", suggest: true });
    expect(readIntelEntry({ nfIntel: { from: "https://elsewhere.test/" } })).toBeNull();
    expect(readIntelEntry(null)).toBeNull();
    expect(ownState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {}, nfSeq: 4, nfSheet: ["a"] }, { nfIntel: { from: "/intelligence" } })).toEqual({
      nfSeq: 4,
      nfSheet: ["a"],
      nfIntel: { from: "/intelligence" },
    });
  });
  it("names where the back goes: a search, a category's page or the home", () => {
    expect(backTargetOf({ from: "/intelligence?q=lekki" }, search)).toEqual({ kind: "search" });
    expect(backTargetOf({ from: "/intelligence?tab=property" }, search)).toEqual({ kind: "category", tab: "property" });
    expect(backTargetOf({ from: "/intelligence" }, search)).toEqual({ kind: "home" });
    expect(backTargetOf(null, search)).toEqual({ kind: "home" });
  });
});

/* ------------------------------------------------ the creative pass, held */

describe("moods are real filters", () => {
  const read = (q: string) => understand(q, { now: new Date("2026-11-16T09:00:00+01:00") }).understood;
  it("every mood's words read into the filters it promises, through the engine's own rules", () => {
    const m = copy.moods.items;
    expect(read(m.work.query)).toMatchObject({ kind: "property", amenities: expect.arrayContaining(["wifi", "workspace"]) });
    expect(read(m.family.query)).toMatchObject({ kind: "property", bedrooms: 3 });
    const weekend = read(m.weekend.query);
    expect(weekend).toMatchObject({ kind: "stay", listingKinds: ["shortlet"] });
    expect(weekend.checkIn && weekend.checkOut).toBeTruthy();
    expect(read(m.pool.query)).toMatchObject({ kind: "property", amenities: ["pool"] });
    expect(read(m.power.query)).toMatchObject({ kind: "property", amenities: ["generator"] });
  });
});

describe("the thinking line is the engine's model gate, read on the screen", () => {
  it("agrees with the engine's own gate on plain and long searches", () => {
    const queries = [
      "2 bed in lekki under 5m",
      "hotels in abuja this weekend",
      "somewhere quiet and green where my kids can play safely outside",
      "i want a calm place close to my office with good light",
      "restaurants with live music for a birthday dinner for ten people",
      "lekki",
      "",
    ];
    for (const q of queries) {
      const { understood, hints } = understand(q);
      expect(mayAskModel(q), q).toBe(q ? shouldAskModel(understood, hints) : false);
    }
    expect(mayAskModel("2 bed in lekki under 5m")).toBe(false);
    expect(mayAskModel("somewhere quiet and green where my kids can play safely outside")).toBe(true);
  });
});

describe("city postcards are drawn only for cities a real record is in", () => {
  it("reads the city from a place line, once each, in order, and nothing else", () => {
    expect(postcardCityOf("Lekki Phase 1, Lagos")).toBe("Lagos");
    expect(postcardCityOf("Wuse 2, Abuja")).toBe("Abuja");
    expect(postcardCityOf("GRA Phase 2")).toBe("Port Harcourt");
    expect(postcardCityOf("Somewhere, Kano")).toBeNull();
    expect(postcardCityOf(undefined)).toBeNull();
    const fresh = [
      { key: "a", kind: "property", title: "A", href: "/a", place: "Yaba, Lagos" },
      { key: "b", kind: "stay", title: "B", href: "/b", place: "Lekki, Lagos" },
      { key: "c", kind: "restaurant", title: "C", href: "/c", subtitle: "Bodija, Ibadan" },
      { key: "d", kind: "property", title: "D", href: "/d" },
    ] as IntelligenceResult[];
    expect(postcardCities(fresh)).toEqual(["Lagos", "Ibadan"]);
    expect(postcardCities([])).toEqual([]);
  });
});

describe("the chips fly from the words they were read from", () => {
  const words = "2 bed flat in lekki under 5m";
  const u = understand(words).understood;
  it("finds each chip's word, and -1 when it is not there", () => {
    expect(wordOrigin(words, "beds", u)).toBe(0);
    expect(wordOrigin(words, "kind", u)).toBe(words.indexOf("flat"));
    expect(wordOrigin(words, "place", u)).toBe(words.indexOf("lekki"));
    expect(wordOrigin(words, "price", u)).toBe(words.indexOf("under"));
    expect(wordOrigin(words, "guests", u)).toBe(-1);
  });
  it("gives every chip the screen draws a glyph", () => {
    const chips = understoodChips({ raw: "x", via: "rules", kind: "stay", intent: "stay", bedrooms: 2, place: "Lekki, Lagos", maxPrice: 1, furnished: true, amenities: ["pool"], checkIn: "2026-12-01", checkOut: "2026-12-03", guests: 2, addedSince: "2026-11-01", listingKinds: ["hotel"], text: "sea view" }, copy, "en");
    for (const chip of chips) expect(CHIP_ICON[chip.id], chip.id).toBeTruthy();
  });
});

describe("why it matches, as pills", () => {
  it("splits the engine's line on its dots, and draws nothing for nothing", () => {
    expect(whyParts("2 bedrooms · Lekki · under ₦5m")).toEqual(["2 bedrooms", "Lekki", "under ₦5m"]);
    expect(whyParts(undefined)).toEqual([]);
    expect(whyParts("")).toEqual([]);
  });
});

describe("round 3: the flow's own decisions", () => {
  it("today is the Lagos calendar's, not the device's", () => {
    /* 23:30 UTC on the 15th is 00:30 on the 16th in Lagos. */
    expect(lagosToday(new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-16");
    expect(lagosToday(new Date("2026-11-16T10:00:00Z"))).toBe("2026-11-16");
    expect(dayOf("2026-11-15T23:30:00Z", "en")).toBe("16 Nov");
    expect(dayOf("not a date", "en")).toBeNull();
  });

  it("stay windows: tonight, this weekend and the next, Friday to Sunday", () => {
    /* Monday 16 November 2026. */
    expect(stayWindows("2026-11-16")).toEqual({
      tonight: { checkIn: "2026-11-16", checkOut: "2026-11-17" },
      weekend: { checkIn: "2026-11-20", checkOut: "2026-11-22" },
      nextWeekend: { checkIn: "2026-11-27", checkOut: "2026-11-29" },
    });
  });

  it("a tile's line is a real count or nothing", () => {
    expect(tileLine(undefined, "en")).toBeNull();
    expect(tileLine({ tab: "stay", live: 0, newThisWeek: 0, areas: [], latest: [] }, "en")).toBeNull();
    expect(tileLine({ tab: "stay", live: 12, newThisWeek: 0, areas: [], latest: [] }, "en")).toBe("12 live listings");
    expect(tileLine({ tab: "stay", live: 12, newThisWeek: 1, areas: [], latest: [] }, "en")).toBe("1 new this week");
  });

  it("a bigger budget is the next round figure at least a quarter up", () => {
    expect(biggerBudget(5_000_000)).toBe(7_500_000);
    expect(biggerBudget(2_000_000)).toBe(2_500_000);
    expect(biggerBudget(80_000)).toBe(100_000);
    expect(biggerBudget(900_000_000)).toBe(1_500_000_000);
  });

  it("refine chips come only from what was understood, four at most, each a filter", () => {
    const u: Understood = { raw: "2 bed in lekki under 5m", via: "rules", kind: "property", bedrooms: 2, place: "Lekki, Lagos", maxPrice: 5_000_000 };
    const chips = refineChips(u, "all", "2026-11-16", copy, "en");
    expect(chips.map((c) => [c.id, c.set])).toEqual([
      ["budget", { maxPrice: 7_500_000 }],
      ["beds", { bedrooms: 3 }],
      ["city", { place: "Lagos" }],
      ["furnished", { furnished: true }],
    ]);
    expect(chips[1]!.label).toBe("3 bedrooms");
    expect(chips[2]!.label).toBe("Anywhere in Lagos");
  });

  it("a stay with no dates is offered this weekend; people, guides and a bare search get no refine chips", () => {
    const stay = refineChips({ raw: "stays in lekki", via: "rules", kind: "stay", place: "Lekki, Lagos", guests: 2 }, "stay", "2026-11-16", copy, "en");
    expect(stay.map((c) => c.id)).toEqual(["city", "weekend", "guests", "new"]);
    expect(stay[1]!.set).toEqual({ checkIn: "2026-11-20", checkOut: "2026-11-22" });
    expect(refineChips({ raw: "agents in lekki", via: "rules", kind: "person", place: "Lekki, Lagos" }, "all", "2026-11-16", copy, "en")).toEqual([]);
    expect(refineChips({ raw: "how to list", via: "rules" }, "guide", "2026-11-16", copy, "en")).toEqual([]);
    expect(refineChips({ raw: "hello", via: "rules" }, "all", "2026-11-16", copy, "en")).toEqual([]);
  });

  it("each For you reason reads as a short line", () => {
    expect(forYouReasonText({ key: "nearSaved", area: "Yaba" }, copy, "en")).toBe("Because you saved a home in Yaba");
    expect(forYouReasonText({ key: "lastSearch", query: "2 bed in yaba" }, copy, "en")).toBe("Like your search “2 bed in yaba”");
    expect(forYouReasonText({ key: "newSince", since: "2026-11-15T10:00:00Z" }, copy, "en")).toBe("Listed since your search on 15 Nov");
    expect(forYouReasonText({ key: "kind", kind: "shortlet" }, copy, "en")).toBe("Because you said you want short lets");
    expect(forYouReasonText({ key: "kind", kind: "something-new" }, copy, "en")).toBe("Because you said you want places like this");
    expect(forYouReasonText({ key: "saved" }, copy, "en")).toBe("Matches your saved search");
  });
});
