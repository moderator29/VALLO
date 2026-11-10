import { describe, expect, it } from "vitest";
import {
  CRYPTO_WITHDRAWAL_ENABLED,
  ONBOARDING_STATES,
  WITHDRAWAL_MIN_KOBO,
  balanceFigures,
  canMoveMoney,
  isOpenMovement,
  lastFour,
  movementKindFor,
  movementReference,
  movementStatusForProvider,
  normalisePhone,
  onboardingStateFor,
  profileGaps,
  withdrawalBreakdown,
} from "./funds";
import { decidePaymentEvent } from "./balance-events";
import { confirmedAgo, movementStatusLabel, ONBOARDING_COPY, REFUSAL, WAITING_COPY } from "./balance-copy";

const active = { status: "active", blocked: false, canWithdraw: true, canBuy: true };

describe("financial onboarding (founder section 9)", () => {
  it("maps the provider's customer onto the seven states, and only ACTIVE moves money", () => {
    expect(onboardingStateFor({ account: null, customer: active, gaps: [] })).toBe("ACTIVE");
    expect(onboardingStateFor({ account: null, customer: { ...active, canWithdraw: false }, gaps: [] })).toBe("RESTRICTED");
    expect(onboardingStateFor({ account: null, customer: { ...active, blocked: true }, gaps: [] })).toBe("SUSPENDED");
    expect(onboardingStateFor({ account: null, customer: { ...active, status: "blocked" }, gaps: [] })).toBe("SUSPENDED");
    expect(onboardingStateFor({ account: null, customer: null, gaps: [] })).toBe("NOT_STARTED");
    expect(onboardingStateFor({ account: null, customer: null, gaps: ["phone"] })).toBe("VERIFICATION_REQUIRED");
    expect(onboardingStateFor({ account: { state: "PENDING", providerCustomerId: null }, customer: null, gaps: [] })).toBe("PENDING");
    expect(onboardingStateFor({ account: { state: "FAILED", providerCustomerId: null }, customer: null, gaps: [] })).toBe("FAILED");
    for (const s of ONBOARDING_STATES) expect(canMoveMoney(s)).toBe(s === "ACTIVE");
  });

  it("a status the provider invents later is PENDING, never ACTIVE and never a blank (section 54)", () => {
    expect(onboardingStateFor({ account: null, customer: { ...active, status: "under_kyc_review_v2" }, gaps: [] })).toBe("PENDING");
  });

  it("every state has words for the member", () => {
    for (const s of ONBOARDING_STATES) expect(ONBOARDING_COPY[s].title.length).toBeGreaterThan(5);
  });

  it("names what is missing from the profile", () => {
    expect(profileGaps({ firstName: "Ada", lastName: " ", phone: "123", email: null })).toEqual(["last_name", "phone", "email"]);
  });

  it("reads every phone spelling the provider accepts into its local form", () => {
    expect(normalisePhone("08012345678")).toBe("08012345678");
    expect(normalisePhone("+234 801 234 5678")).toBe("08012345678");
    expect(normalisePhone("2348012345678")).toBe("08012345678");
    expect(normalisePhone("8012345678")).toBe("08012345678");
    expect(normalisePhone("0123")).toBeNull();
  });
});

describe("movement status (section 54)", () => {
  it("maps the provider's words and never guesses at an unknown one", () => {
    expect(movementStatusForProvider("success")).toBe("completed");
    expect(movementStatusForProvider("FAILED")).toBe("failed");
    expect(movementStatusForProvider("reversed")).toBe("reversed");
    expect(movementStatusForProvider("pending")).toBe("processing");
    expect(movementStatusForProvider("settling_maybe")).toBe("under_review");
  });

  it("keeps watching everything not settled", () => {
    expect(isOpenMovement("unknown")).toBe(true);
    expect(isOpenMovement("processing")).toBe(true);
    expect(isOpenMovement("completed")).toBe(false);
  });

  it("knows which way a send went", () => {
    expect(movementKindFor("wallet_transfer", "credit")).toBe("transfer_in");
    expect(movementKindFor("wallet_transfer", "debit")).toBe("transfer_out");
    expect(movementKindFor("deposit", "credit")).toBe("deposit");
    expect(movementKindFor("commission", "credit")).toBe("other");
  });

  it("labels never carry a provider word or a backend state", () => {
    for (const status of ["preparing", "awaiting_confirmation", "awaiting_payment", "processing", "unknown", "completed", "failed", "reversed", "cancelled", "under_review"] as const) {
      const label = movementStatusLabel("withdrawal", status);
      expect(label).not.toMatch(/paystack|intent|webhook|escrow_|PENDING|ONGOING|_/);
    }
  });
});

describe("the withdrawal breakdown (section 12)", () => {
  it("debits amount plus the provider's fee, and the bank receives the amount", () => {
    const b = withdrawalBreakdown({ amountMinor: 1_000_000, providerFeeMinor: 10_000 });
    expect(b).toEqual({ amountMinor: 1_000_000, providerFeeMinor: 10_000, valloFeeMinor: 0, vatMinor: 0, totalDebitedMinor: 1_010_000, receivedMinor: 1_000_000 });
  });

  it("refuses anything but whole kobo", () => {
    expect(() => withdrawalBreakdown({ amountMinor: 100.5, providerFeeMinor: 0 })).toThrow(RangeError);
  });

  it("crypto withdrawal is built but stays off until the founder decides", () => {
    expect(CRYPTO_WITHDRAWAL_ENABLED).toBe(false);
  });

  it("the minimum is 1,000 naira", () => {
    expect(WITHDRAWAL_MIN_KOBO).toBe(100_000);
    expect(REFUSAL.belowWithdrawalMinimum).toContain("₦1,000");
  });
});

