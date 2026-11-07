import { describe, expect, it } from "vitest";

import { amenityLabels, countOrNull, firstPhotoPath, statedPrice, POST_LISTING_COLUMNS, type PostListingRow } from "./model";

const base: PostListingRow = {
  id: "l1",
  title: "2 bedroom flat",
  area: "Yaba",
  city: "Lagos",
  listing_intent: "rent",
  rate_minor: null,
  rate_period: null,
  rent_amount_minor: null,
  rent_period: null,
  sale_price_minor: null,
  bedrooms: 2,
  bathrooms: 2,
  listing_photos: [
    { storage_path: "b.jpg", position: 2 },
    { storage_path: "a.jpg", position: 1 },
  ],
  listing_amenities: [{ amenities: { label: "Prepaid meter" } }, { amenities: [{ label: "Borehole" }] }, { amenities: null }],
};

describe("the featured listing card reads only what the listing states", () => {
  it("never selects the two columns that do not exist", () => {
    expect(POST_LISTING_COLUMNS).not.toMatch(/price_per_night_minor|price_period/);
  });
  it("a yearly rent", () => {
    expect(statedPrice({ ...base, rent_amount_minor: 360_000_000, rent_period: "year" })).toEqual({ minor: 360_000_000, period: "a year", kind: "property" });
  });
  it("a stay by the night", () => {
    expect(statedPrice({ ...base, rate_minor: "4500000", rate_period: "night" })).toEqual({ minor: 4_500_000, period: "a night", kind: "stay" });
  });
  it("a sale has no period", () => {
    expect(statedPrice({ ...base, listing_intent: "sale", sale_price_minor: 9_000_000_000 })?.period).toBe("");
  });
  it("no stated price is no price, never zero", () => {
    expect(statedPrice(base)).toBeNull();
  });
  it("the first photo by position, amenity labels deduplicated and capped", () => {
    expect(firstPhotoPath(base)).toBe("a.jpg");
    expect(amenityLabels(base)).toEqual(["Prepaid meter", "Borehole"]);
    expect(countOrNull(0)).toBeNull();
    expect(countOrNull(3)).toBe(3);
  });
});
