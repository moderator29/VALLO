import { CURRENCY_META, isDisplayCurrency, type DisplayCurrency } from "./currencies";

/**
 * NAIRA TO A GUIDE FIGURE, IN INTEGER MINOR UNITS. Client-safe, no I/O.
 *
 * Read the header of `currencies.ts` first: a converted figure is a guide,
 * never a price, and nothing here is used to charge, refund or pay anything.
 *
 * THE ARITHMETIC. Amounts arrive as integer kobo, the platform's one money
 * shape. A rate is "naira per one unit of the other currency" (how many naira
 * one pound is worth), stored as a decimal string and read here as a BigInt
 * scaled by 10^9, so no step ever touches a binary float:
 *
 *   target minor = kobo * 10^decimals * 10^9 / (100 * scaledRate)
 *
 * ROUNDING RULE: the exact quotient is rounded HALF TO EVEN to the target's
 * minor unit (so a run of conversions has no upward drift). The "about"
 * figure a reader sees is then TRUNCATED to whole units by `format.ts`, so a
 * guide never states more than the naira is worth.
 *
 * STALENESS: a rate is only used while it is fresh, judged on the OLDER of
 * the source's own "last updated" time and our fetch time. Past
 * `MAX_RATE_AGE_MS` the conversion is refused and the reader sees naira only,
 * with nothing that suggests a conversion was attempted.
 */

/** Rates refresh daily at the source; two missed refreshes is the limit. */
export const MAX_RATE_AGE_MS = 48 * 60 * 60 * 1000;

/** A timestamp more than this far in the future is a broken clock, not a rate. */
export const MAX_CLOCK_SKEW_MS = 60 * 60 * 1000;

/** The rate's scale: nine decimal places of a naira. */
export const RATE_SCALE = 1_000_000_000n;

export type RateSource = "exchangerate-api" | "currency-api";

/**
 * One display rate, as stored and as handed to the client (strings only, so
 * it crosses the server-client boundary unchanged).
 */
export type DisplayRate = {
  currency: DisplayCurrency;
  /** Naira per one unit of `currency`, a positive decimal string. */
  ngnPerUnit: string;
  source: RateSource;
  /** When the source says it last updated, ISO 8601. */
  sourceUpdatedAt: string;
  /** When Vallo fetched it, ISO 8601. */
  fetchedAt: string;
};

/**
 * A positive decimal string as a BigInt scaled by 10^9, or null.
 * More than nine decimal places are cut, not rounded: the tenth place of a
 * naira cannot change a guide figure.
 */
export function parseRate(value: string | number | null | undefined): bigint | null {
  const text = typeof value === "number" ? (Number.isFinite(value) ? toPlainDecimal(value) : "") : (value ?? "");
  const match = /^\s*(\d{1,12})(?:\.(\d+))?\s*$/.exec(text);
  if (!match) return null;
  const whole = BigInt(match[1]!);
  const fraction = BigInt(((match[2] ?? "") + "000000000").slice(0, 9));
  const scaled = whole * RATE_SCALE + fraction;
  return scaled > 0n ? scaled : null;
}

/** A float written without exponent notation, for `parseRate`. */
function toPlainDecimal(value: number): string {
  if (value <= 0) return "";
  return value.toFixed(9);
}

/** Round a rational num/den (den > 0) half to even, to an integer. */
export function roundHalfEven(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new RangeError("denominator must be positive");
  const negative = num < 0n;
  const n = negative ? -num : num;
  const q = n / den;
  const r = n % den;
  const twice = r * 2n;
  let out = q;
  if (twice > den || (twice === den && q % 2n === 1n)) out = q + 1n;
  return negative ? -out : out;
}

/**
 * Kobo to the target currency's minor units, half to even. Null when the
 * input is not a safe integer or the rate cannot be read.
 */
export function convertNgnMinor(ngnMinor: number, currency: DisplayCurrency, ngnPerUnit: string): number | null {
  if (!Number.isSafeInteger(ngnMinor)) return null;
  if (currency === "NGN") return ngnMinor;
  const rate = parseRate(ngnPerUnit);
  if (rate === null) return null;
  const decimals = 10n ** BigInt(CURRENCY_META[currency].decimals);
  const out = roundHalfEven(BigInt(ngnMinor) * decimals * RATE_SCALE, 100n * rate);
  const asNumber = Number(out);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

export type RateVerdict = { usable: true } | { usable: false; why: "missing" | "malformed" | "stale" | "future" };

/** Whether a stored rate may be shown at `now`. */
export function rateVerdict(rate: DisplayRate | null | undefined, now: number): RateVerdict {
  if (!rate) return { usable: false, why: "missing" };
  if (!isDisplayCurrency(rate.currency) || parseRate(rate.ngnPerUnit) === null) {
    return { usable: false, why: "malformed" };
  }
  const source = Date.parse(rate.sourceUpdatedAt);
  const fetched = Date.parse(rate.fetchedAt);
  if (!Number.isFinite(source) || !Number.isFinite(fetched)) return { usable: false, why: "malformed" };
  if (Math.max(source, fetched) > now + MAX_CLOCK_SKEW_MS) return { usable: false, why: "future" };
  /* The older of the two clocks decides: a fetch made today of a feed that
     stopped updating last week is a week-old rate. */
  if (now - Math.min(source, fetched) > MAX_RATE_AGE_MS) return { usable: false, why: "stale" };
  return { usable: true };
}
