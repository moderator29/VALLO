/**
 * The upgraded search, in Chromium (search-map track): the one-per-row card
 * draws only the listing's real fields, the map's credit is a round "i" that
 * opens and closes, and the filter sheet's rows are real radio groups that a
 * keyboard can drive.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT * 2 });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CARD_ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ListingCard } from "@/components/app/ListingCard";
  import { RENTAL } from "@/app/(dev)/preview/f3/fixtures";
  const t = getDictionary("en");
  /* Two beds stated, baths and floor area NOT stated, not checked. */
  const SPARE = { ...RENTAL, id: "spare", verified: false, bedrooms: 2, bathrooms: 0, sizeSqm: undefined, parkingSpaces: undefined };
  const NOPRICE = { ...RENTAL, id: "noprice", intent: "rent", pricePeriod: "year", priceMinor: 0, moveInCostMinor: undefined };
  const DEMO = { ...RENTAL, id: "demo", isDemo: true };
  const SALE = { ...RENTAL, id: "sale", intent: "sale", pricePeriod: undefined, moveInCostMinor: undefined, priceMinor: 18000000000 };
  mount(
    <div style={{ width: 358 }}>
      <div id="full"><ListingCard listing={RENTAL} locale="en" t={t} layout="row" brief /></div>
      <div id="spare"><ListingCard listing={SPARE} locale="en" t={t} layout="row" brief /></div>
      <div id="noprice"><ListingCard listing={NOPRICE} locale="en" t={t} layout="row" brief /></div>
      <div id="demo"><ListingCard listing={DEMO} locale="en" t={t} layout="row" brief /></div>
      <div id="sale"><ListingCard listing={SALE} locale="en" t={t} layout="row" brief /></div>
      <div id="reason"><ListingCard listing={SPARE} locale="en" t={t} layout="row" brief reason={{ text: "In Yaba, under your budget", icon: "wallet" }} /></div>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the row result card draws real fields only", () => {
  it("draws what the listing states, and nothing it does not", async () => {
    const { page, close } = await mountInBrowser({ entry: CARD_ENTRY });
    try {
      const text = (sel: string) => page.locator(sel).first().innerText();
      /* The full listing: market chip, Verified, move-in figure, three facts. */
      expect(await text("#full [data-testid=card-market]")).toBe("For rent");
      expect(await page.locator("#full .nf-badge--verified").count()).toBe(1);
      const price = await text("#full [data-testid=card-price]");
      /* The stated move-in total, as a screen reader hears it while the
         figure counts up on screen. */
      expect(price).toContain("₦14,700,000");
      expect(price).toContain("to move in");
      const facts = await text("#full [data-testid=card-facts]");
      expect(facts).toContain("4 beds");
      expect(facts).toContain("5 baths");
      expect(facts).toContain("420 m²");
      /* The spare listing: two beds and nothing invented for the rest. */
      const spare = await text("#spare [data-testid=card-facts]");
      expect(spare).toContain("2 beds");
      expect(spare).not.toMatch(/bath|m²/);
      expect(await page.locator("#spare .nf-badge--verified").count()).toBe(0);
      /* No reason line unless the page found a real one. */
      expect(await page.locator("#spare [data-testid=card-reason]").count()).toBe(0);
      expect(await text("#reason [data-testid=card-reason]")).toBe("In Yaba, under your budget");
      /* No figure stated: the card says so in words, never a zero. */
      const ask = await text("#noprice [data-testid=card-price]");
      expect(ask).not.toMatch(/₦0|0\.0/);
      expect(ask.length).toBeGreaterThan(0);
      /* An example never carries a trust mark. */
      expect(await page.locator("#demo .nf-badge--verified").count()).toBe(0);
      /* A sale: its market, its figure, no period after it. */
      expect(await text("#sale [data-testid=card-market]")).toBe("For sale");
      const sale = await text("#sale [data-testid=card-price]");
      expect(sale).toContain("180m");
      expect(sale).not.toMatch(/year|move in/);
    } finally {
      await close();
    }
  });
});

