import { formatMoney } from "@vallo/i18n/core";
import { dateTimeLabel } from "@/lib/format/when";
import type { ToolContext } from "./types";

/** The caller's own client and id, or null when the tool was somehow run without them. */
export function callerOf(ctx: ToolContext): { supabase: unknown; userId: string } | null {
  if (!ctx.supabase || !ctx.userId) return null;
  return { supabase: ctx.supabase, userId: ctx.userId };
}

export const NOT_SIGNED_IN = { data: { error: "Nobody is signed in, so this cannot be read." } } as const;

export const naira = (minor: number, currency = "NGN"): string => {
  void currency;
  return formatMoney(minor);
};

export const when = (iso: string): string => {
  try {
    return dateTimeLabel(iso);
  } catch {
    return iso;
  }
};

export type Period = "this_month" | "last_month" | "last_30_days" | "all";
export const PERIODS = ["this_month", "last_month", "last_30_days", "all"] as const;

/** The start and end (exclusive) of a period, on the Lagos calendar (one hour ahead of UTC). */
export function periodBounds(period: Period, now = new Date()): { from: number; to: number; label: string } {
  const hour = 3_600_000;
  const lagos = new Date(now.getTime() + hour);
  const y = lagos.getUTCFullYear();
  const m = lagos.getUTCMonth();
  const startOfMonth = (yy: number, mm: number) => Date.UTC(yy, mm, 1) - hour;
  switch (period) {
    case "this_month":
      return { from: startOfMonth(y, m), to: Number.POSITIVE_INFINITY, label: "this month" };
    case "last_month":
      return { from: startOfMonth(y, m - 1), to: startOfMonth(y, m), label: "last month" };
    case "last_30_days":
      return { from: now.getTime() - 30 * 86_400_000, to: Number.POSITIVE_INFINITY, label: "the last 30 days" };
    default:
      return { from: Number.NEGATIVE_INFINITY, to: Number.POSITIVE_INFINITY, label: "all the time on record" };
  }
}
