import { describe, expect, it } from "vitest";
import { clearListingStats, fetchListingStats, figuresFrom, readListingStats, readMyListingStats } from "./read";

const ID = "7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13";
const client = (answer: { data: unknown; error: unknown } | Error) => ({
  rpc: async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

describe("the page's read fails closed", () => {
  it("is null while the function is missing (the pending SQL not applied)", async () => {
    const missing = { data: null, error: { code: "PGRST202", message: "Could not find the function public.listing_public_stats" } };
    expect(await fetchListingStats(client(missing), ID)).toBeNull();
  });

  it("is null for no row (an example, a listing that is not live), a bad row or a throw", async () => {
    expect(await fetchListingStats(client({ data: [], error: null }), ID)).toBeNull();
    expect(await fetchListingStats(client({ data: [{ views: "x", saves: 1 }], error: null }), ID)).toBeNull();
    expect(await fetchListingStats(client({ data: [{ views: -1, saves: 1 }], error: null }), ID)).toBeNull();
    expect(await fetchListingStats(client(new Error("timeout")), ID)).toBeNull();
  });

  it("returns the two figures from one row (bigint arrives as text)", async () => {
    expect(await fetchListingStats(client({ data: [{ views: "1234", saves: 0 }], error: null }), ID)).toEqual({ views: 1234, saves: 0 });
    expect(figuresFrom({ views: 3, saves: 2 })).toEqual({ views: 3, saves: 2 });
  });

  it("reads nothing at all without a database or for an id that is not a uuid", async () => {
    clearListingStats();
    expect(await readListingStats("not-an-id")).toBeNull();
    expect(await readListingStats(ID)).toBeNull();
  });
});

describe("the lister's read", () => {
  it("keys their figures by listing, and is null when the read failed", async () => {
    expect(
      await readMyListingStats(client({ data: [{ listing_id: ID, views: 5, saves: 1 }, { listing_id: 7, views: 1, saves: 1 }], error: null })),
    ).toEqual({ [ID]: { views: 5, saves: 1 } });
    expect(await readMyListingStats(client({ data: null, error: { code: "PGRST202" } }))).toBeNull();
    expect(await readMyListingStats(client(new Error("down")))).toBeNull();
  });
});
