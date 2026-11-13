/**
 * BACK LANDS WHERE YOU LEFT IT, ON ITS FIRST FRAME (Agent FEEL, 13 November
 * 2026). Measured on a production build, going back to /search drew the page
 * one frame at the top (scrollY 0 at 105ms) before it jumped to where it had
 * been left (900 at 121ms). The restore now happens in a layout effect, after
 * the returning page is in the document and before it is painted, and the
 * page being LEFT is never scrolled.
 *
 * The router is a stand-in: a popstate listener that swaps the page, as the
 * app router does on a traversal; `usePathname` is the harness's, which reads
 * `location` on render, so ScrollToTop is rendered inside the page switch.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { useEffect, useState } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { ScrollToTop } from "@/components/site/ScrollToTop";
  function Pages() {
    const [path, setPath] = useState(window.location.pathname);
    useEffect(() => {
      const onPop = () => setPath(window.location.pathname);
      window.addEventListener("popstate", onPop);
      window.__go = (to) => { window.history.pushState({}, "", to); setPath(to); };
      return () => window.removeEventListener("popstate", onPop);
    }, []);
    /* ScrollToTop re-renders with the page, as it does under the real
       router, where usePathname changes in the same commit. */
    return (
      <>
        <ScrollToTop />
        {path === "/search"
          ? <div data-page="search" style={{ height: "6000px" }}>search</div>
          : <div data-page="listing" style={{ height: "3000px" }}>listing</div>}
      </>
    );
  }
  mount(<Pages />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("scroll on back", () => {
  it("draws the returning page in place on its first frame, and never moves the page being left", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, url: "http://vallo.test/search" });
    try {
      /* A person's scroll: a wheel, which is what the store records. */
      await page.mouse.move(195, 400);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 150);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(900);

      await page.evaluate(() => (window as unknown as { __go: (to: string) => void }).__go("/listing/1"));
      await page.waitForFunction(() => document.querySelector('[data-page="listing"]') !== null);
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);

      const frames = await page.evaluate(
        () =>
          new Promise<[string, number][]>((resolve) => {
            const seen: [string, number][] = [];
            const t0 = performance.now();
            const tick = () => {
              const which = document.querySelector("[data-page]")?.getAttribute("data-page") ?? "";
              seen.push([which, Math.round(window.scrollY)]);
              if (performance.now() - t0 > 600) return resolve(seen);
              requestAnimationFrame(tick);
            };
            window.history.back();
            requestAnimationFrame(tick);
          }),
      );
      /* Every frame that shows the search page shows it where it was left. */
      const searchFrames = frames.filter(([which]) => which === "search");
      expect(searchFrames.length).toBeGreaterThan(0);
      expect(searchFrames.every(([, y]) => y === 900)).toBe(true);
      /* The listing being left is never scrolled on its way out. */
      expect(frames.filter(([which]) => which === "listing").every(([, y]) => y === 0)).toBe(true);
    } finally {
      await close();
    }
  });

  it("lands a new page (a push) at the top", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, url: "http://vallo.test/search" });
    try {
      await page.mouse.move(195, 400);
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 150);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(600);
      await page.evaluate(() => (window as unknown as { __go: (to: string) => void }).__go("/listing/2"));
      await page.waitForFunction(() => document.querySelector('[data-page="listing"]') !== null);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    } finally {
      await close();
    }
  });
});
