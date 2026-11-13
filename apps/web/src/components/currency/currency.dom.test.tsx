import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import type { DisplayMoney } from "@/lib/currency/display";
import type { DisplayRate } from "@/lib/currency/convert";
import { Price, PriceGuide } from "./Price";
import { DisplayMoneyProvider, guideCopyOf } from "./DisplayMoneyProvider";
import { RatesAttribution, ATTRIBUTION_URL } from "./RatesAttribution";
import { AreaRow, CurrencyChoices, CurrencyRows, currencyOptions } from "./DisplayPreferences";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/lib/currency/actions", () => ({ saveDisplayPreferences: async () => ({ ok: true, data: { onAccount: false } }) }));

afterAll(closeAxe);

/**
 * The guide beside a naira price, as a reader and a screen reader get it,
 * and the settings rows that choose it. Rendered to HTML with the client
 * React build, as the server sends it on first paint.
 */

const prefs = getDictionary("en").experienceSettings.preferences;
const copy = guideCopyOf(prefs);

const RATE: DisplayRate = {
  currency: "GBP",
  ngnPerUnit: "1788.334597543",
  source: "exchangerate-api",
  sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
  fetchedAt: "2026-11-13T00:50:04.000Z",
};
const POUNDS: DisplayMoney = { choice: "GBP", currency: "GBP", automatic: "NGN", rate: RATE, areaUnit: "sqm" };
const NAIRA: DisplayMoney = { choice: "auto", currency: "NGN", automatic: "NGN", rate: null, areaUnit: "sqm" };
const NO_RATE: DisplayMoney = { ...POUNDS, rate: null };

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("<Price>", () => {
  it("draws the naira price first and in full, then the guide, with the words for the ear", () => {
    const html = renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={POUNDS} copy={copy} />);
    expect(html.indexOf("₦4,500,000")).toBeGreaterThan(-1);
    expect(html.indexOf("₦4,500,000")).toBeLessThan(html.indexOf("about £2,516"));
    expect(html).toContain('data-guide="GBP"');
    expect(text(html)).toContain("approximately 2,516 British pounds, as a guide. You pay in naira.");
  });

  it("reads the provider when no display is passed", () => {
    const html = renderToStaticMarkup(
      <DisplayMoneyProvider value={{ display: POUNDS, copy }}>
        <Price minor={25_000_000} locale="en" mode="glance" />
      </DisplayMoneyProvider>,
    );
    expect(text(html)).toContain("₦250,000");
    expect(text(html)).toContain("about £139");
  });

  it("goes short with the naira figure on a card", () => {
    const html = renderToStaticMarkup(<Price minor={2_000_000_000} locale="en" mode="compact" display={POUNDS} copy={copy} />);
    expect(text(html)).toContain("₦20m");
    expect(text(html)).toContain("about £11.1k");
  });

  it("shows naira only with naira chosen, with no fresh rate, with no provider, or when told not to", () => {
    for (const html of [
      renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={NAIRA} copy={copy} />),
      renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={NO_RATE} copy={copy} />),
      renderToStaticMarkup(<Price minor={450_000_000} locale="en" />),
      renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={POUNDS} copy={copy} guide="none" />),
    ]) {
      expect(text(html)).toContain("₦4,500,000");
      expect(html).not.toContain("data-guide");
      expect(text(html)).not.toContain("about");
    }
  });

  it("never works a guide from an amount that is not naira", () => {
    const html = renderToStaticMarkup(<Price minor={450_000_000} locale="en" currency="USD" display={POUNDS} copy={copy} />);
    expect(html).not.toContain("data-guide");
    expect(renderToStaticMarkup(<PriceGuide minor={450_000_000} currency="USD" display={POUNDS} copy={copy} />)).toBe("");
  });

  it("draws the guide alone after a surface's own figure", () => {
    const html = renderToStaticMarkup(
      <DisplayMoneyProvider value={{ display: POUNDS, copy }}>
        <PriceGuide minor={2_000_000_000} compact />
      </DisplayMoneyProvider>,
    );
    expect(text(html)).toContain("about £11.1k");
    expect(html).not.toContain("₦");
    expect(renderToStaticMarkup(<PriceGuide minor={2_000_000_000} />)).toBe("");
  });

  it("puts the guide on its own line when asked", () => {
    const html = renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={POUNDS} copy={copy} guide="below" />);
    expect(html).toMatch(/<span class="block nf-caption[^"]*" data-guide="GBP">/);
  });
});

