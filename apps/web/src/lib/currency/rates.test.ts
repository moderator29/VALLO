import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { parseCurrencyApi, parseExchangeRateApi, scaledToDecimal, SOURCE_URLS } from "./sources";
import { forgetRatesMemo, readDisplayRates, rowsToRates, RATES_FAILURE_MEMO_MS, RATES_MEMO_MS } from "./rates-store";
import { MAX_MOVE, moveBetween, rowsFromSnapshot, runDisplayRates, type FetchLike, type RateRow, type RatesJobDeps } from "./rates-job";
import type { AdminClient } from "../cron/rpc";
import type { DisplayCurrency } from "./currencies";

/**
 * The rate pipeline, against responses RECORDED from both sources on
 * 13 November 2026 (`fixtures/`). No test here reaches the network.
 */

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const ERAPI = fixture("exchangerate-api-usd-2026-11-13.json");
const CAPI = fixture("currency-api-usd-2026-11-13.json");

describe("the primary source, ExchangeRate-API", () => {
  it("parses the recorded response into naira per unit, worked from the dollar base in integers", () => {
    const parsed = parseExchangeRateApi(ERAPI);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.source).toBe("exchangerate-api");
    expect(parsed.snapshot.sourceUpdatedAt).toBe("2026-11-13T00:02:31.000Z");
    /* 1350.459083 / 0.755149, half to even at nine places (checked with Python's Decimal). */
    expect(parsed.snapshot.ngnPerUnit.GBP).toBe("1788.334597543");
    expect(parsed.snapshot.ngnPerUnit.EUR).toBe("1494.712269408");
    expect(parsed.snapshot.ngnPerUnit.CAD).toBe("947.271790717");
    expect(parsed.snapshot.ngnPerUnit.XOF).toBe("2.278718786");
    expect(parsed.snapshot.ngnPerUnit.USD).toBe("1350.459083000");
    expect(Object.keys(parsed.snapshot.ngnPerUnit).sort()).toEqual(
      ["AED", "AUD", "CAD", "EUR", "GBP", "GHS", "KES", "USD", "XOF", "ZAR"].sort(),
    );
    expect(parsed.snapshot.ngnPerUnit).not.toHaveProperty("NGN");
    expect(parsed.snapshot.ngnPerUnit).not.toHaveProperty("JPY");
  });

  it("refuses an error answer, a different base, no time and a naira rate nobody would believe", () => {
    const body = ERAPI as Record<string, unknown>;
    expect(parseExchangeRateApi({ ...body, result: "error" })).toEqual({ ok: false, why: "result_not_success" });
    expect(parseExchangeRateApi({ ...body, base_code: "NGN" })).toEqual({ ok: false, why: "base_not_usd" });
    expect(parseExchangeRateApi({ ...body, time_last_update_unix: null })).toEqual({ ok: false, why: "no_update_time" });
    expect(parseExchangeRateApi({ ...body, rates: { ...(body.rates as object), NGN: 13.5 } })).toEqual({ ok: false, why: "ngn_out_of_bounds" });
    expect(parseExchangeRateApi({ ...body, rates: { ...(body.rates as object), NGN: 135_045_908 } })).toEqual({ ok: false, why: "ngn_out_of_bounds" });
    expect(parseExchangeRateApi({ ...body, rates: { USD: 1 } })).toEqual({ ok: false, why: "no_ngn" });
    expect(parseExchangeRateApi("<html>")).toEqual({ ok: false, why: "not_json_object" });
  });

  it("drops a currency the source sent as nonsense and keeps the rest", () => {
    const body = ERAPI as Record<string, unknown>;
    const parsed = parseExchangeRateApi({ ...body, rates: { ...(body.rates as object), GBP: 0, EUR: "x" } });
    expect(parsed.ok && parsed.snapshot.ngnPerUnit.GBP).toBeUndefined();
    expect(parsed.ok && parsed.snapshot.ngnPerUnit.EUR).toBeUndefined();
    expect(parsed.ok && parsed.snapshot.ngnPerUnit.USD).toBe("1350.459083000");
  });
});

