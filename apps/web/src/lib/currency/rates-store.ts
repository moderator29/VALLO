import "server-only";

import { createAdminClient } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/env";
import { isDisplayCurrency, type DisplayCurrency } from "./currencies";
import { parseRate, type DisplayRate, type RateSource } from "./convert";

/**
 * READING THE STORED DISPLAY RATES AT REQUEST TIME. Server only.
 *
 * The rates are fetched by the scheduled job (`rates-job.ts`), never per
 * request, and read from `public.display_exchange_rates` here. That table has
 * no grant to `anon` or `authenticated` (the source forbids redistribution;
 * see `sources.ts`), so it is read with the service client, on the server.
 *
 * A ten-minute in-process memo stops a busy page reading the table on every
 * render. It cannot make a stale rate look fresh: freshness is judged on the
 * stored times at the moment of use (`rateVerdict`), not on when the memo was
 * filled. A failed read answers an empty map (naira only) and is memoised for
 * one minute so a bad afternoon does not hammer the database.
 *
 * Until the pending migration is applied the table does not exist, every read
 * fails, and every surface shows naira only, exactly as before.
 */

export const RATES_TABLE = "display_exchange_rates";
export const RATES_MEMO_MS = 10 * 60 * 1000;
export const RATES_FAILURE_MEMO_MS = 60 * 1000;

export type DisplayRateRow = {
  currency: string;
  ngn_per_unit: string | number;
  source: string;
  source_updated_at: string;
  fetched_at: string;
};

const SOURCES: ReadonlySet<string> = new Set<RateSource>(["exchangerate-api", "currency-api"]);

/** Rows as rates, dropping any row that is not a well-formed rate for a known currency. */
export function rowsToRates(rows: unknown): Map<DisplayCurrency, DisplayRate> {
  const out = new Map<DisplayCurrency, DisplayRate>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows as Partial<DisplayRateRow>[]) {
    if (!row || !isDisplayCurrency(row.currency) || row.currency === "NGN") continue;
    const ngnPerUnit = typeof row.ngn_per_unit === "number" ? String(row.ngn_per_unit) : row.ngn_per_unit;
    if (typeof ngnPerUnit !== "string" || parseRate(ngnPerUnit) === null) continue;
    if (typeof row.source !== "string" || !SOURCES.has(row.source)) continue;
    if (typeof row.source_updated_at !== "string" || typeof row.fetched_at !== "string") continue;
    out.set(row.currency, {
      currency: row.currency,
      ngnPerUnit,
      source: row.source as RateSource,
      sourceUpdatedAt: new Date(row.source_updated_at).toISOString(),
      fetchedAt: new Date(row.fetched_at).toISOString(),
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** One read through the given client. The table is not in the generated types yet. */
export async function readRatesWith(db: unknown): Promise<Map<DisplayCurrency, DisplayRate> | null> {
  try {
    const { data, error } = await (db as Loose)
      .from(RATES_TABLE)
      .select("currency, ngn_per_unit::text, source, source_updated_at, fetched_at")
      .limit(50);
    if (error) return null;
    return rowsToRates(data);
  } catch {
    return null;
  }
}

let memo: { at: number; ttl: number; rates: Map<DisplayCurrency, DisplayRate> } | null = null;

/** For tests: forget the memo. */
export function forgetRatesMemo(): void {
  memo = null;
}

/** The stored rates, memoised per server instance. Never throws. */
export async function readDisplayRates(
  now: number = Date.now(),
  read: () => Promise<Map<DisplayCurrency, DisplayRate> | null> = readThroughServiceClient,
): Promise<Map<DisplayCurrency, DisplayRate>> {
  if (memo && now - memo.at < memo.ttl) return memo.rates;
  const rates = await read();
  memo = rates
    ? { at: now, ttl: RATES_MEMO_MS, rates }
    : { at: now, ttl: RATES_FAILURE_MEMO_MS, rates: new Map() };
  return memo.rates;
}

async function readThroughServiceClient(): Promise<Map<DisplayCurrency, DisplayRate> | null> {
  if (!isSupabaseConfigured() || (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length === 0) return null;
  try {
    return await readRatesWith(createAdminClient());
  } catch {
    return null;
  }
}
