/**
 * THE QUICK PILL, drawn for real in Chromium (founder, 14 November 2026:
 * "built clean sharp and goes back by itself within 0.4 seconds").
 *
 * What a unit test of the store cannot say: that the host draws it at the
 * bottom centre, politely, with no button inside it; that it is gone by itself
 * after its hold; that the top banner is a different place; and that a reader
 * who asked for less motion gets no slide.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/grade1.css");

const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { banner } from "@/lib/ui/toast";
  window.__banner = banner;
  mount(<><main><button type="button" data-testid="copy" onClick={() => banner.quick("Message copied")}>Copy</button></main><ToastHost /></>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the quick pill in the host", () => {
  it("is a polite status at the bottom centre with a tick, its words and nothing to press", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      await page.locator("[data-testid=copy]").click();
      const pill = page.locator("[data-testid=quick-pill]");
      await pill.waitFor();
      expect(await pill.getAttribute("role")).toBe("status");
      expect(await pill.textContent()).toBe("Message copied");
      expect(await pill.locator("button, a, [role=button]").count()).toBe(0);
      expect(await pill.locator("svg").count()).toBe(1);
      expect(await pill.evaluate((node) => node.closest("[aria-live]")?.getAttribute("aria-live"))).toBe("polite");
      /* Never an alert, and never the top banner. */
      expect(await page.getByRole("alert").count()).toBe(0);
      expect(await page.locator(".nf-toast").count()).toBe(0);
      await page.waitForTimeout(260);
      const box = await pill.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { centre: r.left + r.width / 2, bottom: r.bottom, top: r.top, width: innerWidth, height: innerHeight, radius: getComputedStyle(node).borderTopLeftRadius };
      });
      expect(Math.abs(box.centre - box.width / 2)).toBeLessThanOrEqual(1);
      expect(box.top).toBeGreaterThan(box.height / 2);
      expect(box.bottom).toBeLessThan(box.height);
      /* It does not take a tap from what is under it. */
      expect(await page.locator(".nf-quick-host").evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
    } finally {
      await close();
    }
  });

  it("goes by itself after its hold, and an error at the top stays where it is", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      await page.evaluate(() => (window as unknown as { __banner: { error: (m: string) => void } }).__banner.error("Could not send"));
      await page.locator("[data-testid=copy]").click();
      const pill = page.locator("[data-testid=quick-pill]");
      await pill.waitFor();
      const shown = Date.now();
      await pill.waitFor({ state: "detached", timeout: 4000 });
      const life = Date.now() - shown;
      /* Held about 1.4 s and out in 0.4 s: about 1.8 s on screen, never 4. */
      expect(life).toBeGreaterThan(1300);
      expect(life).toBeLessThan(2600);
      expect(await page.getByRole("alert").textContent()).toContain("Could not send");
    } finally {
      await close();
    }
  });

  it("restarts for the same words without drawing a second pill", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      const copy = page.locator("[data-testid=copy]");
      await copy.click();
      await page.waitForTimeout(900);
      await copy.click();
      await page.waitForTimeout(900);
      /* 1.8 s after the first tap it is still up, because the second restarted it. */
      expect(await page.locator(".nf-quick").count()).toBe(1);
      expect(await page.locator(".nf-quick[data-leaving]").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("does not slide for a reader who asked for less motion", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator("[data-testid=copy]").click();
      const pill = page.locator("[data-testid=quick-pill]");
      await pill.waitFor();
      const style = await pill.evaluate((node) => {
        const s = getComputedStyle(node);
        return { animation: s.animationName, transform: s.transform, opacity: s.opacity };
      });
      expect(style.animation).toBe("none");
      expect(style.transform).toBe("none");
      expect(style.opacity).toBe("1");
    } finally {
      await close();
    }
  });
});
