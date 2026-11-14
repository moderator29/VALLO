import { describe, expect, it } from "vitest";
import { formatCount, scrollTargetFor } from "./count-tabs-math";

describe("formatCount", () => {
  it("shows nothing at zero, below zero, or without a number", () => {
    expect(formatCount(0)).toBeNull();
    expect(formatCount(-3)).toBeNull();
    expect(formatCount(undefined)).toBeNull();
    expect(formatCount(null)).toBeNull();
    expect(formatCount(Number.NaN)).toBeNull();
    expect(formatCount(0.4)).toBeNull();
  });

  it("shows the number up to nine and 9+ past it", () => {
    expect(formatCount(1)).toBe("1");
    expect(formatCount(9)).toBe("9");
    expect(formatCount(10)).toBe("9+");
    expect(formatCount(4821)).toBe("9+");
    expect(formatCount(3.9)).toBe("3");
  });
});

describe("scrollTargetFor", () => {
  const row = { left: 0, right: 300, scrollLeft: 100 };

  it("leaves a tab that is wholly in view where it is", () => {
    expect(scrollTargetFor(row, { left: 40, right: 120 })).toBeNull();
  });

  it("scrolls forward for a tab past the trailing edge, with air", () => {
    expect(scrollTargetFor(row, { left: 280, right: 360 })).toBe(100 + 60 + 16);
  });

  it("scrolls back for a tab before the leading edge, never below zero", () => {
    expect(scrollTargetFor(row, { left: -50, right: 30 })).toBe(100 - 50 - 16);
    expect(scrollTargetFor({ left: 0, right: 300, scrollLeft: 20 }, { left: -50, right: 30 })).toBe(0);
  });
});
