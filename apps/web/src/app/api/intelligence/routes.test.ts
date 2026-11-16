import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The VALLO Intelligence routes, with the engine and the stores stubbed: the
 * input is validated and capped, a visitor's answer may be kept briefly and a
 * member's never, a spent allowance is a 429, only a submitted search is
 * recorded, and the click beacon always answers 204 and never records junk.
 */

const recorded: unknown[] = [];
const remembered: string[] = [];
let allowed = true;
let viewer = { signedIn: false, userId: null as string | null, db: null };

vi.mock("@/lib/support/search-entries", () => ({ buildSupportEntries: () => [] }));
vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => void fn() };
});
vi.mock("@/lib/intelligence/viewer", () => ({ resolveViewer: async () => viewer, anonClient: () => null }));
vi.mock("@/lib/security/rate-limit", () => ({
  consume: async () => (allowed ? { allowed: true, degraded: false } : { allowed: false, retryAfterSeconds: 60, retryIn: "in about a minute" }),
  ipFromHeaders: () => "1.2.3.4",
  subjectForIp: (ip: string) => `ip:${ip}`,
  subjectForUser: (id: string) => `user:${id}`,
}));
vi.mock("@/lib/intelligence/analytics", () => ({
  recordSearchEvent: async (e: unknown) => void recorded.push(e),
  rememberSearch: async (_v: unknown, q: string) => void remembered.push(q),
  readStaffAliases: async () => ({ words: {}, places: {} }),
}));
const runSearch = vi.fn(async (input: { q: string; tab: string; allowModel?: boolean }) => ({
  q: input.q,
  understood: { raw: input.q, via: "rules" },
  tab: input.tab,
  tabs: [{ tab: "all" }],
  results: [],
  tookMs: 3,
}));
vi.mock("@/lib/intelligence/engine", () => ({ runSearch: (input: never) => runSearch(input) }));
vi.mock("@/lib/intelligence/suggest", () => ({ suggest: async ({ q }: { q: string }) => ({ q, suggestions: [] }) }));

const { GET: search } = await import("./search/route");
const { GET: suggestRoute } = await import("./suggest/route");
const { POST: event } = await import("./event/route");

beforeEach(() => {
  recorded.length = 0;
  remembered.length = 0;
  allowed = true;
  viewer = { signedIn: false, userId: null, db: null };
  runSearch.mockClear();
});

describe("search", () => {
  it("cleans and caps the words, and lets a visitor's answer be kept briefly", async () => {
    const res = await search(new Request(`https://x.test/api/intelligence/search?q=${encodeURIComponent(`flats\u0000 in yaba ${"x".repeat(300)}`)}&tab=nonsense`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.q.length).toBeLessThanOrEqual(120);
    expect(body.q.startsWith("flats in yaba")).toBe(true);
    expect(body.tab).toBe("all");
    expect(res.headers.get("cache-control")).toMatch(/^public, max-age=15/);
  });

  it("never lets a member's answer be kept, and records only a submitted search", async () => {
    viewer = { signedIn: true, userId: "u1", db: null };
    const browse = await search(new Request("https://x.test/api/intelligence/search?q=flats&tab=property"));
    expect(browse.headers.get("cache-control")).toBe("private, no-store");
    expect(recorded).toEqual([]);
    expect(runSearch.mock.calls[0]![0].allowModel).toBe(false);
    await search(new Request("https://x.test/api/intelligence/search?q=flats&submit=1"));
    expect(runSearch.mock.calls[1]![0].allowModel).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(remembered).toEqual(["flats"]);
  });

  it("answers 429 when the allowance is spent", async () => {
    allowed = false;
    const res = await search(new Request("https://x.test/api/intelligence/search?q=flats"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("reads the screen's chips and filters, and ignores what is not a filter", async () => {
    await search(new Request("https://x.test/api/intelligence/search?q=flats&drop=bedrooms,place&beds=3&max=5000000&place=vi&amenities=pool,DROP%20TABLE&in=2026-12-01&out=2026-11-01"));
    const input = runSearch.mock.calls[0]![0] as unknown as { drop: string[]; set: Record<string, unknown> };
    expect(input.drop).toEqual(["bedrooms", "place"]);
    expect(input.set).toEqual({ bedrooms: 3, maxPrice: 5_000_000, place: "Victoria Island, Lagos", amenities: ["pool"] });
  });
});

describe("suggest", () => {
  it("answers fast and briefly cacheable for a visitor", async () => {
    const res = await suggestRoute(new Request("https://x.test/api/intelligence/suggest?q=lek"));
    expect(res.status).toBe(200);
    expect((await res.json()).q).toBe("lek");
    expect(res.headers.get("cache-control")).toMatch(/^public/);
  });
});

describe("the click beacon", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    event(new Request("https://x.test/api/intelligence/event", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }));

  it("records a click with no person in it", async () => {
    const res = await post({ event: "click", q: "flats in yaba", tab: "property", kind: "property", position: 2 }, { cookie: "nf_visit=3b9c1f2e-1111-4222-8333-444455556666" });
    expect(res.status).toBe(204);
    expect(recorded).toEqual([{ event: "click", query: "flats in yaba", tab: "property", clickedKind: "property", position: 2, session: "v:3b9c1f2e-1111-4222-8333-444455556666" }]);
  });

  it("answers 204 and records nothing for junk", async () => {
    for (const body of ["not json", { event: "search", q: "x", kind: "property" }, { event: "click", q: "x", kind: "nope" }, { event: "click", q: "", kind: "guide" }]) {
      expect((await post(body)).status).toBe(204);
    }
    expect((await post({ event: "click", q: "x".repeat(2000), kind: "guide" })).status).toBe(204);
    expect(recorded).toEqual([]);
  });
});
