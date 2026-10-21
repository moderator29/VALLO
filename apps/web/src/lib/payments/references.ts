import "server-only";

import { randomUUID } from "node:crypto";

/**
 * The payment reference contract, in one place.
 *
 * A reference is not a cosmetic prefix. It is the key money moves on: the
 * wallet ledger's `reference` column is unique, `transactions.provider_ref` is
 * unique, and the Paystack webhook routes purely on these shapes. That is what
 * makes a replayed delivery collide with itself instead of posting twice. Never
 * invent a new shape without adding it here and teaching
 * app/api/paystack/webhook/route.ts to route it.
 *
 * The whole family this platform generates:
 *
 *  - `rm-fund-<uuid>`  Wallet funding. A hosted Paystack charge, settled by
 *    charge.success, which posts a COMPLETED deposit to wallet_entries. The
 *    verify-on-redirect fallback posts the identical row, so whichever arrives
 *    first wins and the second is a clean duplicate.
 *
 *  - `rm-wd-<uuid>`  Withdrawal. Posted first as a PENDING debit hold, then
 *    handed to Paystack as a transfer under the same reference;
 *    transfer.success / transfer.failed / transfer.reversed settle that one
 *    hold and nothing else.
 *
 *  - `rm-p2p-<uuid>-out` / `rm-p2p-<uuid>-in`  The paired legs of an internal
 *    transfer, written inside one database function so both land or neither.
 *
 *  - `rm-book-<uuid>`  A card payment against a booking. Written first as a
 *    PENDING `transactions` row whose `provider_ref` is the reference, then
 *    handed to Paystack. charge.success settles it (transaction to SUCCESSFUL,
 *    one balanced `ledger_entries` row, booking PENDING to CONFIRMED, state
 *    event, calendar nights) and charge.failed marks the transaction FAILED
 *    while leaving the booking PENDING so the guest can try again. The same
 *    shape carries a wallet payment: there it keys both the `payment` debit in
 *    wallet_entries and the `transactions` row written inside one atomic
 *    database function, so paying a booking from the wallet is idempotent on
 *    exactly the same key as paying it by card.
 *
 *  - `rm-refund-<uuid>`  Money going back to a guest after Vallo support
 *    cancels a stay they had paid for. Posted as a COMPLETED `refund` credit
 *    inside private.refund_and_cancel_booking, in the same transaction as the
 *    contra ledger row, the booking transition and the calendar release. The
 *    unique reference is what makes a double tap on the console a no-op rather
 *    than a second payment out. Nothing hands this shape to Paystack: the money
 *    lands in the Vallo wallet, exactly as /cancellations promises, and leaves
 *    it later as an ordinary withdrawal under `rm-wd-`.
 *
 *  - `rm-esc-<escrow uuid>-hold` / `-release` / `-refund`  Escrow. Three legs,
 *    one escrow agreement, all three in the SAME ledger everything else is in
 *    (`public.wallet_entries`, kinds `escrow_hold`, `escrow_release`,
 *    `escrow_refund`). There is no second table of escrow balances anywhere:
 *    a shadow ledger is how a marketplace ends up unable to answer "how much
 *    does this person have" with one number.
 *
 *    The uuid in the middle is the ESCROW ROW's id, not a fresh one. That is
 *    deliberate and it is the whole idempotency story: a retried release
 *    computes the identical reference, collides with the unique index on
 *    wallet_entries.reference, and moves nothing. A random uuid per attempt
 *    would make every retry a second payment. Each escrow therefore has at most
 *    one hold, and at most one of release or refund; a partial settlement is a
 *    new escrow row, not a fourth leg on this one.
 *
 * Nothing is added to a guest's price (HANDOFF.md section 2), so a booking
 * reference always moves the booking total and nothing more; Vallo's fee
 * comes out of the host's share inside the split.
 */

export const FUND_PREFIX = "rm-fund-";
export const WITHDRAW_PREFIX = "rm-wd-";
export const P2P_PREFIX = "rm-p2p-";
export const BOOKING_PREFIX = "rm-book-";
export const REFUND_PREFIX = "rm-refund-";
export const ESCROW_PREFIX = "rm-esc-";
/**
 * A crypto on-ramp deposit.
 *
 * Its own prefix rather than reusing `rm-fund-`, because the two are settled by
 * DIFFERENT PROCESSORS and the reconciliation sweep asks Paystack for every
 * charge it has taken. A crypto deposit carrying a fund reference would be a
 * row that sweep looks for at Paystack, does not find, and has to decide about
 * - and the safe decision on "a credit we cannot see at the processor" is one
 * nobody should have to make by hand.
 */
