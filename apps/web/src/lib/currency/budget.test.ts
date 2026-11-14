import { describe, expect, it } from "vitest";
import { convertNgnMinor, convertToNgnMinor } from "./convert";
import { NAIRA_ONLY, type DisplayMoney } from "./display";
import { BUDGET_MAX_NAIRA, budgetNairaFromUnits, budgetUnitsFromNaira } from "./budget";

/**
 * CURRENCY TOOL 2: a reader's search budget typed in their currency becomes
 * whole naira for the filter, only while a fresh rate is on the page, and
 * naira read back never overstates.
 */

const RATE = {
  currency: "GBP" as const,
  ngnPerUnit: "1788.334597543",
  source: "exchangerate-api" as const,
  sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
  fetchedAt: "2026-11-13T00:50:04.000Z",
};
const POUNDS: DisplayMoney = { choice: "GBP", currency: "GBP", automatic: "NGN", areaUnit: "sqm", distanceUnit: "km", rate: RATE };
const FRANCS: DisplayMoney = {
  ...POUNDS,
  choice: "XOF",
  currency: "XOF",
  rate: { ...RATE, currency: "XOF", ngnPerUnit: "2.725" },
};

describe("convertToNgnMinor", () => {
  it("turns the other currency's minor units into kobo, half to even", () => {
    // 1,500.00 pounds at 1,788.334597543 = 2,682,501.8963145 naira.
    expect(convertToNgnMinor(150_000, "GBP", RATE.ngnPerUnit)).toBe(268_250_190);
    // A currency with no minor unit: 1,000 francs at 2.725 = 2,725 naira.
    expect(convertToNgnMinor(1_000, "XOF", "2.725")).toBe(272_500);
    // An exact half goes to the even kobo: 0.01 at 0.5 naira is half a kobo.
    expect(convertToNgnMinor(1, "GBP", "0.5")).toBe(0);
    expect(convertToNgnMinor(3, "GBP", "0.5")).toBe(2);
  });

  it("is the identity for naira and refuses what it cannot read", () => {
    expect(convertToNgnMinor(12_345, "NGN", "1")).toBe(12_345);
    expect(convertToNgnMinor(1.5, "GBP", RATE.ngnPerUnit)).toBeNull();
    expect(convertToNgnMinor(100, "GBP", "nonsense")).toBeNull();
    expect(convertToNgnMinor(100, "GBP", "0")).toBeNull();
  });

  it("comes back to within one minor unit of where it started", () => {
    for (const minor of [1, 99, 150_000, 987_654_321]) {
      const kobo = convertToNgnMinor(minor, "GBP", RATE.ngnPerUnit);
      expect(kobo).not.toBeNull();
      const back = convertNgnMinor(kobo!, "GBP", RATE.ngnPerUnit);
      expect(Math.abs(back! - minor)).toBeLessThanOrEqual(1);
    }
  });
});

describe("a budget typed in the reader's currency", () => {
  it("becomes whole naira, cut not rounded up", () => {
    expect(budgetNairaFromUnits(1_500, POUNDS)).toBe(2_682_501);
    expect(budgetNairaFromUnits(1_000, FRANCS)).toBe(2_725);
  });

  it("never exceeds what the naira field can hold", () => {
    expect(budgetNairaFromUnits(900_000_000, POUNDS)).toBe(BUDGET_MAX_NAIRA);
  });

  it("answers nothing without a fresh rate, for naira, or for a figure that is not a whole positive number", () => {
    expect(budgetNairaFromUnits(1_500, { ...POUNDS, rate: null })).toBeNull();
    expect(budgetNairaFromUnits(1_500, NAIRA_ONLY)).toBeNull();
    expect(budgetNairaFromUnits(1_500, null)).toBeNull();
    expect(budgetNairaFromUnits(0, POUNDS)).toBeNull();
    expect(budgetNairaFromUnits(-5, POUNDS)).toBeNull();
    expect(budgetNairaFromUnits(1.5, POUNDS)).toBeNull();
  });

  it("reads naira back in whole units, the way every guide figure is cut", () => {
    // Exactly as a guide figure is worked: to the penny half to even, then cut
    // to whole pounds. 2,682,501 naira is 1,499.9995 pounds, which is 1,500.00
    // to the penny; 5,000,000 naira is 2,795.89 and reads 2,795.
    expect(budgetUnitsFromNaira(2_682_501, POUNDS)).toBe(1_500);
    expect(budgetUnitsFromNaira(5_000_000, POUNDS)).toBe(2_795);
    expect(budgetUnitsFromNaira(2_725, FRANCS)).toBe(1_000);
    // Under one unit there is nothing to show.
    expect(budgetUnitsFromNaira(500, POUNDS)).toBeNull();
    expect(budgetUnitsFromNaira(2_682_501, { ...POUNDS, rate: null })).toBeNull();
    expect(budgetUnitsFromNaira(2_682_501, NAIRA_ONLY)).toBeNull();
  });
});
