import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The flatmate's return from Paystack (settleShareReturn), and the rule the
 * success sheet depends on: a share is settled, and celebrated, only against
 * the move-in on the screen it came back to (docs/SUCCESS_MOMENTS.md).
 */
const REF = "rm-book-22222222-2222-4222-8222-222222222222";
const TENANCY = "11111111-1111-4111-8111-111111111111";

const s = vi.hoisted(() => ({
  txBooking: "bk-1" as string | null,
  tenancyBooking: "bk-1" as string | null,
  settle: vi.fn(),
  /* Typed at the seam: left to infer it would be a function of no arguments
     returning exactly this shape, and every mockResolvedValue below would be
     rejected by the compiler. */
  refund: vi.fn(
    async (
      _admin: unknown,
      _params: unknown,
    ): Promise<{ ok: true; refundId: string } | { ok: false; reason: string }> => ({ ok: true, refundId: "rf_1" }),
  ),
}));

vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "unconfigured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({ state: "signed-in", user: { id: "payer-1" } }),
}));
vi.mock("../payments/paystack", () => ({
  PaystackError: class extends Error {},
  initializeTransaction: vi.fn(),
  isPaystackConfigured: () => true,
  verifyTransaction: async () => ({ status: "success", amountMinor: 25_000_000, feesMinor: 0, currency: "NGN" }),
}));
vi.mock("../payments/paystack-mode", () => ({ currentPaystackMode: () => "test", currentReserveSubaccount: () => "ACCT" }));
vi.mock("../bookings/settlement", () => ({ markChargeFailed: vi.fn(), settleBookingCharge: s.settle }));
vi.mock("../payments/refund", () => ({ refundChargeToCard: s.refund, REFUND_ALREADY_CLAIMED: "refund_already_claimed" }));
vi.mock("../security/money-limits", () => ({ guardMoney: async () => ({ allowed: true }) }));
vi.mock("../security/idempotency", () => ({ IN_FLIGHT_MESSAGE: "x", withIdempotency: vi.fn() }));
vi.mock("../payments/attempts", () => ({ recordCheckoutHandle: vi.fn(), reuseLiveAttempt: vi.fn() }));
vi.mock("../money/audit", () => ({ recordMoneyAudit: vi.fn(async () => undefined) }));
vi.mock("../bookings/arrival", () => ({ announceConfirmedStay: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase/service", () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({
        data:
          table === "transactions"
            ? { share_payer_id: "payer-1", booking_id: s.txBooking }
            : table === "rent_payments"
              ? { booking_id: s.tenancyBooking }
              : null,
        error: null,
      });
      return chain;
    },
  }),
}));

import { settleShareReturn } from "./share-checkout";

beforeEach(() => {
  s.txBooking = "bk-1";
  s.tenancyBooking = "bk-1";
  s.settle.mockReset();
  s.refund.mockReset();
  s.refund.mockResolvedValue({ ok: true, refundId: "rf_1" });
  s.settle.mockResolvedValue({
    outcome: "share-settled",
    bookingId: "bk-1",
    amountMinor: 25_000_000,
    paidMinor: 25_000_000,
    totalMinor: 100_000_000,
    ledger: {},
  });
});

describe("settleShareReturn", () => {
  it("settles a share of the move-in on this screen, and says what this charge was", async () => {
    const result = await settleShareReturn({ reference: REF, tenancyId: TENANCY });
    expect(result).toEqual({
      ok: true,
      data: { state: "share-settled", paidMinor: 25_000_000, totalMinor: 100_000_000, amountMinor: 25_000_000 },
    });
  });

  it("refuses, and settles nothing, when the payment is for a different move-in", async () => {
    s.txBooking = "bk-OTHER";
    const result = await settleShareReturn({ reference: REF, tenancyId: TENANCY });
    expect(result.ok).toBe(false);
    expect(s.settle).not.toHaveBeenCalled();
  });

  it("refuses when either side of the match cannot be read", async () => {
    s.tenancyBooking = null;
    expect((await settleShareReturn({ reference: REF, tenancyId: TENANCY })).ok).toBe(false);
    expect(s.settle).not.toHaveBeenCalled();
  });
});

/**
 * WHAT THE PAYER IS TOLD WHEN THE CHARGE COULD NOT BE APPLIED.
 *
 * `settle_booking_charge` answers `refund-due` for money the processor took
 * that cannot be put against the move-in, marks the attempt FAILED and raises
 * a high risk alert telling the desk to refund it by hand. Nothing automatic
 * retries it: the sweep only looks at PENDING attempts, and a replay answers
 * `already-settled` with transaction_status REFUND_DUE rather than refunding
 * again.
 *
 * So whether the refund was actually accepted is the whole of what this
 * screen may promise. The webhook has always read it (`route.ts` distinguishes
 * submitted, already claimed and failed); this path threw the answer away and
 * told every payer the money was on its way.
 */
describe("settleShareReturn when the charge cannot be applied", () => {
  beforeEach(() => {
    s.settle.mockResolvedValue({
      outcome: "refund-due",
      bookingId: "bk-1",
      reason: "already_paid",
      amountMinor: 25_000_000,
      reference: REF,
    });
  });

  it("promises the money back when the processor took the refund", async () => {
    s.refund.mockResolvedValue({ ok: true, refundId: "rf_1" });
    const result = await settleShareReturn({ reference: REF, tenancyId: TENANCY });
    expect(result.ok).toBe(false);
    expect("error" in result && result.error).toContain("being returned");
  });

  it("promises it too when another caller already claimed the refund", async () => {
    /* The webhook or the sweep has it. It is genuinely on its way. */
    s.refund.mockResolvedValue({ ok: false, reason: "refund_already_claimed" });
    const result = await settleShareReturn({ reference: REF, tenancyId: TENANCY });
    expect("error" in result && result.error).toContain("being returned");
  });

  it("does NOT promise it when the refund was not accepted", async () => {
    s.refund.mockResolvedValue({ ok: false, reason: "Paystack refused the refund" });
    const result = await settleShareReturn({ reference: REF, tenancyId: TENANCY });
    expect(result.ok).toBe(false);
    const said = "error" in result ? result.error : "";
    expect(said).not.toContain("being returned");
    expect(said).toContain("team");
  });
});
