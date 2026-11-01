import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history-model";
import { csvCell, statementCsv } from "./statement";

const row = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: "1",
  kind: "payment",
  occurredAt: "2026-10-30T09:00:00.000000+00:00",
  amountMinor: 250_000_00,
  direction: "out",
  status: "SUCCEEDED",
  reference: "VL-ABC123",
  title: "Two bedroom flat, Yaba",
  bookingId: null,
  grossMinor: null,
  guaranteeMinor: null,
  commissionMinor: null,
  listerShareMinor: null,
  payerName: "Somebody Else",
  payeeName: "Another Person",
  ...over,
});

describe("the member's statement", () => {
  it("has the six columns and signs money out as negative", () => {
    const csv = statementCsv([row({}), row({ kind: "refund", direction: "in", amountMinor: 10_000, title: null })]);
    const [head, first, second] = csv.trim().split("\r\n");
    expect(head).toBe("Date (Lagos),What,To whom,Amount (NGN),Status,Reference");
    expect(first).toContain("-250000.00");
    expect(first).toContain("The lister or host");
    expect(second).toContain("Refund,Back to you,100.00");
  });

  it("never prints another member's name", () => {
    const csv = statementCsv([row({})]);
    expect(csv).not.toContain("Somebody Else");
    expect(csv).not.toContain("Another Person");
  });

  it("defuses spreadsheet formulas and quotes commas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+234")).toBe("'+234");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});