export const CRYPTO_PREFIX = "rm-yc-";
/**
 * D75: a restaurant table deposit (`public.reservation_deposits`). Its own
 * prefix, like a promotion, because a reservation is not a booking: it settles
 * through `reservation_deposit_settle`, never `settle_booking_charge`.
 */
export const DEPOSIT_PREFIX = "rm-dep-";
/**
 * A restaurant bill paid through Vallo (`public.restaurant_bills`), minted by
 * `restaurant_bill_open`. Settled through `restaurant_bill_settle`, by the
 * webhook or the diner's return, whichever arrives first.
 */
export const BILL_PREFIX = "rm-bill-";

const REFERENCE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a restaurant bill reference the database minted (shape-checked). */
export function isBillReference(value: string): boolean {
  if (!value.startsWith(BILL_PREFIX)) return false;
  return REFERENCE_UUID_RE.test(value.slice(BILL_PREFIX.length));
}

/** A fresh reference for one payment attempt against a booking. */
export function bookingReference(): string {
  return `${BOOKING_PREFIX}${randomUUID()}`;
}

/** True for a table deposit reference this platform made (shape-checked, like a booking's). */
export function isDepositReference(value: string): boolean {
  if (!value.startsWith(DEPOSIT_PREFIX)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.slice(DEPOSIT_PREFIX.length));
}

/** A fresh reference for one refund out of a cancellation decision. */
export function refundReference(): string {
  return `${REFUND_PREFIX}${randomUUID()}`;
}

/**
 * True when a string is a reference this platform generated for a booking
 * payment. Shape-checked, not merely prefix-checked, so a hand-typed value
 * cannot reach a settlement path.
 */
export function isBookingReference(value: string): boolean {
  if (!value.startsWith(BOOKING_PREFIX)) return false;
  return REFERENCE_UUID_RE.test(value.slice(BOOKING_PREFIX.length));
}

/**
 * True when a string is a reference this platform generated for a wallet
 * funding. The reconciliation sweep asks Paystack for every successful charge
 * it has taken, and most of them are not ours to credit; this is the shape test
 * that decides which ones are.
 */
export function isFundReference(value: string): boolean {
  if (!value.startsWith(FUND_PREFIX)) return false;
  return REFERENCE_UUID_RE.test(value.slice(FUND_PREFIX.length));
}

/** True when a string is a reference this platform generated for a crypto
    deposit. Same shape test as `isFundReference`, against the other prefix. */
export function isCryptoReference(value: string): boolean {
  if (!value.startsWith(CRYPTO_PREFIX)) return false;
  return REFERENCE_UUID_RE.test(value.slice(CRYPTO_PREFIX.length));
}

/** The three legs an escrow agreement can ever post. */
export type EscrowLeg = "hold" | "release" | "refund";

/**
 * The reference for one leg of one escrow agreement.
 *
 * Deterministic on the escrow id, which is what makes every escrow movement
 * safe to retry: the second attempt writes the same key and the unique index
 * refuses it. Never call this with a value that is not the escrow row's id.
 */
export function escrowReference(escrowId: string, leg: EscrowLeg): string {
  return `${ESCROW_PREFIX}${escrowId}-${leg}`;
}

/**
 * ESC-P2-03. The escrow agreement a ledger reference belongs to, whichever of
 * the two formats wrote it: the hold is `rm-esc-<id>-hold`, and the
 * settlement credits `private.escrow_settle` posts are `escrow:release:<id>`
 * and `escrow:refund:<id>` (a reversed one carries `:reversed:<n>` after the
 * id). Null for anything else.
 */
export function escrowIdFromReference(value: string): string | null {
  if (isEscrowReference(value)) {
    const rest = value.slice(ESCROW_PREFIX.length);
    return rest.slice(0, rest.lastIndexOf("-"));
  }
  const settled = /^escrow:(?:release|refund):([0-9a-f-]{36})(?::reversed:.+)?$/i.exec(value);
  if (settled && REFERENCE_UUID_RE.test(settled[1] ?? "")) return settled[1] ?? null;
  return null;
}

/** True when a string is a reference this platform generated for escrow. */
export function isEscrowReference(value: string): boolean {
  if (!value.startsWith(ESCROW_PREFIX)) return false;
  const rest = value.slice(ESCROW_PREFIX.length);
  const cut = rest.lastIndexOf("-");
  if (cut < 0) return false;
  const leg = rest.slice(cut + 1);
  if (leg !== "hold" && leg !== "release" && leg !== "refund") return false;
  return REFERENCE_UUID_RE.test(rest.slice(0, cut));
}
