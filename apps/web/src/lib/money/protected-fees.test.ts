import { describe, expect, it } from "vitest";
import {
  IDENTITY_CHECK_MINOR,
  MONEY_IN_FEE_PAYER,
  moneyInFeeMinor,
  moneyOutFeeMinor,
  protectedQuote,
} from "./protected-fees";

const N = 100; // kobo per naira

describe("the protected rail's money-in fee", () => {
  it("is 1.5% plus 150 naira in band one", () => {
    expect(moneyInFeeMinor(100_000 * N)).toBe(1_500 * N + 150 * N);
  });

  it("caps at 3,000 naira in band one", () => {
    expect(moneyInFeeMinor(250_000 * N)).toBe(3_000 * N);
    expect(moneyInFeeMinor(200_000 * N)).toBe(3_000 * N);
  });

  it("is 1.25% plus 150 naira, uncapped, in band two", () => {
    expect(moneyInFeeMinor(250_001 * N)).toBe(Math.ceil((250_001 * N * 125) / 10_000) + 150 * N);
    expect(moneyInFeeMinor(2_500_000 * N)).toBe(31_250 * N + 150 * N);
    expect(moneyInFeeMinor(50_000_000 * N)).toBe(625_000 * N + 150 * N);
  });

  it("is agreed in advance above 50 million naira, so no figure is quoted", () => {
    expect(moneyInFeeMinor(50_000_000 * N + 1)).toBeNull();
  });

  it("rounds a share of a kobo up, never down", () => {
    expect(moneyInFeeMinor(1)).toBe(1 + 150 * N);
  });

  it("refuses nothing-to-pay and broken amounts", () => {
    expect(moneyInFeeMinor(0)).toBeNull();
    expect(moneyInFeeMinor(-5)).toBeNull();
    expect(moneyInFeeMinor(1.5)).toBeNull();
    expect(moneyInFeeMinor(Number.NaN)).toBeNull();
  });
});

describe("the money-out and identity fees", () => {
  it("is 40 naira up to 50,000 naira and 70 naira above", () => {
    expect(moneyOutFeeMinor(50_000 * N)).toBe(40 * N);
    expect(moneyOutFeeMinor(50_000 * N + 1)).toBe(70 * N);
  });

  it("charges 80 naira once for an identity check", () => {
    expect(IDENTITY_CHECK_MINOR).toBe(80 * N);
  });
});

describe("a protected quote", () => {
  it("has the seller bear the fee, by the founder's ruling of 9 November 2026", () => {
    expect(MONEY_IN_FEE_PAYER).toBe("seller");
    const q = protectedQuote(2_500_000 * N);
    expect(q).toEqual({
      buyerPaysMinor: 2_500_000 * N,
      moneyInFeeMinor: 31_400 * N,
      sellerReceivesMinor: 2_500_000 * N - 31_400 * N,
      payer: "seller",
    });
  });

  it("adds the fee to the buyer's total only if the payer is ever switched", () => {
    const q = protectedQuote(100_000 * N, "buyer");
    expect(q?.buyerPaysMinor).toBe(100_000 * N + 1_650 * N);
    expect(q?.sellerReceivesMinor).toBe(100_000 * N);
  });

  it("offers no quote where no fee can be quoted", () => {
    expect(protectedQuote(0)).toBeNull();
    expect(protectedQuote(60_000_000 * N)).toBeNull();
  });
});
