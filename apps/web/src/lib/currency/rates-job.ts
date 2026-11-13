import "server-only";

import type { JobVerdict } from "../bookings/lifecycle";
import type { AdminClient } from "../cron/rpc";
import type { DisplayCurrency } from "./currencies";
import { parseRate, type RateSource } from "./convert";
import { PARSERS, SOURCE_ORDER, SOURCE_URLS, type RateSnapshot } from "./sources";
import { RATES_TABLE, readRatesWith } from "./rates-store";

/**
 * THE DISPLAY-RATES JOB (`/api/cron/display-rates`, twice a day).
 *
 * Fetches the day's rates from the primary source, or the fallback when the
 * primary fails (`sources.ts` has both and their terms), and writes one row
 * per currency into `public.display_exchange_rates` with the time the source
 * says it updated and the time we fetched it. Pages read that table; nothing
 * at request time ever calls a source.
 *
 * A RATE THAT JUMPS IS NOT WRITTEN. If a currency moves more than
 * `MAX_MOVE` against the stored rate in one fetch, that currency keeps its old
 * row (which then ages out to naira only under the 48-hour rule unless a
 * later fetch agrees) and the desk is told. A real move that large is rare
 * enough that a person should look; a broken feed is far more likely.
 *
 * Failure costs nothing but convenience: with no fresh rate every page shows
 * naira only, which is the price of record. So a failed fetch is `attention`
 * with a warning, never critical.
 */

/** 25% in one fetch. */
export const MAX_MOVE = 0.25;
export const FETCH_TIMEOUT_MS = 10_000;

export type FetchLike = (url: string, init: { signal: AbortSignal; headers: Record<string, string>; cache: "no-store" }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type RatesJobDeps = {
  fetch: FetchLike;
  now: () => number;
  /** The stored rows, or null when the read failed. */
  readStored: (admin: AdminClient) => Promise<Map<DisplayCurrency, { ngnPerUnit: string }> | null>;
  write: (admin: AdminClient, rows: RateRow[]) => Promise<{ error: string | null }>;
};

export type RateRow = {
  currency: DisplayCurrency;
  ngn_per_unit: string;
  source: RateSource;
  source_updated_at: string;
  fetched_at: string;
};

type Attempt = { source: RateSource; outcome: "ok" | "http" | "unreadable" | "refused" | "threw"; detail: string };

/** One source, fetched and parsed. */
export async function fetchSnapshot(
  source: RateSource,
  fetchImpl: FetchLike,
): Promise<{ snapshot: RateSnapshot | null; attempt: Attempt }> {
  try {
    const response = await fetchImpl(SOURCE_URLS[source], {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      /* A plain client name: nothing about this platform or its people. */
      headers: { accept: "application/json", "user-agent": "rates-fetch/1.0" },
      cache: "no-store",
    });
    if (!response.ok) return { snapshot: null, attempt: { source, outcome: "http", detail: String(response.status) } };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { snapshot: null, attempt: { source, outcome: "unreadable", detail: "not_json" } };
    }
    const parsed = PARSERS[source](body);
    if (!parsed.ok) return { snapshot: null, attempt: { source, outcome: "refused", detail: parsed.why } };
    return { snapshot: parsed.snapshot, attempt: { source, outcome: "ok", detail: "" } };
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    return { snapshot: null, attempt: { source, outcome: "threw", detail: name.slice(0, 40) } };
  }
}

/** How far a new rate is from the stored one, as a fraction; null when either cannot be read. */
export function moveBetween(previous: string, next: string): number | null {
  const a = parseRate(previous);
  const b = parseRate(next);
  if (a === null || b === null) return null;
  /* Parts per million, in integers, then a fraction. */
  const ppm = ((b > a ? b - a : a - b) * 1_000_000n) / a;
  return Number(ppm) / 1_000_000;
}

