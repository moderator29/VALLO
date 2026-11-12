import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PAYING A TABLE'S BILL THROUGH VALLO sits behind `restaurant_bill_pay`
 * (fail-closed, `bill-pay.ts`): while it is off nothing is entered, confirmed
 * or opened and no Paystack checkout exists. On, the checkout carries the
 * database's figures and the restaurant's split, never the client's. The
 * diner's return settles only the diner's own bill. Nothing here calls
 * Paystack.
 */

const GUEST = "11111111-1111-4111-8111-111111111111";
const BILL = "33333333-3333-4333-8333-333333333333";
const RES = "22222222-2222-4222-8222-222222222222";
const REF = "rm-bill-0f8fad5b-d9cb-469f-a165-70867728950e";

const state = vi.hoisted(() => ({
  flag: false,
  paystack: true,
  rpcs: [] as { fn: string; args: Record<string, unknown> }[],
  meRpcs: [] as string[],
  opened: [] as Record<string, unknown>[],
  answer: {} as Record<string, unknown>,
  /* Successive `restaurant_bill_open` answers, when one run opens twice. */
  answers: [] as Record<string, unknown>[],
  verifyThrows: null as Error | null,
  ownRow: null as Record<string, unknown> | null,
  ownFilters: [] as [string, unknown][],
  verified: { status: "success", amountMinor: 1_250_000, currency: "NGN" } as Record<string, unknown>,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "vallo.test" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../flags/read", () => ({ flagIsOn: async (key: string) => key === "restaurant_bill_pay" && state.flag }));
vi.mock("../phone-otp/gate", () => ({ phoneGateFor: async () => null }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: GUEST, email: "g@vallo.test" },
    supabase: {
      rpc: async (fn: string) => {
        state.meRpcs.push(fn);
        return { data: { status: fn === "restaurant_bill_enter" ? "saved" : "confirmed", bill_id: BILL }, error: null };
      },
      from: () => {
        const chain = {
          select: () => chain,
          eq: (column: string, value: unknown) => {
            state.ownFilters.push([column, value]);
            return chain;
          },
          maybeSingle: async () => ({ data: state.ownRow, error: null }),
        };
        return chain;
      },
    },
  }),
}));
class FakePaystackError extends Error {}
class FakePaystackUnknownOutcome extends FakePaystackError {}

vi.mock("../payments/paystack", () => ({
  PaystackError: FakePaystackError,
  PaystackUnknownOutcome: FakePaystackUnknownOutcome,
  currentPaystackMode: () => "test",
  isPaystackConfigured: () => state.paystack,
  verifyTransaction: async () => {
    if (state.verifyThrows) throw state.verifyThrows;
    return state.verified;
  },
}));
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
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcs.push({ fn, args });
      if (fn === "restaurant_bill_settle") return { data: { outcome: "settled" }, error: null };
      if (fn === "restaurant_bill_open" && state.answers.length > 0) {
        return { data: state.answers.shift(), error: null };
      }
      return { data: state.answer, error: null };
    },
  }),
}));

beforeEach(() => {
  Object.assign(state, {
    flag: false,
    paystack: true,
    rpcs: [],
    meRpcs: [],
    opened: [],
    answer: {},
    answers: [],
    ownRow: null,
    ownFilters: [],
    verifyThrows: null,
    verified: { status: "success", amountMinor: 1_250_000, currency: "NGN" },
  });
});

describe("restaurant_bill_pay off (the default)", () => {
  it("refuses to open a checkout before anything is written", async () => {
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok).toBe(false);
    expect(state.rpcs).toHaveLength(0);
    expect(state.opened).toHaveLength(0);
  });

  it("refuses to enter or confirm a bill the diner could not then pay", async () => {
    const { enterTableBill, confirmTableBill } = await import("./seating-actions");
    expect((await enterTableBill(RES, "12500")).ok).toBe(false);
    expect((await confirmTableBill(BILL)).ok).toBe(false);
    expect(state.meRpcs).toHaveLength(0);
  });

  it("reads off without a Paystack key even when the row is on", async () => {
    state.flag = true;
    state.paystack = false;
    const { billPayOn } = await import("./bill-pay");
    expect(await billPayOn()).toBe(false);
  });
});

