import type { Database } from "../supabase/database.types";

/**
 * The shortlist's vocabulary. saved_places.entity_kind is text with a CHECK
 * (M13 explains why it does not reference M9's enum), so the union lives here
 * and mirrors the CHECK: the catalogue's three shelves.
 */
/** `roommate_listing` and `roommate_profile` (Vallo Roommates, 8 November 2026) need the roommate SQL's widened CHECK. */
export type SavedPlaceKind = "listing" | "accommodation" | "restaurant" | "roommate_listing" | "roommate_profile";

export const SAVED_PLACE_KINDS: readonly SavedPlaceKind[] = [
  "listing",
  "accommodation",
  "restaurant",
  "roommate_listing",
  "roommate_profile",
] as const;

export type SavedPlaceRow = Database["public"]["Tables"]["saved_places"]["Row"];

/**
 * The column is text under a CHECK, so the generated type is `string`. A row
 * the database accepted is one of the three by construction; this narrows it
 * for the type system and refuses, loudly, if the CHECK and this union ever
 * drift apart.
 */
export function asSavedPlaceKind(value: string): SavedPlaceKind {
  if ((SAVED_PLACE_KINDS as readonly string[]).includes(value)) return value as SavedPlaceKind;
  throw new Error(`saved_places.entity_kind holds a kind this build does not know: ${value}`);
}
