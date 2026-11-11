import { describe, expect, it } from "vitest";
import { readEvery } from "./money";

describe("readEvery", () => {
  it("pages until a short page and reports the set complete", async () => {
    const table = Array.from({ length: 2500 }, (_, i) => i);
    const calls: [number, number][] = [];
    const out = await readEvery<number>(async (from, to) => {
      calls.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    expect(out?.rows).toHaveLength(2500);
    expect(out?.complete).toBe(true);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
  it("admits it stopped at the ceiling rather than calling it a total", async () => {
    const out = await readEvery<number>(async (from, to) => ({ data: Array.from({ length: to - from + 1 }, () => 1), error: null }), 2000);
    expect(out?.rows).toHaveLength(2000);
    expect(out?.complete).toBe(false);
  });
  /**
   * A CEILING THAT IS NOT A WHOLE NUMBER OF CHUNKS.
   *
   * The last window before 2500 is rows 2000 to 2499, five hundred of them.
   * A table with 3000 rows fills that window exactly, so the read stopped at
   * the ceiling with five hundred rows still behind it. Reporting
   * `complete: true` there is a desk drawing a partial sum as a total, which
   * is the one thing the ceiling exists to prevent. No caller passes such a
   * ceiling today; this is the guard that keeps it that way.
   */
  it("does not call a partial sum complete when the ceiling is not a whole number of chunks", async () => {
    const table = Array.from({ length: 3000 }, (_, i) => i);
    const out = await readEvery<number>(async (from, to) => ({ data: table.slice(from, to + 1), error: null }), 2500);
    expect(out?.rows).toHaveLength(2500);
    expect(out?.complete).toBe(false);
  });
  it("still reports complete when a short last window really is the end of the table", async () => {
    const table = Array.from({ length: 2300 }, (_, i) => i);
    const out = await readEvery<number>(async (from, to) => ({ data: table.slice(from, to + 1), error: null }), 2500);
    expect(out?.rows).toHaveLength(2300);
    expect(out?.complete).toBe(true);
  });
  it("returns nothing at all on an error, because half a sum is a wrong sum", async () => {
    let n = 0;
    const out = await readEvery<number>(async () => (n++ === 0 ? { data: Array(1000).fill(1), error: null } : { data: null, error: new Error("x") }));
    expect(out).toBeNull();
  });
});
