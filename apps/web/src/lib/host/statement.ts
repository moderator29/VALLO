/**
 * A HOST'S PAYOUT STATEMENT FOR ONE MONTH (C9, 30 September 2026). READ ONLY.
 *
 * Every line is one row `my_earnings_history` already returns under the
 * host's own session: a payment Paystack split (what the guest paid, Vallo's
 * commission, the Guarantee contribution, the host's share, the Paystack
 * reference) or a refund that reversed part of one. Nothing here computes a
 * split: the four figures are the ones written when the money moved, and the
 * totals are sums of those, in integer kobo. Nothing here changes how money
 * moves; there is no button on a statement that moves money.
 *
 * A reversal's figures are shown as negatives, because on a statement a
 * reversal is money that came off; the database returns them either way
 * round, so the sign is set from the kind, never from the figure.
 */

import type { HistoryEntry } from "../money/history-model";

export type StatementLine = {
  id: string;
  kind: "earning" | "reversal";
  occurredAt: string;
  /** Lagos day, YYYY-MM-DD. */
  day: string;
  title: string;
  reference: string | null;
  bookingId: string | null;
  status: string;
  grossMinor: number;
  commissionMinor: number;
  guaranteeMinor: number;
  shareMinor: number;
};

export type StatementTotals = {
  payments: number;
  reversals: number;
  grossMinor: number;
  commissionMinor: number;
  guaranteeMinor: number;
  /** The host's share after reversals: what reached their bank. */
  shareMinor: number;
};

const LAGOS_OFFSET_MS = 3_600_000;

/** The instant a Lagos month starts, as ISO. */
export function monthStartInstant(month: string): string {
  return new Date(Date.parse(`${month}-01T00:00:00Z`) - LAGOS_OFFSET_MS).toISOString();
}

export function nextMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function lagosDayOf(iso: string): string {
  return new Date(Date.parse(iso) + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Lagos month an instant falls in. */
export function lagosMonthOf(iso: string): string {
  return lagosDayOf(iso).slice(0, 7);
}

function signed(kind: "earning" | "reversal", value: number | null): number {
  const v = Math.abs(value ?? 0);
  return kind === "reversal" ? -v : v;
}

/** The lines of one Lagos month, oldest first, from history entries of any range. */
export function statementLines(entries: readonly HistoryEntry[], month: string): StatementLine[] {
  return entries
    .filter((e): e is HistoryEntry & { kind: "earning" | "reversal" } => e.kind === "earning" || e.kind === "reversal")
    .filter((e) => lagosMonthOf(e.occurredAt) === month)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      occurredAt: e.occurredAt,
      day: lagosDayOf(e.occurredAt),
      title: e.title ?? (e.kind === "earning" ? "A stay" : "A refund"),
      reference: e.reference,
      bookingId: e.bookingId,
      status: e.status,
      grossMinor: signed(e.kind, e.grossMinor),
      commissionMinor: signed(e.kind, e.commissionMinor),
      guaranteeMinor: signed(e.kind, e.guaranteeMinor),
      shareMinor: signed(e.kind, e.amountMinor),
    }))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

export function statementTotals(lines: readonly StatementLine[]): StatementTotals {
  return lines.reduce<StatementTotals>(
    (t, l) => ({
      payments: t.payments + (l.kind === "earning" ? 1 : 0),
      reversals: t.reversals + (l.kind === "reversal" ? 1 : 0),
      grossMinor: t.grossMinor + l.grossMinor,
      commissionMinor: t.commissionMinor + l.commissionMinor,
      guaranteeMinor: t.guaranteeMinor + l.guaranteeMinor,
      shareMinor: t.shareMinor + l.shareMinor,
    }),
    { payments: 0, reversals: 0, grossMinor: 0, commissionMinor: 0, guaranteeMinor: 0, shareMinor: 0 },
  );
}

/**
 * Whether the statement draws a Guarantee row and column at all (A9, D51).
 *
 * The Guarantee is retired and a new payment carries no contribution, so a
 * month of new payments printed "Guarantee contribution ₦0" on every line, a
 * charge that no longer exists. The row shows only where a line carried one:
 * a payment made while it ran, or the reversal of one.
 */
export function statementCarriesGuarantee(lines: readonly StatementLine[]): boolean {
  return lines.some((line) => line.guaranteeMinor !== 0);
}

/** Kobo to "12345.67", the way an accountant's spreadsheet reads money. */
export function nairaPlain(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function cell(value: string): string {
  /* A leading = + - @ would be read as a formula by a spreadsheet: quote it
     and prefix an apostrophe (CSV injection). Every cell is quoted anyway. */
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const CSV_HEADER = [
  "Date (Lagos)",
  "Type",
  "Stay",
  "Guest paid (NGN)",
  "Vallo commission (NGN)",
  "Guarantee contribution (NGN)",
  "Your share (NGN)",
  "Payment reference",
  "Booking",
];

/** The statement as CSV, with a totals row. UTF-8 with a BOM so Excel reads the naira sign. */
export function statementCsv(lines: readonly StatementLine[]): string {
  const rows = lines.map((l) =>
    [
      l.day,
      l.kind === "earning" ? "Payment" : "Refund reversal",
      l.title,
      nairaPlain(l.grossMinor),
      nairaPlain(l.commissionMinor),
      nairaPlain(l.guaranteeMinor),
      nairaPlain(l.shareMinor),
      l.reference ?? "",
      l.bookingId ?? "",
    ].map(cell),
  );
  const t = statementTotals(lines);
  rows.push(
    ["", "Total", `${t.payments} payments, ${t.reversals} reversals`, nairaPlain(t.grossMinor), nairaPlain(t.commissionMinor), nairaPlain(t.guaranteeMinor), nairaPlain(t.shareMinor), "", ""].map(cell),
  );
  return `﻿${[CSV_HEADER.map(cell), ...rows].map((r) => r.join(",")).join("\r\n")}\r\n`;
}

/** Months that have at least one line, newest first, from entries of any range. */
export function monthsWithLines(entries: readonly HistoryEntry[]): string[] {
  const set = new Set(
    entries.filter((e) => e.kind === "earning" || e.kind === "reversal").map((e) => lagosMonthOf(e.occurredAt)),
  );
  return [...set].sort().reverse();
}
