/**
 * THE LISTINGS DESK, THE PURE HALF: the shapes, the row parsers and the
 * bucket arithmetic, client and server safe (the desk draws in the browser
 * too). The reads are beside it in `listing-stats.ts`.
 */

export type StatsRange = "7d" | "30d" | "90d";
export const STATS_RANGES: readonly StatsRange[] = ["7d", "30d", "90d"];
export const RANGE_DAYS: Record<StatsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

export type DayFigures = { day: string; views: number; saves: number; enquiries: number; viewings: number };
export type RankedRow = {
  key: string;
  label: string;
  sub: string | null;
  listings: number;
  views: number;
  saves: number;
  enquiries: number;
  viewings: number;
};
export type RankedGroup = "listing" | "area" | "lister";

function n(value: unknown): number {
  const v = typeof value === "string" ? Number(value) : value;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Rows of `admin_listing_stats_daily` into figures. Pure; tested. */
export function dayRows(data: unknown): DayFigures[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && typeof (row as { day?: unknown }).day === "string")
    .map((row) => ({
      day: String(row.day).slice(0, 10),
      views: n(row.views),
      saves: n(row.saves),
      enquiries: n(row.enquiries),
      viewings: n(row.viewings),
    }));
}

/** Rows of `admin_listing_stats_ranked`. Pure; tested. */
export function rankedRows(data: unknown): RankedRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      key: String(row.group_key ?? ""),
      label: String(row.label ?? ""),
      sub: typeof row.sub === "string" && row.sub.length > 0 ? row.sub : null,
      listings: n(row.listings),
      views: n(row.views),
      saves: n(row.saves),
      enquiries: n(row.enquiries),
      viewings: n(row.viewings),
    }))
    .filter((row) => row.key.length > 0);
}

/** Sum a run of days. */
export function totalsOf(days: readonly DayFigures[]): Omit<DayFigures, "day"> {
  return days.reduce(
    (sum, d) => ({
      views: sum.views + d.views,
      saves: sum.saves + d.saves,
      enquiries: sum.enquiries + d.enquiries,
      viewings: sum.viewings + d.viewings,
    }),
    { views: 0, saves: 0, enquiries: 0, viewings: 0 },
  );
}

/** Seven-day buckets for a long range, oldest first, each starting on its first day. Pure; tested. */
export function weekly(days: readonly DayFigures[]): DayFigures[] {
  const out: DayFigures[] = [];
  /* Anchored on the newest day, so the last bucket always ends today. */
  for (let end = days.length; end > 0; end -= 7) {
    const slice = days.slice(Math.max(0, end - 7), end);
    out.unshift({ day: slice[0]!.day, ...totalsOf(slice) });
  }
  return out;
}

