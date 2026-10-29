/**
 * The QR row in the listing's share sheet (backlog row 13), mounted for real
 * in Chromium in both themes with axe: hidden until asked, the door is minted
 * only when the panel opens, the code is an SVG named for the place and drawn
 * locally, a failed door says so in words, and a sheet without a door offers
 * no QR row at all.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { PORTED_CSS, axeViolations } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (theme: "dark" | "light", door: string, withQr = true) => `
  import { getDictionary } from "@vallo/i18n";
  import { ShareSheet } from "@/components/app/messages/ShareSheet";
  import { mount } from "@/lib/testing/browser-root";
  document.documentElement.dataset.theme = "${theme}";
  window.__doorCalls = 0;
  const qr = ${withQr} ? { copy: getDictionary("en").frontDoor.shareQr, door: () => { window.__doorCalls += 1; return ${door}; } } : undefined;
  mount(<ShareSheet open onOpenChange={() => {}} kind="listing" id="00000000-0000-4000-8000-000000000001" title="Two bedroom flat" onShareElsewhere={() => {}} qr={qr} />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("ShareSheet QR row", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`draws a QR code from the door when asked, and passes axe (${theme})`, async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(theme, `Promise.resolve("https://example.test/s/abc123")`),
        css: PORTED_CSS,
      });
      try {
        const toggle = page.getByTestId("share-qr-toggle");
        await toggle.waitFor();
        expect(await page.evaluate(() => (window as unknown as { __doorCalls: number }).__doorCalls)).toBe(0);
        expect(await toggle.getAttribute("aria-expanded")).toBe("false");

        await toggle.click();
        await page.getByRole("img", { name: "QR code for this place" }).waitFor();
        expect(await toggle.getAttribute("aria-expanded")).toBe("true");
        expect(await page.getByTestId("share-qr").innerText()).toMatch(/flyer or a board/);
        expect(await page.evaluate(() => (window as unknown as { __doorCalls: number }).__doorCalls)).toBe(1);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });
  }

  it("says so when the door cannot be made, and has no QR row without a door", async () => {
    const a = await mountInBrowser({ entry: entry("dark", `Promise.resolve(null)`), css: PORTED_CSS });
    try {
      await a.page.getByTestId("share-qr-toggle").click();
      await a.page.getByRole("alert").waitFor();
      expect(await a.page.getByRole("alert").innerText()).toMatch(/Could not make the QR code/);
      expect(await a.page.getByRole("img", { name: "QR code for this place" }).count()).toBe(0);
    } finally {
      await a.close();
    }
    const b = await mountInBrowser({ entry: entry("dark", `Promise.resolve(null)`, false), css: PORTED_CSS });
    try {
      await b.page.getByText("Two bedroom flat").waitFor();
      expect(await b.page.getByTestId("share-qr-toggle").count()).toBe(0);
    } finally {
      await b.close();
    }
  });
});
