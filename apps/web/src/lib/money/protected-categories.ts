/**
 * WHICH DEALS MAY EVER REACH THE PROTECTED RAIL (PROTECTED_PAYMENTS_BUILD.md
 * section 9).
 *
 * Every category starts DISABLED. A category becomes `approved` only on the
 * provider's written approval naming Vallo's use case, recorded with a date
 * and the founder's sign-off, in the database (the category table in
 * supabase/migrations/pending/escrowpay_rail_foundation_2026-11-09.sql), never
 * from a client. This module is the code's half: the vocabulary, and the rule
 * that anything not `approved` is refused. A successful sandbox payment is NOT
 * approval.
 */

export const PROTECTED_CATEGORIES = [
  "residential_rent",
  "shortlet",
  "hotel_booking",
  "commercial_rent",
  "property_sale",
  "land_sale",
  "event_space",
  "other",
] as const;
export type ProtectedCategory = (typeof PROTECTED_CATEGORIES)[number];

export const CATEGORY_STATUSES = ["approved", "pending_approval", "not_supported", "disabled"] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

/** The default for every category, and what any unknown or unreadable answer means. */
export const DEFAULT_CATEGORY_STATUS: CategoryStatus = "disabled";

export function isProtectedCategory(value: unknown): value is ProtectedCategory {
  return typeof value === "string" && (PROTECTED_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Read a status as the database returned it. Anything that is not one of the
 * four words, including a failed read, is `disabled`: the rail fails closed.
 */
export function readCategoryStatus(value: unknown): CategoryStatus {
  return typeof value === "string" && (CATEGORY_STATUSES as readonly string[]).includes(value)
    ? (value as CategoryStatus)
    : DEFAULT_CATEGORY_STATUS;
}

/** Only an approved category may offer the protected option. */
export function categoryMayUseProtectedRail(status: CategoryStatus): boolean {
  return status === "approved";
}
