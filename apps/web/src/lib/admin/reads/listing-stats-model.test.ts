import { describe, expect, it } from "vitest";
import { dayRows, rankedRows, totalsOf, weekly } from "./listing-stats-model";

const day = (d: string, views: number, saves = 0) => ({ day: d, views, saves, enquiries: 0, viewings: 0 });

describe("the listings desk's arithmetic", () => {
  it("reads the daily rows, bigints as text, dropping what is not a day", () => {
    expect(dayRows([{ day: "2026-11-13", views: "12", saves: 3, enquiries: null, viewings: -1 }, { views: 4 }, null])).toEqual([
      day("2026-11-13", 12, 3),
    ]);
    expect(dayRows(null)).toEqual([]);
  });

  it("reads the ranked rows and drops a row with no key", () => {
    expect(
      rankedRows([
        { group_key: "a", label: "Yaba", sub: "", listings: "2", views: "10", saves: 1, enquiries: 0, viewings: 0 },
        { group_key: "", label: "x" },
      ]),
    ).toEqual([{ key: "a", label: "Yaba", sub: null, listings: 2, views: 10, saves: 1, enquiries: 0, viewings: 0 }]);
  });

  it("sums a run of days, and buckets weeks ending today", () => {
    const days = Array.from({ length: 10 }, (_, i) => day(`2026-11-${String(i + 4).padStart(2, "0")}`, i + 1));
    expect(totalsOf(days).views).toBe(55);
    const weeks = weekly(days);
    expect(weeks.map((w) => w.day)).toEqual(["2026-11-04", "2026-11-07"]);
    expect(weeks.map((w) => w.views)).toEqual([1 + 2 + 3, 4 + 5 + 6 + 7 + 8 + 9 + 10]);
  });
});
