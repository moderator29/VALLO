import { PaystackError, PaystackUnknownOutcome } from "@/lib/payments/paystack";

/**
 * A RESTAURANT BILL LEFT `pending` WITH NO CHECKOUT PAGE, AND HOW IT GETS OUT.
 *
 * `restaurant_bill_open` moves a bill to `pending` and mints its
 * `provider_ref` BEFORE this platform calls Paystack, which is right: the
 * reference has to exist before a charge can carry it. The page's address is
 * written afterwards, by `restaurant_bill_checkout_saved`. Between those two
 * writes the bill is `pending` with `authorization_url` null, and until today
 * that was a state nothing could leave:
 *
 *   - `payTableBill` answered the stored page for a `pending` bill, and with
 *     no page to answer fell through to a flat refusal;
 *   - `restaurant_bill_enter` answers `locked` for a `pending` bill, so the
 *     restaurant could not re-enter the amount either;
 *   - `restaurant_bill_reopen` is called only by the diner's return (which
 *     needs a reference they never received) and by `charge.failed` (which
 *     Paystack does not send for a page nobody opened);
 *   - and unlike the table deposit, whose hourly job marks a checkout nobody
 *     paid within two hours `abandoned`, no sweep looks at bills at all.
 *
 * So the bill was stuck, the diner could not pay, the restaurant could not
 * amend, and nothing anywhere said so. The window is real: `payTableBill`
 * reaches it whenever `openCheckout` throws `PaystackUnknownOutcome` (its own
 * comment promises "the bill stays pending and the return settles it", which
 * is only true if a charge actually exists), and whenever the process dies
 * between the checkout and `restaurant_bill_checkout_saved`.
 *
 * THE DECISION IS PAYSTACK'S, NOT OURS. Ask it what happened to the
 * reference:
 *
 *   success                   -> settle the bill. The money is there. Unless
 *                                the settle answers `mismatch`: the charge
 *                                did not match the bill, the database has
 *                                alerted a person, and nothing is claimed.
 *   failed / abandoned /
 *   reversed                  -> reopen, and a fresh reference is minted.
 *   an explicit refusal (4xx,
 *   which is what Paystack
 *   answers for a reference it
 *   never saw)                -> reopen: no charge exists under it.
 *   anything else, including
 *   PaystackUnknownOutcome    -> leave it exactly as it is. The charge may
 *                                exist, so the reference must stay on the
 *                                bill for the webhook to settle it.
 *
 * The reopen set is the one `confirmTableBillReturn` already uses, and it
 * carries that path's existing exposure: a diner holding a stale checkout page
 * for a reopened bill pays a reference the bill no longer carries, the webhook
 * answers `reference_not_ours`, and the route's warning alert is how a person
 * finds it. Narrowing it here and not there would only make the two paths
 * disagree.
 *
 * Every dependency is handed in, so the whole decision is unit tested with no
 * network and no database.
 */

export type StrandedBillVerdict = "settled" | "reopened" | "unknown";

export type StrandedBillDeps = {
  /** Paystack's record of the reference. Throws the way `lib/payments/paystack.ts` throws. */
  verify: (reference: string) => Promise<{ status: string; amountMinor: number; currency: string }>;
  /**
   * `restaurant_bill_settle` with the charged kobo and currency, answering its
   * own outcome. Only `settled` and `duplicate` mean the bill is paid:
   * `mismatch` means the charge did not match the bill, the database raised a
   * high risk alert and the bill is deliberately NOT marked paid.
   */
  settle: (reference: string, amountMinor: number, currency: string) => Promise<string | null>;
  /** `restaurant_bill_reopen`: pending back to awaiting_payment, reference cleared. */
  reopen: (reference: string) => Promise<void>;
};

const REOPEN_ON: ReadonlySet<string> = new Set(["failed", "abandoned", "reversed"]);

export async function recoverStrandedBill(
  deps: StrandedBillDeps,
  reference: string,
): Promise<StrandedBillVerdict> {
  let tx: Awaited<ReturnType<StrandedBillDeps["verify"]>>;
  try {
    tx = await deps.verify(reference);
  } catch (error) {
    if (error instanceof PaystackUnknownOutcome || !(error instanceof PaystackError)) return "unknown";
    await deps.reopen(reference);
    return "reopened";
  }
  if (tx.status === "success") {
    const outcome = await deps.settle(reference, tx.amountMinor, tx.currency);
    /* A `mismatch` or an unreadable answer is not a paid bill, and telling the
       diner it is would be the one sentence they could act on and shouldn't. */
    return outcome === "settled" || outcome === "duplicate" ? "settled" : "unknown";
  }
  if (REOPEN_ON.has(tx.status)) {
    await deps.reopen(reference);
    return "reopened";
  }
  return "unknown";
}