/** The rows to write, and the currencies refused for jumping. Pure. */
export function rowsFromSnapshot(
  snapshot: RateSnapshot,
  stored: Map<DisplayCurrency, { ngnPerUnit: string }> | null,
  fetchedAt: string,
): { rows: RateRow[]; jumped: DisplayCurrency[] } {
  const rows: RateRow[] = [];
  const jumped: DisplayCurrency[] = [];
  for (const [code, rate] of Object.entries(snapshot.ngnPerUnit) as [DisplayCurrency, string][]) {
    if (!rate || parseRate(rate) === null) continue;
    const previous = stored?.get(code)?.ngnPerUnit;
    const move = previous ? moveBetween(previous, rate) : null;
    if (move !== null && move > MAX_MOVE) {
      jumped.push(code);
      continue;
    }
    rows.push({
      currency: code,
      ngn_per_unit: rate,
      source: snapshot.source,
      source_updated_at: snapshot.sourceUpdatedAt,
      fetched_at: fetchedAt,
    });
  }
  return { rows, jumped };
}

export async function runDisplayRates(admin: AdminClient, deps: RatesJobDeps): Promise<JobVerdict> {
  const attempts: Attempt[] = [];
  let snapshot: RateSnapshot | null = null;
  for (const source of SOURCE_ORDER) {
    const result = await fetchSnapshot(source, deps.fetch);
    attempts.push(result.attempt);
    if (result.snapshot) {
      snapshot = result.snapshot;
      break;
    }
  }
  const tried = attempts.map((a) => `${a.source}:${a.outcome}${a.detail ? `:${a.detail}` : ""}`).join(",");

  if (!snapshot) {
    return {
      outcome: "attention",
      counts: { written: 0, jumped: 0, sources_tried: attempts.length },
      detail: { tried },
      alert: { kind: "display_rates.fetch_failed", severity: "warning", detail: { tried, effect: "naira_only_after_48h" } },
    };
  }

  const stored = await deps.readStored(admin);
  const fetchedAt = new Date(deps.now()).toISOString();
  const { rows, jumped } = rowsFromSnapshot(snapshot, stored, fetchedAt);
  const write = rows.length > 0 ? await deps.write(admin, rows) : { error: null };
  const counts = { written: write.error ? 0 : rows.length, jumped: jumped.length, sources_tried: attempts.length };
  const detail = { source: snapshot.source, source_updated_at: snapshot.sourceUpdatedAt, tried };

  if (write.error) {
    return {
      outcome: "attention",
      counts,
      detail,
      alert: { kind: "display_rates.write_failed", severity: "warning", detail: { reason: write.error.slice(0, 120) } },
    };
  }
  if (jumped.length > 0) {
    return {
      outcome: "attention",
      counts,
      detail: { ...detail, jumped: jumped.join(",") },
      alert: {
        kind: "display_rates.rate_jumped",
        severity: "warning",
        detail: { currencies: jumped.join(","), max_move: MAX_MOVE, source: snapshot.source },
      },
    };
  }
  return { outcome: "ok", counts, detail, alert: null };
}

/* ------------------------------------------------------- the real deps */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

async function writeRows(admin: AdminClient, rows: RateRow[]): Promise<{ error: string | null }> {
  try {
    const { error } = await (admin as Loose).from(RATES_TABLE).upsert(rows, { onConflict: "currency" });
    return { error: error ? String(error.message ?? "write failed") : null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "write threw" };
  }
}

async function readStoredRates(admin: AdminClient): Promise<Map<DisplayCurrency, { ngnPerUnit: string }> | null> {
  return readRatesWith(admin);
}

export const LIVE_DEPS: RatesJobDeps = {
  fetch: (url, init) => fetch(url, init),
  now: Date.now,
  readStored: readStoredRates,
  write: writeRows,
};

/** The job as `runCronJob` calls it. */
export function displayRates(admin: AdminClient): Promise<JobVerdict> {
  return runDisplayRates(admin, LIVE_DEPS);
}
