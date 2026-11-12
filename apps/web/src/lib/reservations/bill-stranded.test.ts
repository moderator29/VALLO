import { describe, expect, it, vi } from "vitest";

import { PaystackError, PaystackUnknownOutcome } from "../payments/paystack";
import { recoverStrandedBill, type StrandedBillDeps } from "./bill-stranded";

/**
 * The whole decision for a bill left `pending` with no checkout page, with
 * Paystack and the database handed in. The two branches the action's own tests
 * do not reach are the ones that matter most here: Paystack reporting a status
 * that is neither paid nor finished must leave the reference alone, because
 * the reference is the only thing the webhook can settle the bill by.
 */
function deps(verify: StrandedBillDeps["verify"], settleOutcome: string | null = "settled") {
  const settle = vi.fn(async () => settleOutcome);
  const reopen = vi.fn(async () => undefined);
  return { d: { verify, settle, reopen } as StrandedBillDeps, settle, reopen };
}

const REF = "rm-bill-0f8fad5b-d9cb-469f-a165-70867728950e";
const paid = { status: "success", amountMinor: 1_250_000, currency: "NGN" };

describe("recovering a stranded restaurant bill", () => {
  it("settles a charge Paystack says succeeded, with Paystack's kobo and currency", async () => {
    const { d, settle, reopen } = deps(async () => paid);
    expect(await recoverStrandedBill(d, REF)).toBe("settled");
    expect(settle).toHaveBeenCalledWith(REF, 1_250_000, "NGN");
    expect(reopen).not.toHaveBeenCalled();
  });

  it("counts a duplicate settle as settled, because the bill is paid either way", async () => {
    const { d } = deps(async () => paid, "duplicate");
    expect(await recoverStrandedBill(d, REF)).toBe("settled");
  });

  /**
   * `restaurant_bill_settle` answers `mismatch` when the charge does not match
   * the bill: it raises a high risk alert and deliberately leaves the bill
   * unpaid. Reporting that as paid would be the one sentence the diner could
   * act on and should not.
   */
  it("does not call a mismatched or unreadable settle a paid bill", async () => {
    for (const outcome of ["mismatch", "not_found", null]) {
      const { d, settle, reopen } = deps(async () => paid, outcome);
      expect(await recoverStrandedBill(d, REF), String(outcome)).toBe("unknown");
      expect(settle).toHaveBeenCalledOnce();
      expect(reopen).not.toHaveBeenCalled();
    }
  });

  it("reopens a charge that failed, was abandoned or was reversed", async () => {
    for (const status of ["failed", "abandoned", "reversed"]) {
      const { d, settle, reopen } = deps(async () => ({ ...paid, status }));
      expect(await recoverStrandedBill(d, REF), status).toBe("reopened");
      expect(reopen).toHaveBeenCalledWith(REF);
      expect(settle).not.toHaveBeenCalled();
    }
  });

  it("reopens when Paystack refuses the reference outright, because no charge exists under it", async () => {
    const { d, settle, reopen } = deps(async () => {
      throw new PaystackError("Transaction reference not found", 404);
    });
    expect(await recoverStrandedBill(d, REF)).toBe("reopened");
    expect(reopen).toHaveBeenCalledWith(REF);
    expect(settle).not.toHaveBeenCalled();
  });

  it("changes nothing when Paystack does not answer: the charge may exist", async () => {
    const { d, settle, reopen } = deps(async () => {
      throw new PaystackUnknownOutcome("The payment service could not be reached.");
    });
    expect(await recoverStrandedBill(d, REF)).toBe("unknown");
    expect(reopen).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });

  it("changes nothing for a charge still in progress", async () => {
    for (const status of ["ongoing", "pending", "queued", ""]) {
      const { d, settle, reopen } = deps(async () => ({ ...paid, status }));
      expect(await recoverStrandedBill(d, REF), status).toBe("unknown");
      expect(reopen).not.toHaveBeenCalled();
      expect(settle).not.toHaveBeenCalled();
    }
  });

  it("changes nothing when something other than a Paystack error is thrown", async () => {
    const { d, settle, reopen } = deps(async () => {
      throw new TypeError("fetch is not a function");
    });
    expect(await recoverStrandedBill(d, REF)).toBe("unknown");
    expect(reopen).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });
});
