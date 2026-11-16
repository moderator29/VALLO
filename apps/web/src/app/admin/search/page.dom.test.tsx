import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** THE SEARCH DESK: its door, "not set up yet", and figures that are only ever real. */
const state = vi.hoisted(() => ({ door: { state: "ok", db: {}, userId: "s1" } as Record<string, unknown>, overview: {} as Record<string, unknown>, aliases: {} as Record<string, unknown> }));
vi.mock("@/lib/admin/search-desk", () => ({
  searchDeskDoor: async () => state.door,
  readSearchOverview: async () => state.overview,
  readSearchAliases: async () => state.aliases,
}));
vi.mock("@/lib/admin/search-alias-actions", () => ({ putSearchAlias: vi.fn(), setSearchAliasActive: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/admin/search", useSearchParams: () => new URLSearchParams() }));

const { default: Page } = await import("./page");
const text = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as React.ReactElement).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const OVERVIEW = {
  days: 7, floor: 3, searches: 40, sessions: 12, zeroResults: 10, clicks: 8, medianTookMs: 182, p90TookMs: 640,
  tabs: [{ tab: "all", n: 30 }, { tab: "stay", n: 10 }], kinds: [{ kind: "property", n: 25 }], clickedKinds: [{ kind: "property", n: 8 }],
  places: [{ place: "Lekki, Lagos", n: 9 }], topQueries: [{ query: "flats in lekki", searches: 9, sessions: 4, zero: 0 }], zeroQueries: [],
};

beforeEach(() => {
  state.door = { state: "ok", db: {}, userId: "s1" };
  state.overview = { state: "ok", data: OVERVIEW };
  state.aliases = { state: "ok", data: { canEdit: true, aliases: [{ id: "a1", fromText: "buka", toText: "restaurant", kind: "word", active: true, updatedAt: "2026-11-16T09:00:00Z" }] } };
});

describe("the search desk", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["step-up", /Confirm it is you/],
    ["not-admin", /Analytics, Content and Marketing/],
  ])("answers %s with its own words", async (door, words) => {
    state.door = { state: door };
    expect(await text()).toMatch(words);
  });

  it("says search analytics are not set up yet instead of zeros", async () => {
    state.overview = { state: "not-set-up" };
    state.aliases = { state: "not-set-up" };
    const out = await text();
    expect(out).toMatch(/Search analytics are not set up yet/);
    expect(out).not.toMatch(/Most searched|undefined|NaN/);
  });

  it("shows the real figures, the floor, and the aliases with their switch", async () => {
    const out = await text();
    expect(out).toMatch(/25%/);
    expect(out).toMatch(/20%/);
    expect(out).toMatch(/182 ms/);
    expect(out).toMatch(/at least 3 different visits/);
    expect(out).toMatch(/flats in lekki/);
    expect(out).toMatch(/Lekki, Lagos/);
    expect(out).toMatch(/buka/);
    expect(out).toMatch(/Switch off/);
    expect(out).not.toMatch(/undefined|NaN/);
  });

  it("shows a reader the aliases without the controls", async () => {
    state.aliases = { state: "ok", data: { canEdit: false, aliases: [] } };
    const out = await text();
    expect(out).toMatch(/Content and Marketing change aliases/);
    expect(out).not.toMatch(/Save alias/);
  });
});
