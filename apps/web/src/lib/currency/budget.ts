import { CURRENCY_META } from "./currencies";
import { convertNgnMinor, convertToNgnMinor } from "./convert";
import { showsGuide, type DisplayMoney } from "./display";
import { wholeUnits } from "./format";

/**
 * A SEARCH BUDGET TYPED IN THE READER'S CURRENCY. Client-safe, no I/O.
 *
 * Read the header of `currencies.ts` first. This is the one place a person
 * types an amount that is not naira, and it is their own budget, not a price:
 * a reader who thinks in pounds types "1,500" and the search filter is given
 * the naira that is worth at the stored rate. The filter, the address bar and
 * a saved search hold naira only, exactly as before; the typed figure is
 * never stored, sent or shown as what anything costs.
 *
 * Offered only when the page would show a guide at all (`showsGuide`): a
 * currency other than naira AND a rate that was fresh when the server built
 * the page. Without both, every function here answers null and the drawer
 * draws its naira fields alone.
 *
 * WHOLE UNITS IN, WHOLE NAIRA OUT. The budget fields hold whole naira (as the
 * drawer's own fields do), so the converted figure is rounded half to even to
 * the kobo by `convertToNgnMinor` and then cut to whole naira. Coming back
 * (naira the reader set with the slider, read in their currency) is worked
 * exactly as a guide figure is: `convertNgnMinor`, then cut to whole units.
 */

/** The drawer's naira fields hold nine digits at most. */
export const BUDGET_MAX_NAIRA = 999_999_999;

/** Whole units of the reader's currency to whole naira, or null when there is no guide or the figure cannot be read. */
export function budgetNairaFromUnits(units: number, display: DisplayMoney | null | undefined): number | null {
  if (!display || !showsGuide(display) || !display.rate) return null;
  if (!Number.isSafeInteger(units) || units <= 0) return null;
  const minor = units * 10 ** CURRENCY_META[display.currency].decimals;
  const kobo = convertToNgnMinor(minor, display.currency, display.rate.ngnPerUnit);
  if (kobo === null) return null;
  const naira = Math.trunc(kobo / 100);
  if (naira <= 0) return null;
  return Math.min(naira, BUDGET_MAX_NAIRA);
}

/** Whole naira read in the reader's currency, cut to whole units; null when there is no guide or it is under one unit. */
export function budgetUnitsFromNaira(naira: number, display: DisplayMoney | null | undefined): number | null {
  if (!display || !showsGuide(display) || !display.rate) return null;
  if (!Number.isSafeInteger(naira) || naira <= 0) return null;
  const minor = convertNgnMinor(naira * 100, display.currency, display.rate.ngnPerUnit);
  if (minor === null) return null;
  const units = wholeUnits(minor, display.currency);
  return units > 0 ? units : null;
}
