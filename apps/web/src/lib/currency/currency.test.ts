import { describe, expect, it } from "vitest";

import { CURRENCY_META, DISPLAY_CURRENCIES, FOREIGN_CURRENCIES, isCurrencyChoice, isDisplayCurrency } from "./currencies";
import {
  MAX_RATE_AGE_MS,
  convertNgnMinor,
  parseRate,
  rateVerdict,
  roundHalfEven,
  type DisplayRate,
} from "./convert";
import { approxFigure, wholeUnits } from "./format";
import { automaticCurrency, languageTags } from "./auto";
import { SQFT_PER_SQM, areaIn, formatArea, isAreaUnit } from "./area";
import { displayFromSettings, resolveDisplay, withDisplay } from "./preference";
import { NAIRA_ONLY, currencyLabel, guideFor, showsGuide, withFreshRate, type DisplayMoney } from "./display";

const NOW = Date.parse("2026-11-13T14:00:00Z");

function gbp(overrides: Partial<DisplayRate> = {}): DisplayRate {
  return {
    currency: "GBP",
    ngnPerUnit: "1788.334597543",
    source: "exchangerate-api",
    sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
    fetchedAt: "2026-11-13T00:50:04.000Z",
    ...overrides,
  };
}

describe("the currency list", () => {
  it("holds naira, the four the founder named, the five Vallo's people use and two for the diaspora", () => {
    expect(DISPLAY_CURRENCIES).toEqual(["NGN", "USD", "GBP", "EUR", "CAD", "GHS", "ZAR", "KES", "AED", "XOF", "AUD"]);
    expect(FOREIGN_CURRENCIES).not.toContain("NGN");
    expect(FOREIGN_CURRENCIES).toHaveLength(10);
  });

  it("states ISO 4217 decimals, and the CFA franc has none", () => {
    for (const code of DISPLAY_CURRENCIES) expect(CURRENCY_META[code].decimals, code).toBe(code === "XOF" ? 0 : 2);
  });

  it("never writes a bare dollar sign, and no two currencies share a symbol", () => {
    const symbols = DISPLAY_CURRENCIES.map((code) => CURRENCY_META[code].symbol);
    expect(symbols).not.toContain("$");
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(CURRENCY_META.NGN.symbol).toBe("₦");
  });

  it("accepts a code or auto, and nothing else", () => {
    expect(isDisplayCurrency("GBP")).toBe(true);
    expect(isDisplayCurrency("gbp")).toBe(false);
    expect(isDisplayCurrency("JPY")).toBe(false);
    expect(isCurrencyChoice("auto")).toBe(true);
    expect(isCurrencyChoice("")).toBe(false);
    expect(isCurrencyChoice(null)).toBe(false);
  });
});

describe("conversion in integer minor units", () => {
  it("reads a rate as nine decimal places, exactly", () => {
    expect(parseRate("1788.334597543")).toBe(1_788_334_597_543n);
    expect(parseRate("1")).toBe(1_000_000_000n);
    expect(parseRate("2.278718786999")).toBe(2_278_718_786n);
    expect(parseRate(1350.459083)).toBe(1_350_459_083_000n);
    for (const bad of ["", "0", "0.000000000", "-1", "1e3", "abc", "1.2.3", null, undefined, Number.NaN, 0, -2]) {
      expect(parseRate(bad as never), String(bad)).toBeNull();
    }
  });

  it("rounds half to even, and away from the tie otherwise", () => {
    expect(roundHalfEven(5n, 2n)).toBe(2n); // 2.5 -> 2
    expect(roundHalfEven(7n, 2n)).toBe(4n); // 3.5 -> 4
    expect(roundHalfEven(11n, 4n)).toBe(3n); // 2.75 -> 3
    expect(roundHalfEven(9n, 4n)).toBe(2n); // 2.25 -> 2
    expect(roundHalfEven(-5n, 2n)).toBe(-2n);
    expect(() => roundHalfEven(1n, 0n)).toThrow();
  });

  it("converts four and a half million naira to 2,516.31 pounds at the recorded rate", () => {
    /* 450,000,000 kobo / 1788.334597543 = 251,631.28... pence. */
    expect(convertNgnMinor(450_000_000, "GBP", "1788.334597543")).toBe(251_631);
  });

  it("converts to the CFA franc's whole units, it has no minor unit", () => {
    /* ₦10,000 / 2.278718786 = 4,388.43 CFA. */
    expect(convertNgnMinor(1_000_000, "XOF", "2.278718786")).toBe(4_388);
  });

  it("lands an exact tie on the even neighbour", () => {
    /* At ₦1 to the unit, kobo and cents are the same size. */
    expect(convertNgnMinor(250, "USD", "1")).toBe(250);
    /* 1 kobo at ₦2 per unit is 0.5 cents: a tie, to the even 0. 3 kobo is 1.5 cents: to the even 2. */
    expect(convertNgnMinor(1, "USD", "2")).toBe(0);
    expect(convertNgnMinor(3, "USD", "2")).toBe(2);
  });

  it("passes naira through, and refuses a non-integer amount or a bad rate", () => {
    expect(convertNgnMinor(12_345, "NGN", "anything")).toBe(12_345);
    expect(convertNgnMinor(1.5, "GBP", "1788")).toBeNull();
    expect(convertNgnMinor(Number.MAX_SAFE_INTEGER + 2, "GBP", "1788")).toBeNull();
    expect(convertNgnMinor(100, "GBP", "0")).toBeNull();
  });

  it("handles the largest real figure without losing a unit", () => {
    /* ₦50 billion, a land sale, in kobo. */
    expect(convertNgnMinor(5_000_000_000_000, "USD", "1350.459083")).toBe(3_702_444_645);
  });
});

