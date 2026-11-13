import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { resolveSessionClaims } from "../actions/session";
import { automaticCurrency, COUNTRY_HEADER } from "./auto";
import { AREA_COOKIE, CURRENCY_COOKIE, DISTANCE_COOKIE, displayFromSettings, resolveDisplay, type ResolvedDisplay, type StoredDisplay } from "./preference";
import { NAIRA_ONLY, withFreshRate, type DisplayMoney } from "./display";
import { readDisplayRates } from "./rates-store";

/**
 * THE READER'S CURRENCY FOR THIS REQUEST, ON THE SERVER, BEFORE FIRST PAINT.
 *
 * `getDisplayPreferences` reads the account (signed in), the cookies and the
 * request's country and language, in that order (`preference.ts`).
 * `getDisplayMoney` adds the stored rate for that currency, only if it is
 * fresh now. Both are memoised per request with React `cache`, so a page with
 * forty cards reads the account and the rates once.
 *
 * Reading cookies and headers makes the caller dynamic, which every page that
 * shows a member's prices already is.
 *
 * NOTHING HERE THROWS. Any failure answers naira only: the price of record is
 * always a correct thing to show.
 */

async function accountDisplay(): Promise<StoredDisplay | null> {
  try {
    const session = await resolveSessionClaims();
    if (session.state !== "signed-in") return null;
    const { data, error } = await session.supabase
      .from("profiles")
      .select("settings")
      .eq("id", session.userId)
      .maybeSingle();
    if (error || !data) return null;
    return displayFromSettings(data.settings);
  } catch {
    return null;
  }
}

export const getDisplayPreferences = cache(async function getDisplayPreferences(): Promise<ResolvedDisplay> {
  try {
    const [requestHeaders, jar, account] = await Promise.all([headers(), cookies(), accountDisplay()]);
    return resolveDisplay({
      account,
      cookies: {
        currency: jar.get(CURRENCY_COOKIE)?.value,
        area: jar.get(AREA_COOKIE)?.value,
        distance: jar.get(DISTANCE_COOKIE)?.value,
      },
      auto: automaticCurrency({
        country: requestHeaders.get(COUNTRY_HEADER),
        acceptLanguage: requestHeaders.get("accept-language"),
      }),
    });
  } catch {
    return {
      choice: "auto",
      currency: "NGN",
      automatic: "NGN",
      areaUnit: NAIRA_ONLY.areaUnit,
      distanceUnit: NAIRA_ONLY.distanceUnit,
      from: "auto",
    };
  }
});

export const getDisplayMoney = cache(async function getDisplayMoney(): Promise<DisplayMoney> {
  try {
    const prefs = await getDisplayPreferences();
    const base = {
      choice: prefs.choice,
      currency: prefs.currency,
      automatic: prefs.automatic,
      areaUnit: prefs.areaUnit,
      distanceUnit: prefs.distanceUnit,
    };
    if (prefs.currency === "NGN") return { ...base, rate: null };
    return withFreshRate(base, await readDisplayRates(), Date.now());
  } catch {
    return NAIRA_ONLY;
  }
});
