import { z } from "zod";
import { getListingRepository } from "@/lib/listings/repository";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import type { Listing } from "@/lib/listings/types";
import { cardFor } from "../cards";
import type { AssistantListingItem } from "../types";
import { priceLine } from "./listing-facts";
import { defineTool, TOOL_FRAMES } from "./types";

const uuid = z.string().uuid();

function itemOf(l: Listing): AssistantListingItem {
  return {
    id: l.id,
    title: l.title,
    city: l.city,
    kind: l.kind,
    price: priceLine(l),
    rating: l.rating,
    verified: l.verified,
    ...(l.bedrooms > 0 ? { bedrooms: l.bedrooms } : {}),
    ...(l.bathrooms > 0 ? { bathrooms: l.bathrooms } : {}),
    ...(l.sizeSqm !== undefined && l.sizeSqm > 0 ? { sizeSqm: l.sizeSqm } : {}),
    href: hrefForListing(l.kind, l.id, marketFactsOf(l)),
    ...(l.photos[0] ? { photo: l.photos[0] } : {}),
  };
}

export { itemOf as listingItemOf };

const EXAMPLE_NOTE =
  "This is an example listing that shows how Vallo looks. It cannot be viewed, booked or paid for. Say so plainly and do not describe it as available.";

/** Public photographs of one real listing. Nothing private, so no permission is needed. */
export const getListingPhotosTool = defineTool({
  name: "get_listing_photos",
  description:
    "Show every available picture of ONE listing, by its id, as a swipeable strip under your answer. Use it when somebody asks for more pictures. You are told only how many there are; the pictures themselves appear on screen.",
  input: z.object({ listing_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { listing_id: { type: "string", description: "The listing id exactly as search_listings gave it." } },
    required: ["listing_id"],
  },
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(_ctx, input) {
    const l = await getListingRepository().byId(input.listing_id);
    if (!l) return { data: { error: "That listing could not be found." } };
    if (l.isDemo) return { data: { example: true, title: l.title }, note: EXAMPLE_NOTE };
    const urls = l.photos.filter((p) => typeof p === "string" && /^https?:\/\//.test(p)).slice(0, 20);
    if (urls.length === 0) return { data: { title: l.title, photoCount: 0 }, note: "This listing has no pictures yet. Say so." };
    return { data: { title: l.title, photoCount: urls.length }, events: [{ type: "photos", listingId: l.id, title: l.title, urls }] };
  },
});

/** The real fields of one listing, and its card with buttons. */
export const getListingDetailsTool = defineTool({
  name: "get_listing_details",
  description:
    "Read the real details of ONE listing by id: kind, place, price, rooms, size, amenities, who verified what, and a short description. Use it to answer questions about a specific place. It also puts the listing card, with its buttons, on screen. Never state a detail it did not return.",
  input: z.object({ listing_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { listing_id: { type: "string", description: "The listing id exactly as search_listings gave it." } },
    required: ["listing_id"],
  },
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(ctx, input) {
    const l = await getListingRepository().byId(input.listing_id);
    if (!l) return { data: { error: "That listing could not be found." } };
    const viewings = Boolean(ctx.access?.permissions.includes("bookings_viewings"));
    const item = itemOf(l);
    const data = {
      id: l.id,
      title: l.title,
      kind: l.kind,
      area: l.area,
      city: l.city,
      state: l.state,
      price: priceLine(l),
      rating: l.rating,
      reviewCount: l.reviewCount,
      ...(l.bedrooms > 0 ? { bedrooms: l.bedrooms } : {}),
      ...(l.bathrooms > 0 ? { bathrooms: l.bathrooms } : {}),
      ...(l.sizeSqm !== undefined && l.sizeSqm > 0 ? { sizeSqm: l.sizeSqm } : {}),
      ...(l.amenities.length > 0 ? { facts: l.amenities.slice(0, 12) } : {}),
      verified: l.verified,
      photoCount: l.photos.length,
      ...(l.isDemo ? { example: true } : {}),
      href: item.href,
    };
    return {
      data,
      ...(l.isDemo ? { note: EXAMPLE_NOTE } : {}),
      events: [{ type: "cards", items: [cardFor(item, { viewings, example: Boolean(l.isDemo) })] }],
    };
  },
});
