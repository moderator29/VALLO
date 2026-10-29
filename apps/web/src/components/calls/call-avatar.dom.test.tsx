/**
 * THE CALL AVATAR IN CHROMIUM (29 October 2026): the caller's profile photo
 * covers the initial when there is one, and a photo that fails to load leaves
 * the initial showing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/calls.css");

const entry = (photo: string | null) => `
  import { mount } from "@/lib/testing/browser-root";
  import { CallAvatar } from "@/components/calls/views";
  mount(<div data-testid="host"><CallAvatar name="Ada Eze" photo=${photo ? `"${photo}"` : "{null}"} ringing /></div>);
`;

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

describe.skipIf(!hasBrowser)("the call avatar", () => {
  it("shows the initial alone with no photo", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(null), css: CSS });
    try {
      await page.getByTestId("host").waitFor();
      expect(await page.locator("img.nf-call__avatar-img").count()).toBe(0);
      expect(await page.locator(".nf-call__avatar").textContent()).toBe("A");
    } finally {
      await close();
    }
  });

  it("draws the photo over the initial, filling the circle", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(PIXEL), css: CSS });
    try {
      const img = page.locator("img.nf-call__avatar-img");
      await img.waitFor();
      const [avatar, photo] = await Promise.all([page.locator(".nf-call__avatar").boundingBox(), img.boundingBox()]);
      expect(Math.round(photo!.width)).toBe(Math.round(avatar!.width));
      expect(Math.round(photo!.height)).toBe(Math.round(avatar!.height));
    } finally {
      await close();
    }
  });

  it("drops a photo that fails to load and keeps the initial", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("data:image/png;base64,AAAA"), css: CSS });
    try {
      await page.getByTestId("host").waitFor();
      await page.waitForFunction(() => document.querySelectorAll("img.nf-call__avatar-img").length === 0);
      expect(await page.locator(".nf-call__avatar").textContent()).toBe("A");
    } finally {
      await close();
    }
  });
});
