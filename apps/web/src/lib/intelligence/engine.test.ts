import { describe, expect, it, vi } from "vitest";
import type { IntelligenceKind, IntelligenceResult, Understood } from "./contract";
import { adjust, runSearch, type EngineDeps } from "./engine";
import { decodeCursor, encodeCursor, groupOrder } from "./rank";
import type { Source, SourceContext } from "./sources/types";
import type { Viewer } from "./viewer";

const VISITOR: Viewer = { signedIn: false, userId: null, db: null };
const NOW = () => new Date("2026-11-16T10:00:00Z");

function row(kind: IntelligenceKind, id: string, extra: Partial<IntelligenceResult> = {}): IntelligenceResult {
  return { key: `${kind}:${id}`, kind, title: `${kind} ${id}`, href: `/${kind}/${id}`, ...extra };
}

/** A fake source: answers from a function of what was understood. */
function source(kind: IntelligenceKind, answer: (u: Understood, ctx: SourceContext) => IntelligenceResult[], opts: { applies?: (u: Understood) => boolean; closestTitle?: (u: Understood) => string | undefined } = {}): Source {
  return {
    kind,
    applies: ({ understood }) => (opts.applies ? opts.applies(understood) : true),
    async run(ctx) {
      const all = answer(ctx.understood, ctx);
      const closest = opts.closestTitle?.(ctx.understood);
      return { results: all.slice(ctx.offset, ctx.offset + ctx.limit), total: all.length, more: `/${kind}`, ...(closest ? { closestTitle: closest } : {}) };
    },
  };
}

const LEKKI_HOMES = Array.from({ length: 30 }, (_, i) => row("property", `h${i}`, { bedrooms: (i % 3) + 1 }));

const property = source("property", (u) => {
  if (u.text && u.text !== "duplex") return [];
  if (u.place && !u.place.startsWith("Lekki") && u.place !== "Lagos") return [];
  return LEKKI_HOMES.filter((h) => u.bedrooms === undefined || (h.bedrooms ?? 0) >= u.bedrooms).filter(() => u.maxPrice === undefined || u.maxPrice > 1_000_000);
});
const stay = source("stay", (u) => ((u.kind === "stay" || u.kind === undefined) && !u.text ? [row("stay", "s1")] : []), { applies: (u) => u.kind !== "personal" });
const restaurant = source("restaurant", (u) => (u.kind === "restaurant" && u.place?.startsWith("Victoria Island") ? [row("restaurant", "r1"), row("restaurant", "r2")] : []));
const place = source("place", (u) => (u.place ? [row("place", u.place.split(",")[0]!)] : []), { applies: (u) => Boolean(u.place) });
const guide = source("guide", (_u, ctx) => (/offer/.test(ctx.words) ? [row("guide", "making-an-offer")] : []));

const DEPS: EngineDeps = { sources: [place, property, stay, restaurant, guide], now: NOW };

