import { describe, expect, it } from "vitest";
import {
  counterFor,
  newSince,
  PULL_MAX_PX,
  pullDistance,
  retapGoesTop,
  settleBaseline,
  shouldOfferTop,
} from "./small-rules";

describe("back to top", () => {
  const base = { viewport: 800, pageHeight: 6000 };
  it("offers the way up on a long page, well down it, scrolling up", () => {
    expect(shouldOfferTop({ ...base, scrollY: 2400, scrollingUp: true })).toBe(true);
  });
  it("stays away while reading on, near the top, or on a short page", () => {
    expect(shouldOfferTop({ ...base, scrollY: 2400, scrollingUp: false })).toBe(false);
    expect(shouldOfferTop({ ...base, scrollY: 1200, scrollingUp: true })).toBe(false);
    expect(shouldOfferTop({ viewport: 800, pageHeight: 2400, scrollY: 1700, scrollingUp: true })).toBe(false);
  });
});

describe("pull to refresh", () => {
  it("halves the finger's travel and stops at the ceiling", () => {
    expect(pullDistance(-20)).toBe(0);
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBe(PULL_MAX_PX);
  });
});

describe("field counter", () => {
  it("stays quiet until the last fifth, then counts, and marks the limit", () => {
    expect(counterFor(100, 140)).toEqual({ show: false, over: false });
    expect(counterFor(112, 140)).toEqual({ show: true, over: false });
    expect(counterFor(140, 140)).toEqual({ show: true, over: true });
  });
  it("uses the last 10 on a short limit, and nothing without one", () => {
    expect(counterFor(19, 30)).toEqual({ show: false, over: false });
    expect(counterFor(20, 30)).toEqual({ show: true, over: false });
    expect(counterFor(5, undefined)).toEqual({ show: false, over: false });
  });
});

describe("a second tap on the open tab", () => {
  it("goes to the top only on the tab's own screen, and only when scrolled", () => {
    expect(retapGoesTop("/home", "/home", 600)).toBe(true);
    expect(retapGoesTop("/home", "/home", 0)).toBe(false);
    expect(retapGoesTop("/home", "/home", 3)).toBe(false);
  });
  it("leaves another tab, and a screen one level inside the tab, to navigate", () => {
    expect(retapGoesTop("/search", "/home", 600)).toBe(false);
    expect(retapGoesTop("/around", "/around/lekki", 600)).toBe(false);
  });
});

describe("the new pill's figure", () => {
  it("counts only what went past the figure the list was drawn against", () => {
    expect(newSince(2, 3)).toBe(1);
    expect(newSince(2, 2)).toBe(0);
    expect(newSince(2, 1)).toBe(0);
  });
  it("says nothing while either figure is unknown", () => {
    expect(newSince(null, 3)).toBe(0);
    expect(newSince(2, null)).toBe(0);
  });
  it("takes the first known figure as the baseline, follows it down, never up", () => {
    expect(settleBaseline(null, null)).toBeNull();
    expect(settleBaseline(null, 4)).toBe(4);
    expect(settleBaseline(4, 2)).toBe(2);
    expect(settleBaseline(2, 5)).toBe(2);
    expect(settleBaseline(2, null)).toBe(2);
  });
});
