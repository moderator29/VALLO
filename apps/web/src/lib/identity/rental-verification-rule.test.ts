import { describe, expect, it } from "vitest";
import { LONG_RENTAL_MONTHS, isLongRental, rentalVerificationOwed, tenancyMonths } from "./rental-verification-rule";

describe("tenancyMonths", () => {
  it("is the larger of one period and the shortest tenancy", () => {
    expect(tenancyMonths("month", null)).toBe(1);
    expect(tenancyMonths("month", 6)).toBe(6);
    expect(tenancyMonths("quarter", 2)).toBe(3);
    expect(tenancyMonths("year", 24)).toBe(24);
  });
  it("reads an unstated period as yearly", () => {
    expect(tenancyMonths(null, null)).toBe(12);
    expect(tenancyMonths("fortnight", undefined)).toBe(12);
  });
});

describe("the long rental line", () => {
  it("starts at 5 months, not 6 (founder, 7 November 2026)", () => {
    expect(LONG_RENTAL_MONTHS).toBe(5);
    expect(isLongRental(4)).toBe(false);
    expect(isLongRental(5)).toBe(true);
    expect(isLongRental(12)).toBe(true);
  });
});

describe("rentalVerificationOwed", () => {
  const base = { flagOn: true, qa: false, months: 12, identity: "none" as const };
  it("asks a renter with nothing on file before a long rental", () => {
    expect(rentalVerificationOwed(base)).toBe(true);
    expect(rentalVerificationOwed({ ...base, identity: "refused" })).toBe(true);
  });
  it("passes a pending or approved identity", () => {
    expect(rentalVerificationOwed({ ...base, identity: "pending" })).toBe(false);
    expect(rentalVerificationOwed({ ...base, identity: "approved" })).toBe(false);
  });
  it("never asks for a short rental", () => {
    expect(rentalVerificationOwed({ ...base, months: 3 })).toBe(false);
  });
  it("never asks a QA account or with the flag off", () => {
    expect(rentalVerificationOwed({ ...base, qa: true })).toBe(false);
    expect(rentalVerificationOwed({ ...base, flagOn: false })).toBe(false);
  });
});
