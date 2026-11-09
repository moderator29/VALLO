import { describe, expect, it } from "vitest";
import { allSeen, ringGradient, ringSegments, ringWindow, RING_GAP_DEG, RING_MAX_SEGMENTS } from "./ring";

/** The story ring is a status: a segment per live story, quiet once opened (reference 7128). */
describe("the story ring", () => {
  it("draws one segment per story, at most six", () => {
    expect(ringSegments(1)).toBe(1);
    expect(ringSegments(3)).toBe(3);
    expect(ringSegments(40)).toBe(RING_MAX_SEGMENTS);
    expect(ringSegments(0)).toBe(1);
  });

  it("draws the newest six stories, not the oldest (the list is oldest first)", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(ringWindow(ids)).toEqual(["c", "d", "e", "f", "g", "h"]);
    /* Only the oldest two are opened: the six drawn are all still lit. */
    const flags = ids.map((id) => id === "a" || id === "b");
    const g = ringGradient(flags);
    expect(g).not.toContain("--nf-ring-seen");
    /* The newest is opened and the rest are not: exactly one quiet segment. */
    const newestOpened = ringGradient(ids.map((id) => id === "h"));
    expect(newestOpened.match(/--nf-ring-seen/g)).toHaveLength(1);
    expect(ringWindow(["a", "b"])).toEqual(["a", "b"]);
  });

  it("one story is a full circle with no gap", () => {
    const lit = ringGradient([false]);
    expect(lit).not.toContain("transparent");
    expect(lit).toContain("--nf-ring-lit");
    expect(ringGradient([true])).toContain("--nf-ring-seen");
  });

  it("several stories leave a gap between segments, and an opened one goes quiet", () => {
    const g = ringGradient([true, false, false]);
    expect(g.match(/--nf-ring-seen/g)).toHaveLength(1);
    expect(g).toContain("transparent");
    /* Three segments of 120deg each, with RING_GAP_DEG of empty ring between. */
    expect(g).toContain(`${(RING_GAP_DEG / 2).toFixed(2)}deg`);
  });

  it("uses tokens only: no raw colour can reach a stylesheet from here", () => {
    for (const flags of [[false], [true], [false, true, false, true], Array(9).fill(false)]) {
      const g = ringGradient(flags);
      expect(g).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(g).not.toMatch(/\brgba?\(/);
      expect(g).not.toMatch(/\bhsla?\(/);
    }
  });

  it("is blue led: only the newest lit segment carries the spark, nothing mixes into it", () => {
    for (const flags of [[false, false], [false, false, false], Array(6).fill(false)]) {
      const g = ringGradient(flags);
      expect(g.match(/--nf-ring-lit-end/g)).toHaveLength(1);
      expect(g).not.toMatch(/color-mix\([^)]*--nf-ring-lit-end/);
      expect(g.lastIndexOf("--nf-ring-lit-end")).toBeGreaterThan(g.lastIndexOf("--nf-ring-lit)"));
    }
    /* The newest opened: the spark goes with it, the rest stay blue. */
    expect(ringGradient([false, false, true])).not.toContain("--nf-ring-lit-end");
  });

  it("is all seen only when there is something and all of it is opened", () => {
    expect(allSeen([])).toBe(false);
    expect(allSeen([true, false])).toBe(false);
    expect(allSeen([true, true])).toBe(true);
  });
});
