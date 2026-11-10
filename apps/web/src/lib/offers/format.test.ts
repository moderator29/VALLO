import { describe, expect, it } from "vitest";
import { deadlineLine, describeDifference, differenceOf, formatPct, nairaFull, proposedDate, resolveAmount, waitingFor } from "./format";

describe("differenceOf", () => {
  it("says above, below and at, with an amount and a percentage", () => {
    expect(differenceOf(87_000_000_00, 85_000_000_00)).toMatchObject({ direction: "above", word: "Above asking", pct: 2.4 });
    expect(differenceOf(80_000_000_00, 85_000_000_00)).toMatchObject({ direction: "below", word: "Below asking", pct: -5.9 });
    expect(differenceOf(85_000_000_00, 85_000_000_00)).toMatchObject({ direction: "at", word: "At asking", pct: 0 });
  });
  it("describes it in words and figures", () => {
    expect(describeDifference(differenceOf(82_000_000_00, 85_000_000_00))).toBe("Below asking by ₦3,000,000 (3.5%)");
    expect(describeDifference(differenceOf(1, 1))).toBe("At asking");
  });
  it("never divides by a zero asking price", () => {
    expect(differenceOf(100, 0).pct).toBe(0);
  });
});

describe("formatPct", () => {
  it("drops a trailing .0 and the sign", () => {
    expect(formatPct(5)).toBe("5%");
    expect(formatPct(-2.4)).toBe("2.4%");
  });
});

describe("resolveAmount", () => {
  const asking = 85_000_000_00;
  it("blank means the asking price, resolved", () => {
    expect(resolveAmount("", asking)).toEqual({ ok: true, minor: asking, atAsking: true });
    expect(resolveAmount(null, asking)).toEqual({ ok: true, minor: asking, atAsking: true });
  });
  it("parses naira with commas", () => {
    expect(resolveAmount("80,000,000", asking)).toEqual({ ok: true, minor: 80_000_000_00, atAsking: false });
  });
  it("refuses zero, negative, text and enormous figures", () => {
    expect(resolveAmount("0", asking)).toMatchObject({ ok: false, reason: "bad_amount" });
    expect(resolveAmount("-5", asking)).toMatchObject({ ok: false, reason: "bad_amount" });
    expect(resolveAmount("abc", asking)).toMatchObject({ ok: false, reason: "bad_amount" });
    expect(resolveAmount("1e9", asking)).toMatchObject({ ok: false, reason: "bad_amount" });
    expect(resolveAmount("999999999999999", asking)).toMatchObject({ ok: false, reason: "amount_too_large" });
  });
  it("refuses a blank offer when there is no asking price", () => {
    expect(resolveAmount("", 0)).toMatchObject({ ok: false });
  });
});

describe("times", () => {
  const now = Date.parse("2026-11-10T10:00:00Z");
  it("states a deadline only when the data has one", () => {
    expect(deadlineLine(null, now)).toBe("No deadline has been set on this offer.");
    expect(deadlineLine("2026-11-14T12:00:00Z", now)).toBe("This offer expires on 14 Nov 2026.");
    expect(deadlineLine("2026-11-05T12:00:00Z", now)).toBe("This offer expired on 5 Nov 2026.");
  });
  it("says how long something has waited", () => {
    expect(waitingFor("2026-11-10T09:59:40Z", now)).toBe("just now");
    expect(waitingFor("2026-11-10T08:00:00Z", now)).toBe("2 hours");
    expect(waitingFor("2026-11-06T10:00:00Z", now)).toBe("4 days");
  });
  it("labels the closing date as proposed", () => {
    expect(proposedDate("2026-12-15")).toBe("Proposed 15 Dec 2026");
    expect(proposedDate(null)).toBe("No date proposed");
  });
  it("prints the naira sign with the figure", () => {
    expect(nairaFull(85_000_000_00)).toBe("₦85,000,000");
  });
});
