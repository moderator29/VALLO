/**
 * THE LISTINGS DESK (Analytics > Listings), mounted in a real Chromium at
 * phone and desktop width with axe over it (founder, 13 November 2026): the
 * four figures with their change, the conversion from a view, both charts,
 * the top lists linking to each listing's page, the area and lister tables;
 * a quiet range draws the calm note and never a flat line; before the SQL the
 * desk says it is not switched on, never zeros.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/base.css", "app/css/admin.css");

const entry = (days: string, ranked: string, range = "30d") => `
  import { mount } from "@/lib/testing/browser-root";
  import { ListingStatsDesk } from "@/app/admin/analytics/listings/ListingStatsDesk";
  const n = ${JSON.stringify(range)} === "7d" ? 7 : ${JSON.stringify(range)} === "90d" ? 90 : 30;
  const all = Array.from({ length: n * 2 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 10, 13) - (n * 2 - 1 - i) * 86400000).toISOString().slice(0, 10),
    views: i < n ? 10 : 20, saves: i < n ? 1 : 2, enquiries: 1, viewings: i % 2,
  }));
  const zero = all.map((d) => ({ ...d, views: 0, saves: 0, enquiries: 0, viewings: 0 }));
  const row = (key, label, sub, views, saves) => ({ key, label, sub, listings: 1, views, saves, enquiries: 3, viewings: 1 });
  const top = [row("7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13", "Two bedroom flat", "Yaba, Lagos", 400, 30), row("00000000-0000-4000-8000-000000000102", "Mini flat", "Ikeja, Lagos", 200, 40)];
  const ok = (data) => ({ state: "ok", data });
  mount(<main><ListingStatsDesk locale="en" range=${JSON.stringify(range)} days={${days}} topViews={${ranked}} topSaves={${ranked}} areas={${ranked}} listers={${ranked}} /></main>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the listings desk", () => {
  for (const width of [390, 1440]) {
    it(`draws the figures, the conversion, the charts and the tables at ${width}`, async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(`ok({ previous: all.slice(0, n), current: all.slice(n) })`, "ok(top)"),
        css: CSS,
        viewport: { width, height: 1200 },
      });
      try {
        const body = await page.locator("body").innerText();
        /* 30 days of 20 views against 30 of 10: 600, +100%. */
        expect(body).toContain("600");
        expect(body).toContain("+100%");
        expect(body).toContain("Views per day");
        expect(body).toContain("View to save");
        /* 60 saves of 600 views. */
        expect(body).toContain("10%");
        expect(body).toContain("Top listings by views");
        expect(body).toContain("By lister");
        expect(await page.locator('a[href="/admin/analytics/listings/7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13"]').count()).toBe(2);
        expect(await page.locator("figure.nf-chart").count()).toBe(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });
  }

  it("buckets ninety days by week", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(`ok({ previous: all.slice(0, n), current: all.slice(n) })`, "ok(top)", "90d"), css: CSS });
    try {
      expect(await page.locator("body").innerText()).toContain("Views per week");
    } finally {
      await close();
    }
  });

  it("says a quiet range is quiet, with no chart and a dash for conversion", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(`ok({ previous: zero.slice(0, n), current: zero.slice(n) })`, "ok([])"), css: CSS });
    try {
      const body = await page.locator("body").innerText();
      expect(body).toContain("Nothing counted in this range yet");
      expect(body).toContain("–");
      expect(await page.locator("figure.nf-chart").count()).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("says the stats are not switched on before the SQL, and draws no figure", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(`{ state: "missing" }`, `{ state: "missing" }`), css: CSS });
    try {
      const body = await page.locator("body").innerText();
      expect(body).toContain("Listing stats are not switched on yet");
      expect(body).not.toMatch(/\b0\b/);
      expect(await page.locator(".nf-admin-kpi").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