describe("restaurant_bill_pay on", () => {
  it("opens Paystack with the database's amount and the restaurant's split", async () => {
    state.flag = true;
    state.answer = {
      status: "ok",
      reference: REF,
      amount_minor: 1_250_000,
      payee_subaccount_code: "ACCT_venue",
      restaurant_share_minor: 1_225_000,
      commission_minor: 25_000,
    };
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok).toBe(true);
    expect(state.rpcs[0]).toEqual({ fn: "restaurant_bill_open", args: { p_bill: BILL, p_guest: GUEST, p_mode: "test" } });
    expect(state.opened).toHaveLength(1);
    expect(state.opened[0]).toMatchObject({
      reference: REF,
      amountMinor: 1_250_000,
      split: { listerSubaccount: "ACCT_venue", listerShareMinor: 1_225_000, reserveSubaccount: null, guaranteeMinor: 0 },
    });
  });

  /**
   * A BILL LEFT `pending` WITH NO CHECKOUT PAGE WAS A STATE NOTHING COULD
   * LEAVE (12 November 2026). `restaurant_bill_open` mints the reference and
   * moves the bill to `pending` before Paystack is called, and
   * `restaurant_bill_checkout_saved` writes the page afterwards. If the
   * checkout call does not answer, or the process stops between the two, the
   * bill sits `pending` with `authorization_url` null: this action used to
   * answer the stored page, find none, fall through to a flat refusal and do
   * nothing, `restaurant_bill_enter` answers `locked` so the restaurant could
   * not amend it either, and no sweep looks at bills. Paystack now decides
   * (`bill-stranded.ts`).
   */
  it("recovers a pending bill with no checkout page: Paystack never saw it", async () => {
    state.flag = true;
    state.verifyThrows = new FakePaystackError("Transaction reference not found");
    state.answers = [
      { status: "pending", reference: REF, amount_minor: 1_250_000, authorization_url: null },
      {
        status: "ok",
        reference: REF,
        amount_minor: 1_250_000,
        payee_subaccount_code: "ACCT_venue",
        restaurant_share_minor: 1_225_000,
      },
    ];
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok, "the diner can pay the bill again").toBe(true);
    expect(state.rpcs.map((c) => c.fn)).toEqual([
      "restaurant_bill_open",
      "restaurant_bill_reopen",
      "restaurant_bill_open",
      "restaurant_bill_checkout_saved",
    ]);
    expect(state.opened).toHaveLength(1);
  });

  it("settles a pending bill with no page that Paystack says was paid, and charges nothing again", async () => {
    state.flag = true;
    state.verified = { status: "success", amountMinor: 1_250_000, currency: "NGN" };
    state.answers = [{ status: "pending", reference: REF, amount_minor: 1_250_000, authorization_url: null }];
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok).toBe(false);
    expect(state.rpcs.map((c) => c.fn)).toEqual(["restaurant_bill_open", "restaurant_bill_settle"]);
    expect(state.opened, "nothing is charged a second time").toHaveLength(0);
  });

  it("leaves a pending bill alone when Paystack does not answer, so the reference survives for the webhook", async () => {
    state.flag = true;
    state.verifyThrows = new FakePaystackUnknownOutcome("no answer");
    state.answers = [{ status: "pending", reference: REF, amount_minor: 1_250_000, authorization_url: null }];
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok).toBe(false);
    expect(state.rpcs.map((c) => c.fn)).toEqual(["restaurant_bill_open"]);
    expect(state.opened).toHaveLength(0);
  });

  it("still answers the stored page when there is one, asking Paystack nothing", async () => {
    state.flag = true;
    state.answer = {
      status: "pending",
      reference: REF,
      amount_minor: 1_250_000,
      authorization_url: "https://checkout.paystack.com/kept",
    };
    const { payTableBill } = await import("./seating-actions");
    const r = await payTableBill(BILL);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.authorizationUrl).toBe("https://checkout.paystack.com/kept");
    expect(state.rpcs.map((c) => c.fn)).toEqual(["restaurant_bill_open"]);
  });

  it("refuses a share larger than the bill and reopens it, opening nothing", async () => {
    state.flag = true;
    state.answer = { status: "ok", reference: REF, amount_minor: 1_000, payee_subaccount_code: "ACCT_venue", restaurant_share_minor: 2_000 };
    const { payTableBill } = await import("./seating-actions");
    expect((await payTableBill(BILL)).ok).toBe(false);
    expect(state.opened).toHaveLength(0);
    expect(state.rpcs.map((c) => c.fn)).toEqual(["restaurant_bill_open", "restaurant_bill_reopen"]);
  });
});

describe("confirmTableBillReturn", () => {
  it("never touches a bill that is not the diner's own", async () => {
    state.ownRow = null;
    const { confirmTableBillReturn } = await import("./seating-actions");
    const r = await confirmTableBillReturn(REF);
    expect(r.ok).toBe(false);
    expect(state.rpcs).toHaveLength(0);
    expect(state.ownFilters).toEqual(
      expect.arrayContaining([
        ["provider_ref", REF],
        ["guest_id", GUEST],
      ]),
    );
  });

  it("settles the diner's own bill with Paystack's amount, not the address bar's", async () => {
    state.ownRow = { id: BILL };
    const { confirmTableBillReturn } = await import("./seating-actions");
    const r = await confirmTableBillReturn(REF);
    expect(r).toEqual({ ok: true, data: { paid: true } });
    expect(state.rpcs).toEqual([
      { fn: "restaurant_bill_settle", args: { p_reference: REF, p_amount_minor: 1_250_000, p_currency: "NGN" } },
    ]);
  });

  it("still settles a bill whose checkout opened while the switch was on", async () => {
    state.flag = false;
    state.ownRow = { id: BILL };
    const { confirmTableBillReturn } = await import("./seating-actions");
    expect((await confirmTableBillReturn(REF)).ok).toBe(true);
  });
});
