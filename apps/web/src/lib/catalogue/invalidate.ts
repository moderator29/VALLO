import "server-only";

import { CATALOGUE_LISTS_TAG, CATALOGUE_TAG, expireCatalogueTags, listingTag, stayTag, venueTag } from "./cache";

/**
 * WHAT A WRITE PATH CALLS AFTER IT CHANGES SOMETHING THE PUBLIC CATALOGUE SHOWS.
 *
 * One call, beside the write's own `revalidatePath`, once the write has
 * committed. It expires the cached copy of the thing that changed and every
 * cached list it could appear in (search results, shelves, the restaurant
 * list), so the next reader of any of them reads it fresh.
 *
 * Name the thing when it is known. With nothing named, the whole catalogue is
 * expired: correct, only slower for the next few readers, and the right answer
 * for a write that could touch many rows at once (a firm suspended, a lister
 * removed).
 */
export type CatalogueChange = {
  listingId?: string | null;
  stayId?: string | null;
  venueId?: string | null;
};

export function catalogueTagsFor(change: CatalogueChange = {}): string[] {
  const tags = [CATALOGUE_LISTS_TAG];
  if (change.listingId) tags.push(listingTag(change.listingId));
  if (change.stayId) tags.push(stayTag(change.stayId));
  if (change.venueId) tags.push(venueTag(change.venueId));
  if (!change.listingId && !change.stayId && !change.venueId) tags.push(CATALOGUE_TAG);
  return tags;
}

export function catalogueChanged(change: CatalogueChange = {}): void {
  expireCatalogueTags(catalogueTagsFor(change));
}
