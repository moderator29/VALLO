/**
 * THE RAIL'S DOOR TO THE PROVIDER (lib/money/protected-provider.ts): the two
 * bank code books, the holder check, and the identity check's outcomes.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";
import type { RailResult } from "../payments/provider";
import type { EscrowPayCall } from "../payments/providers/escrowpay/client";

const provider = await import("./protected-provider");

const CONFIG = {
  baseUrl: "https://api.example.test",
  apiKey: "sk_test_x",
  webhookSecret: null,
  webhookSecretPrevious: null,
  environment: "sandbox" as const,
  payoutPreference: "automatic" as const,
  startsMoney: true,
};
const ok = (data: unknown): RailResult<unknown> => ({ ok: true, value: { success: true, message: "ok", data } });
const refused = (code: string, httpStatus = 422): RailResult<unknown> => ({ ok: false, kind: "refused", httpStatus, detail: "", retryAfterSeconds: null, code }) as never;

function deps(answers: Record<string, RailResult<unknown>>) {
  const send = vi.fn(async (_c: unknown, call: EscrowPayCall) => answers[`${call.method} ${call.path}`] ?? ({ ok: false, kind: "unknown", httpStatus: null, detail: "", retryAfterSeconds: null } as RailResult<unknown>));
  return { d: { db: fakeSupabase().client as never, config: CONFIG, documented: true, send, enabled: async () => true, alert: vi.fn(async () => undefined), now: () => 0 }, send };
}

const BANKS = [
  { code: "000013", name: "GTBANK PLC" },
  { code: "000014", name: "ACCESS BANK" },
  { code: "999", name: "EscrowPay Bank" },
];

describe("the two bank code books", () => {
  it("joins the code on a Vallo bank account to the provider's own, only when the provider lists it", () => {
    expect(provider.providerBankCode(BANKS, { bankCode: "058" })).toBe("000013");
    expect(provider.providerBankCode(BANKS, { bankCode: "044" })).toBe("000014");
    /* Zenith is in the table and not on this list: not offered. */
    expect(provider.providerBankCode(BANKS, { bankCode: "057" })).toBeNull();
  });

  it("uses a code that is already the provider's as it is, and never guesses from an unknown one", () => {
    expect(provider.providerBankCode(BANKS, { bankCode: "000013" })).toBe("000013");
    expect(provider.providerBankCode(BANKS, { bankCode: "12345" })).toBeNull();
    expect(provider.providerBankCode(BANKS, { bankCode: null })).toBeNull();
  });

  it("holds each interbank code once: two banks never share one", () => {
    const codes = Object.values(provider.INTERBANK_CODE);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
  });
});

describe("the same account holder", () => {
  it("accepts the same person named in another order or shortened", () => {
    expect(provider.sameAccountHolder("ADA NGOZI OBI", "OBI ADA")).toBe(true);
    expect(provider.sameAccountHolder("Obi, Ada N.", "ADA NGOZI OBI")).toBe(true);
    expect(provider.sameAccountHolder("VALLO SPACES LTD", "Vallo Spaces Limited")).toBe(true);
  });

  it("refuses a different person, one shared word among several, and a missing name", () => {
    expect(provider.sameAccountHolder("ADA NGOZI OBI", "CHIDI OKEKE")).toBe(false);
    expect(provider.sameAccountHolder("ADA NGOZI OBI", "ADA BELLO MUSA")).toBe(false);
    expect(provider.sameAccountHolder("ADA OBI", null)).toBe(false);
    expect(provider.sameAccountHolder("", "ADA OBI")).toBe(false);
  });
});

describe("the identity check", () => {
  const input = { userId: "user-1", kind: "nin" as const, identifier: "12345678902", dateOfBirth: "1990-01-15", email: "a@b.co", name: null, phone: null };
  const LOOKUP = "GET /api/v1/parties?external_reference=user-1&page_size=5";
  const ONBOARD = "POST /api/v1/parties/onboard";

  it("a member the provider already knows is not checked a second time", async () => {
    const { d, send } = deps({ [LOOKUP]: ok({ items: [{ id: "PAR_1", status: "active" }] }) });
    expect(await provider.onboardMember(d, input)).toMatchObject({ state: "verified", partyId: "PAR_1" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("a new member is checked once, with their Vallo id as the provider's reference", async () => {
    const { d, send } = deps({
      [LOOKUP]: ok({ items: [] }),
      [ONBOARD]: ok({ party: { id: "PAR_9", status: "active" }, identity: { masked_identifier: "*******8902", verification_details: { full_name: "SIMULATED NIN 8902" } } }),
    });
    expect(await provider.onboardMember(d, input)).toEqual({ state: "verified", partyId: "PAR_9", maskedIdentifier: "*******8902", verifiedName: "SIMULATED NIN 8902" });
    expect(send.mock.calls[1]![1].body).toMatchObject({ type: "nin", identifier: "12345678902", date_of_birth: "1990-01-15", consent: true, external_reference: "user-1" });
  });

  it.each([
    ["identity_verification_failed", "not_matched"],
    ["identity_requires_review", "needs_review"],
    ["identity_already_exists", "already_used"],
    ["validation_error", "bad_input"],
  ])("the provider's refusal %s is %s, and no party exists", async (code, state) => {
    const { d } = deps({ [LOOKUP]: ok({ items: [] }), [ONBOARD]: refused(code) });
    expect(await provider.onboardMember(d, input)).toEqual({ state });
  });

  it("no answer is unavailable, never a pass; an archived party is not a usable one", async () => {
    expect(await provider.onboardMember(deps({ [LOOKUP]: ok({ items: [] }) }).d, input)).toEqual({ state: "unavailable" });
    expect(await provider.findParty(deps({ [LOOKUP]: ok({ items: [{ id: "PAR_1", status: "archived" }] }) }).d, "user-1")).toEqual({ state: "unknown_member" });
  });
});

describe("the fee is the provider's own figure", () => {
  it("reads the amount and who bears it; nothing when it cannot be asked", async () => {
    const { d } = deps({ "POST /api/v1/fees/estimates": ok({ amount_minor: 285_000, fee_type: "escrow_service", payer: "payer" }) });
    expect(await provider.estimateMoneyInFee(d, 18_000_000)).toEqual({ feeMinor: 285_000, payer: "payer" });
    expect(await provider.estimateMoneyInFee(deps({}).d, 18_000_000)).toBeNull();
  });
});
