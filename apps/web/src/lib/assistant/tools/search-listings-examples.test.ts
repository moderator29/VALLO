import { describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/listings/types";

vi.mock("server-only", () => ({}));

/**
 * THE ASSISTANT FINDS THE EXAMPLES, AND SAYS THEY ARE EXAMPLES.
 *
 * Founder, 26 November 2026, in the brief that put a hundred of them back in
 * the catalogue: the assistant finds them the same way VALLO Intelligence
 * does, and always says they are examples, never available to rent.
 *
 * What this pins is the pair of promises in that sentence, because the first
 * one alone is the dangerous half. The tool used to pass `excludeDemo: true`
 * and answer "I found nothing" to a question the search page beside it
 * answered with rows; now the rows come back, and every reply carrying one
 * also carries the instruction that says what it is. A regression that drops
 * the note while keeping the rows is exactly the shape of mistake that puts a
 * price and a link on a property that does not exist.
 */

const rows: Listing[] = [];
vi.mock("@/lib/listings/repository", () => ({
  getListingRepository: () => ({
    byId: async () => null,
    search: async (filter?: { excludeDemo?: boolean }) =>
      filter?.excludeDemo === true ? rows.filter((r) => !r.isDemo) : rows,
  }),
}));

const { runListingSearch, searchListingsTool, EXAMPLE_NOTE, NO_MATCH_NOTE } = await import(
  "./search-listings"
);

function listing(over: Partial<Listing> & { id: string }): Listing {
  return {
    title: "A place",
    description: null,
    kind: "rental",
    status: "PUBLISHED",
    state: "Lagos",
    city: "Lagos",
    area: "Yaba",
    address: null,
    landmark: null,
    bedrooms: 2,
    bathrooms: 2,
    beds: 2,
    maxGuests: 2,
    priceMinor: 1_200_000_00,
    currency: "NGN",
    cleaningFeeMinor: 0,
    serviceFeeMinor: 0,
    minStayNights: 1,
    instantBook: false,
    featured: false,
    verified: false,
    isDemo: false,
    rating: 4,
    reviewCount: 10,
    amenities: [],
    photos: [],
    videos: [],
    hue: 1,
    ...over,
  } as unknown as Listing;
}

describe("the assistant and the example collection", () => {
  it("returns example listings instead of pretending the catalogue is bare", async () => {
    rows.length = 0;
    rows.push(listing({ id: "e1", title: "Mini flat in Yaba", isDemo: true }));

    const { forModel, hasExample } = await runListingSearch({ city: "Lagos" });

    expect(forModel).toHaveLength(1);
    expect(forModel[0]).toMatchObject({ title: "Mini flat in Yaba", example: true });
    expect(hasExample).toBe(true);
  });

  it("marks every example row, and marks nothing else", async () => {
    rows.length = 0;
    rows.push(listing({ id: "r1", title: "Real flat" }));
    rows.push(listing({ id: "e1", title: "Example flat", isDemo: true }));

    const { forModel } = await runListingSearch({});

    expect(forModel.find((r) => r.title === "Example flat")).toHaveProperty("example", true);
    expect(forModel.find((r) => r.title === "Real flat")).not.toHaveProperty("example");
  });

  it("never pushes a real listing below an example, whatever either is rated", async () => {
    rows.length = 0;
    rows.push(listing({ id: "e1", title: "Example flat", isDemo: true, rating: 5, reviewCount: 900 }));
    rows.push(listing({ id: "r1", title: "Real flat", rating: 1, reviewCount: 1 }));

    const { forModel } = await runListingSearch({});

    expect(forModel.map((r) => r.title)).toEqual(["Real flat", "Example flat"]);
  });

  it("sends the instruction with any reply that carries an example", async () => {
    rows.length = 0;
    rows.push(listing({ id: "r1", title: "Real flat" }));
    rows.push(listing({ id: "e1", title: "Example flat", isDemo: true }));

    const out = await searchListingsTool.run({} as never, {} as never);

    expect(out.note).toBe(EXAMPLE_NOTE);
  });

  it("sends no example instruction when every row is real", async () => {
    rows.length = 0;
    rows.push(listing({ id: "r1", title: "Real flat" }));

    const out = await searchListingsTool.run({} as never, {} as never);

    expect(out.note).toBeUndefined();
  });

  it("asks for a wider search when nothing matched at all", async () => {
    rows.length = 0;

    const out = await searchListingsTool.run({} as never, {} as never);

    expect(out.note).toBe(NO_MATCH_NOTE);
  });

  it("tells the model what an example cannot do, in the note itself", () => {
    /* The model is never trusted to remember a caveat about a row it was
       handed, so the prohibition travels with the row. */
    expect(EXAMPLE_NOTE).toMatch(/example/i);
    expect(EXAMPLE_NOTE).toMatch(/cannot be rented/i);
    expect(EXAMPLE_NOTE).toMatch(/never present one as available/i);
  });
});
