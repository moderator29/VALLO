import { CURRENCY_META, type DisplayCurrency } from "./currencies";

/**
 * THE GUIDE FIGURE, WRITTEN. Client-safe, no I/O.
 *
 * Takes the target currency's minor units (from `convert.ts`) and writes the
 * bare figure a reader sees after "about": "£2,516", "US$1,350", "CFA 1.2m".
 * The word "about" itself is copy (`currency.about` in the dictionary) and is
 * put round the figure by the component, so the sentence can be translated.
 *
 * WHOLE UNITS, TRUNCATED. A guide with pence in it claims a precision a daily
 * mid-market rate does not have, and rounding up would state more than the
 * naira is worth. So the figure is cut to whole units (2,516.97 reads
 * 2,516), the same "never overstate" rule `formatMoney` applies to its short
 * figures. Below one whole unit it reads "less than £1" (`under`).
 *
 * GROUPING is the platform's en-NG convention in every language: commas
 * between thousands. SHORT FIGURES (`compact`) follow `formatMoney`: one
 * decimal at most, truncated, lower-case suffix ("£12.5k", "US$1.2m"), and
 * only from 10,000 units up, so a card still reads "£2,516" in full.
 */

export const APPROX_COMPACT_FROM_UNITS = 10_000;

export type ApproxFigure =
  | { kind: "figure"; text: string; spoken: string }
  | { kind: "under"; text: string; spoken: string };

const WHOLE = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/* `roundingMode` is ES2023 Intl and typed in newer libs only. */
const COMPACT = new Intl.NumberFormat("en-NG", {
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  roundingMode: "trunc",
} as Intl.NumberFormatOptions);

/** Whole units of a minor amount, truncated toward zero. */
export function wholeUnits(minor: number, currency: DisplayCurrency): number {
  const per = 10 ** CURRENCY_META[currency].decimals;
  return Math.trunc(minor / per);
}

/** Sign then figure, with the space the CFA letters need and the signs do not. */
function withSymbol(currency: DisplayCurrency, figure: string, negative: boolean): string {
  const { symbol } = CURRENCY_META[currency];
  const spaced = /[A-Za-z]$/.test(symbol) ? `${symbol} ${figure}` : `${symbol}${figure}`;
  return negative ? `-${spaced}` : spaced;
}

export function approxFigure(
  minor: number,
  currency: DisplayCurrency,
  options: { compact?: boolean } = {},
): ApproxFigure {
  const meta = CURRENCY_META[currency];
  const units = wholeUnits(minor, currency);
  const negative = minor < 0;
  const magnitude = Math.abs(units);

  if (magnitude === 0 && minor !== 0) {
    return { kind: "under", text: withSymbol(currency, "1", false), spoken: `1 ${singular(meta.spoken)}` };
  }

  const figure =
    options.compact && magnitude >= APPROX_COMPACT_FROM_UNITS
      ? COMPACT.format(magnitude).replace(/[A-Za-z]+$/, (suffix) => suffix.toLowerCase())
      : WHOLE.format(magnitude);
  return {
    kind: "figure",
    text: withSymbol(currency, figure, negative),
    spoken: `${negative ? "minus " : ""}${WHOLE.format(magnitude)} ${magnitude === 1 ? singular(meta.spoken) : meta.spoken}`,
  };
}

/** "British pounds" to "British pound"; "naira" and "rand" stay as they are. */
function singular(spoken: string): string {
  return spoken.endsWith("s") ? spoken.slice(0, -1) : spoken;
}
