/**
 * THE CARD'S SIGNAL LINE (founder, 14 November 2026), on the real search card
 * at 390 in Chromium: the rating in its capsule, then views and saves as bare
 * figures, under the facts as its own quiet line; the facts row keeps the
 * height it had (the line never wraps the facts). A reviewed listing shows
 * its average and review count; one nobody has reviewed shows the 2.5 every
 * listing starts at with "New", and a screen reader is told it is not yet
 * rated. Views and saves show from the first, never a zero; an example shows
 * its counts like any other; a compact figure is read out whole.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ListingCard } from "@/components/app/ListingCard";
  import { HomeListingCard } from "@/components/app/home/HomeListingCard";
  import { homeCardCopyOf } from "@/components/app/home/home-card-copy";
  import { RENTAL } from "@/app/(dev)/preview/f3/fixtures";
  import { forListingCard } from "@/lib/i18n/slice";
  const t = getDictionary("en");
  const cardCopy = forListingCard(t);
  const REAL = { ...RENTAL, isDemo: false };
  const card = (id, listing, extra = {}) => <div id={id}><ListingCard listing={listing} locale="en" t={cardCopy} layout="row" brief {...extra} /></div>;
  mount(
    <div style={{ width: 358 }}>
      {card("counts", { ...REAL, rating: 4.6, reviewCount: 12, stats: { views: 1234, saves: 24 } })}
      {card("plain", REAL)}
      {card("zero", { ...REAL, stats: { views: 0, saves: 0 } })}
      {card("saves", { ...REAL, stats: { views: 0, saves: 1 } })}
      {card("demo", { ...REAL, isDemo: true, stats: { views: 3, saves: 0 } })}
      <div id="home"><HomeListingCard listing={{ ...REAL, stats: { views: 40, saves: 2 } }} locale="en" copy={homeCardCopyOf(t)} layout="card" /></div>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the signal line on a card", () => {
  it("draws the rating and the counts under the facts without moving them, and never a zero", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: productCss("app/css/base.css", "app/css/symbols.css", "app/css/controls.css", "app/css/catalogue.css", "app/css/space-card.css"),
    });
    try {
      const counts = (id: string) => page.locator(`#${id} [data-testid="card-counts"]`);
      await counts("counts").waitFor();
      const keys = (id: string) => counts(id).locator("[data-stat]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")));
      const seen = (id: string) => counts(id).locator('span[aria-hidden="true"]:not(.nf-stars)').allInnerTexts();
      const heard = (id: string) => counts(id).locator(".sr-only").allTextContents();
      const stars = (id: string) => counts(id).locator(".nf-stars").getAttribute("data-stars");

      /* Reviewed: its own average, how many reviews, then the counts. */
      expect(await keys("counts")).toEqual(["rating", "views", "saves"]);
      expect(await seen("counts")).toEqual(["4.6", "(12)", "1.2k", "24"]);
      expect((await heard("counts")).map((x) => x.trim())).toEqual(["Rated 4.6 out of 5, 12 reviews.", "1,234 views.", "24 saves."]);
      expect(await stars("counts")).toBe("4.5");
      expect(await counts("counts").locator('[data-stat="rating"]').getAttribute("data-rated")).toBe("true");

      /* Nobody has reviewed it: the 2.5 every listing starts at, said to be so. */
      expect(await keys("plain")).toEqual(["rating"]);
      expect(await seen("plain")).toEqual(["2.5", "New"]);
      expect((await heard("plain"))[0]).toContain("Not yet rated");
      expect(await stars("plain")).toBe("2.5");
      expect(await counts("plain").locator('[data-stat="rating"]').getAttribute("data-rated")).toBe("false");
      /* The lit part of the stars is exactly half the rail. */
      const lit = await counts("plain").locator(".nf-stars").evaluate((el) => {
        const all = el.getBoundingClientRect().width;
        return Math.round((parseFloat(getComputedStyle(el, "::after").width) / all) * 100);
      });
      expect(lit).toBe(50);

      /* Never a zero; saves from the first; an example like any other. */
      expect(await keys("zero")).toEqual(["rating"]);
      expect(await keys("saves")).toEqual(["rating", "saves"]);
      expect(await keys("demo")).toEqual(["rating", "views"]);
      expect(await seen("demo")).toEqual(["2.5", "New", "3"]);
      expect(await seen("home")).toEqual(["2.5", "New", "40", "2"]);
      /* One line at 390, on both cards. */
      for (const id of ["counts", "home"]) {
        expect(await counts(id).evaluate((el) => el.getBoundingClientRect().height), id).toBeLessThan(30);
      }

      /* The facts row is the same height with the counts as without them. */
      const factsHeight = (id: string) => page.locator(`#${id} [data-testid="card-facts"]`).evaluate((el) => el.getBoundingClientRect().height);
      expect(await factsHeight("counts")).toBe(await factsHeight("plain"));
      /* The line sits below the facts, not beside them. */
      const factsBottom = await page.locator('#counts [data-testid="card-facts"]').evaluate((el) => el.getBoundingClientRect().bottom);
      const countsTop = await counts("counts").evaluate((el) => el.getBoundingClientRect().top);
      expect(countsTop).toBeGreaterThanOrEqual(factsBottom - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
