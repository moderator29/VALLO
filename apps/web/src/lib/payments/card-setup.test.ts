/**
 * B-6: saving a card (the ₦100 check) always read as pending, so "Card saved"
 * never opened and no card was filed from the checkout. `confirmCardSetup` now
 * verifies the charge with Paystack and files the card. Every Paystack answer
 * here is a mocked response: nothing in this file can reach the processor.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";

const state = vi.hoisted(() => ({
  session: null as unknown,
  allowed: true,
  configured: true,
  admin: null as unknown,
  verify: null as null | (() => Promise<unknown>),
  verifyCalls: [] as string[],
  audits: [] as { action: string; outcome: string }[],
  notices: [] as unknown[],
  walletRow: true,
  savedCards: false,
}));

vi.mock("../actions/session", () => ({
  resolveSession: async () => state.session,
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../flags", () => ({ isFeatureEnabled: async () => state.walletRow }));
vi.mock("../flags/read", () => ({
  SAVED_CARDS_FLAG: "saved_cards",
  flagIsOn: async (key: string) => key === "saved_cards" && state.savedCards,
}));
vi.mock("../security/money-limits", () => ({
  guardMoney: async () => (state.allowed ? { allowed: true } : { allowed: false, message: "limit reached" }),
}));
vi.mock("../security/idempotency", () => ({
  IN_FLIGHT_MESSAGE: "in flight",
  withIdempotency: async (_o: unknown, work: () => Promise<unknown>) => ({ status: "ran", result: await work() }),
}));
vi.mock("@/lib/money/audit", () => ({
  recordMoneyAudit: async (_a: unknown, entry: { action: string; outcome: string }) => {
    state.audits.push({ action: entry.action, outcome: entry.outcome });
  },
}));
vi.mock("@/lib/supabase/service", () => ({ getAdminClient: () => state.admin }));
vi.mock("./notices", () => ({
  cardDefaultChangedNotice: async () => undefined,
  cardRemovedNotice: async () => undefined,
  cardSavedNotice: async (_a: unknown, userId: string, card: unknown) => {
    state.notices.push({ userId, card });
  },
}));
vi.mock("./observability", () => ({ logMoney: () => undefined }));
/* The processor, entirely. `readAuthorization` and `metadataObject` are pure
   and kept real; every network call is replaced. */
vi.mock("./paystack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./paystack")>();
  return {
    readAuthorization: actual.readAuthorization,
    metadataObject: actual.metadataObject,
    PaystackError: actual.PaystackError,
    isPaystackConfigured: () => state.configured,
    initializeTransaction: async () => {
      throw new Error("no live Paystack call in a test");
    },
    verifyTransaction: async (reference: string) => {
      state.verifyCalls.push(reference);
      if (!state.verify) throw new Error("no verify scripted");
      return state.verify();
    },
  };
});

const { confirmCardSetup } = await import("./methods-actions");
const { CARD_SETUP_AMOUNT_MINOR, judgeCardSetupCharge } = await import("./card-setup");

const ME = "11111111-1111-4111-8111-111111111111";
const SOMEONE_ELSE = "22222222-2222-4222-8222-222222222222";
const REF = "rm-fund-3f1c2b0e-3d4a-4b5c-8d6e-7f8091a2b3c4";

const AUTH = {
  authorization_code: "AUTH_test_code",
  signature: "SIG_test_card",
  card_type: "visa ",
  last4: "4081",
  exp_month: "12",
  exp_year: "2030",
  bin: "408408",
  bank: "Test Bank",
  channel: "card",
  reusable: true,
};

/** A verify response, as `verifyTransaction` shapes it. */
function verified(over: Record<string, unknown> = {}) {
  return {
    status: "success",
    amountMinor: CARD_SETUP_AMOUNT_MINOR,
    feesMinor: 15,
    currency: "NGN",
    reference: REF,
    paidAt: "2026-09-29T10:00:00Z",
    channel: "card",
    gatewayResponse: "Approved",
    customerEmail: "ada@example.com",
    metadata: { user_id: ME, purpose: "card-setup", save_card: true },
    authorization: AUTH,
    ...over,
  };
}

let service: ReturnType<typeof fakeSupabase>;
function signedIn({ intent = true }: { intent?: boolean } = {}) {
  service = fakeSupabase({
    audit_log: { select: { data: intent ? { id: "audit-1" } : null } },
    payment_methods: { select: { data: null }, insert: { data: null } },
  });
  state.session = { state: "signed-in", user: { id: ME, email: "ada@example.com" }, supabase: fakeSupabase().client };
  state.admin = service.client;
}