describe("the engine", () => {
  it("puts the kind the words point at first, then the place, then the rest", async () => {
    const answer = await runSearch({ q: "2 bedroom apartment in Lekki", tab: "all", viewer: VISITOR }, DEPS);
    expect(answer.understood).toMatchObject({ kind: "property", bedrooms: 2, place: "Lekki, Lagos" });
    expect(answer.groups!.map((g) => g.kind)).toEqual(["property", "place"]);
    expect(answer.groups![0]!.results.length).toBe(4);
    expect(answer.groups![0]!.more).toBe("/property");
    expect(answer.results).toEqual(answer.groups!.flatMap((g) => g.results));
    expect(answer.tabs).toContainEqual({ tab: "property", count: 20 });
    expect(answer.tookMs).toBeGreaterThanOrEqual(0);
  });

  it("puts the place first when the query is a place", async () => {
    const answer = await runSearch({ q: "Lekki", tab: "all", viewer: VISITOR }, DEPS);
    expect(answer.groups![0]!.kind).toBe("place");
    expect(groupOrder({ raw: "x", via: "rules", kind: "guide" }).slice(0, 2)).toEqual(["guide", "screen"]);
  });

  it("pages one tab with a cursor tied to the tab and the words", async () => {
    const first = await runSearch({ q: "apartments in Lekki", tab: "property", viewer: VISITOR }, DEPS);
    expect(first.results.length).toBe(20);
    expect(first.next).toBeDefined();
    const second = await runSearch({ q: "apartments in Lekki", tab: "property", cursor: first.next, viewer: VISITOR }, DEPS);
    expect(second.results.map((r) => r.key)).toEqual(LEKKI_HOMES.slice(20).map((r) => r.key));
    expect(second.next).toBeUndefined();
    expect(decodeCursor(first.next, "stay", "apartments in Lekki")).toBe(0);
    expect(decodeCursor(first.next, "property", "something else")).toBe(0);
    expect(decodeCursor("garbage", "property", "x")).toBe(0);
    expect(decodeCursor(encodeCursor("property", 40, "x"), "property", "x")).toBe(40);
  });

  it("returns the others and says partial when one source fails or is slow", async () => {
    const broken: Source = { kind: "stay", applies: () => true, run: async () => Promise.reject(new Error("down")) };
    const slow: Source = { kind: "guide", applies: () => true, run: () => new Promise(() => undefined) };
    const answer = await runSearch({ q: "apartments in Lekki", tab: "all", viewer: VISITOR }, { ...DEPS, sources: [property, broken, slow], deadlineMs: 50 });
    expect(answer.partial).toBe(true);
    expect(answer.groups!.map((g) => g.kind)).toEqual(["property"]);
  });

  it("shows results for the spelling fix only when the words as typed found nothing, and says so", async () => {
    const answer = await runSearch({ q: "resturants in VI", tab: "all", viewer: VISITOR }, { ...DEPS, sources: [restaurant] });
    expect(answer.showing).toEqual({ query: "restaurants in Victoria Island", insteadOf: "resturants in VI" });
    expect(answer.understood.raw).toBe("resturants in VI");
    expect(answer.understood.kind).toBe("restaurant");
    expect(answer.results.map((r) => r.kind)).toEqual(["restaurant", "restaurant"]);

    const offer = await runSearch({ q: "make an ofer", tab: "all", viewer: VISITOR }, DEPS);
    expect(offer.showing?.query).toBe("make an offer");
    expect(offer.results[0]!.key).toBe("guide:making-an-offer");
  });

  it("offers the closest real title for a misspelled listing title", async () => {
    const titled = source("property", () => [], { closestTitle: (u) => (u.text ? "4 Bedroom Duplex, Banana Island" : undefined) });
    const answer = await runSearch({ q: "Duplx Bananna", tab: "all", viewer: VISITOR }, { ...DEPS, sources: [titled] });
    expect(answer.understood.didYouMean).toBeDefined();
  });

  it("offers alternatives on nothing, each checked to return something", async () => {
    const answer = await runSearch({ q: "2 bedroom apartment in Lekki Phase 1 under 500k with pool", tab: "property", viewer: VISITOR }, {
      ...DEPS,
      sources: [source("property", (u) => (u.amenities?.length ? [] : [row("property", "x")]))],
    });
    expect(answer.results).toEqual([]);
    expect(answer.alternatives?.length).toBeGreaterThan(0);
    for (const alt of answer.alternatives!) {
      const check = await runSearch({ q: alt.query!, tab: "property", viewer: VISITOR }, {
        ...DEPS,
        sources: [source("property", (u) => (u.amenities?.length ? [] : [row("property", "x")]))],
      });
      expect(check.results.length, alt.label).toBeGreaterThan(0);
    }
  });

  it("offers no alternative that would also find nothing", async () => {
    const answer = await runSearch({ q: "2 bedroom flat in yaba", tab: "property", viewer: VISITOR }, { ...DEPS, sources: [source("property", () => [])] });
    expect(answer.alternatives).toBeUndefined();
  });

  it("asks the model only when allowed and the rules read too little", async () => {
    const model = vi.fn(async () => ({ patch: { kind: "property" as const, place: "Surulere, Lagos" } }));
    const long = "somewhere quiet for my mum close to her church nothing too dear please";
    const asked = await runSearch({ q: long, tab: "all", viewer: VISITOR, allowModel: true }, { ...DEPS, model });
    expect(model).toHaveBeenCalledTimes(1);
    expect(asked.understood.via).toBe("model");
    await runSearch({ q: long, tab: "all", viewer: VISITOR }, { ...DEPS, model });
    await runSearch({ q: "flats in lekki", tab: "all", viewer: VISITOR, allowModel: true }, { ...DEPS, model });
    expect(model).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => {
      throw new Error("model down");
    });
    const fallback = await runSearch({ q: long, tab: "all", viewer: VISITOR, allowModel: true }, { ...DEPS, model: failing });
    expect(fallback.understood.via).toBe("rules");
  });

  it("drops what the person took off and keeps what they set", () => {
    const u: Understood = { raw: "x", via: "rules", place: "Lekki, Lagos", bedrooms: 2, checkIn: "2026-11-20", checkOut: "2026-11-22" };
    expect(adjust(u, ["bedrooms", "checkIn", "raw", "via"], { maxPrice: 5 })).toEqual({ raw: "x", via: "rules", place: "Lekki, Lagos", maxPrice: 5 });
  });
});
