import { historyKindLabelEn } from "@vallo/i18n/en/history-kinds";
import type { StatusTone } from "@/components/ui/StatusPill";
import { formatMoneyDate } from "./dates";

/**
 * THE SHAPE OF A MONEY HISTORY, AND EVERY DECISION ABOUT HOW IT READS.
 *
 * Three screens draw the same record from three sides: what a renter or guest
 * paid (`my_payments_history`), what a lister was paid by Paystack's split
 * (`my_earnings_history`), and the platform-wide view on the Money desk
 * (`admin_money_history`). The database functions return rows of money that
 * has ALREADY MOVED. Nothing here adds them into a figure Vallo is keeping for
 * anybody, because Vallo keeps nothing: the lister's share settled to their
 * bank in the same transaction the payer paid (docs/MONEY_ARCHITECTURE.md).
 *
 * This file is pure, client-safe and tested, so the three pages cannot
 * disagree about the three things a reader actually checks:
 *
 *   1. WHICH WAY THE MONEY WENT. On the payer's side a payment is money out
 *      and a refund is money back. On the lister's side an earning is money in
 *      and a reversal is money out. The sign is decided by the KIND, never by
 *      the sign of the figure, because a reversal arrives negative and a
 *      refund arrives positive and both mean "less for this reader".
 *   2. WHAT STATE IT IS IN, as a word. A refund still with the processor is
 *      "Processing", never drawn as settled money.
 *   3. WHICH DAY IT HAPPENED, in Lagos time, whatever the viewer's clock says.
 *
 * All money is integer kobo from start to finish. Nothing here divides it.
 */

export type HistoryKind = "payment" | "refund" | "earning" | "reversal";
export type HistoryDirection = "in" | "out";

export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  /** The instant it moved, exactly as the database printed it (microseconds kept). */
  occurredAt: string;
  /** Always positive: the size of the movement. The direction carries the sign. */
  amountMinor: number;
  direction: HistoryDirection;
  status: string;
  reference: string | null;
  title: string | null;
  bookingId: string | null;
  /** The whole charge, on the earnings and platform rows. */
  grossMinor: number | null;
  guaranteeMinor: number | null;
  commissionMinor: number | null;
  /** The lister's share, on the platform rows. */
  listerShareMinor: number | null;
  /** Display names, on the platform rows only. */
  payerName: string | null;
  payeeName: string | null;
};

const KINDS: readonly HistoryKind[] = ["payment", "refund", "earning", "reversal"];

/** Which way each kind moved, for the person reading it. */
export const DIRECTION: Record<HistoryKind, HistoryDirection> = {
  payment: "out",
  refund: "in",
  earning: "in",
  reversal: "out",
};

/**
 * What a row is called when the listing's title could not be read. The
 * platform view draws no sign at all: it is nobody's money, only a record.
 */
/** SW11: source of truth is now `packages/i18n/src/locales/history-kinds.en.ts`. */
export const KIND_LABEL: Record<HistoryKind, string> = historyKindLabelEn as Record<HistoryKind, string>;

/* ------------------------------------------------------------------ parsing */

/**
 * A kobo figure from PostgREST. A bigint normally arrives as a JSON number;
 * a string of digits is accepted too, because a driver that stringifies
 * bigints is a real thing and a history must not blank out over it.
 */
export function toMinor(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * One database row to one entry, or null for a row that is not one. A row
 * with no id, no instant or no amount is dropped rather than drawn as ₦0,
 * because a zero that is really "unknown" is a wrong figure on a money screen.
 */
export function parseHistoryRow(row: unknown): HistoryEntry | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = text(r.entry_id);
  const kind = KINDS.find((k) => k === r.kind);
  const occurredAt = text(r.occurred_at);
  const amount = toMinor(r.amount_minor);
  if (!id || !kind || !occurredAt || amount === null || Number.isNaN(Date.parse(occurredAt))) return null;
  return {
    id,
    kind,
    occurredAt,
    amountMinor: Math.abs(amount),
    direction: DIRECTION[kind],
    status: text(r.status) ?? "",
    reference: text(r.reference),
    title: text(r.title),
    bookingId: text(r.booking_id),
    grossMinor: toMinor(r.gross_minor),
    guaranteeMinor: toMinor(r.guarantee_minor),
    commissionMinor: toMinor(r.commission_minor),
    listerShareMinor: toMinor(r.lister_share_minor),
    payerName: text(r.payer_name),
    payeeName: text(r.payee_name),
  };
}

