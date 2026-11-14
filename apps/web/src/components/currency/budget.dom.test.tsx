import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { DisplayMoney } from "@/lib/currency/display";
import { BudgetInCurrency } from "./BudgetInCurrency";
import { DisplayMoneyProvider } from "./DisplayMoneyProvider";
import { guideCopyOf } from "./guide-copy";

/**
 * CURRENCY TOOL 2 ON THE FILTER SHEET: the budget row in the reader's
 * currency is drawn only when the page shows a guide, reads the naira fields
 * back as a guide figure is cut, and says in naira what the search will use.
 */

const prefs = getDictionary("en").experienceSettings.preferences;
const POUNDS: DisplayMoney = {
  choice: "GBP",
  currency: "GBP",
  automatic: "NGN",
  areaUnit: "sqm",
  distanceUnit: "km",
  rate: {
    currency: "GBP",
    ngnPerUnit: "1788.334597543",
    source: "exchangerate-api",
    sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
    fetchedAt: "2026-11-13T00:50:04.000Z",
  },
};

const within = (display: DisplayMoney, node: ReactNode) =>
  renderToStaticMarkup(<DisplayMoneyProvider value={{ display, copy: guideCopyOf(prefs) }}>{node}</DisplayMoneyProvider>);
const row = (minNaira: string, maxNaira: string) => (
  <BudgetInCurrency minNaira={minNaira} maxNaira={maxNaira} locale="en" onChange={() => undefined} />
);

describe("the budget in the reader's currency", () => {
  it("draws nothing without a provider, with naira chosen, or without a fresh rate", () => {
    expect(renderToStaticMarkup(row("2000000", ""))).toBe("");
    expect(within({ ...POUNDS, choice: "NGN", currency: "NGN", rate: null }, row("2000000", ""))).toBe("");
    expect(within({ ...POUNDS, rate: null }, row("2000000", ""))).toBe("");
  });

  it("is a named group of two named fields with the currency's own sign", () => {
    const html = within(POUNDS, row("", ""));
    expect(html).toMatch(/role="group" aria-labelledby="([^"]+)"/);
    const id = /aria-labelledby="([^"]+)"/.exec(html)![1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Budget in British pounds");
    expect(html).toContain("Minimum budget in British pounds");
    expect(html).toContain("Maximum budget in British pounds");
    expect(html.match(/inputMode="numeric"/gi)).toHaveLength(2);
    expect(html.match(/aria-hidden="true">£</g)).toHaveLength(2);
  });

  it("with nothing set, says what typing here does and states no figure", () => {
    const html = within(POUNDS, row("", ""));
    expect(html).toContain("Type it in British pounds and the search turns it into naira, as a guide at a recent rate.");
    expect(html).not.toContain("₦");
    expect(html.match(/value=""/g)).toHaveLength(2);
  });

  it("reads the naira fields back cut to whole units, and states the naira the search uses", () => {
    const html = within(POUNDS, row("2682501", "5000000"));
    // 2,682,501 naira is 1,500.00 pounds to the penny; 5,000,000 is 2,795.89.
    expect(html).toMatch(/data-testid="filter-budget-min"[^>]*value="1,500"/);
    expect(html).toMatch(/data-testid="filter-budget-max"[^>]*value="2,795"/);
    expect(html).toContain("The search uses naira: ₦2,682,501 to ₦5,000,000. A guide at a recent rate, not a price.");
    expect(html).toMatch(/aria-live="polite"/);
  });

  it("words one bound alone, and puts crossed bounds in the order the search reads them", () => {
    expect(within(POUNDS, row("2000000", ""))).toContain("The search uses naira: ₦2,000,000 and above.");
    expect(within(POUNDS, row("", "5000000"))).toContain("The search uses naira: up to ₦5,000,000.");
    expect(within(POUNDS, row("5000000", "2000000"))).toContain("The search uses naira: ₦2,000,000 to ₦5,000,000.");
  });
});