describe("the four figures (section 10)", () => {
  const reported = { availableMinor: 245_000_00, protectedMinor: 85_000_00, currency: "NGN", observedAt: "2026-10-07T10:00:00.000Z" };

  it("Available and Protected are exactly what the provider reported, with when", () => {
    const f = balanceFigures(reported, []);
    expect(f.available).toEqual({ minor: 245_000_00, confirmedAt: reported.observedAt });
    expect(f.protected).toEqual({ minor: 85_000_00, confirmedAt: reported.observedAt });
    expect(f.pending).toEqual({ minor: 0, confirmedAt: null });
  });

  it("Pending and Processing are the member's own unsettled requests, never subtracted from the balance", () => {
    const f = balanceFigures(reported, [
      { kind: "deposit", status: "processing", amountMinor: 50_000_00, providerFeeMinor: 0, observedAt: "2026-10-07T10:01:00.000Z" },
      { kind: "withdrawal", status: "unknown", amountMinor: 20_000_00, providerFeeMinor: 50_00, observedAt: "2026-10-07T10:02:00.000Z" },
      { kind: "withdrawal", status: "completed", amountMinor: 99_00, providerFeeMinor: 0, observedAt: "2026-10-07T09:00:00.000Z" },
    ]);
    expect(f.pending.minor).toBe(50_000_00);
    expect(f.processing).toEqual({ minor: 20_050_00, confirmedAt: "2026-10-07T10:02:00.000Z" });
    expect(f.available.minor).toBe(245_000_00);
  });

  it("says how old a figure is", () => {
    const at = Date.parse("2026-10-07T10:00:00.000Z");
    expect(confirmedAgo("2026-10-07T10:00:00.000Z", at + 30_000)).toBe("Confirmed just now");
    expect(confirmedAgo("2026-10-07T10:00:00.000Z", at + 5 * 60_000)).toBe("Confirmed 5 minutes ago");
    expect(confirmedAgo(null, at)).toBe("Nothing yet");
  });
});

describe("references and what is kept of an account", () => {
  it("one row, one reference, under prefixes the card sweep never reads", () => {
    const id = "6b1f1c1e-1111-4a4a-8888-000000000001";
    expect(movementReference("withdrawal", id)).toBe(`rm-plw-${id}`);
    expect(movementReference("withdrawal", id)).toBe(movementReference("withdrawal", id));
    expect(movementReference("deposit", id).startsWith("rm-fund-")).toBe(false);
    expect(lastFour("0123 456 789")).toBe("6789");
  });
});

describe("a payment webhook against Vallo's record (phase 15)", () => {
  const movement = { providerId: "t1", reference: "rm-plw-1", amountMinor: 5_000_000, feeMinor: 10_000, status: "success", type: "withdrawal", direction: "debit" as const, customerId: "cust-a", updatedAt: null };

  it("completes the movement Vallo started when amount and customer agree", () => {
    expect(decidePaymentEvent({ outcome: "success", movement }, { amountMinor: 5_000_000, ownerCustomerId: "cust-a" }, null)).toEqual({ kind: "observe", to: "completed", detail: {} });
    expect(decidePaymentEvent({ outcome: "reversed", movement }, { amountMinor: 5_000_000, ownerCustomerId: "cust-a" }, null)).toMatchObject({ to: "reversed" });
  });

  it("an amount or a customer that disagrees is checked by a person, never shown done", () => {
    expect(decidePaymentEvent({ outcome: "success", movement }, { amountMinor: 50_000, ownerCustomerId: "cust-a" }, null)).toMatchObject({ to: "under_review", detail: { reason: "amount_mismatch" } });
    expect(decidePaymentEvent({ outcome: "success", movement }, { amountMinor: 5_000_000, ownerCustomerId: "cust-b" }, null)).toMatchObject({ to: "under_review", detail: { reason: "customer_mismatch" } });
  });

  it("records money a member received that Vallo did not start, and ignores what is not a member's", () => {
    const incoming = { ...movement, reference: "PLK-1", type: "wallet_transfer", direction: "credit" as const };
    expect(decidePaymentEvent({ outcome: "success", movement: incoming }, null, "user-a")).toEqual({ kind: "mirror", userId: "user-a", movementKind: "transfer_in", status: "completed" });
    expect(decidePaymentEvent({ outcome: "success", movement: { ...incoming, type: "commission" } }, null, null)).toMatchObject({ kind: "ignore" });
  });

  it("the waiting copy never promises a time and never says something went wrong", () => {
    for (const w of Object.values(WAITING_COPY)) {
      expect(w.body).not.toMatch(/something went wrong/i);
      expect(w.body).not.toMatch(/\b\d+ seconds?\b/);
    }
  });
});
