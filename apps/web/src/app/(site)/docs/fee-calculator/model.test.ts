import { describe, expect, it } from "vitest";
import { listerFeeFigures, listerFeeShown, type ListerFeePolicy } from "@/lib/money/lister-fee";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_NIGHTS, restaurantBill, stayResult } from "./model";

/* Rates for the arithmetic only: the calculator itself never holds one. */
const POLICY: ListerFeePolicy = {
  rateVersion: "test",
  valloBps: 200,
  escrowProtectionBps: 200,
  directProcessorFeeCapMinor: 200_000,
  capMinor: null,
};

describe("the fee calculator's arithmetic", () => {
  it("is the lister fee screen's own figures, card rail only, for a signed-in reader", () => {
    const r = stayResult({ policy: POLICY, processorKnown: true }, 50_000_00, 3);
    const figures = listerFeeFigures(150_000_00, { ...POLICY, escrowShown: false })!;
    const shown = listerFeeShown(figures, { ...POLICY, escrowShown: false });
    expect(r).toEqual({
      totalMinor: 150_000_00,
      valloMinor: figures.valloMinor,
      valloPercentText: figures.valloPercentText,
      valloCapped: false,
      processorUpToMinor: figures.processorUpToMinor,
      receiveMinor: shown.receiveLowMinor,
    });
    expect(r!.valloMinor + r!.processorUpToMinor! + r!.receiveMinor).toBe(r!.totalMinor);
  });

  it("never draws the escrow fee, even with a protection rate in the policy", () => {
    const r = stayResult({ policy: { ...POLICY, escrowShown: true }, processorKnown: true }, 10_000_00, 1)!;
    expect(r.receiveMinor).toBe(10_000_00 - r.valloMinor - r.processorUpToMinor!);
  });

  it("leaves the processor out of every figure when it is not known, rather than guessing", () => {
    const r = stayResult({ policy: POLICY, processorKnown: false }, 10_000_00, 2)!;
    expect(r.processorUpToMinor).toBeNull();
    expect(r.receiveMinor).toBe(20_000_00 - r.valloMinor);
  });

  it("shows nothing for no price, a bad stay length or a policy that does not parse", () => {
    const rates = { policy: POLICY, processorKnown: true };
    expect(stayResult(rates, null, 1)).toBeNull();
    expect(stayResult(rates, 0, 1)).toBeNull();
    expect(stayResult(rates, 10_000_00, 0)).toBeNull();
    expect(stayResult(rates, 10_000_00, MAX_NIGHTS + 1)).toBeNull();
    expect(stayResult({ policy: { ...POLICY, valloBps: Number.NaN }, processorKnown: true }, 10_000_00, 1)).toBeNull();
  });

  it("bills a restaurant the seated fee in force per table, and refuses a non-count", () => {
    expect(restaurantBill(100_000, 12)).toBe(1_200_000);
    expect(restaurantBill(100_000, 0)).toBeNull();
    expect(restaurantBill(100_000, 1.5)).toBeNull();
  });

  it("types no rate and no fee: every figure comes from the server's read", () => {
    for (const file of ["model.ts", "FeeCalculator.tsx"]) {
      const text = readFileSync(join(__dirname, file), "utf8");
      expect(text, file).not.toMatch(/\bbps\s*[:=]\s*\d/i);
      expect(text, file).not.toMatch(/SEATED_FEE_MINOR_DEFAULT|HOTEL_ROOM_FEE_BPS/);
    }
    /* The read never falls back to the code default for the seated fee. */
    expect(readFileSync(join(__dirname, "config.ts"), "utf8")).not.toMatch(/SEATED_FEE_MINOR_DEFAULT/);
  });

  it("offers neither rent nor a sale, and never the protected rail's fees", () => {
    const ui = readFileSync(join(__dirname, "FeeCalculator.tsx"), "utf8");
    expect(ui).not.toMatch(/protected-fees|escrowProtectionLabel|ESCROW_PROTECTION_WHEN/);
    expect(ui).toMatch(/PAYMENT_GATE_SENTENCE/);
  });
});
