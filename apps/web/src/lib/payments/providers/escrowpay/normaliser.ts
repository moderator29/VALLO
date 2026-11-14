import type { ArrangementStatus } from "@/lib/money/arrangement-states";

/**
 * THE PROVIDER'S WORDS ONTO VALLO'S STATES (audit section 10.3).
 *
 * Two vocabularies, both the provider's own:
 *  - its webhook EVENT names (docs.escrowpay.app, "Webhooks", a closed set),
 *    mapped in `ESCROWPAY_EVENT_STATES`;
 *  - the STATUS word on a transaction read back with
 *    `GET /api/v1/transactions/{id}`, mapped in `ESCROWPAY_STATUS_WORDS`.
 *
 * Rules the tests pin:
 *  - funded (`protected`) and `released` come ONLY from a word that means
 *    exactly that;
 *  - an unknown word is `null`: recorded, and acted on not at all. It is
 *    never `released`, never `protected`;
 *  - `split` is historical and is never produced here;
 *  - an event that reports a part of the money (a partial funding, a release
 *    or refund of less than the whole) is `requires_review`, which the rail
 *    decides from the amount: this table only names the event's meaning.
 */
export const ESCROWPAY_EVENT_STATES: Readonly<Record<string, ArrangementStatus>> = Object.freeze({
  /* The transfer has been seen and is being confirmed (spec screen 4). */
  "transaction.funding_started": "payment_processing",
  /* The bank holds the whole amount. */
  "transaction.funded": "protected",
  /* Less than the whole arrived on an exact-amount transaction: a person looks. */
  "transaction.partially_funded": "requires_review",
  /* Unfunded and closed by the provider. */
  "transaction.expired": "cancelled",
  "transaction.cancelled": "cancelled",
  /* The money has left the bank's hold for the seller. */
  "release.completed": "released",
  /* The money is back with the payer. */
  "refund.completed": "refunded",
  /* An instruction Vallo gave did not go through, or money came back: a person looks. */
  "release.failed": "requires_review",
  "refund.failed": "requires_review",
  "refund.requires_action": "requires_review",
  "charge.reversed": "requires_review",
});

/**
 * The transaction's own status word, each one seen on the provider's sandbox
 * on 14 November 2026 (`docs/handoff/ESCROWPAY_INTEGRATION.md`, "The sandbox
 * run"), never guessed:
 *
 *   draft            made, not yet payable. No Vallo state: the open is not finished.
 *   pending_funding  activated, waiting for the transfer
 *   funded           the whole amount is held (`funded_minor` is the amount)
 *   released         the whole amount has been released
 *   refunded         the whole amount has been refunded
 *   cancelled        withdrawn before any money arrived
 *
 * `expired` was not reached on the sandbox (it needs the funding deadline to
 * pass); it is the provider's own word in its webhook list
 * (`transaction.expired`) and among the closed states its dashboard reads.
 */
export const ESCROWPAY_STATUS_WORDS: Readonly<Record<string, ArrangementStatus>> = Object.freeze({
  pending_funding: "awaiting_payment",
  funded: "protected",
  released: "released",
  refunded: "refunded",
  cancelled: "cancelled",
  expired: "cancelled",
});

function lookup(table: Readonly<Record<string, ArrangementStatus>>, word: unknown): ArrangementStatus | null {
  if (typeof word !== "string") return null;
  const key = word.trim().toLowerCase();
  if (!key || !Object.prototype.hasOwnProperty.call(table, key)) return null;
  const state = table[key]!;
  return state === "split" ? null : state;
}

/** A transaction's status word onto Vallo's state, or null for a word the sandbox never showed. */
export function normaliseEscrowPayStatus(word: unknown): ArrangementStatus | null {
  return lookup(ESCROWPAY_STATUS_WORDS, word);
}

/** A webhook event name onto Vallo's state, or null for an event that moves no arrangement. */
export function normaliseEscrowPayEvent(event: unknown): ArrangementStatus | null {
  return lookup(ESCROWPAY_EVENT_STATES, event);
}
