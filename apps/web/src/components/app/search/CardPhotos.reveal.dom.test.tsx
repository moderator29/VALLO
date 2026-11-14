/**
 * THE PHOTOGRAPH SETTLES IN (the founder's brief, section 6; 14 November
 * 2026), in a real browser.
 *
 * What is pinned here is as much what does NOT fade as what does: the eager
 * photograph is the page's largest contentful paint, and an element that
 * starts at zero opacity paints later, so fading it would buy a flourish
 * with the number the platform is judged on.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/list-views.css");
/* The token ladder, which is what collapses under reduced motion. */
const CSS_WITH_TOKENS = productCss("app/css/list-views.css", "../../../packages/design-tokens/src/tokens.css");

/** A one-pixel PNG, so the load event is real and immediate. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const entry = (eager: boolean) => `
  import { mount } from "@/lib/testing/browser-root";
  import { useRef } from "react";
  import { CardPhotos } from "@/components/app/search/CardPhotos";
  function Harness() {
    const track = useRef(null);
    return <CardPhotos photos={["${PIXEL}", "${PIXEL}"]} sizes="100vw" trackRef={track} eager={${eager}} />;
  }
  mount(<Harness />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("a card photograph settling in", () => {
  it("fades a lazy photograph up once it has decoded, and leaves no layout behind", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      const img = page.locator("img[data-reveal]").first();
      await img.waitFor();
      await page.waitForFunction(() => {
        const el = document.querySelector("img[data-reveal]");
        return el instanceof HTMLElement && el.dataset.shown === "true";
      });
      /* Mid-fade it is genuinely part way there (this caught it at 0.52),
         so wait for the transition to settle rather than race it. */
      await page.waitForFunction(() => {
        const el = document.querySelector("img[data-reveal]");
        return el instanceof HTMLElement && parseFloat(getComputedStyle(el).opacity) > 0.99;
      });
      /* Opacity only: the reveal may never move the layout (motion system
         principle 6, and the list's CLS is 0 today). */
      const transition = await img.evaluate((el) => getComputedStyle(el).transitionProperty);
      expect(transition).toBe("opacity");
    } finally {
      await close();
    }
  });

  it("collapses to no fade at all under reduced motion", async () => {
    /* Every duration token is 1ms there (motion system, section 0), so this
       rule needs no branch of its own. Proven rather than assumed. */
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS_WITH_TOKENS, reducedMotion: true });
    try {
      const img = page.locator("img[data-reveal]").first();
      await img.waitFor();
      const seconds = await img.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
      expect(seconds).toBeLessThanOrEqual(0.01);
    } finally {
      await close();
    }
  });

  it("never fades the eager photograph, because it is the largest paint", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS });
    try {
      await page.locator("img").first().waitFor();
      const first = page.locator("img").first();
      expect(await first.getAttribute("data-reveal")).toBeNull();
      /* It is painted at full opacity from the start. */
      expect(await first.evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBe(1);
    } finally {
      await close();
    }
  });
});
