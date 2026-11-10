import { describe, expect, it } from "vitest";
import { DAY_MS, aggregate, csvText, normaliseReason, parseRange, percentOf, summaryText, trendWords, type ReasonRow } from "./model";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();
const row = (reason: string, days: number, over: Partial<ReasonRow> = {}): ReasonRow => ({ reason, requestedAt: ago(days), restoredAt: null, ...over });

describe("the deletion reason rates", () => {
  it("is honest when there is nothing: zeros, no lines, no divide by zero", () => {
    const a = aggregate([], "30", NOW);
    expect(a).toMatchObject({ total: 0, lines: [], restored: 0, restoredPercent: 0, notGivenPercent: 0, previousTotal: 0, trendPercent: null });
    expect(summaryText(a)).toBe("Account deletion requests, 30 days: 0. None in either period.");
    expect(percentOf(1, 0)).toBe(0);
  });

  it("counts inside the range only and ranks by count then name", () => {
    const rows = [row("found_place", 1), row("found_place", 2), row("privacy", 3), row("hard_to_use", 3), row("other", 40)];
    const a = aggregate(rows, "7", NOW);
    expect(a.total).toBe(4);
    expect(a.lines.map((l) => [l.code, l.count, l.percent])).toEqual([
      ["found_place", 2, 50],
      ["hard_to_use", 1, 25],
      ["privacy", 1, 25],
    ]);
    expect(aggregate(rows, "all", NOW).total).toBe(5);
  });

  it("rounds a share to one decimal", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(2, 3)).toBe(66.7);
  });

  it("compares with the period before, and not at all for all time", () => {
    const rows = [row("other", 1), row("other", 2), row("other", 3), row("other", 10), row("other", 11)];
    const a = aggregate(rows, "7", NOW);
    expect([a.total, a.previousTotal, a.trendPercent]).toEqual([3, 2, 50]);
    expect(trendWords(a)).toBe("Up 50% on the 2 before");
    const all = aggregate(rows, "all", NOW);
    expect([all.previousTotal, all.trendPercent]).toEqual([null, null]);
    expect(trendWords(all)).toBe("No comparison for all time");
  });

  it("counts restored and not given, and treats an unknown code as not given", () => {
    const rows = [row("not_given", 1), row("weird", 1), row("privacy", 1, { restoredAt: ago(0) }), row("privacy", 2)];
    const a = aggregate(rows, "30", NOW);
    expect([a.restored, a.restoredPercent, a.notGiven, a.notGivenPercent]).toEqual([1, 25, 2, 50]);
    expect(normaliseReason("weird")).toBe("not_given");
  });

  it("returns notes only when asked, newest first, capped at 20", () => {
    const rows = Array.from({ length: 25 }, (_, i) => row("other", i % 5, { note: `note ${i}` }));
    expect(aggregate(rows, "30", NOW, false).notes).toEqual([]);
    const withNotes = aggregate(rows, "30", NOW, true).notes;
    expect(withNotes).toHaveLength(20);
    expect(Date.parse(withNotes[0]!.at)).toBeGreaterThanOrEqual(Date.parse(withNotes[19]!.at));
  });

  it("writes a summary and a CSV with the same numbers", () => {
    const a = aggregate([row("privacy", 1), row("privacy", 1), row("other", 1)], "30", NOW);
    expect(summaryText(a)).toContain("Account deletion requests, 30 days: 3.");
    expect(summaryText(a)).toContain("Privacy 66.7%");
    expect(csvText(a).split("\n")).toEqual(["reason,count,percent", "Privacy,2,66.7", "Something else,1,33.3", "Total,3,100"]);
  });

  it("reads a range from the address and falls back to 30 days", () => {
    expect(parseRange("90")).toBe("90");
    expect(parseRange("all")).toBe("all");
    expect(parseRange("1; drop")).toBe("30");
    expect(parseRange(undefined)).toBe("30");
  });
});
