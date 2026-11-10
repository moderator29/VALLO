import { DELETION_REASONS } from "@/lib/account-deletion/constants";

/**
 * WHY PEOPLE DELETE THEIR ACCOUNT, as rates (founder, 10 November 2026). Pure
 * arithmetic over rows of reason, requested and restored; no database, no
 * clock of its own, nothing that names a person. The desk, the copilot tool
 * and the copy buttons all read the same numbers from here.
 */

export const DAY_MS = 86_400_000;

export const RANGES = ["7", "30", "90", "all"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_LABEL: Record<Range, string> = { "7": "7 days", "30": "30 days", "90": "90 days", all: "All time" };

export function parseRange(value: string | string[] | undefined): Range {
  const one = Array.isArray(value) ? value[0] : value;
  return (RANGES as readonly string[]).includes(one ?? "") ? (one as Range) : "30";
}

export const REASON_CODES = [...DELETION_REASONS, "not_given"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_LABEL: Record<ReasonCode, string> = {
  not_using: "Not using Vallo any more",
  found_place: "Found a place",
  not_found: "Could not find what they wanted",
  hard_to_use: "Hard to use",
  notifications: "Too many notifications",
  privacy: "Privacy",
  safety: "Safety",
  second_account: "Has another account",
  other: "Something else",
  prefer_not_to_say: "Prefers not to say",
  not_given: "Not given",
};

export type ReasonRow = {
  reason: string;
  requestedAt: string;
  restoredAt: string | null;
  /** Only ever filled for a super admin. */
  note?: string | null;
};

export type ReasonLine = { code: ReasonCode; label: string; count: number; percent: number };

export type Aggregate = {
  range: Range;
  total: number;
  lines: ReasonLine[];
  /** Requests in the period before this one, the same length. Null for "all". */
  previousTotal: number | null;
  /** Percent change against the previous period; null when there is nothing to compare. */
  trendPercent: number | null;
  restored: number;
  restoredPercent: number;
  notGiven: number;
  notGivenPercent: number;
  notes: { at: string; reason: ReasonCode; text: string }[];
};

/** Anything off the closed list reads as 'not given' rather than inventing a bucket. */
export function normaliseReason(value: string): ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value) ? (value as ReasonCode) : "not_given";
}

/** A share as a percentage with one decimal; zero when there is nothing to divide. */
export function percentOf(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function inWindow(row: ReasonRow, from: number, to: number): boolean {
  const at = Date.parse(row.requestedAt);
  return Number.isFinite(at) && at >= from && at <= to;
}

export function windowStart(range: Range, now: number): number {
  return range === "all" ? Number.NEGATIVE_INFINITY : now - Number(range) * DAY_MS;
}

export function aggregate(rows: readonly ReasonRow[], range: Range, now: number, showNotes = false): Aggregate {
  const from = windowStart(range, now);
  const current = rows.filter((row) => inWindow(row, from, now));
  const counts = new Map<ReasonCode, number>();
  for (const row of current) {
    const code = normaliseReason(row.reason);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const total = current.length;
  const lines: ReasonLine[] = [...counts.entries()]
    .map(([code, count]) => ({ code, label: REASON_LABEL[code], count, percent: percentOf(count, total) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  let previousTotal: number | null = null;
  let trendPercent: number | null = null;
  if (range !== "all") {
    const span = Number(range) * DAY_MS;
    previousTotal = rows.filter((row) => inWindow(row, from - span, from - 1)).length;
    trendPercent = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10 : null;
  }

  const restored = current.filter((row) => row.restoredAt !== null).length;
  const notGiven = counts.get("not_given") ?? 0;
  const notes = showNotes
    ? current
        .filter((row) => typeof row.note === "string" && row.note.trim().length > 0)
        .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
        .slice(0, 20)
        .map((row) => ({ at: row.requestedAt, reason: normaliseReason(row.reason), text: (row.note ?? "").trim().slice(0, 500) }))
    : [];

  return {
    range,
    total,
    lines,
    previousTotal,
    trendPercent,
    restored,
    restoredPercent: percentOf(restored, total),
    notGiven,
    notGivenPercent: percentOf(notGiven, total),
    notes,
  };
}

export function trendWords(a: Aggregate): string {
  if (a.previousTotal === null) return "No comparison for all time";
  if (a.previousTotal === 0) return a.total === 0 ? "None in either period" : "None in the period before";
  const sign = (a.trendPercent ?? 0) > 0 ? "up" : (a.trendPercent ?? 0) < 0 ? "down" : "level";
  if (sign === "level") return `Level with the ${a.previousTotal} before`;
  return `${sign === "up" ? "Up" : "Down"} ${Math.abs(a.trendPercent ?? 0)}% on the ${a.previousTotal} before`;
}

/** The short text the Copy summary button puts on the clipboard. */
export function summaryText(a: Aggregate): string {
  const head = `Account deletion requests, ${RANGE_LABEL[a.range].toLowerCase()}: ${a.total}. ${trendWords(a)}.`;
  if (a.total === 0) return head;
  const top = a.lines.slice(0, 3).map((l) => `${l.label} ${l.percent}%`).join(", ");
  return `${head} Top reasons: ${top}. Restored within 30 days: ${a.restored} (${a.restoredPercent}%). Reason not given: ${a.notGiven} (${a.notGivenPercent}%).`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Comma separated rows for a spreadsheet: reason, count, share. */
export function csvText(a: Aggregate): string {
  const rows = [["reason", "count", "percent"], ...a.lines.map((l) => [l.label, l.count, l.percent]), ["Total", a.total, a.total === 0 ? 0 : 100]];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