const CREDIT_ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { MapCredit } from "@/components/app/search/MapCredit";
  mount(
    <div style={{ position: "relative", width: 360, height: 300 }}>
      <MapCredit
        credits={[{ label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" }, { label: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" }, { label: "OpenFreeMap", href: "https://openfreemap.org" }]}
        join=" and "
        label="About this map"
        heading="Map data"
        note="Pins show the area, not the address."
      />
      <button id="elsewhere" type="button">elsewhere</button>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the map's credit control", () => {
  it("is a round 'i' that reveals the providers' credit and hides it again", async () => {
    const { page, close } = await mountInBrowser({ entry: CREDIT_ENTRY });
    try {
      const toggle = page.locator("[data-testid=map-credit-toggle]");
      const panel = page.locator("[data-testid=map-credit-panel]");
      expect(await toggle.getAttribute("aria-label")).toBe("About this map");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await panel.isVisible()).toBe(false);
      /* The credit is in the page the whole time, one tap away. */
      expect(await panel.locator("a").count()).toBe(3);

      await toggle.click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
      expect(await panel.isVisible()).toBe(true);
      expect(await panel.innerText()).toContain("© OpenMapTiles, © OpenStreetMap contributors and OpenFreeMap");
      expect(await panel.locator("a").first().getAttribute("href")).toBe("https://www.openmaptiles.org/");

      await page.keyboard.press("Escape");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await panel.isVisible()).toBe(false);

      await toggle.click();
      expect(await panel.isVisible()).toBe(true);
      await page.locator("#elsewhere").click();
      expect(await panel.isVisible()).toBe(false);
    } finally {
      await close();
    }
  });
});

const PILLS_ENTRY = `
  import { useState } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { RadioPills } from "@/components/app/filters/RadioPills";
  import { PriceSpread } from "@/components/app/filters/PriceSpread";
  function Harness() {
    const [beds, setBeds] = useState(0);
    const [market, setMarket] = useState(undefined);
    return (
      <div style={{ width: 360 }}>
        <h2 id="beds-h">Bedrooms</h2>
        <RadioPills labelledBy="beds-h" testPrefix="beds" value={beds} onPick={(v) => setBeds(v ?? 0)}
          options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === 0 ? "Any" : v + "+" }))} />
        <RadioPills label="Market" testPrefix="market" allowClear value={market} onPick={setMarket}
          options={[{ value: "rent", label: "For rent" }, { value: "sale", label: "For sale" }, { value: "shortlet", label: "Shortlet" }]} />
        <PriceSpread figures={[100, 150, 900, null, 2000]} ceilingMinor={1000} minMinor={0} maxMinor={500} />
      </div>
    );
  }
  mount(<Harness />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the filter sheet's rows", () => {
  it("are radio groups with one tab stop that the arrows drive", async () => {
    const { page, close } = await mountInBrowser({ entry: PILLS_ENTRY });
    try {
      const group = page.locator("[data-testid=beds-group]");
      expect(await group.getAttribute("role")).toBe("radiogroup");
      expect(await group.getAttribute("aria-labelledby")).toBe("beds-h");
      const radios = group.locator("[role=radio]");
      expect(await radios.count()).toBe(6);
      expect(await radios.allInnerTexts()).toEqual(["Any", "1+", "2+", "3+", "4+", "5+"]);
      const checked = () => group.locator("[aria-checked=true]").innerText();
      expect(await checked()).toBe("Any");
      expect(await group.locator("[tabindex='0']").count()).toBe(1);

      await page.locator("[data-testid=beds-0]").focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      expect(await checked()).toBe("2+");
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("2+");
      await page.keyboard.press("End");
      expect(await checked()).toBe("5+");
      await page.keyboard.press("ArrowRight");
      expect(await checked()).toBe("Any");

      /* The market: nothing chosen is "any market", and the tap that chose
         an answer can take it back, as the sheet always allowed. */
      const market = page.locator("[data-testid=market-group]");
      expect(await market.getAttribute("aria-label")).toBe("Market");
      expect(await market.locator("[aria-checked=true]").count()).toBe(0);
      expect(await market.locator("[tabindex='0']").count()).toBe(1);
      await page.locator("[data-testid=market-sale]").click();
      expect(await market.locator("[aria-checked=true]").innerText()).toBe("For sale");
      await page.locator("[data-testid=market-sale]").click();
      expect(await market.locator("[aria-checked=true]").count()).toBe(0);

      /* The bars are drawn from the figures, the chosen range lit. */
      const bars = page.locator("[data-testid=filter-histogram] > span");
      const counts = await bars.evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-count"))));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
      const lit = await bars.evaluateAll((els) => els.map((el) => el.getAttribute("data-in") === "true"));
      expect(lit[0]).toBe(true);
      expect(lit[lit.length - 1]).toBe(false);
    } finally {
      await close();
    }
  });
});