describe("<RatesAttribution>", () => {
  it("credits the source with its required words and link wherever a guide is shown", () => {
    const html = renderToStaticMarkup(<RatesAttribution display={POUNDS} label={prefs.attribution} />);
    expect(html).toContain(`href="${ATTRIBUTION_URL}"`);
    expect(text(html)).toBe("Rates By Exchange Rate API");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("draws nothing with no guide on the page, or for the CC0 fallback", () => {
    expect(renderToStaticMarkup(<RatesAttribution display={NAIRA} label={prefs.attribution} />)).toBe("");
    expect(renderToStaticMarkup(<RatesAttribution display={NO_RATE} label={prefs.attribution} />)).toBe("");
    expect(
      renderToStaticMarkup(<RatesAttribution display={{ ...POUNDS, rate: { ...RATE, source: "currency-api" } }} label={prefs.attribution} />),
    ).toBe("");
  });
});

describe("the settings rows", () => {
  it("shows the choice and a worked example in the chosen currency on first paint", () => {
    const html = renderToStaticMarkup(<CurrencyRows display={POUNDS} copy={prefs} locale="en" exampleNaira="₦250,000" />);
    expect(html).toContain('data-testid="setting-currency"');
    expect(text(html)).toContain("Currency");
    expect(text(html)).toContain("GBP");
    expect(text(html)).toContain("A stay at ₦250,000 a night");
    expect(text(html)).toContain("about £139");
    expect(text(html)).toContain("You always pay in naira.");
  });

  it("names Automatic with what it picks for this reader", () => {
    const html = renderToStaticMarkup(
      <CurrencyRows display={{ ...POUNDS, choice: "auto", automatic: "GBP" }} copy={prefs} locale="en" exampleNaira="₦250,000" />,
    );
    expect(text(html)).toContain("Automatic (GBP)");
  });

  it("lists Automatic and every currency, says payment is in naira, and marks the current one", () => {
    const options = currencyOptions(prefs, "GBP");
    expect(options.map((o) => o.value)).toEqual(["auto", "NGN", "USD", "GBP", "EUR", "CAD", "GHS", "ZAR", "KES", "AED", "XOF", "AUD"]);
    expect(options[0]!.sub).toBe("Follows where you are. Right now: British pound (GBP)");
    const html = renderToStaticMarkup(
      <CurrencyChoices intro={prefs.sheetIntro} legend={prefs.sheetTitle} options={options} choice="EUR" onChoose={() => undefined} />,
    );
    expect(text(html)).toContain("You always pay in naira, and you see the exact amount before you pay.");
    expect(html.match(/type="radio"/g)).toHaveLength(12);
    const radios = html.match(/<input[^>]*>/g) ?? [];
    expect(radios.filter((r) => /checked/.test(r))).toHaveLength(1);
    expect(radios.find((r) => /checked/.test(r))).toContain('value="EUR"');
    expect(text(html)).toContain("Nigerian naira (NGN)");
    expect(text(html)).toContain("West African CFA franc (XOF)");
  });

  it("offers square metres or square feet, with the example in the chosen unit", () => {
    const html = renderToStaticMarkup(<AreaRow display={{ ...POUNDS, areaUnit: "sqft" }} copy={prefs} />);
    expect(text(html)).toContain("A 120 m² flat reads: 1,292 sq ft");
    expect(text(html)).toContain("Square feet (sq ft)");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("accessibility (axe)", () => {
  it("has no violations in the price, the attribution and the choices", async () => {
    const html = [
      `<h1>Language and currency</h1>`,
      renderToStaticMarkup(<Price minor={450_000_000} locale="en" display={POUNDS} copy={copy} />),
      renderToStaticMarkup(<RatesAttribution display={POUNDS} label={prefs.attribution} />),
      renderToStaticMarkup(
        <CurrencyChoices intro={prefs.sheetIntro} legend={prefs.sheetTitle} options={currencyOptions(prefs, "NGN")} choice="auto" onChoose={() => undefined} />,
      ),
    ].join("");
    expect(await axe(html)).toEqual([]);
  });
});
