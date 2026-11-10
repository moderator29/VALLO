/**
 * THE ONE PLACE THE OFFER ROUTES ARE SPELLED. Buttons in the docs, the
 * notifications and the listing page all go through here, so a route is
 * renamed once. Stable: do not change these paths without telling DOCS.
 */

/** My offers (Made and Received tabs). */
export const offersHref = "/offers";

/** My offers on one tab. */
export function offersTabHref(tab: "made" | "received"): string {
  return tab === "received" ? "/offers?tab=received" : "/offers";
}

/** One Deal Room, for either side. */
export function dealRoomHref(id: string): string {
  return `/offers/${encodeURIComponent(id)}`;
}

/** A Deal Room on one tab. */
export function dealRoomTabHref(id: string, tab: "overview" | "negotiation" | "messages" | "inspection" | "documents" | "activity"): string {
  return `${dealRoomHref(id)}?tab=${tab}`;
}

/** The offer flow for a sale listing. */
export function makeOfferHref(listingId: string): string {
  return `/listing/${encodeURIComponent(listingId)}/offer`;
}

/** The admin Offers and Deals desk. */
export const adminOffersHref = "/admin/offers";

/** One deal in the admin desk. */
export function adminDealHref(id: string): string {
  return `/admin/offers/${encodeURIComponent(id)}`;
}
