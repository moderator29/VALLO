import { describe, expect, it } from "vitest";
import { listingCompleteness, type CompletenessFacts } from "./completeness";

const WORDS = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");

function facts(over: Partial<CompletenessFacts["gate"]> = {}, extra: Partial<CompletenessFacts> = {}): CompletenessFacts {
  return {
    gate: {
      title: "Two bedroom flat in Lekki",
      description: WORDS,
      propertyType: "rental",
      stateCode: "LA",
      city: "Lagos",
      area: "Lekki Phase 1",
      intent: "rent",
      rentMinor: 300_000_000,
      rentPeriod: "year",
      rateMinor: null,
      ratePeriod: null,
      salePriceMinor: null,
      tenure: null,
      bedrooms: 2,
      bathrooms: 2,
      amenityCount: 3,
      photoCount: 4,
      hasCover: true,
      ...over,
    },
    videoCount: 0,
    utilitiesAnswered: false,
    hasLandmark: false,
    ...extra,
  };
}

describe("listingCompleteness", () => {
  it("counts the five gate steps and is ready for review at 5 of 8", () => {
    const c = listingCompleteness(facts());
    expect(c.done).toBe(5);
    expect(c.total).toBe(8);
    expect(c.readyForReview).toBe(true);
    expect(c.next).toBe("video");
  });

  it("is 8 of 8 with the three extras", () => {
    const c = listingCompleteness(facts({}, { videoCount: 1, utilitiesAnswered: true, hasLandmark: true }));
    expect(c.done).toBe(8);
    expect(c.next).toBeNull();
  });

  it("names the first open step in order and is not ready", () => {
    const c = listingCompleteness(facts({ photoCount: 1, description: "too short" }));
    expect(c.readyForReview).toBe(false);
    expect(c.steps.description).toBe(false);
    expect(c.steps.photos).toBe(false);
    expect(c.next).toBe("description");
  });

  it("an empty draft is 0 of 8 and starts at the details", () => {
    const c = listingCompleteness(
      facts({ title: "", description: null, propertyType: null, stateCode: null, city: null, area: null, rentMinor: null, rentPeriod: null, bedrooms: -1, bathrooms: 0, amenityCount: 0, photoCount: 0, hasCover: false }),
    );
    expect(c.done).toBe(0);
    expect(c.next).toBe("details");
  });

  it("a sale listing needs a price and a title deed for the price step", () => {
    const sale = facts({ intent: "sale", salePriceMinor: 5_000_000_000, tenure: null });
    expect(listingCompleteness(sale).steps.price).toBe(false);
    const ok = facts({ intent: "sale", salePriceMinor: 5_000_000_000, tenure: "c_of_o" as never });
    expect(listingCompleteness(ok).steps.price).toBe(true);
  });
});