describe("a rate is used only while it is fresh", () => {
  it("is fresh inside 48 hours of both clocks", () => {
    expect(rateVerdict(gbp(), NOW)).toEqual({ usable: true });
  });

  it("is stale one millisecond past 48 hours of the OLDER clock, even if fetched just now", () => {
    const source = NOW - MAX_RATE_AGE_MS - 1;
    expect(rateVerdict(gbp({ sourceUpdatedAt: new Date(source).toISOString(), fetchedAt: new Date(NOW).toISOString() }), NOW)).toEqual({
      usable: false,
      why: "stale",
    });
    expect(rateVerdict(gbp({ sourceUpdatedAt: new Date(NOW - MAX_RATE_AGE_MS).toISOString(), fetchedAt: new Date(NOW).toISOString() }), NOW).usable).toBe(true);
  });

  it("is stale when the fetch itself is old", () => {
    expect(rateVerdict(gbp({ fetchedAt: "2026-11-10T00:00:00.000Z" }), NOW)).toEqual({ usable: false, why: "stale" });
  });

  it("refuses a clock more than an hour in the future, a malformed rate and a missing one", () => {
    expect(rateVerdict(gbp({ fetchedAt: "2026-11-13T16:00:00.000Z" }), NOW)).toEqual({ usable: false, why: "future" });
    expect(rateVerdict(gbp({ ngnPerUnit: "0" }), NOW)).toEqual({ usable: false, why: "malformed" });
    expect(rateVerdict(gbp({ sourceUpdatedAt: "yesterday" }), NOW)).toEqual({ usable: false, why: "malformed" });
    expect(rateVerdict(null, NOW)).toEqual({ usable: false, why: "missing" });
  });
});

describe("the guide figure, written", () => {
  it("writes whole units with the platform's grouping, truncated, never rounded up", () => {
    expect(approxFigure(251_631, "GBP")).toEqual({ kind: "figure", text: "£2,516", spoken: "2,516 British pounds" });
    expect(approxFigure(251_699, "GBP").text).toBe("£2,516");
    expect(approxFigure(100, "USD")).toEqual({ kind: "figure", text: "US$1", spoken: "1 US dollar" });
  });

  it("writes each currency's own sign, spaced as it is written at home", () => {
    expect(approxFigure(123_456, "CAD").text).toBe("CA$1,234");
    expect(approxFigure(123_456, "GHS").text).toBe("GH₵1,234");
    expect(approxFigure(123_456, "KES").text).toBe("KSh 1,234");
    expect(approxFigure(123_456, "ZAR").text).toBe("R1,234");
    expect(approxFigure(123_456, "AED").text).toBe("AED 1,234");
    expect(approxFigure(123_456, "EUR").text).toBe("€1,234");
    expect(approxFigure(123_456, "AUD").text).toBe("A$1,234");
    expect(approxFigure(1_234, "XOF")).toEqual({ kind: "figure", text: "CFA 1,234", spoken: "1,234 CFA francs" });
  });

  it("says less than one unit rather than zero", () => {
    expect(approxFigure(99, "GBP")).toEqual({ kind: "under", text: "£1", spoken: "1 British pound" });
    expect(approxFigure(0, "GBP")).toEqual({ kind: "figure", text: "£0", spoken: "0 British pounds" });
  });

  it("goes short only from ten thousand units, truncating the tenth", () => {
    expect(approxFigure(999_999, "GBP", { compact: true }).text).toBe("£9,999");
    expect(approxFigure(1_259_999, "GBP", { compact: true }).text).toBe("£12.5k");
    expect(approxFigure(1_234_567_800, "USD", { compact: true }).text).toBe("US$12.3m");
    expect(approxFigure(1_259_999, "GBP", { compact: true }).spoken).toBe("12,599 British pounds");
  });

  it("counts whole units by the currency's decimals", () => {
    expect(wholeUnits(1_299, "GBP")).toBe(12);
    expect(wholeUnits(1_299, "XOF")).toBe(1_299);
  });
});

