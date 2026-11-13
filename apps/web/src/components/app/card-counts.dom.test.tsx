/**
 * THE CARD'S COUNT LINE (listing stats, founder, 13 November 2026), on the
 * real search card at 390 in Chromium: "1.2k views  24 saves" under the facts
 * as its own quiet line; the facts row keeps the height it had without it (it
 * never wraps the facts); views below ten and a zero draw nothing; an example
 * draws nothing whatever its figures; a compact figure keeps its whole number
 * for a screen reader.
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
      {card("counts", { ...REAL, stats: { views: 1234, saves: 24 } })}
      {card("plain", REAL)}
      {card("few", { ...REAL, stats: { views: 9, saves: 0 } })}
      {card("saves", { ...REAL, stats: { views: 9, saves: 1 } })}
      {card("demo", { ...REAL, isDemo: true, stats: { views: 1234, saves: 24 } })}
      <div id="home"><HomeListingCard listing={{ ...REAL, stats: { views: 40, saves: 2 } }} locale="en" copy={homeCardCopyOf(t)} layout="card" /></div>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the count line on a card", () => {
  it("draws the counts under the facts without moving them, and nothing where nothing is honest", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: productCss("app/css/base.css", "app/css/catalogue.css", "app/css/space-card.css"),
    });
    try {
      const counts = (id: string) => page.locator(`#${id} [data-testid="card-counts"]`);
      await counts("counts").waitFor();
      expect(await counts("counts").locator("[data-stat]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stat")))).toEqual(["views", "saves"]);
      const visible = (id: string) => page.locator(`#${id} [data-testid="card-counts"] [data-stat] > span:not(.sr-only)`).allInnerTexts();
      expect(await visible("counts")).toEqual(["1.2k views", "24 saves"]);
      expect(await counts("counts").locator(".sr-only").allTextContents()).toEqual(["1,234 views"]);
      expect(await counts("plain").count()).toBe(0);
      expect(await counts("few").count()).toBe(0);
      expect(await counts("saves").innerText()).toBe("1 save");
      expect(await counts("demo").count()).toBe(0);
      expect(await visible("home")).toEqual(["40 views", "2 saves"]);

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
