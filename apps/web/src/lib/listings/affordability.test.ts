import { describe, expect, it } from "vitest";
import { affordability, incomeMinorFromNaira } from "./affordability";

describe("affordability", () => {
  it("turns a yearly rent into a monthly share of income", () => {
    const a = affordability({ rentMinor: 360_000_000, period: "year", moveInMinor: 500_000_000, incomeMinor: 100_000_000 });
    expect(a).not.toBeNull();
    expect(a!.monthlyRentMinor).toBe(30_000_000);
    expect(a!.rentShare).toBeCloseTo(0.3, 5);
    expect(a!.moveInMonths).toBeCloseTo(5, 5);
  });

  it("handles a monthly and a quarterly rent", () => {
    expect(affordability({ rentMinor: 20_000_000, period: "month", moveInMinor: null, incomeMinor: 100_000_000 })!.rentShare).toBeCloseTo(0.2, 5);
    expect(affordability({ rentMinor: 90_000_000, period: "quarter", moveInMinor: null, incomeMinor: 100_000_000 })!.monthlyRentMinor).toBe(30_000_000);
  });

  it("has no move-in months when no total is stated", () => {
    expect(affordability({ rentMinor: 120_000_000, period: "year", moveInMinor: undefined, incomeMinor: 50_000_000 })!.moveInMonths).toBeNull();
    expect(affordability({ rentMinor: 120_000_000, period: "year", moveInMinor: 0, incomeMinor: 50_000_000 })!.moveInMonths).toBeNull();
  });

  it("says nothing without a rent or an income", () => {
    expect(affordability({ rentMinor: 0, period: "year", moveInMinor: 1, incomeMinor: 1 })).toBeNull();
    expect(affordability({ rentMinor: null, period: "year", moveInMinor: 1, incomeMinor: 1 })).toBeNull();
    expect(affordability({ rentMinor: 1, period: "year", moveInMinor: 1, incomeMinor: null })).toBeNull();
    expect(affordability({ rentMinor: 1, period: "year", moveInMinor: 1, incomeMinor: -5 })).toBeNull();
    expect(affordability({ rentMinor: Number.NaN, period: "year", moveInMinor: 1, incomeMinor: 1 })).toBeNull();
  });

  it("reads typed naira as kobo and refuses nonsense", () => {
    expect(incomeMinorFromNaira("450,000")).toBe(45_000_000);
    expect(incomeMinorFromNaira("₦ 1500000")).toBe(150_000_000);
    expect(incomeMinorFromNaira("")).toBeNull();
    expect(incomeMinorFromNaira("0")).toBeNull();
    expect(incomeMinorFromNaira("1234567890123")).toBeNull();
  });
});
