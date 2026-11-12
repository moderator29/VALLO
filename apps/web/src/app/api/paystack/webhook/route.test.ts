import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The status codes, which is where money was once actually lost.
 *
 * Every failure branch of this route used to answer HTTP 200. Paystack reads
 * 200 as "we have it, never send it again", so a delivery we did not process
 * was never retried. These tests are about one thing first: a delivery that
 * was not successfully processed must NOT be acknowledged.
 *
 * And since 25 September 2026 (Track A) about a second: Vallo never holds a
 * customer's money. A charge that cannot be applied goes back to the card, a
 * wallet top-up from before the wallet was retired goes back to the card, and
 * a transfer event is acknowledged and ignored. Nothing is ever credited.
 */

const paystack = vi.hoisted(() => ({
  isPaystackConfigured: vi.fn(() => true),
  verifyWebhookSignature: vi.fn(() => true),
  verifyTransaction: vi.fn(),
}));

const service = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
}));

const audit = vi.hoisted(() => ({
  recordMoneyAudit: vi.fn(async () => {}),
  recordWebhookDelivery: vi.fn(async () => {}),
}));

const settlement = vi.hoisted(() => ({
  settleBookingCharge: vi.fn(),
  markChargeFailed: vi.fn(async () => {}),
}));

const refund = vi.hoisted(() => ({
  refundChargeToCard: vi.fn(async () => ({ ok: true as const, refundId: "rf_1" })),
}));

const methods = vi.hoisted(() => ({
  savePaymentMethodFromCharge: vi.fn(async () => "skipped" as const),
}));

vi.mock("@/lib/payments/paystack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/paystack")>();
  return { ...actual, ...paystack };
});
vi.mock("@/lib/supabase/service", () => service);
vi.mock("@/lib/money/audit", () => audit);
vi.mock("@/lib/bookings/settlement", () => settlement);
vi.mock("@/lib/payments/refund", () => refund);
vi.mock("@/lib/bookings/arrival", () => ({ announceConfirmedStay: vi.fn(async () => {}) }));
vi.mock("@/lib/payments/methods", () => methods);

const { POST } = await import("./route");

const BOOK_REFERENCE = "rm-book-3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const FUND_REFERENCE = "rm-fund-3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const AMOUNT_MINOR = 2_500_000;

/** A stand-in admin client. Nothing in these tests reaches a real query. */
const ADMIN = { from: () => ({}) };

function delivery(body: unknown, signature = "a-valid-looking-signature"): Request {
  return new Request("https://vallospaces.com/api/paystack/webhook", {
    method: "POST",
    headers: { "x-paystack-signature": signature, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function chargeSuccess(reference = BOOK_REFERENCE) {
  return {
    event: "charge.success",
    data: {
      reference,
      amount: AMOUNT_MINOR,
      currency: "NGN",
      channel: "card",
      paid_at: "2026-09-25T10:00:00.000Z",
      metadata: { booking_id: "b1", user_id: "u1" },
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  methods.savePaymentMethodFromCharge.mockClear();
  paystack.isPaystackConfigured.mockReturnValue(true);
  paystack.verifyWebhookSignature.mockReturnValue(true);
  service.getAdminClient.mockReturnValue(ADMIN);
  settlement.settleBookingCharge.mockResolvedValue({
    outcome: "settled",
    bookingId: "b1",
    confirmed: true,
    amountMinor: AMOUNT_MINOR,
    ledger: {
      grossMinor: AMOUNT_MINOR,
      platformFeeMinor: 0,
      agentShareMinor: AMOUNT_MINOR - 37_500,
      processorFeeMinor: 0,
      netSettlementMinor: AMOUNT_MINOR - 37_500,
      guaranteeMinor: 37_500,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("never acknowledge what was not processed", () => {
  it("answers 503, NOT 200, when the service role key is missing", async () => {
    service.getAdminClient.mockReturnValue(null);
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      reason: "service_role_key_missing",
    });
  });

  it("answers 500, NOT 200, when the settlement throws", async () => {
    settlement.settleBookingCharge.mockRejectedValue(new Error("connection reset"));
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(500);
  });
});

describe("authentication and shape", () => {
  it("refuses an unverifiable signature with 401 and writes nothing", async () => {
    paystack.verifyWebhookSignature.mockReturnValue(false);
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(401);
    expect(settlement.settleBookingCharge).not.toHaveBeenCalled();
    expect(audit.recordWebhookDelivery).not.toHaveBeenCalled();
  });

  it("answers 503 when the Paystack key is missing, because nothing can be verified", async () => {
    paystack.isPaystackConfigured.mockReturnValue(false);
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(503);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await POST(delivery("not json at all"));
    expect(response.status).toBe(400);
  });
});

describe("a booking charge", () => {
  it("settles it with the processor's amount and the metadata booking", async () => {
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(200);
    expect(settlement.settleBookingCharge).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ reference: BOOK_REFERENCE, amountMinor: AMOUNT_MINOR, fallbackBookingId: "b1" }),
    );
    expect(refund.refundChargeToCard).not.toHaveBeenCalled();
  });

  it("refunds a charge that could not be applied to the card, in full, and credits nothing", async () => {
    settlement.settleBookingCharge.mockResolvedValue({
      outcome: "refund-due",
      bookingId: "b1",
      reason: "agreement_cancelled",
      amountMinor: AMOUNT_MINOR,
      reference: BOOK_REFERENCE,
    });
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(200);
    expect(refund.refundChargeToCard).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ reference: BOOK_REFERENCE, reason: "agreement_cancelled" }),
    );
    // A full refund: no amount means the whole charge.
    expect(refund.refundChargeToCard.mock.calls[0]).toBeDefined();
    const args = (refund.refundChargeToCard.mock.calls[0] as unknown as [unknown, { amountMinor?: number }])[1];
    expect(args.amountMinor).toBeUndefined();
  });

  it("is a duplicate, not a failure, when the payer's return already claimed the refund", async () => {
    settlement.settleBookingCharge.mockResolvedValue({
      outcome: "refund-due",
      bookingId: "b1",
      reason: "already_paid",
      amountMinor: AMOUNT_MINOR,
      reference: BOOK_REFERENCE,
    });
    refund.refundChargeToCard.mockResolvedValueOnce({ ok: false, reason: "refund_already_claimed" } as never);
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(200);
    expect(audit.recordWebhookDelivery).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ outcome: "duplicate", httpStatus: 200 }),
    );
  });
});

