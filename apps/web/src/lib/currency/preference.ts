import { AUTO_CURRENCY, isCurrencyChoice, type CurrencyChoice, type DisplayCurrency } from "./currencies";
import { DEFAULT_AREA_UNIT, isAreaUnit, type AreaUnit } from "./area";
import type { AutoVerdict } from "./auto";

/**
 * THE READER'S DISPLAY PREFERENCES: currency and floor-area unit. Pure.
 *
 * WHERE THE CHOICE LIVES, and the order it is read in:
 *
 *   1. Signed in: the account, `profiles.settings.display`
 *      (`{ currency: "GBP" | "auto" | ..., areaUnit: "sqm" | "sqft" }`). The
 *      same answer on the web and in the app, on every device, because both
 *      shells load the same site and sign in to the same account.
 *   2. The cookies `vallo_currency` and `vallo_area` on this device. Anybody
 *      signed out keeps their choice here, and a member's device keeps it
 *      too, so a failed account write still holds on the device that made it.
 *   3. Automatic (`auto.ts`).
 *
 * Every one of those is readable before the server writes a byte, so a page
 * renders the chosen currency on its first paint: there is no client-side
 * swap from naira to pounds after load.
 *
 * Both are written together by `saveDisplayPreferences` (`actions.ts`).
 * `lib/profile/schema.ts` `mergeSettings` keeps the `display` key through
 * every other settings save (it used to drop it; see the note there).
 */

export const CURRENCY_COOKIE = "vallo_currency";
export const AREA_COOKIE = "vallo_area";
/** 400 days, the ceiling browsers enforce. A preference, not a credential. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/** The key inside `profiles.settings`. */
export const SETTINGS_DISPLAY_KEY = "display";

export type StoredDisplay = { currency?: CurrencyChoice; areaUnit?: AreaUnit };

/** The display preference out of a raw `profiles.settings` document, tolerant of anything. */
export function displayFromSettings(settings: unknown): StoredDisplay {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  const display = (settings as Record<string, unknown>)[SETTINGS_DISPLAY_KEY];
  if (!display || typeof display !== "object" || Array.isArray(display)) return {};
  const { currency, areaUnit } = display as Record<string, unknown>;
  return {
    ...(isCurrencyChoice(currency) ? { currency } : {}),
    ...(isAreaUnit(areaUnit) ? { areaUnit } : {}),
  };
}

/** A settings document with `display` replaced and every other key kept exactly. */
export function withDisplay(settings: unknown, display: Required<StoredDisplay>): Record<string, unknown> {
  const base = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  return { ...base, [SETTINGS_DISPLAY_KEY]: { currency: display.currency, areaUnit: display.areaUnit } };
}

export type ResolvedDisplay = {
  /** What the reader chose ("auto" included), for the settings sheet. */
  choice: CurrencyChoice;
  /** The currency a guide figure is shown in. NGN means no guide figure. */
  currency: DisplayCurrency;
  /** What "Automatic" would show this reader now, for the sheet's label. */
  automatic: DisplayCurrency;
  areaUnit: AreaUnit;
  /** Where the currency answer came from, for tests and the sheet. */
  from: "account" | "cookie" | "auto";
};

export function resolveDisplay(input: {
  account: StoredDisplay | null;
  cookies: { currency?: string | null; area?: string | null };
  auto: AutoVerdict;
}): ResolvedDisplay {
  const cookieCurrency = isCurrencyChoice(input.cookies.currency) ? input.cookies.currency : undefined;
  const cookieArea = isAreaUnit(input.cookies.area) ? input.cookies.area : undefined;

  const fromAccount = input.account?.currency;
  const choice: CurrencyChoice = fromAccount ?? cookieCurrency ?? AUTO_CURRENCY;
  const from: ResolvedDisplay["from"] = fromAccount ? "account" : cookieCurrency ? "cookie" : "auto";
  const currency = choice === AUTO_CURRENCY ? input.auto.currency : choice;
  const areaUnit = input.account?.areaUnit ?? cookieArea ?? DEFAULT_AREA_UNIT;
  return { choice, currency, automatic: input.auto.currency, areaUnit, from };
}
