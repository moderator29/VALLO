import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The member's four doors (lib/subscriptions/actions.ts): who may knock, what
 * each one hands the database or Paystack, and that a refusal is a fixed
 * reason the page words, never provider text.
 */

const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const flags = vi.hoisted(() => ({ flagIsOn: vi.fn(async () => true) }));
const limits = vi.hoisted(() => ({ guardMoney: vi.fn(async () => ({ allowed: true, degraded: false })) }));
const service = vi.hoisted(() => ({ getAdminClient: vi.fn() }));
const checkout = vi.hoisted(() => ({ openSubscriptionCheckout: vi.fn(), confirmSubscriptionCharge: vi.fn() }));
const paystack = vi.hoisted(() => ({
  disableSubscription: vi.fn(async () => {}),
  fetchSubscription: vi.fn(async () => ({ subscriptionCode: "SUB_x", status: "active", emailToken: "tok_fetched", nextPaymentDate: null })),
  currentPaystackMode: vi.fn(() => "test"),
}));

vi.mock("../actions/session", () => ({ ...session, NOT_CONFIGURED_MESSAGE: "not configured" }));
vi.mock("../flags/read", () => ({ ...flags, SUBSCRIPTIONS_CHECKOUT_FLAG: "subscriptions_checkout" }));
vi.mock("../security/money-limits", () => limits);
vi.mock("./open", () => ({ SUBSCRIPTIONS_OPEN: true }));
vi.mock("../supabase/service", () => service);
vi.mock("./checkout", () => checkout);
vi.mock("../money/audit", () => ({ recordMoneyAudit: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "vallospaces.com", "x-forwarded-proto": "https" }) }));
vi.mock("../payments/paystack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../payments/paystack")>();
  return { ...actual, ...paystack };
});

const { startSubscriptionTrial, startSubscriptionCheckout, subscriptionCheckoutState, cancelSubscription } = await import("./actions");

const SUB_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const REF = `rm-sub-${SUB_ID}`;

function signedIn(rpc = vi.fn()) {
  session.resolveSession.mockResolvedValue({ state: "signed-in", supabase: { rpc }, user: { id: "u1", email: "ada@example.com" } });
  return rpc;
}