describe("the fallback source, currency-api (CC0)", () => {
  it("parses the recorded response and dates it at the start of its UTC day", () => {
    const parsed = parseCurrencyApi(CAPI);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.source).toBe("currency-api");
    expect(parsed.snapshot.sourceUpdatedAt).toBe("2026-11-13T00:00:00.000Z");
    expect(parsed.snapshot.ngnPerUnit.GBP).toBe("1778.068487067");
    expect(Object.keys(parsed.snapshot.ngnPerUnit)).toHaveLength(10);
  });

  it("refuses a body with no date or no table", () => {
    expect(parseCurrencyApi({ usd: {} })).toEqual({ ok: false, why: "no_update_time" });
    expect(parseCurrencyApi({ date: "2026-11-13" })).toEqual({ ok: false, why: "no_rates" });
  });
});

describe("the store, read at request time", () => {
  const row = {
    currency: "GBP",
    ngn_per_unit: "1788.334597543",
    source: "exchangerate-api",
    source_updated_at: "2026-11-13T00:02:31+00:00",
    fetched_at: "2026-11-13T00:50:04+00:00",
  };

  it("keeps well-formed rows and drops the rest", () => {
    const rates = rowsToRates([
      row,
      { ...row, currency: "NGN" },
      { ...row, currency: "JPY" },
      { ...row, currency: "EUR", ngn_per_unit: "0" },
      { ...row, currency: "USD", source: "somewhere" },
      { ...row, currency: "CAD", fetched_at: null },
      null,
    ]);
    expect([...rates.keys()]).toEqual(["GBP"]);
    expect(rates.get("GBP")).toEqual({
      currency: "GBP",
      ngnPerUnit: "1788.334597543",
      source: "exchangerate-api",
      sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
      fetchedAt: "2026-11-13T00:50:04.000Z",
    });
    expect(rowsToRates({ not: "rows" }).size).toBe(0);
  });

  it("reads the table once per ten minutes, and after a failure waits one minute", async () => {
    forgetRatesMemo();
    const good = new Map<DisplayCurrency, never>();
    const read = vi.fn(async () => good);
    const t0 = 1_000_000;
    await readDisplayRates(t0, read);
    await readDisplayRates(t0 + RATES_MEMO_MS - 1, read);
    expect(read).toHaveBeenCalledTimes(1);
    await readDisplayRates(t0 + RATES_MEMO_MS, read);
    expect(read).toHaveBeenCalledTimes(2);

    forgetRatesMemo();
    const failing = vi.fn(async () => null);
    expect((await readDisplayRates(t0, failing)).size).toBe(0);
    await readDisplayRates(t0 + RATES_FAILURE_MEMO_MS - 1, failing);
    expect(failing).toHaveBeenCalledTimes(1);
    await readDisplayRates(t0 + RATES_FAILURE_MEMO_MS, failing);
    expect(failing).toHaveBeenCalledTimes(2);
    forgetRatesMemo();
  });
});

