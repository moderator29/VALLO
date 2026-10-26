import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  flag: false,
  rpcs: [] as string[],
  opened: [] as Record<string, unknown>[],
  answer: {} as Record<string, unknown>,
  row: null as Record<string, unknown> | null,
  verified: { status: "success", amountMinor: 3_000_000, currency: "NGN" } as Record<string, unknown>,
  settled: [] as Record<string, unknown>[],
  verdict: { outcome: "posted", reason: "deposit_paid", httpStatus: 200 } as Record<string, unknown>,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "vallo.test" }) }));
vi.mock("../flags/read", () => ({ flagIsOn: async () => state.flag }));
vi.mock("@/lib/passcode/money", () => ({ passcodeMoneyRefusal: async () => null }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({ state: "signed-in", user: { id: "11111111-1111-4111-8111-111111111111", email: "g@vallo.test" } }),
}));
vi.mock("../payments/paystack", () => ({
  PaystackError: class extends Error {},
  PaystackUnknownOutcome: class extends Error {},
  currentPaystackMode: () => "test",
  isPaystackConfigured: () => true,
  verifyTransaction: async () => state.verified,
}));
vi.mock("./deposit-settlement", () => ({
  handleDepositChargeSuccess: async (_admin: unknown, data: Record<string, unknown>) => {
    state.settled.push(data);
    return state.verdict;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../payments/providers", () => ({
  assertProviderEnabled: async () => undefined,
  paystackSeam: () => ({}),
  openCheckout: async (_p: unknown, input: Record<string, unknown>) => {
    state.opened.push(input);
    return { reference: input.reference, authorizationUrl: "https://checkout.paystack.com/x", accessCode: "ac" };
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  getAdminClient: () => ({
    rpc: async (fn: string) => {
      state.rpcs.push(fn);
      return { data: state.answer, error: null };
    },
    from: () => ({
      update: () => ({ eq: async () => ({}) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }),
    }),
  }),
}));

const RES = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  Object.assign(state, {
    flag: false,
    rpcs: [],
    opened: [],
    answer: {},
    row: null,
    settled: [],
    verified: { status: "success", amountMinor: 3_000_000, currency: "NGN" },
    verdict: { outcome: "posted", reason: "deposit_paid", httpStatus: 200 },
  });
});

describe("payReservationDeposit (D75)", () => {
  it("with restaurant_deposits off, refuses before anything is written or opened", async () => {
    const { payReservationDeposit } = await import("./deposit-actions");
    const r = await payReservationDeposit(RES);
    expect(r.ok).toBe(false);
    expect(state.rpcs).toHaveLength(0);
    expect(state.opened).toHaveLength(0);
  });

  it("on: opens Paystack with the database's figures and the venue's split, never its own", async () => {
    state.flag = true;
    state.answer = {
      status: "ok",
      reference: "rm-dep-0f8fad5b-d9cb-469f-a165-70867728950e",
      amount_minor: 3_000_000,
      payee_subaccount_code: "ACCT_venue",
      lister_share_minor: 2_940_000,
      commission_minor: 60_000,
    };
    const { payReservationDeposit } = await import("./deposit-actions");
    const r = await payReservationDeposit(RES);
    expect(r.ok).toBe(true);
    expect(state.rpcs).toEqual(["reservation_deposit_open"]);
    expect(state.opened[0]).toMatchObject({
      amountMinor: 3_000_000,
      /* Card only (the founder, 13 October 2026), and back to the deposit's own page. */
      channels: ["card"],
      callbackUrl: `https://vallo.test/pay/deposit/${RES}?ref=rm-dep-0f8fad5b-d9cb-469f-a165-70867728950e`,
      split: { listerSubaccount: "ACCT_venue", listerShareMinor: 2_940_000, reserveSubaccount: null, guaranteeMinor: 0 },
    });
  });

  it("on: a second press resumes the open checkout instead of opening another", async () => {
    state.flag = true;
    state.answer = {
      status: "pending",
      reference: "rm-dep-0f8fad5b-d9cb-469f-a165-70867728950e",
      amount_minor: 3_000_000,
      authorization_url: "https://checkout.paystack.com/x",
      access_code: "ac",
    };
    const { payReservationDeposit } = await import("./deposit-actions");
    const r = await payReservationDeposit(RES);
    expect(r.ok && r.data.authorizationUrl).toBe("https://checkout.paystack.com/x");
    expect(state.opened).toHaveLength(0);
  });
});

const REF = "rm-dep-0f8fad5b-d9cb-469f-a165-70867728950e";

describe("confirmDepositReturn: back from paying", () => {
  it("a reference that is not this guest's is not found, and Paystack is never asked", async () => {
    state.row = { reservation_id: RES, guest_id: "99999999-9999-4999-8999-999999999999", status: "pending" };
    const { confirmDepositReturn } = await import("./deposit-actions");
    const r = await confirmDepositReturn(RES, REF);
    expect(r.ok).toBe(false);
    expect(state.settled).toHaveLength(0);
  });

  it("a paid charge is settled through the webhook's own leg, with Paystack's figures", async () => {
    state.row = { reservation_id: RES, guest_id: "11111111-1111-4111-8111-111111111111", status: "pending" };
    const { confirmDepositReturn } = await import("./deposit-actions");
    const r = await confirmDepositReturn(RES, REF);
    expect(r.ok && r.data.state).toBe("paid");
    expect(state.settled).toEqual([{ reference: REF, amount: 3_000_000, currency: "NGN" }]);
  });

  it("works with the switch off: a deposit already taken is always recorded", async () => {
    state.flag = false;
    state.row = { reservation_id: RES, guest_id: "11111111-1111-4111-8111-111111111111", status: "pending" };
    const { confirmDepositReturn } = await import("./deposit-actions");
    expect((await confirmDepositReturn(RES, REF)).ok).toBe(true);
  });

  it("a charge that could not be applied says it goes back to the card", async () => {
    state.row = { reservation_id: RES, guest_id: "11111111-1111-4111-8111-111111111111", status: "pending" };
    state.verdict = { outcome: "failed", reason: "deposit_refund_due:sent", httpStatus: 200 };
    const { confirmDepositReturn } = await import("./deposit-actions");
    const r = await confirmDepositReturn(RES, REF);
    expect(r.ok && r.data.state).toBe("going_back");
  });

  it("a failed charge is closed, never settled", async () => {
    state.row = { reservation_id: RES, guest_id: "11111111-1111-4111-8111-111111111111", status: "pending" };
    state.verified = { status: "failed", amountMinor: 3_000_000, currency: "NGN" };
    const { confirmDepositReturn } = await import("./deposit-actions");
    const r = await confirmDepositReturn(RES, REF);
    expect(r.ok && r.data.state).toBe("not_paid");
    expect(state.rpcs).toEqual(["reservation_deposit_close"]);
    expect(state.settled).toHaveLength(0);
  });
});
