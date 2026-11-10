import type { StaffScope } from "@/lib/admin/guard";

/**
 * The scopes that may read why people leave: Operations (the COO holds every
 * scope), the Customer Support Lead and Marketing. An admin or super admin
 * passes with any of them. Kept apart from the door so a copilot tool can name
 * them without importing the page's server code.
 */
export const ACCOUNT_DELETION_SCOPES = ["operations", "support_lead", "marketing"] as const satisfies readonly StaffScope[];