describe("the job", () => {
  const ADMIN = {} as AdminClient;
  const NOW = Date.parse("2026-11-13T00:50:04Z");

  function response(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  function deps(fetchImpl: FetchLike, stored: Map<DisplayCurrency, { ngnPerUnit: string }> | null = new Map(), writeError: string | null = null) {
    const written: RateRow[][] = [];
    const d: RatesJobDeps = {
      fetch: fetchImpl,
      now: () => NOW,
      readStored: async () => stored,
      write: async (_admin, rows) => {
        written.push(rows);
        return { error: writeError };
      },
    };
    return { d, written };
  }

  it("fetches the primary only, at its documented address, and writes one row per currency with both times", async () => {
    const calls: string[] = [];
    const { d, written } = deps(async (url, init) => {
      calls.push(url);
      expect(init.cache).toBe("no-store");
      expect(init.headers["user-agent"]).toBe("rates-fetch/1.0");
      return response(200, ERAPI);
    });
    const verdict = await runDisplayRates(ADMIN, d);
    expect(calls).toEqual([SOURCE_URLS["exchangerate-api"]]);
    expect(verdict.outcome).toBe("ok");
    expect(verdict.counts).toMatchObject({ written: 10, jumped: 0, sources_tried: 1 });
    expect(written).toHaveLength(1);
    const gbp = written[0]!.find((r) => r.currency === "GBP");
    expect(gbp).toEqual({
      currency: "GBP",
      ngn_per_unit: "1788.334597543",
      source: "exchangerate-api",
      source_updated_at: "2026-11-13T00:02:31.000Z",
      fetched_at: "2026-11-13T00:50:04.000Z",
    });
  });

  it("falls back to the CC0 source when the primary is rate limited", async () => {
    const calls: string[] = [];
    const { d, written } = deps(async (url) => {
      calls.push(url);
      return url === SOURCE_URLS["exchangerate-api"] ? response(429, {}) : response(200, CAPI);
    });
    const verdict = await runDisplayRates(ADMIN, d);
    expect(calls).toEqual([SOURCE_URLS["exchangerate-api"], SOURCE_URLS["currency-api"]]);
    expect(verdict.outcome).toBe("ok");
    expect(verdict.detail).toMatchObject({ source: "currency-api", tried: "exchangerate-api:http:429,currency-api:ok" });
    expect(written[0]!.every((r) => r.source === "currency-api")).toBe(true);
  });

  it("writes nothing and raises a warning when both sources fail", async () => {
    const { d, written } = deps(async (url) => {
      if (url === SOURCE_URLS["exchangerate-api"]) throw new TypeError("fetch failed");
      return response(200, { garbage: true });
    });
    const verdict = await runDisplayRates(ADMIN, d);
    expect(written).toEqual([]);
    expect(verdict.outcome).toBe("attention");
    expect(verdict.alert).toMatchObject({ kind: "display_rates.fetch_failed", severity: "warning" });
    expect(verdict.detail).toMatchObject({ tried: "exchangerate-api:threw:TypeError,currency-api:refused:no_update_time" });
  });

  it("refuses a currency that moved more than a quarter in one fetch, keeps the rest, and says so", async () => {
    const stored = new Map<DisplayCurrency, { ngnPerUnit: string }>([
      ["GBP", { ngnPerUnit: "1000.000000000" }],
      ["EUR", { ngnPerUnit: "1490.000000000" }],
    ]);
    const { d, written } = deps(async () => response(200, ERAPI), stored);
    const verdict = await runDisplayRates(ADMIN, d);
    expect(written[0]!.map((r) => r.currency)).not.toContain("GBP");
    expect(written[0]!.map((r) => r.currency)).toContain("EUR");
    expect(verdict.outcome).toBe("attention");
    expect(verdict.alert).toMatchObject({ kind: "display_rates.rate_jumped", detail: { currencies: "GBP", max_move: MAX_MOVE } });
  });

  it("reports a write that failed (the table not there yet, for one)", async () => {
    const { d } = deps(async () => response(200, ERAPI), null, 'relation "public.display_exchange_rates" does not exist');
    const verdict = await runDisplayRates(ADMIN, d);
    expect(verdict.outcome).toBe("attention");
    expect(verdict.counts.written).toBe(0);
    expect(verdict.alert?.kind).toBe("display_rates.write_failed");
  });

  it("measures a move in integers", () => {
    expect(moveBetween("1000", "1250")).toBe(0.25);
    expect(moveBetween("1000", "750")).toBe(0.25);
    expect(moveBetween("1000", "1251")).toBeGreaterThan(MAX_MOVE);
    expect(moveBetween("x", "1")).toBeNull();
    const snap = { source: "exchangerate-api" as const, sourceUpdatedAt: "2026-11-13T00:00:00.000Z", ngnPerUnit: { GBP: "1250.000000000" } };
    expect(rowsFromSnapshot(snap, new Map([["GBP", { ngnPerUnit: "1000" }]]), "t").jumped).toEqual([]);
  });

  it("writes stored rates at nine places", () => {
    expect(scaledToDecimal(1_788_334_597_543n)).toBe("1788.334597543");
    expect(scaledToDecimal(5n)).toBe("0.000000005");
  });
});