export function parseHistoryRows(rows: unknown): HistoryEntry[] | null {
  if (!Array.isArray(rows)) return null;
  return rows.map(parseHistoryRow).filter((e): e is HistoryEntry => e !== null);
}

export type PaymentsSummary = { paidMinor: number; payments: number; refundedMinor: number };
export type EarningsSummary = {
  earnedMinor: number;
  grossMinor: number;
  payments: number;
  reversedMinor: number;
  netMinor: number;
};
export type AdminMoneySummary = {
  grossMinor: number;
  listerMinor: number;
  guaranteeMinor: number;
  commissionMinor: number;
  payments: number;
  refundedMinor: number;
};

/** The status a summary came back with, and its figures when it is "ok". */
export type SummaryRead<T> = { status: "ok"; summary: T } | { status: "signed_out" | "forbidden" | "unreadable" };

function readSummary<K extends string>(value: unknown, keys: readonly K[]): SummaryRead<Record<K, number>> {
  if (!value || typeof value !== "object") return { status: "unreadable" };
  const v = value as Record<string, unknown>;
  if (v.status === "signed_out" || v.status === "forbidden") return { status: v.status };
  if (v.status !== "ok") return { status: "unreadable" };
  const out = {} as Record<K, number>;
  for (const key of keys) {
    const n = toMinor(v[key]);
    /* Every figure or none: a summary missing one total is not a summary. */
    if (n === null) return { status: "unreadable" };
    out[key] = n;
  }
  return { status: "ok", summary: out };
}

export function parsePaymentsSummary(value: unknown): SummaryRead<PaymentsSummary> {
  const read = readSummary(value, ["paid_minor", "payments", "refunded_minor"] as const);
  if (read.status !== "ok") return read;
  const s = read.summary;
  return { status: "ok", summary: { paidMinor: s.paid_minor, payments: s.payments, refundedMinor: s.refunded_minor } };
}

export function parseEarningsSummary(value: unknown): SummaryRead<EarningsSummary> {
  const read = readSummary(value, ["earned_minor", "gross_minor", "payments", "reversed_minor", "net_minor"] as const);
  if (read.status !== "ok") return read;
  const s = read.summary;
  return {
    status: "ok",
    summary: {
      earnedMinor: s.earned_minor,
      grossMinor: s.gross_minor,
      payments: s.payments,
      /* The function returns the reversal as a positive "how much came off";
         kept positive here and signed where it is drawn. */
      reversedMinor: Math.abs(s.reversed_minor),
      netMinor: s.net_minor,
    },
  };
}

export function parseAdminSummary(value: unknown): SummaryRead<AdminMoneySummary> {
  const read = readSummary(value, [
    "gross_minor",
    "lister_minor",
    "guarantee_minor",
    "commission_minor",
    "payments",
    "refunded_minor",
  ] as const);
  if (read.status !== "ok") return read;
  const s = read.summary;
  return {
    status: "ok",
    summary: {
      grossMinor: s.gross_minor,
      listerMinor: s.lister_minor,
      guaranteeMinor: s.guarantee_minor,
      commissionMinor: s.commission_minor,
      payments: s.payments,
      refundedMinor: s.refunded_minor,
    },
  };
}

/* ------------------------------------------------------------------- status */

/**
 * The state of a movement, as a word and a tone.
 *
 * The words are this screen's, because the database speaks two vocabularies
 * at once: a transaction's own status (SUCCESSFUL, REFUNDED) and a refund's
 * processor status (pending, submitted, processed, failed, not_needed). The
 * TONES are the ones `toneForStatus` (components/ui/StatusPill.tsx), the
 * platform's one status colour map, gives the equivalent word: a processed
 * refund is COMPLETED's emerald, a submitted one PROCESSING's info, and so on.
 * They are written out rather than called so this file stays free of React
 * and runs in the unit suite; if that map ever moves a word, move it here too.
 *
 * A payment later refunded keeps its own row and says "Refunded" in the
 * neutral tone: the payment did happen, and the refund is its own row with
 * its own state, so painting the payment red would say it failed.
 */
