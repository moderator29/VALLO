import type { ArrangementStatus } from "@/lib/money/arrangement-states";
import type { UiIconName } from "@/design-system/icons/UiIcon";

/**
 * THE SCREENS NOBODY ASKS FOR (spec two, "The screens nobody asks for"; BUILD
 * 7.8), as states of the same protected payment. Pure and client-safe.
 *
 * An issue is read from what Vallo RECORDED, never from the browser:
 *  - a review the provider's report or the reconcile put on the payment
 *    (`provider_arrangements.status = 'requires_review'` with a coded
 *    `review_reason`: `amount_mismatch`, `late_transfer` or
 *    `duplicate_transfer`, optionally followed by `received_minor=<kobo>`);
 *  - the reconcile's own word on its last run (`last_reconcile_result`:
 *    `provider_unavailable`, `release_overdue`, `refund_overdue`);
 *  - an instruction the bank has not confirmed for longer than
 *    `DELAY_AFTER_HOURS`, an internal threshold for saying "longer than
 *    usual", never shown to anyone as a promise;
 *  - the lister having no payout account, read under their own session.
 * Anything not recognised is no issue at all: the ordinary screen for the
 * recorded state is drawn.
 */

export const PROTECTED_ISSUE_KINDS = [
  "partner_unavailable",
  "amount_mismatch",
  "late_transfer",
  "duplicate_transfer",
  "release_delayed",
  "refund_delayed",
  "payout_missing",
] as const;
export type ProtectedIssueKind = (typeof PROTECTED_ISSUE_KINDS)[number];

export type ProtectedIssue =
  | { kind: "partner_unavailable"; lastConfirmedAt: string | null }
  | { kind: "amount_mismatch"; receivedMinor: number | null }
  | { kind: "late_transfer" }
  | { kind: "duplicate_transfer" }
  | { kind: "release_delayed"; askedAt: string | null }
  | { kind: "refund_delayed"; askedAt: string | null }
  | { kind: "payout_missing" };

/** Each issue's icon. Its words are `PROTECTED_ISSUE` in lib/money/copy.ts. */
export const ISSUE_ICON: Readonly<Record<ProtectedIssueKind, UiIconName>> = {
  partner_unavailable: "globe",
  amount_mismatch: "coins",
  late_transfer: "calendar-clock",
  duplicate_transfer: "repost",
  release_delayed: "hourglass",
  refund_delayed: "hourglass",
  payout_missing: "banknote",
};

/** After this long without the bank's word, an instruction reads as "taking longer than usual". */
export const DELAY_AFTER_HOURS = 48;

const REVIEW_CODES = ["amount_mismatch", "late_transfer", "duplicate_transfer"] as const;
const FINAL: readonly ArrangementStatus[] = ["released", "refunded", "split", "failed", "cancelled"];

export type IssueFacts = {
  status: ArrangementStatus;
  reviewReason: string | null;
  lastReconcileResult: string | null;
  /** The last time the provider's state was read, for the stale-status line. */
  lastConfirmedAt: string | null;
  releaseRequestedAt: string | null;
  refundRequestedAt: string | null;
  now: number;
};

/** The received amount, when the review reason carries it (`received_minor=123400`). */
function receivedFrom(reason: string): number | null {
  const m = /\breceived_minor=(\d{1,15})\b/.exec(reason);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function olderThan(iso: string | null, hours: number, now: number): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && now - at > hours * 3_600_000;
}

/** The payer's issue for a recorded arrangement, or null. */
export function issueFor(f: IssueFacts): ProtectedIssue | null {
  const reconcile = (f.lastReconcileResult ?? "").trim().toLowerCase();
  if (f.status === "requires_review" && f.reviewReason) {
    const code = REVIEW_CODES.find((c) => f.reviewReason!.trim().toLowerCase().startsWith(c));
    if (code === "amount_mismatch") return { kind: "amount_mismatch", receivedMinor: receivedFrom(f.reviewReason) };
    if (code) return { kind: code };
  }
  /* A partner that does not answer never reads as "your money is fine": the
     last confirmed state is shown as that, with its time. */
  if (reconcile === "provider_unavailable" && !FINAL.includes(f.status)) {
    return { kind: "partner_unavailable", lastConfirmedAt: f.lastConfirmedAt };
  }
  if (f.status === "release_requested" && (reconcile === "release_overdue" || olderThan(f.releaseRequestedAt, DELAY_AFTER_HOURS, f.now))) {
    return { kind: "release_delayed", askedAt: f.releaseRequestedAt };
  }
  if (f.status === "refund_requested" && (reconcile === "refund_overdue" || olderThan(f.refundRequestedAt, DELAY_AFTER_HOURS, f.now))) {
    return { kind: "refund_delayed", askedAt: f.refundRequestedAt };
  }
  return null;
}
