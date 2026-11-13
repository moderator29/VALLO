import { FOREIGN_CURRENCIES, type DisplayCurrency } from "./currencies";
import { RATE_SCALE, parseRate, roundHalfEven, type RateSource } from "./convert";

/**
 * WHERE THE DISPLAY RATES COME FROM, AND ON WHAT TERMS. Pure parsers; the
 * fetching is in `rates-job.ts`.
 *
 * Both sources are free, need no key, and carry the naira. The European
 * Central Bank's feed (and Frankfurter, which serves it) does not carry NGN,
 * so it cannot be used.
 *
 * 1. PRIMARY: ExchangeRate-API, open access endpoint
 *    (https://open.er-api.com/v6/latest/USD; docs
 *    https://www.exchangerate-api.com/docs/free). Free for personal and
 *    commercial conversion. ITS TERMS, which this platform keeps:
 *      - ATTRIBUTION IS REQUIRED on the pages that use the rates, as the link
 *        "Rates By Exchange Rate API" to https://www.exchangerate-api.com.
 *        `RatesAttribution` renders exactly that wherever a guide figure is
 *        on the page; discreet styling is expressly allowed.
 *      - It updates once a day and rate limits frequent callers (HTTP 429 for
 *        twenty minutes). The job runs twice a day, inside what they ask.
 *      - Caching is allowed. REDISTRIBUTION IS NOT: the rates are stored in a
 *        table no browser and no API key can read, and Vallo exposes no rates
 *        endpoint. They reach a reader only as a converted figure on a page.
 * 2. FALLBACK, used only when the primary fails: the currency-api published
 *    by fawazahmed0 through jsDelivr
 *    (https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json),
 *    released under CC0 (no attribution required, none forbidden). Daily.
 *
 * WHY THE US DOLLAR BASE, not the naira. Asked for a naira base, the primary
 * rounds every rate to about three significant figures (one naira is
 * "0.000564" pounds), an error of up to 0.1% before any arithmetic. Asked for
 * a US dollar base it gives six or seven (1 USD = 1350.459083 NGN,
 * 0.755149 GBP), and the cross rate is worked out here in integers.
 */

export const SOURCE_URLS: Readonly<Record<RateSource, string>> = {
  "exchangerate-api": "https://open.er-api.com/v6/latest/USD",
  "currency-api": "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
};

export const SOURCE_ORDER: readonly RateSource[] = ["exchangerate-api", "currency-api"];

/** What a source told us, in the shape the store keeps. */
export type RateSnapshot = {
  source: RateSource;
  sourceUpdatedAt: string;
  /** Naira per one unit, nine decimal places, for every currency the source carried. */
  ngnPerUnit: Partial<Record<DisplayCurrency, string>>;
};

export type ParseResult = { ok: true; snapshot: RateSnapshot } | { ok: false; why: string };

/**
 * A believable naira price of one US dollar. Wide on purpose (the naira has
 * moved a long way in three years); it exists to refuse a broken feed (a
 * zero, a base swapped, a rate quoted per kobo), not to second-guess a market.
 */
export const NGN_PER_USD_BOUNDS = { min: 100, max: 100_000 } as const;

/** A scaled BigInt rate as a nine-place decimal string. */
export function scaledToDecimal(scaled: bigint): string {
  const whole = scaled / RATE_SCALE;
  const fraction = (scaled % RATE_SCALE).toString().padStart(9, "0");
  return `${whole}.${fraction}`;
}

/**
 * Cross rates from a US-dollar-based table: naira per unit of X is
 * (naira per dollar) / (X per dollar), worked in integers, half to even.
 */
export type CrossResult = { ok: true; ngnPerUnit: RateSnapshot["ngnPerUnit"] } | { ok: false; why: string };

export function crossFromUsd(usdTable: Record<string, unknown>, keyOf: (code: string) => string): CrossResult {
  const ngn = parseRate(asRateText(usdTable[keyOf("NGN")]));
  if (ngn === null) return { ok: false, why: "no_ngn" };
  const ngnPerUsd = Number(ngn) / Number(RATE_SCALE);
  if (ngnPerUsd < NGN_PER_USD_BOUNDS.min || ngnPerUsd > NGN_PER_USD_BOUNDS.max) {
    return { ok: false, why: "ngn_out_of_bounds" };
  }
  const out: RateSnapshot["ngnPerUnit"] = {};
  for (const code of FOREIGN_CURRENCIES) {
    const perUsd = parseRate(asRateText(usdTable[keyOf(code)]));
    if (perUsd === null) continue;
    out[code] = scaledToDecimal(roundHalfEven(ngn * RATE_SCALE, perUsd));
  }
  return { ok: true, ngnPerUnit: out };
}

/** A JSON number or numeric string as text `parseRate` reads, never exponent form. */
function asRateText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  /* Six to ten significant figures arrive; twelve places keeps them all and
     never writes "1e-7". */
  return value.toFixed(12);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** ExchangeRate-API's open access response, base USD. */
export function parseExchangeRateApi(body: unknown): ParseResult {
  if (!isObject(body)) return { ok: false, why: "not_json_object" };
  if (body.result !== "success") return { ok: false, why: "result_not_success" };
  if (body.base_code !== "USD") return { ok: false, why: "base_not_usd" };
  const unix = body.time_last_update_unix;
  if (typeof unix !== "number" || !Number.isFinite(unix) || unix <= 0) return { ok: false, why: "no_update_time" };
  if (!isObject(body.rates)) return { ok: false, why: "no_rates" };
  const cross = crossFromUsd(body.rates, (code) => code);
  if (!cross.ok) return cross;
  return {
    ok: true,
    snapshot: {
      source: "exchangerate-api",
      sourceUpdatedAt: new Date(unix * 1000).toISOString(),
      ngnPerUnit: cross.ngnPerUnit,
    },
  };
}

/** fawazahmed0's currency-api, base usd: `{ date: "YYYY-MM-DD", usd: { ngn: ... } }`. */
export function parseCurrencyApi(body: unknown): ParseResult {
  if (!isObject(body)) return { ok: false, why: "not_json_object" };
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  if (!date) return { ok: false, why: "no_update_time" };
  if (!isObject(body.usd)) return { ok: false, why: "no_rates" };
  const cross = crossFromUsd(body.usd, (code) => code.toLowerCase());
  if (!cross.ok) return cross;
  /* The source dates its file, not the minute; the start of that UTC day is
     the earliest it can be, so staleness is never understated. */
  return { ok: true, snapshot: { source: "currency-api", sourceUpdatedAt: `${date}T00:00:00.000Z`, ngnPerUnit: cross.ngnPerUnit } };
}

export const PARSERS: Readonly<Record<RateSource, (body: unknown) => ParseResult>> = {
  "exchangerate-api": parseExchangeRateApi,
  "currency-api": parseCurrencyApi,
};
