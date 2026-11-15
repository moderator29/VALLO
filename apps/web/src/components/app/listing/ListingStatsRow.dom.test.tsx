/**
 * THE LISTING STATS ROW AND ITS BEACON, mounted in a real Chromium at phone
 * width (founder, 13 November 2026). The row draws the three items in order
 * with tabular figures, a compact figure keeps its whole number for a screen
 * reader, an example shows its counts but no time on Vallo, and axe finds
 * nothing. The beacon sends
 * exactly once after the page has been visible for a second, and not while the
 * tab is hidden.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const rowEntry = (args: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { ListingStatsRow } from "@/components/app/listing/ListingStatsRow";
  import { listingStatItems } from "@/lib/listings/stats/format";
  const NOW = new Date("2026-11-13T10:00:00+01:00");
  const ago = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
  mount(<main style={{ padding: 16 }}><p>A bright two bedroom flat.</p><ListingStatsRow label="How this listing is doing on Vallo" items={listingStatItems({ now: NOW, ...${args} })} /><p data-testid="after">after</p></main>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the listing stats row", () => {
  it("draws days, views and saves in order, tabular, and passes axe", async () => {
    const { page, close } = await mountInBrowser({
      entry: rowEntry(`{ isDemo: false, publishedAt: ago(12), figures: { views: 12480, saves: 18 } }`),
      css: productCss("app/css/base.css", "app/css/controls.css"),
    });
    try {
      const row = page.getByTestId("listing-stats");
      await row.waitFor();
      expect(await row.getAttribute("role")).toBe("group");
      expect(await row.getAttribute("aria-label")).toBe("How this listing is doing on Vallo");
      const keys = await row.locator("[data-stat]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")));
      expect(keys).toEqual(["days", "views", "saves"]);
      const visible = await row.locator("[data-stat] .nf-numeric").allInnerTexts();
      expect(visible).toEqual(["12 days on Vallo", "12.4k views", "18 saves"]);
      expect(await row.locator(".sr-only").allTextContents()).toEqual(["12,480 views"]);
      const numeric = await row.locator("[data-stat] .nf-numeric").first().evaluate((el) => getComputedStyle(el).fontVariantNumeric);
      expect(numeric).toContain("tabular-nums");
      /* No horizontal page scroll at 390. */
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("leaves views out until there is one, and shows saves at zero", async () => {
    const { page, close } = await mountInBrowser({
      entry: rowEntry(`{ isDemo: false, publishedAt: ago(0), figures: { views: 0, saves: 0 } }`),
      css: productCss("app/css/base.css", "app/css/controls.css"),
    });
    try {
      await page.getByTestId("listing-stats").waitFor();
      expect(await page.locator("[data-stat] .nf-numeric").allInnerTexts()).toEqual(["Listed today", "0 saves"]);
    } finally {
      await close();
    }
  });

  it("gives an example its counts without a time on Vallo, and draws nothing when the figures could not be read", async () => {
    const example = await mountInBrowser({
      entry: rowEntry(`{ isDemo: true, publishedAt: ago(30), figures: { views: 50, saves: 3, shares: 2 } }`),
      css: productCss("app/css/base.css", "app/css/controls.css"),
    });
    try {
      await example.page.getByTestId("listing-stats").waitFor();
      expect(await example.page.locator("[data-stat] .nf-numeric").allInnerTexts()).toEqual(["50 views", "3 saves", "2 shares"]);
      expect(await example.page.locator("body").innerText()).not.toMatch(/on Vallo/);
    } finally {
      await example.close();
    }
    const failed = await mountInBrowser({
      entry: rowEntry(`{ isDemo: false, publishedAt: ago(30), figures: null }`),
      css: productCss("app/css/base.css", "app/css/controls.css"),
    });
    try {
      await failed.page.getByTestId("after").waitFor();
      expect(await failed.page.getByTestId("listing-stats").count()).toBe(0);
      expect(await failed.page.locator("body").innerText()).not.toMatch(/on Vallo|views|saves/);
    } finally {
      await failed.close();
    }
  });
});

const beaconEntry = `
  import { mount } from "@/lib/testing/browser-root";
  import { ListingViewBeacon } from "@/components/app/listing/ListingViewBeacon";
  mount(<ListingViewBeacon listingId="7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13" />);
`;

/* Record every beacon; let a test hide or show the tab. */
const BEACON_INIT = `
  window.__beacons = [];
  navigator.sendBeacon = (url, blob) => { blob.text().then((t) => window.__beacons.push([url, t])); return true; };
  window.__hidden = false;
  /* Playwright's Chromium reports itself as automated; a person's browser does not. */
  Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (window.__hidden ? "hidden" : "visible") });
`;

const beacons = (page: import("playwright-core").Page) =>
  page.evaluate(() => (window as unknown as { __beacons: [string, string][] }).__beacons);

describe.skipIf(!hasBrowser && !process.env.CI)("the view beacon", () => {
  it("sends one beacon after a second on screen, and never a second one", async () => {
    const { page, close } = await mountInBrowser({ entry: beaconEntry, init: BEACON_INIT });
    try {
      await page.waitForTimeout(400);
      expect(await beacons(page)).toEqual([]);
      await page.waitForFunction(() => (window as unknown as { __beacons: unknown[] }).__beacons.length === 1, null, { timeout: 5_000 });
      await page.waitForTimeout(1_500);
      expect(await beacons(page)).toEqual([["/api/listing-view", '{"id":"7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13"}']]);
    } finally {
      await close();
    }
  });

  it("waits while the tab is hidden and counts once it is seen for a second", async () => {
    const { page, close } = await mountInBrowser({
      entry: beaconEntry,
      init: `${BEACON_INIT} window.__hidden = true;`,
    });
    try {
      await page.waitForTimeout(1_800);
      expect(await beacons(page)).toEqual([]);
      await page.evaluate(() => {
        (window as unknown as { __hidden: boolean }).__hidden = false;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(500);
      expect(await beacons(page)).toEqual([]);
      await page.waitForFunction(() => (window as unknown as { __beacons: unknown[] }).__beacons.length === 1, null, { timeout: 5_000 });
    } finally {
      await close();
    }
  });

  it("sends nothing from a browser driven by automation", async () => {
    const { page, close } = await mountInBrowser({
      entry: beaconEntry,
      init: `${BEACON_INIT} Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });`,
    });
    try {
      await page.waitForTimeout(1_800);
      expect(await beacons(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
