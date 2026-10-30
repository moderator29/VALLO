/**
 * Saved collections, the pure half: names, keys and the filter. Client-safe.
 *
 * A collection is a member's own named list over what they have saved
 * ("Lagos shortlist"). A list holds `kind:id` keys; the Saved page draws only
 * the members that are still saved, so un-saving never leaves a ghost in a list.
 */
import type { SavedPlaceKind } from "./db";

export const COLLECTION_NAME_MAX = 40;
export const COLLECTION_LIMIT = 20;

export type SavedCollection = { id: string; name: string; keys: string[] };

/** The one string that names a saved thing across the three shelves. */
export function collectionKey(kind: SavedPlaceKind, id: string): string {
  return `${kind}:${id}`;
}

/** A tidy name, or null when there is nothing left to name a list. */
export function cleanCollectionName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, COLLECTION_NAME_MAX).trim();
  return name.length > 0 ? name : null;
}

/** Keep only the items in the chosen list; no list chosen keeps everything. */
export function inCollection<T extends { id: string; place?: { kind: string } }>(
  items: T[],
  collection: SavedCollection | null,
): T[] {
  if (!collection) return items;
  const keys = new Set(collection.keys);
  return items.filter((item) => keys.has(`${item.place ? item.place.kind : "listing"}:${item.id}`));
}