describe("the retired wallet", () => {
  it("refunds a wallet top-up to the card rather than crediting anything", async () => {
    const response = await POST(delivery(chargeSuccess(FUND_REFERENCE)));
    expect(response.status).toBe(200);
    expect(settlement.settleBookingCharge).not.toHaveBeenCalled();
    expect(refund.refundChargeToCard).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ reference: FUND_REFERENCE, reason: "wallet_retired" }),
    );
  });

  it("acknowledges and ignores a transfer event: Vallo sends no transfers", async () => {
    const response = await POST(
      delivery({ event: "transfer.success", data: { reference: "rm-wd-3f2504e0-4f89-11d3-9a0c-0305e82c3301" } }),
    );
    expect(response.status).toBe(200);
    expect(audit.recordWebhookDelivery).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ outcome: "ignored", httpStatus: 200 }),
    );
  });
});

describe("the delivery record", () => {
  it("persists what Paystack sent and what we did with it", async () => {
    await POST(delivery(chargeSuccess()));
    expect(audit.recordWebhookDelivery).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({
        event: "charge.success",
        reference: BOOK_REFERENCE,
        amountMinor: AMOUNT_MINOR,
        outcome: "posted",
        httpStatus: 200,
      }),
    );
  });

  it("persists the failures too, which is the point", async () => {
    settlement.settleBookingCharge.mockRejectedValue(new Error("connection reset"));
    await POST(delivery(chargeSuccess()));
    expect(audit.recordWebhookDelivery).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ outcome: "failed", httpStatus: 500 }),
    );
  });

  it("records an event it does not handle as ignored rather than silently", async () => {
    await POST(delivery({ event: "customer.identification.failed", data: { reference: "x" } }));
    expect(audit.recordWebhookDelivery).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ outcome: "ignored", httpStatus: 200 }),
    );
  });
});

/**
 * A CARD IS FILED ONLY BY A CHARGE THAT PAID FOR A BOOKING.
 *
 * `metadata.user_id` says whose card it is, and it has to, because a payer is
 * often not the guest. It is not proof of anything: metadata belongs to
 * whoever opened the transaction at Paystack. This used to run before the
 * settlement, on any well-signed charge.success carrying an `rm-book-`
 * reference, so a charge this platform never minted could file a card against
 * any account whose id the sender knew.
 */
describe("filing the card the charge was paid with", () => {
  it("files it when the charge settled the booking", async () => {
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(200);
    expect(methods.savePaymentMethodFromCharge).toHaveBeenCalledTimes(1);
  });

  it("files it when the payer's return settled it a moment earlier", async () => {
    settlement.settleBookingCharge.mockResolvedValue({
      outcome: "already-settled",
      bookingId: "b1",
      transactionStatus: "SUCCESSFUL",
    });
    await POST(delivery(chargeSuccess()));
    expect(methods.savePaymentMethodFromCharge).toHaveBeenCalledTimes(1);
  });

  it("files nothing for a reference this platform never minted", async () => {
    settlement.settleBookingCharge.mockResolvedValue({ outcome: "unknown-reference" });
    const response = await POST(delivery(chargeSuccess()));
    expect(response.status).toBe(200);
    expect(methods.savePaymentMethodFromCharge).not.toHaveBeenCalled();
  });

  it("files nothing for a charge that could not be applied and goes back to the card", async () => {
    settlement.settleBookingCharge.mockResolvedValue({
      outcome: "refund-due",
      bookingId: "b1",
      reason: "no_split",
      amountMinor: AMOUNT_MINOR,
      reference: BOOK_REFERENCE,
    });
    await POST(delivery(chargeSuccess()));
    expect(methods.savePaymentMethodFromCharge).not.toHaveBeenCalled();
  });

  it("files nothing on the replay of a charge that was found refund due", async () => {
    settlement.settleBookingCharge.mockResolvedValue({
      outcome: "already-settled",
      bookingId: "b1",
      transactionStatus: "REFUND_DUE",
    });
    await POST(delivery(chargeSuccess()));
    expect(methods.savePaymentMethodFromCharge).not.toHaveBeenCalled();
  });
});
