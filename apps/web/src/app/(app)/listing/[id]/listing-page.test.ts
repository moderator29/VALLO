import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * THE LISTING PAGE, TO THE FOUNDER'S REFERENCE (13 October 2026), held where
 * a screen cannot be mounted under the unit config: the page is a server
 * component that reads a database, so its wiring is read as source, as the
 * other listing tests here do.
 *
 *   - A home to rent or to buy has "Schedule a visit", linking to the viewing
 *     flow at /listing/[id]/visit, on the pinned foot (full width on a phone)
 *     and on the desktop summary card. A stay keeps Check availability and its
 *     reserve panel; an example keeps its honest way out.
 *   - Nothing that was on the page left it: every panel and tool is still
 *     mounted.
 *   - The rating is drawn only with real reviews behind it, counted with
 *     countOf; the lister card reads published rows.
 */
const page = withoutComments(readFileSync(join(__dirname, "page.tsx"), "utf8"));

describe("Schedule a visit", () => {
  it("links to the viewing flow for this listing", () => {
    expect(page).toContain("const visitHref = `/listing/${listing.id}/visit`;");
    expect(page).toMatch(/isVisit\s*\?\s*(offerAction \?\? )?\{ label: t\.catalogue\.detail\.scheduleVisit, href: visitHref \}/);
  });

  it("is for a real home to rent or to buy, never an example", () => {
    expect(page).toContain("const isVisit = !isExample && (isRental || isSale);");
  });

  it("leaves a stay on its reserve flow, decided before the visit", () => {
    const action = page.slice(page.indexOf("const stickyAction"), page.indexOf("const stickySecondary"));
    expect(action.indexOf("isBookable")).toBeLessThan(action.indexOf("isVisit"));
    expect(action).toContain('{ label: t.catalogue.detail.checkAvailability, href: "#reserve" }');
  });

  it("takes the full width of a phone on the pinned foot", () => {
    expect(page).toMatch(/<ListingStickyBar[\s\S]*?stackOnPhone=\{isVisit\}/);
  });

  it("is the summary card's action from lg", () => {
    expect(page).toMatch(/<ListingSummaryCard[\s\S]*?action=\{\{ label: stickyAction\.label, href: stickyAction\.href/);
  });
});

describe("nothing the page carried was removed", () => {
  const MOUNTED = [
    "<RentalPanel",
    "<ReservePanel",
    "<ReserveTable",
    "<RestaurantPanel",
    "<StillAvailable",
    "<ViewingSlots",
    "<ListingGallery",
    "<ListingMapPanel",
    "<ListingReviews",
    "<OwnershipSeenMark",
    "<PriceContextRow",
    "<ReportSheet",
    "<TrustFacts",
    "<ListingMoveIn",
    "<ListingMoveInBlock",
    "<ListingPurchase",
    "<ListingTenure",
    "<ListingUtilities",
    "<ListingNeighbours",
    "<ListingCompound",
    "<ListingService",
    "<PropertyOffers",
    "<OwnerAvailabilityLine",
    "<ExactPlace",
    "<ListingCodeRow",
    "<ListingPhotoGrid",
    "<ListingAgentCard",
    "<ValloRecord",
    "<ReplyTimeLine",
    "<SimilarListings",
    "<CancellationTimeline",
    "<ListingSectionTabs",
    "<ListingAmenityTiles",
    "<FactGrid",
    "<LastLetLine",
    "<PhotographedLine",
    "<CautionRecordLine",
  ];
  it.each(MOUNTED)("still mounts %s", (tag) => {
    expect(page).toContain(tag);
  });

  it("keeps the booking panel in the column on a home to rent or buy at every width", () => {
    expect(page).toContain('<div className={isVisit ? undefined : "lg:hidden"}>{bookingPanel}</div>');
  });
});

describe("only real facts", () => {
  it("draws the rating only with reviews behind it, and counts them with countOf", () => {
    expect(page).toContain("listing.rating > 0 && listing.reviewCount > 0 &&");
    expect(page).toContain('countOf(listing.reviewCount, "reviews", locale)');
  });

  it("builds the lister card from the published read, and the call from the calls feature", () => {
    expect(page).toContain("readListerCard(listing)");
    expect(page).toContain("videoCallsOn()");
    expect(page).toContain("findConversationForListing({ listingId: listing.id })");
  });

  it("builds the highlights and the amenity row from the listing's own fields", () => {
    expect(page).toContain("listingHighlights(listing, t, locale, isRental && !isSale)");
    expect(page).toMatch(/<ListingAmenityTiles\s+variant="plates"\s+amenities=\{listing\.amenities\}\s+limit=\{5\}/);
  });

  it("never offers a call on an example listing or to a signed-out reader", () => {
    expect(page).toContain('session.state === "signed-in" && !listing.isDemo && listerCard');
  });
});