beforeEach(() => {
  state.walletRow = true;
  state.savedCards = false;
  state.allowed = true;
  state.configured = true;
  state.verify = null;
  state.verifyCalls = [];
  state.audits = [];
  state.notices = [];
  signedIn();
});

describe("confirmCardSetup, with mocked Paystack answers", () => {
  it("success: files the card, says saved, and announces it once", async () => {
    state.verify = async () => verified();
    const result = await confirmCardSetup(REF);
    expect(result).toEqual({ ok: true, data: { state: "saved", cardType: "visa", last4: "4081" } });

    const [insert] = service.of("payment_methods", "insert");
    expect(insert?.values).toMatchObject({
      user_id: ME,
      signature: "SIG_test_card",
      authorization_code: "AUTH_test_code",
      last4: "4081",
      reusable: true,
      email_used: "ada@example.com",
    });
    expect(state.audits).toContainEqual({ action: "payment_method.saved", outcome: "saved" });
    expect(state.notices).toHaveLength(1);
  });

  it("success after the webhook already returned the ₦100 (reversed): still saves the card", async () => {
    state.verify = async () => verified({ status: "reversed" });
    expect(await confirmCardSetup(REF)).toMatchObject({ ok: true, data: { state: "saved" } });
  });

  it("a card already on file is refreshed, not added twice, and not announced again", async () => {
    service = fakeSupabase({
      audit_log: { select: { data: { id: "audit-1" } } },
      payment_methods: { select: { data: { id: "pm-1" } }, update: { data: null } },
    });
    state.admin = service.client;
    state.verify = async () => verified();
    expect(await confirmCardSetup(REF)).toMatchObject({ ok: true, data: { state: "saved" } });
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
    expect(service.of("payment_methods", "update")).toHaveLength(1);
    expect(state.notices).toHaveLength(0);
  });

  it("pending: keeps waiting and files nothing", async () => {
    for (const status of ["ongoing", "pending", "abandoned", "processing", "queued", "something_new"]) {
      state.verify = async () => verified({ status });
      expect(await confirmCardSetup(REF), status).toEqual({ ok: true, data: { state: "pending" } });
    }
    expect(service.wrote()).toBe(false);
  });

  it("a verify that throws is pending, never failed", async () => {
    state.verify = async () => {
      throw new Error("timeout");
    };
    expect(await confirmCardSetup(REF)).toEqual({ ok: true, data: { state: "pending" } });
    expect(service.wrote()).toBe(false);
  });

  it("failed: says failed and files nothing", async () => {
    state.verify = async () => verified({ status: "failed" });
    expect(await confirmCardSetup(REF)).toEqual({ ok: true, data: { state: "failed" } });
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
  });

  it("wrong user in Paystack's metadata: refused, nothing filed, nothing about the charge said", async () => {
    state.verify = async () => verified({ metadata: { user_id: SOMEONE_ELSE, purpose: "card-setup", save_card: true } });
    const result = await confirmCardSetup(REF);
    expect(result).toMatchObject({ ok: true, data: { state: "refused" } });
    if (result.ok && result.data.state === "refused") {
      expect(result.data.message).toMatch(/does not belong to this account/);
      expect(result.data.message).not.toContain("4081");
    }
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
    expect(state.notices).toHaveLength(0);
  });

  it("wrong user by our own record: a reference this person never opened is pending, and Paystack is not asked", async () => {
    signedIn({ intent: false });
    state.verify = async () => verified();
    expect(await confirmCardSetup(REF)).toEqual({ ok: true, data: { state: "pending" } });
    expect(state.verifyCalls).toEqual([]);
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
    /* The intent lookup is scoped to the caller. */
    const [lookup] = service.of("audit_log", "select");
    expect(lookup?.filters).toContainEqual(["eq", "actor_id", ME]);
    expect(lookup?.filters).toContainEqual(["eq", "entity_id", REF]);
  });

  it("wrong amount: refused with what happens to the money, nothing filed", async () => {
    state.verify = async () => verified({ amountMinor: 500_00 });
    const result = await confirmCardSetup(REF);
    expect(result).toMatchObject({ ok: true, data: { state: "refused" } });
    if (result.ok && result.data.state === "refused") {
      expect(result.data.message).toMatch(/goes back to your card in full/);
      expect(result.data.message).toContain(REF);
    }
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
    expect(state.audits).toContainEqual({ action: "payment_method.setup_refused", outcome: "wrong_amount" });
  });

  it("wrong currency and a token the bank will not let us keep are refused too", async () => {
    state.verify = async () => verified({ currency: "USD" });
    expect(await confirmCardSetup(REF)).toMatchObject({ ok: true, data: { state: "refused" } });
    state.verify = async () => verified({ authorization: { ...AUTH, reusable: false } });
    expect(await confirmCardSetup(REF)).toMatchObject({ ok: true, data: { state: "refused" } });
    expect(service.of("payment_methods", "insert")).toHaveLength(0);
  });

  it("a booking or hand-typed reference never reaches Paystack", async () => {
    state.verify = async () => verified();
    for (const ref of ["rm-book-3f1c2b0e-3d4a-4b5c-8d6e-7f8091a2b3c4", "rm-fund-nope", ""]) {
      expect(await confirmCardSetup(ref)).toEqual({ ok: true, data: { state: "pending" } });
    }
    expect(state.verifyCalls).toEqual([]);
  });

  it("is counted, and past the limit asks nobody", async () => {
    state.allowed = false;
    state.verify = async () => verified();
    expect(await confirmCardSetup(REF)).toEqual({ ok: false, error: "limit reached" });
    expect(state.verifyCalls).toEqual([]);
  });

  it("signed out: nothing", async () => {
    state.session = { state: "signed-out" };
    expect(await confirmCardSetup(REF)).toEqual({ ok: false, error: "signed out" });
    expect(state.verifyCalls).toEqual([]);
  });

  it("the database refusing the card is said honestly, not celebrated", async () => {
    service = fakeSupabase({
      audit_log: { select: { data: { id: "audit-1" } } },
      payment_methods: { select: { data: null }, insert: { data: null, error: { code: "XX000" } } },
    });
    state.admin = service.client;
    state.verify = async () => verified();
    const result = await confirmCardSetup(REF);
    expect(result).toMatchObject({ ok: true, data: { state: "refused" } });
    if (result.ok && result.data.state === "refused") expect(result.data.message).toMatch(/could not save the card/);
    expect(state.notices).toHaveLength(0);
  });
});

