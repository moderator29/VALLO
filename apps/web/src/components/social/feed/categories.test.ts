import { describe, expect, it } from "vitest";
import { inCategory, isFeedCategory, postCategory } from "./categories";
import type { PostListing } from "./PostCard";

const listing = (over: Partial<PostListing> = {}): PostListing => ({
  id: "l1",
  title: "A flat",
  area: "Yaba",
  city: "Lagos",
  priceLabel: "N1",
  periodLabel: "a year",
  photoUrl: null,
  verified: true,
  ...over,
});

describe("the feed's categories read what a post carries", () => {
  it("a post with no listing belongs to no category and shows only under For you", () => {
    expect(postCategory({ listing: null })).toBeNull();
    expect(inCategory({ listing: null }, null)).toBe(true);
    expect(inCategory({ listing: null }, "properties")).toBe(false);
  });
  it("a nightly price is a stay, anything else a property, unless the read names the kind", () => {
    expect(postCategory({ listing: listing({ periodLabel: "a night" }) })).toBe("stays");
    expect(postCategory({ listing: listing() })).toBe("properties");
    expect(postCategory({ listing: listing({ kind: "restaurant" }) })).toBe("restaurants");
    expect(postCategory({ listing: listing({ kind: "stay", periodLabel: "a year" }) })).toBe("stays");
  });
  it("knows only its three names", () => {
    for (const ok of ["properties", "stays", "restaurants"]) expect(isFeedCategory(ok)).toBe(true);
    for (const bad of ["", "Stays", "for-you", null, undefined]) expect(isFeedCategory(bad)).toBe(false);
  });
});
