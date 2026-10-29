import { describe, expect, it } from "vitest";
import { COMPARE_MAX, compareHref, parseIds, toggled } from "./ids";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";

describe("compare tray", () => {
  it("reads only well-formed ids, unique, and no more than the limit", () => {
    expect(parseIds(null)).toEqual([]);
    expect(parseIds("not json")).toEqual([]);
    expect(parseIds(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseIds(JSON.stringify([A, "nope", A, 5, B.toUpperCase()]))).toEqual([A, B]);
    expect(parseIds(JSON.stringify([A, B, C, D, E]))).toEqual([A, B, C, D]);
  });

  it("adds, removes and refuses a fifth", () => {
    expect(toggled([], A)).toEqual({ ids: [A], full: false });
    expect(toggled([A, B], A)).toEqual({ ids: [B], full: false });
    const full = [A, B, C, D];
    expect(full.length).toBe(COMPARE_MAX);
    expect(toggled(full, E)).toEqual({ ids: full, full: true });
    expect(toggled(full, A).ids).toEqual([B, C, D]);
  });

  it("ignores a malformed id and builds the address", () => {
    expect(toggled([A], "x")).toEqual({ ids: [A], full: false });
    expect(compareHref([A, B])).toBe(`/compare?ids=${A},${B}`);
  });
});
