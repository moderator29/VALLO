import { CURRENCY_META, type CurrencyChoice, type DisplayCurrency } from "./currencies";
import { convertNgnMinor, rateVerdict, type DisplayRate } from "./convert";
import { approxFigure, type ApproxFigure } from "./format";
import { DEFAULT_AREA_UNIT, type AreaUnit } from "./area";
import { DEFAULT_DISTANCE_UNIT, type DistanceUnit } from "./distance";

/**
 * WHAT A PAGE HANDS ITS PRICES: one small, serialisable object. Client-safe.
 *
 * The server builds it once per request (`getDisplayMoney` in `server.ts`):
 * the reader's currency, and the rate for it ONLY IF that rate is fresh at
 * that moment. A client component receives it as a prop or through
 * `DisplayMoneyProvider` and never re-decides freshness, so the server's HTML
 * and the first client render always agree (no hydration swap).
 *
 * `rate: null` with a foreign currency means "the reader asked for pounds and
 * Vallo has no fresh rate": every surface then shows naira only and says
 * nothing about a conversion.
 */
export type DisplayMoney = {
  choice: CurrencyChoice;
  currency: DisplayCurrency;
  automatic: DisplayCurrency;
  rate: DisplayRate | null;
  areaUnit: AreaUnit;
  distanceUnit: DistanceUnit;
};

/** Naira only: the safe answer when nothing could be read. */
export const NAIRA_ONLY: DisplayMoney = {
  choice: "auto",
  currency: "NGN",
  automatic: "NGN",
  rate: null,
  areaUnit: DEFAULT_AREA_UNIT,
  distanceUnit: DEFAULT_DISTANCE_UNIT,
};

/** Keep the rate only when it is for this currency and fresh at `now`. */
export function withFreshRate(
  base: Omit<DisplayMoney, "rate">,
  rates: ReadonlyMap<DisplayCurrency, DisplayRate>,
  now: number,
): DisplayMoney {
  if (base.currency === "NGN") return { ...base, rate: null };
  const rate = rates.get(base.currency) ?? null;
  return { ...base, rate: rate && rate.currency === base.currency && rateVerdict(rate, now).usable ? rate : null };
}

/** True when this page will show guide figures at all. */
export function showsGuide(display: DisplayMoney | null | undefined): boolean {
  return !!display && display.currency !== "NGN" && display.rate !== null;
}

/**
 * The guide figure for a naira amount, or null when there is none to show
 * (naira chosen, no fresh rate, an amount that is not a safe integer).
 */
export function guideFor(
  display: DisplayMoney | null | undefined,
  ngnMinor: number,
  options: { compact?: boolean } = {},
): (ApproxFigure & { currency: DisplayCurrency }) | null {
  if (!display || !showsGuide(display) || !display.rate) return null;
  const minor = convertNgnMinor(ngnMinor, display.currency, display.rate.ngnPerUnit);
  if (minor === null) return null;
  return { ...approxFigure(minor, display.currency, options), currency: display.currency };
}

/** "British pound (GBP)": a currency as a settings line names it. */
export function currencyLabel(code: DisplayCurrency): string {
  return `${CURRENCY_META[code].name} (${code})`;
}
