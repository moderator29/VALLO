import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE GATE ON THE CATALOGUE CACHE'S TWO ENDS (platform speed, 13 November 2026).
 *
 * 1. Every page that DRAWS the public catalogue reads it through the cached
 *    reader, not the live repository, so no page quietly goes back to paying
 *    a dozen round trips per visitor.
 * 2. Every write path that changes what the catalogue shows tells the cache,
 *    with the right thing named, so no reader is served a copy the write made
 *    wrong (a takedown, a price, a photo, a review).
 *
 * Read from source, function by function, because these are server actions
 * whose real run needs a database: what is held here is that the call is
 * there, in that function, with that argument. `cache.test.ts` holds what the
 * call does.
 */

const SRC = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(`${SRC}/${path}`, "utf8");

/** The body of `name` (function declaration), up to the next top-level declaration. */
function body(source: string, name: string): string {
  const start = source.search(new RegExp(`^(export )?(async )?function ${name}\\b`, "m"));
  if (start < 0) throw new Error(`function ${name} not found`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(export |async |function |const |type |\/\*\* -)/m);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

describe("pages draw the public catalogue from the cache", () => {
  const pages: Array<[string, RegExp]> = [
    ["app/(app)/search/page.tsx", /catalogueReader\(\)/],
    ["app/(app)/stays/page.tsx", /publicStaysShelf\(/],
    ["app/(app)/stays/page.tsx", /catalogueReader\(\)/],
    ["app/(app)/restaurants/page.tsx", /publicRestaurants\(/],
    ["app/(app)/restaurants/page.tsx", /catalogueReader\(\)/],
    ["app/(app)/restaurants/page.tsx", /publicBusinessCovers\(/],
    ["app/(app)/stay/[id]/page.tsx", /publicStayDetail\(/],
    ["app/(app)/restaurant/[id]/page.tsx", /publicRestaurantDetail\(/],
    ["app/(app)/home/page.tsx", /catalogueReader\(\)/],
    ["components/app/listing/SimilarListings.tsx", /catalogueReader\(\)/],
    ["components/app/search/RealMap.tsx", /catalogueReader\(\)/],
    ["components/app/home/HomeStreams.tsx", /catalogueReader\(\)/],
    ["lib/listings/listing-by-id.ts", /catalogueReader\(\)\.byId\(/],
  ];
  it.each(pages)("%s reads through the cache", (path, pattern) => {
    const source = read(path);
    expect(source).toMatch(pattern);
    expect(source).not.toMatch(/getListingRepository\(\)/);
    expect(source).not.toMatch(/\b(getStayDetail|getRestaurantDetail|listStaysShelf|listRestaurants|businessCoverUrls)\(/);
  });

  it("the stays home reads the greeting without the trending strip it never draws", () => {
    expect(read("app/(app)/stays/page.tsx")).toMatch(/getHomeOverview\(\{ trending: false \}\)/);
  });

  it("checkout keeps the live stay read, because it takes a payment at the rate it shows", () => {
    expect(read("app/(app)/checkout/page.tsx")).toMatch(/getStayDetail\(stayId\)/);
  });

  it("the cached readers read anonymously and strictly, so nothing private and no failure is kept", () => {
    const listings = read("lib/catalogue/listings.ts");
    expect(listings).toMatch(/persistSession: false/);
    expect(listings).toMatch(/new SupabaseListingRepository\([\s\S]*?,\s*true,\s*\)/);
    const stays = read("lib/catalogue/stays.ts");
    expect(stays).toMatch(/persistSession: false/);
    expect(stays.match(/strict: true/g)?.length).toBe(5);
  });
});

describe("write paths tell the cache", () => {
  const writes: Array<[string, string, string]> = [
    ["lib/admin/actions.ts", "decideListing", "catalogueChanged({ listingId: listing.id })"],
    ["lib/admin/actions.ts", "resolveReport", "catalogueChanged()"],
    ["lib/admin/moderation-actions.ts", "decideHeldItem", "catalogueChanged()"],
    ["lib/admin/queue-desk-actions.ts", "bulkAct", "catalogueChanged()"],
    ["lib/agent/listings-actions.ts", "refreshAgentSurfaces", "catalogueChanged({ listingId })"],
    ["lib/agent/listings-actions.ts", "addPhoto", "refreshAgentSurfaces(listingId)"],
    ["lib/agent/listings-actions.ts", "removePhoto", "refreshAgentSurfaces(listingId)"],
    ["lib/agent/listings-actions.ts", "reorderPhotos", "refreshAgentSurfaces(listingId)"],
    ["lib/agent/listings-actions.ts", "reorderMedia", "refreshAgentSurfaces(listingId)"],
    ["lib/agent/listings-actions.ts", "setAmenities", "refreshAgentSurfaces(listingId)"],
    ["lib/agent/listings-actions.ts", "saveDraft", "refreshAgentSurfaces("],
    ["lib/agent/listings-actions.ts", "submitListing", "refreshAgentSurfaces("],
    ["lib/agent/listings-actions.ts", "unpublishListing", "refreshAgentSurfaces("],
    ["lib/agent/listings-actions.ts", "deleteListing", "refreshAgentSurfaces("],
    ["lib/agent/listings-actions.ts", "addVideo", "refreshAgentSurfaces("],
    ["lib/agent/listings-actions.ts", "removeVideo", "refreshAgentSurfaces("],
    ["lib/agent/reviews-actions.ts", "", "catalogueChanged({ listingId: data.listing_id })"],
    ["lib/reviews/actions.ts", "submitReviewWork", "catalogueChanged(hotelId ? { stayId: hotelId } : { listingId })"],
    ["lib/offers/actions.ts", "", "catalogueChanged({ listingId: parsed.data.listingId })"],
    ["lib/landlord/close-actions.ts", "", "catalogueChanged({ listingId: parsed.data.listingId })"],
    ["lib/landlord/close-actions.ts", "", "catalogueChanged({ listingId: id.data })"],
    ["lib/reservations/deposit-settings-actions.ts", "", "catalogueChanged({ venueId: businessId })"],
    ["lib/business-transfer/actions.ts", "closeBusiness", "catalogueChanged()"],
  ];
  it.each(writes)("%s %s calls %s", (path, fn, call) => {
    const source = read(path);
    expect(fn ? body(source, fn) : source).toContain(call);
  });

  it("every host and console write that revalidates a public stays or restaurant page also tells the cache", () => {
    for (const path of [
      "lib/host/actions.ts",
      "lib/host/calendar-actions.ts",
      "lib/host/calendar-sync-actions.ts",
      "lib/admin/business-actions.ts",
    ]) {
      const lines = read(path).split("\n");
      lines.forEach((line, i) => {
        if (/revalidatePath\("\/(stays|restaurants)"\)/.test(line)) {
          const near = lines.slice(Math.max(0, i - 3), i).join("\n");
          expect(near, `${path}:${i + 1}`).toContain("catalogueChanged(");
        }
      });
    }
  });
});
