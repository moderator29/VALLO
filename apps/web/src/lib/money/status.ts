/**
 * THE VALLO STATUS VOCABULARY (D50; VALLO_FINANCIAL_LAYER.md section 4 item 1).
 *
 * Eleven statuses a member may see, and the tables that map every provider
 * word onto them. The rule: a raw provider status never reaches a member.
 * Provider words stay in `providerStatus` columns and in the audit view.
 *
 * Two rules from D50 are built into the tables, not left to callers:
 *  - Never "paid" before the provider has confirmed it. Anything not a
 *    confirmed success is at most `processing`.
 *  - An unknown provider word is `under_review`, never a guess at success
 *    or failure (a timeout is unknown, not a failure).
 *
 * This is a business vocabulary, separate from the escrow state machine
 * (7.6), whose `provider_status` column is likewise never overwritten.
 * The member-facing LABELS below are drafts for founder review (7.14); the
 * keys are the contract.
 */

export const VALLO_STATUSES = [
  "awaiting_payment",
  "processing",
  "paid",
  "protected",
  "release_pending",
  "released",
  "refund_processing",
  "refunded",
  "failed",
  "cancelled",
  "under_review",
] as const;
export type ValloStatus = (typeof VALLO_STATUSES)[number];

/** Draft labels, pending founder and counsel (handoff 7.14). */
export const VALLO_STATUS_LABEL_DRAFT: Record<ValloStatus, string> = {
  awaiting_payment: "Awaiting payment",
  processing: "Processing",
  paid: "Paid",
  protected: "Payment held until you confirm",
  release_pending: "Release pending",
  released: "Released",
  refund_processing: "Refund processing",
  refunded: "Refunded",
  failed: "Not completed",
  cancelled: "Cancelled",
  under_review: "Under review",
};

/** Paystack transaction `status` words (verify / webhook). */
const PAYSTACK: Readonly<Record<string, ValloStatus>> = {
  success: "paid",
  failed: "failed",
  // An open, unpaid checkout. Paystack says `abandoned` of any checkout not yet
  // paid, so it is not a failure (SESSION-2-RESPONSE, attempt sweep).
  abandoned: "awaiting_payment",
  pending: "processing",
  ongoing: "processing",
  processing: "processing",
  queued: "processing",
  reversed: "refunded",
};

export type ProviderVocabulary = "paystack";

const TABLES: Record<ProviderVocabulary, Readonly<Record<string, ValloStatus>>> = {
  paystack: PAYSTACK,
};

/** The Vallo status for a provider word. Unknown or missing: `under_review`. */
export function valloStatusFor(vocabulary: ProviderVocabulary, providerStatus: unknown): ValloStatus {
  if (typeof providerStatus !== "string") return "under_review";
  const table = TABLES[vocabulary];
  const key = providerStatus.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key]! : "under_review";
}

/** The mapping table itself, for the audit view and the tests. */
export function providerMappingTable(vocabulary: ProviderVocabulary): Readonly<Record<string, ValloStatus>> {
  return TABLES[vocabulary];
}
