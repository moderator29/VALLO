/**
 * THE LISTING PAGE'S PULSE, mounted in a real Chromium at phone width
 * (founder, 14 November 2026). Four tiles on one row at 390 with nothing cut:
 * views, saves, shares and the rating, the figures in tabular digits, a
 * compact figure read out whole. A listing nobody has reviewed shows 2.5 with
 * the stars lit to the half and says "Not yet rated"; a reviewed one shows its
 * own average. Without figures only the rating is drawn. Axe finds nothing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (figures: string, rating: string, age: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { ListingPulse } from "@/components/app/listing/ListingPulse";
  import { listingPulse } from "@/lib/listings/stats/format";
  import { shownRating } from "@/lib/listings/stats/rating";
  mount(<main style={{ padding: 16 }}><p>A bright two bedroom flat.</p><ListingPulse tiles={listingPulse({ figures: ${figures} })} rating={shownRating(${rating})} age={${age}} /><p data-testid="after">after</p></main>);
`;
const CSS = productCss("app/css/base.css", "app/css/symbols.css", "app/css/controls.css");

describe.skipIf(!hasBrowser && !process.env.CI)("the listing page's pulse", () => {
  it("draws four tiles on one row at 390 with nothing cut, and says the starting rating is not a review", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(`{ views: 12480, saves: 1999, shares: 1204 }`, `{ rating: 0, reviewCount: 0 }`, `"4 months on Vallo"`),
      css: CSS,
    });
    try {
      const row = page.getByTestId("listing-stats");
      await row.waitFor();
      expect(await row.getAttribute("role")).toBe("group");
      expect(await row.locator("li").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")))).toEqual(["views", "saves", "shares", "rating"]);
      expect(await row.locator(".nf-pulse__figure").allInnerTexts()).toEqual(["12.4k", "1.9k", "1.2k", "2.5"]);
      expect((await row.locator("li .sr-only").allTextContents()).map((x) => x.trim())).toEqual([
        "12,480 views",
        "1,999 saves",
        "1,204 shares",
        "Not yet rated. Every listing starts at 2.5 out of 5 until its first review.",
      ]);
      /* One row, and no figure or word cut. */
      const tops = await row.locator("li").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      const cut = await row.locator(".nf-pulse__figure, .nf-pulse__word").evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
      expect(cut).toBe(0);
      expect(await row.locator('[data-stat="rating"]').getAttribute("data-rated")).toBe("false");
      expect(await row.locator(".nf-stars").getAttribute("data-stars")).toBe("2.5");
      expect(await row.locator(".nf-pulse__foot").innerText()).toMatch(/4 months on Vallo\s*Not yet rated/);
      const numeric = await row.locator(".nf-pulse__figure").first().evaluate((el) => getComputedStyle(el).fontVariantNumeric);
      expect(numeric).toContain("tabular-nums");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("shows a reviewed listing's own average, and only the rating when the figures could not be read", async () => {
    const rated = await mountInBrowser({ entry: entry(`{ views: 340, saves: 18 }`, `{ rating: 4.6, reviewCount: 12 }`, `null`), css: CSS });
    try {
      const row = rated.page.getByTestId("listing-stats");
      await row.waitFor();
      /* Before the shares SQL there is no shares tile: not known is never drawn as zero. */
      expect(await row.locator("li").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")))).toEqual(["views", "saves", "rating"]);
      expect(await row.locator(".nf-pulse__figure").allInnerTexts()).toEqual(["340", "18", "4.6"]);
      expect(await row.locator('[data-stat="rating"] .sr-only').textContent()).toBe("Rated 4.6 out of 5");
      expect(await row.locator(".nf-pulse__foot").count()).toBe(0);
    } finally {
      await rated.close();
    }
    const failed = await mountInBrowser({ entry: entry(`null`, `{}`, `null`), css: CSS });
    try {
      const row = failed.page.getByTestId("listing-stats");
      await row.waitFor();
      expect(await row.locator("li").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")))).toEqual(["rating"]);
      expect(await failed.page.locator("body").innerText()).not.toMatch(/views|saves|shares/);
    } finally {
      await failed.close();
    }
  });
});