describe("judgeCardSetupCharge", () => {
  const expected = { reference: REF, userId: ME };

  it("checks ownership before status, so a stranger's failed charge reads the same as a stranger's paid one", () => {
    const stranger = { user_id: SOMEONE_ELSE, purpose: "card-setup", save_card: true };
    expect(judgeCardSetupCharge(verified({ metadata: stranger }) as never, expected)).toEqual({ kind: "refused", reason: "wrong_user" });
    expect(judgeCardSetupCharge(verified({ metadata: stranger, status: "failed" }) as never, expected)).toEqual({ kind: "refused", reason: "wrong_user" });
  });

  it("refuses a charge that is not a card setup, or not the reference asked about", () => {
    expect(judgeCardSetupCharge(verified({ metadata: { user_id: ME } }) as never, expected)).toEqual({ kind: "refused", reason: "not_a_setup" });
    expect(judgeCardSetupCharge(verified({ reference: "rm-fund-00000000-0000-4000-8000-000000000000" }) as never, expected)).toEqual({ kind: "refused", reason: "not_a_setup" });
  });

  it("accepts the stringified save_card flag Paystack sometimes echoes", () => {
    const meta = { user_id: ME, purpose: "card-setup", save_card: "true" };
    expect(judgeCardSetupCharge(verified({ metadata: meta }) as never, expected).kind).toBe("confirmed");
  });
});

describe("the ₦100 in the panel", () => {
  it("is the same amount the server charges and checks", () => {
    const panel = readFileSync(new URL("../../components/app/payments/PaymentMethodsPanel.tsx", import.meta.url), "utf8");
    const match = panel.match(/export const CARD_SETUP_AMOUNT_MINOR = ([\d_]+);/);
    expect(Number(match?.[1]?.replace(/_/g, ""))).toBe(CARD_SETUP_AMOUNT_MINOR);
  });
});

describe("the switch that saving a card sits behind", () => {
  it("is off when neither saved_cards nor the legacy wallet row is on, and nothing is opened", async () => {
    state.walletRow = false;
    state.savedCards = false;
    const { startCardSetup } = await import("./methods-actions");
    const result = await startCardSetup();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Saving a card is switched off/);
  });

  it("takes its own saved_cards switch, so it no longer needs the retired wallet row", async () => {
    state.walletRow = false;
    state.savedCards = true;
    const { startCardSetup } = await import("./methods-actions");
    const result = await startCardSetup();
    if (!result.ok) expect(result.error).not.toMatch(/Saving a card is switched off/);
  });
});
