/**
 * NOTHING SITS BETWEEN A CONTROL AND THE KEYS (founder, 14 November 2026,
 * handoff 6.4 items 3 and 4), measured in a real browser rather than read
 * off the stylesheet.
 *
 * With the keyboard up, `env(safe-area-inset-bottom)` still describes the
 * home indicator at the bottom of the DEVICE, and the bottom of the web view
 * is now the top of the keyboard, where no home indicator exists. Left in,
 * it is dead air between the composer (or a sheet's button) and the keys.
 *
 * WHAT THIS CANNOT SEE. A real phone keyboard cannot be opened here, so the
 * marker `lib/native/keyboard.ts` sets on the root is set by hand. What only
 * a device shows is the keyboard arriving, the web view resizing under it,
 * and the composer landing on the keys.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css", "app/css/overlays.css");

const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <>
      <form className="nf-composer"><div className="nf-composer__box" /></form>
      <div className="nf-sheet" data-open="true" />
    </>,
  );
`;

async function bottomPadding(page: import("playwright-core").Page, selector: string) {
  return page.evaluate(
    (sel) => parseFloat(getComputedStyle(document.querySelector(sel) as HTMLElement).paddingBottom),
    selector,
  );
}

describe.skipIf(!hasBrowser && !process.env.CI)("the keyboard and the bottom of the screen", () => {
  it("drops the stale home-indicator reservation under the composer and a sheet", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      /* A device with a home indicator, keyboard down. */
      await page.addStyleTag({ content: ":root { --nf-fake-safe: 34px; }" });
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--nf-space-xs", "8px");
        document.documentElement.style.setProperty("--nf-space-0", "0px");
      });
      const closedComposer = await bottomPadding(page, ".nf-composer");

      /* The keyboard arrives: `lib/native/keyboard.ts` marks the root. */
      await page.evaluate(() => {
        document.documentElement.dataset.keyboard = "open";
      });
      const openComposer = await bottomPadding(page, ".nf-composer");
      const openSheet = await bottomPadding(page, ".nf-sheet");

      /* The composer's reservation becomes the plain gap, and the sheet's
         goes entirely: nothing is left between a control and the keys. */
      expect(openComposer).toBeLessThanOrEqual(closedComposer);
      expect(openComposer).toBe(8);
      expect(openSheet).toBe(0);

      /* And it comes back when the keyboard goes. */
      await page.evaluate(() => {
        delete document.documentElement.dataset.keyboard;
      });
      expect(await bottomPadding(page, ".nf-composer")).toBe(closedComposer);
    } finally {
      await close();
    }
  });
});