export function statusFor(kind: HistoryKind, status: string): { label: string; tone: StatusTone } {
  const s = status.trim().toLowerCase();
  if (kind === "refund") {
    switch (s) {
      case "processed":
        return { label: "Refunded", tone: "success" };
      case "submitted":
        return { label: "Processing", tone: "info" };
      case "pending":
        return { label: "Pending", tone: "warning" };
      case "failed":
        return { label: "Failed", tone: "danger" };
      case "not_needed":
        return { label: "Not needed", tone: "neutral" };
      default:
        /* A state the database gained before this screen did: shown as its
           own word, in no colour, rather than guessed at. */
        return { label: status || "Unknown", tone: "neutral" };
    }
  }
  if (kind === "reversal") return { label: "Reversed", tone: "neutral" };
  if (s === "successful") return { label: kind === "earning" ? "Settled" : "Paid", tone: "success" };
  if (s === "refunded") return { label: "Refunded", tone: "neutral" };
  return { label: status || "Unknown", tone: "neutral" };
}

/** "+" for money that came to the reader, "-" for money that left them. */
export function signFor(direction: HistoryDirection): "+" | "-" {
  return direction === "in" ? "+" : "-";
}

/* --------------------------------------------------------------------- days */

const LAGOS = "Africa/Lagos";

/** The Lagos calendar day an instant falls on, as `YYYY-MM-DD`. */
export function lagosDay(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  /* en-CA formats a date as YYYY-MM-DD, which is the key and the sort order. */
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "Today", "Yesterday", or the money-date form of the day ("Fri 16 Oct"). */
export function dayLabel(day: string, now: Date = new Date()): string {
  if (day === lagosDay(now)) return "Today";
  /* Noon Lagos today, less a day, is always yesterday in Lagos. */
  const noon = new Date(`${lagosDay(now)}T12:00:00+01:00`);
  if (day === lagosDay(new Date(noon.getTime() - 86_400_000))) return "Yesterday";
  return formatMoneyDate(day, "en", { now }) ?? day;
}

export type HistoryDay = { day: string; label: string; entries: HistoryEntry[] };

/** Entries arrive newest first; the order is kept inside and across days. */
export function groupByDay(entries: readonly HistoryEntry[], now: Date = new Date()): HistoryDay[] {
  const days: HistoryDay[] = [];
  for (const entry of entries) {
    const day = lagosDay(entry.occurredAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else days.push({ day, label: dayLabel(day, now), entries: [entry] });
  }
  return days;
}

/* --------------------------------------------------------------- pagination */

/**
 * `?before=` is an instant the page reads rows older than. It is the
 * `occurred_at` of the last row on the page before, PASSED BACK EXACTLY: a
 * Postgres timestamp carries microseconds and `Date#toISOString` keeps only
 * milliseconds, so re-printing it would move the boundary and drop or repeat
 * rows. Anything that is not a full ISO instant with a zone is refused and
 * the page reads from the newest row, which is always a safe answer.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

export function parseBefore(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.length > 40) return null;
  /* A "+" in a query string arrives as a space when it was not encoded. */
  const candidate = value.trim().replace(/ (\d{2}(?::?\d{2})?)$/, "+$1");
  if (!ISO_INSTANT.test(candidate)) return null;
  return Number.isNaN(Date.parse(candidate)) ? null : candidate;
}

/** The link to the page before this one, or null when this page is the last. */
export function earlierHref(basePath: string, nextBefore: string | null): string | null {
  if (!nextBefore) return null;
  return `${basePath}?before=${encodeURIComponent(nextBefore)}`;
}

/**
 * A page of history from a read that asked for one row more than it shows.
 * The extra row only answers "is there more", and is never drawn.
 */
export function pageOf(entries: HistoryEntry[], pageSize: number): { entries: HistoryEntry[]; nextBefore: string | null } {
  if (entries.length <= pageSize) return { entries, nextBefore: null };
  const shown = entries.slice(0, pageSize);
  return { entries: shown, nextBefore: shown[shown.length - 1]?.occurredAt ?? null };
}

/* -------------------------------------------------------------- date ranges */

/**
 * A `YYYY-MM-DD` from a query string, as a real calendar date, or null.
 * `2026-02-30` is refused rather than rolled into March.
 */
export function parseDay(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return raw;
}

/** The first instant of a Lagos calendar day. Lagos is UTC+1 all year. */
export function lagosDayStart(day: string): string {
  return `${day}T00:00:00+01:00`;
}

/** The first instant AFTER a Lagos calendar day, so a `to` day is inclusive. */
export function lagosDayEnd(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.toISOString().slice(0, 10)}T00:00:00+01:00`;
}