describe("Automatic", () => {
  it("shows naira in Nigeria and the local currency where Vallo has one", () => {
    expect(automaticCurrency({ country: "NG" })).toEqual({ currency: "NGN", from: "country" });
    expect(automaticCurrency({ country: "GB" }).currency).toBe("GBP");
    expect(automaticCurrency({ country: "us" }).currency).toBe("USD");
    expect(automaticCurrency({ country: "IE" }).currency).toBe("EUR");
    expect(automaticCurrency({ country: "BJ" }).currency).toBe("XOF");
    expect(automaticCurrency({ country: "AE" }).currency).toBe("AED");
    expect(automaticCurrency({ country: "AU" }).currency).toBe("AUD");
  });

  it("the country header beats the language", () => {
    expect(automaticCurrency({ country: "NG", acceptLanguage: "en-GB" }).currency).toBe("NGN");
  });

  it("is naira for a country Vallo has no currency for, rather than a guess", () => {
    expect(automaticCurrency({ country: "JP", acceptLanguage: "en-GB" })).toEqual({ currency: "NGN", from: "unsure" });
  });

  it("falls back to the first language tag that names a region", () => {
    expect(automaticCurrency({ acceptLanguage: "en-GB,en;q=0.9" })).toEqual({ currency: "GBP", from: "language" });
    expect(automaticCurrency({ acceptLanguage: "en, fr-FR;q=0.8" }).currency).toBe("EUR");
    expect(automaticCurrency({ acceptLanguage: "fr-CA" }).currency).toBe("CAD");
    expect(automaticCurrency({ acceptLanguage: "de-DE;q=0.5, en-GH;q=0.9" }).currency).toBe("GHS");
  });

  it("reads en-US as unsure, because it is the factory language of Nigerian phones", () => {
    expect(automaticCurrency({ acceptLanguage: "en-US,en;q=0.9" })).toEqual({ currency: "NGN", from: "unsure" });
    expect(automaticCurrency({ country: "", acceptLanguage: "en-US" }).currency).toBe("NGN");
  });

  it("reads a Nigerian language as naira", () => {
    expect(automaticCurrency({ acceptLanguage: "yo, en-GB;q=0.8" })).toEqual({ currency: "NGN", from: "language" });
  });

  it("is naira when there is nothing to go on, or nonsense", () => {
    for (const acceptLanguage of [null, "", "*", "en", ";;;", "x".repeat(2000)]) {
      expect(automaticCurrency({ country: null, acceptLanguage }).currency).toBe("NGN");
    }
    expect(automaticCurrency({ country: "XX1" }).currency).toBe("NGN");
  });

  it("orders language tags by q and drops q=0", () => {
    expect(languageTags("fr;q=0.2, en-GB, de;q=0")).toEqual(["en-GB", "fr"]);
  });
});

describe("floor area", () => {
  it("converts square metres to whole square feet, exactly by definition", () => {
    expect(SQFT_PER_SQM).toBeCloseTo(10.7639104, 6);
    expect(areaIn(120, "sqft")).toBe(1_292);
    expect(areaIn(120, "sqm")).toBe(120);
    expect(formatArea(120, "sqft", { sqm: "m²", sqft: "sq ft" })).toBe("1,292 sq ft");
    expect(formatArea(1_250.5, "sqm", { sqm: "m²", sqft: "sq ft" })).toBe("1,250.5 m²");
    expect(formatArea(Number.NaN, "sqm", { sqm: "m²", sqft: "sq ft" })).toBe("");
    expect(isAreaUnit("sqft")).toBe(true);
    expect(isAreaUnit("acre")).toBe(false);
  });
});