function adminWith(row: unknown, markResult: unknown = { ok: true, status: "non_renewing", ends_at: "2026-11-08T10:00:00Z" }) {
  const rpc = vi.fn(async () => ({ data: markResult, error: null }));
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: row, error: null });
  const admin = { rpc, from: vi.fn(() => chain) };
  service.getAdminClient.mockReturnValue(admin);
  return admin;
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.NEXT_PUBLIC_SITE_URL;
  flags.flagIsOn.mockResolvedValue(true);
  limits.guardMoney.mockResolvedValue({ allowed: true, degraded: false });
  paystack.currentPaystackMode.mockReturnValue("test");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("startSubscriptionTrial", () => {
  it("asks the database under the member's own session, and words its refusal by reason", async () => {
    const rpc = signedIn(vi.fn(async () => ({ data: { ok: false, reason: "trial_used" }, error: null })));
    expect(await startSubscriptionTrial("pro")).toEqual({ ok: true, data: { started: false, reason: "trial_used" } });
    expect(rpc).toHaveBeenCalledWith("subscription_start_trial", { p_plan_key: "pro" });
  });

  it("reports the trial's end from the database", async () => {
    signedIn(vi.fn(async () => ({ data: { ok: true, plan_key: "pro", trial_ends_at: "2026-10-12T10:00:00Z" }, error: null })));
    expect(await startSubscriptionTrial("pro")).toEqual({ ok: true, data: { started: true, planKey: "pro", trialEndsAt: "2026-10-12T10:00:00Z" } });
  });

  it("never sends an unknown reason or a malformed plan key on", async () => {
    const rpc = signedIn(vi.fn(async () => ({ data: { ok: false, reason: "something internal" }, error: null })));
    expect(await startSubscriptionTrial("pro")).toEqual({ ok: true, data: { started: false, reason: "unavailable" } });
    rpc.mockClear();
    expect(await startSubscriptionTrial("Pro'); --")).toEqual({ ok: true, data: { started: false, reason: "unknown_plan" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks a visitor to sign in", async () => {
    session.resolveSession.mockResolvedValue({ state: "signed-out" });
    expect(await startSubscriptionTrial("pro")).toEqual({ ok: true, data: { started: false, reason: "signed_out" } });
  });
});

describe("startSubscriptionCheckout", () => {
  it("opens with the member's own id and email, and a return address Paystack completes", async () => {
    signedIn();
    adminWith(null);
    checkout.openSubscriptionCheckout.mockResolvedValue({
      ok: true,
      subscriptionId: SUB_ID,
      reference: REF,
      amountMinor: 950000,
      currency: "NGN",
      authorizationUrl: "https://checkout.paystack.com/abc",
      accessCode: "abc",
    });
    expect(await startSubscriptionCheckout("pro")).toEqual({
      ok: true,
      data: { opened: true, reference: REF, amountMinor: 950000, accessCode: "abc", authorizationUrl: "https://checkout.paystack.com/abc" },
    });
    expect(checkout.openSubscriptionCheckout).toHaveBeenCalledWith(expect.anything(), {
      memberId: "u1",
      email: "ada@example.com",
      planKey: "pro",
      callbackUrl: "https://vallospaces.com/pro/confirm",
    });
    expect(limits.guardMoney).toHaveBeenCalledWith("startSubscriptionCheckout", "u1");
  });

  it("is closed while the switch is off, before anything is counted or opened", async () => {
    signedIn();
    flags.flagIsOn.mockResolvedValue(false);
    expect(await startSubscriptionCheckout("pro")).toEqual({ ok: true, data: { opened: false, reason: "closed" } });
    expect(limits.guardMoney).not.toHaveBeenCalled();
    expect(checkout.openSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("hands back the rate limit's own sentence, and opens nothing", async () => {
    signedIn();
    limits.guardMoney.mockResolvedValue({ allowed: false, message: "You have opened several plan checkouts.", retryAfterSeconds: 60 } as never);
    expect(await startSubscriptionCheckout("pro")).toEqual({ ok: false, error: "You have opened several plan checkouts." });
    expect(checkout.openSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("needs an email address for a card payment", async () => {
    session.resolveSession.mockResolvedValue({ state: "signed-in", supabase: {}, user: { id: "u1", email: "" } });
    expect(await startSubscriptionCheckout("pro")).toEqual({ ok: true, data: { opened: false, reason: "no_email" } });
  });
});

describe("subscriptionCheckoutState", () => {
  it("reads paid only from the server's own confirmation, and refuses a foreign reference", async () => {
    signedIn();
    adminWith(null);
    checkout.confirmSubscriptionCharge.mockResolvedValue("paid");
    expect(await subscriptionCheckoutState(REF)).toEqual({ ok: true, data: "paid" });
    checkout.confirmSubscriptionCharge.mockResolvedValue("pending");
    expect(await subscriptionCheckoutState(REF)).toEqual({ ok: true, data: "pending" });
    expect(await subscriptionCheckoutState("rm-book-x")).toEqual({ ok: true, data: "failed" });
  });
});

describe("cancelSubscription", () => {
  const ACTIVE = {
    id: SUB_ID,
    kind: "paid",
    status: "active",
    mode: "test",
    provider_subscription_code: "SUB_vbdx",
    provider_email_token: "tok_1",
    current_period_end: "2026-11-08T10:00:00Z",
  };

  it("disables at Paystack with the stored token, then keeps the plan to the end of the period", async () => {
    signedIn();
    const admin = adminWith(ACTIVE);
    expect(await cancelSubscription(SUB_ID)).toEqual({ ok: true, data: { cancelled: true, endsAt: "2026-11-08T10:00:00Z" } });
    expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: "SUB_vbdx", token: "tok_1" });
    expect(admin.rpc).toHaveBeenCalledWith("subscription_mark_cancelled", { p_user: "u1", p_subscription: SUB_ID });
  });

  it("fetches the token from Paystack when the row does not hold one", async () => {
    signedIn();
    adminWith({ ...ACTIVE, provider_email_token: null });
    await cancelSubscription(SUB_ID);
    expect(paystack.disableSubscription).toHaveBeenCalledWith({ code: "SUB_vbdx", token: "tok_fetched" });
  });

  it("changes nothing when Paystack will not stop it", async () => {
    signedIn();
    const admin = adminWith(ACTIVE);
    const { PaystackError } = await import("../payments/paystack");
    paystack.disableSubscription.mockRejectedValueOnce(new PaystackError("nope", 400));
    expect(await cancelSubscription(SUB_ID)).toEqual({ ok: true, data: { cancelled: false, reason: "cancel_failed" } });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("has nothing to cancel on a trial, and is already done on a plan that will not renew", async () => {
    signedIn();
    adminWith({ ...ACTIVE, kind: "trial", status: "trialing" });
    expect(await cancelSubscription(SUB_ID)).toEqual({ ok: true, data: { cancelled: false, reason: "not_cancellable" } });
    adminWith({ ...ACTIVE, status: "non_renewing" });
    expect(await cancelSubscription(SUB_ID)).toEqual({ ok: true, data: { cancelled: true, endsAt: "2026-11-08T10:00:00Z" } });
    expect(paystack.disableSubscription).not.toHaveBeenCalled();
  });

  it("cannot cancel until Paystack has told us the subscription's code", async () => {
    signedIn();
    adminWith({ ...ACTIVE, provider_subscription_code: null });
    expect(await cancelSubscription(SUB_ID)).toEqual({ ok: true, data: { cancelled: false, reason: "cancel_failed" } });
  });
});