describe("the preference, in order: account, then cookie, then automatic", () => {
  const auto = { currency: "GBP" as const, from: "country" as const };

  it("the account wins, so every device gives the same answer", () => {
    const resolved = resolveDisplay({ account: { currency: "USD", areaUnit: "sqft" }, cookies: { currency: "EUR", area: "sqm" }, auto });
    expect(resolved).toEqual({ choice: "USD", currency: "USD", automatic: "GBP", areaUnit: "sqft", from: "account" });
  });

  it("the cookie holds for anybody signed out", () => {
    expect(resolveDisplay({ account: null, cookies: { currency: "EUR", area: "sqft" }, auto })).toMatchObject({
      currency: "EUR",
      areaUnit: "sqft",
      from: "cookie",
    });
  });

  it("Automatic, chosen or by default, follows the request", () => {
    expect(resolveDisplay({ account: { currency: "auto" }, cookies: {}, auto })).toMatchObject({ choice: "auto", currency: "GBP", from: "account" });
    expect(resolveDisplay({ account: null, cookies: {}, auto })).toMatchObject({ choice: "auto", currency: "GBP", areaUnit: "sqm", from: "auto" });
  });

  it("ignores a cookie or account value that is not on the list", () => {
    expect(resolveDisplay({ account: displayFromSettings({ display: { currency: "BTC" } }), cookies: { currency: "JPY", area: "acre" }, auto })).toMatchObject({
      currency: "GBP",
      areaUnit: "sqm",
      from: "auto",
    });
  });

  it("reads the stored display tolerantly", () => {
    expect(displayFromSettings({ display: { currency: "GBP", areaUnit: "sqft" } })).toEqual({ currency: "GBP", areaUnit: "sqft" });
    for (const raw of [null, "x", [], {}, { display: "GBP" }, { display: [] }]) expect(displayFromSettings(raw)).toEqual({});
  });

  it("writes display and keeps every other key in the settings document", () => {
    const doc = { whatsappDoorbell: true, notifications: { bookings: false }, display: { currency: "EUR", areaUnit: "sqm" } };
    expect(withDisplay(doc, { currency: "GBP", areaUnit: "sqft" })).toEqual({
      whatsappDoorbell: true,
      notifications: { bookings: false },
      display: { currency: "GBP", areaUnit: "sqft" },
    });
    expect(withDisplay(null, { currency: "auto", areaUnit: "sqm" })).toEqual({ display: { currency: "auto", areaUnit: "sqm" } });
  });
});

describe("what a page hands its prices", () => {
  const base = { choice: "GBP" as const, currency: "GBP" as const, automatic: "NGN" as const, areaUnit: "sqm" as const };

  it("keeps a fresh rate for the chosen currency", () => {
    const display = withFreshRate(base, new Map([["GBP", gbp()]]), NOW);
    expect(display.rate?.ngnPerUnit).toBe("1788.334597543");
    expect(showsGuide(display)).toBe(true);
    expect(guideFor(display, 450_000_000)).toMatchObject({ kind: "figure", text: "£2,516", currency: "GBP" });
    expect(guideFor(display, 450_000_000, { compact: true })?.text).toBe("£2,516");
  });

  it("drops a stale rate, a missing one and one for another currency: naira only", () => {
    const stale = withFreshRate(base, new Map([["GBP", gbp({ sourceUpdatedAt: "2026-11-10T00:00:00.000Z" })]]), NOW);
    expect(stale.rate).toBeNull();
    expect(guideFor(stale, 450_000_000)).toBeNull();
    expect(withFreshRate(base, new Map(), NOW).rate).toBeNull();
    expect(withFreshRate(base, new Map([["GBP", { ...gbp(), currency: "EUR" }]]), NOW).rate).toBeNull();
  });

  it("never draws a guide for naira, or with nothing resolved", () => {
    const naira: DisplayMoney = { ...NAIRA_ONLY, rate: gbp() };
    expect(guideFor(naira, 100_000)).toBeNull();
    expect(guideFor(null, 100_000)).toBeNull();
    expect(guideFor(undefined, 100_000)).toBeNull();
    expect(withFreshRate({ ...base, currency: "NGN" }, new Map([["GBP", gbp()]]), NOW).rate).toBeNull();
  });

  it("names a currency as a settings line does", () => {
    expect(currencyLabel("GBP")).toBe("British pound (GBP)");
  });
});
