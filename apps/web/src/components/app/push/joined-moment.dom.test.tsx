import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

declare global {
  interface Window {
    /** What `onSettled` reported, written by the mounted entry. */
    __settled: string | null;
  }
}

/**
 * THE NOTIFICATIONS STEP OF FIRST RUN (the founder, 7 November 2026).
 * `FirstRun` ends on `<PushPrompt moment="joined">`: these prove the two
 * behaviours that beat depends on, on the paths a real device takes.
 */
describe.skipIf(!hasBrowser && !process.env.CI)("the joined moment", () => {
  it("shows the offer and Not now settles as declined", async () => {
    const entry = `
      import { PushPrompt } from "@/components/app/push/PushPrompt";
      import { mount } from "@/lib/testing/browser-root";
      /* The shell's bridge, injected: currentPermission then answers "default"
         exactly as a fresh iPhone install does, so the card must show. */
      (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
      (window as any).__settled = null;
      mount(<PushPrompt moment="joined" onSettled={(o) => { (window as any).__settled = o; }} />);
    `;
    const { page, close } = await mountInBrowser({ entry });
    try {
      await page.getByText("Booking answers, messages and your money, as they happen.").waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "Not now" }).click();
      await page.waitForFunction(() => window.__settled === "declined");
      expect(await page.evaluate(() => window.__settled)).toBe("declined");
    } finally { await close(); }
  });

  it("settles itself at once where push is unsupported, so the step never traps", async () => {
    const entry = `
      import { PushPrompt } from "@/components/app/push/PushPrompt";
      import { mount } from "@/lib/testing/browser-root";
      (window as any).__settled = null;
      mount(<PushPrompt moment="joined" onSettled={(o) => { (window as any).__settled = o; }} />);
    `;
    const { page, close } = await mountInBrowser({ entry });
    try {
      await page.waitForFunction(() => window.__settled !== null);
      const settled = await page.evaluate(() => window.__settled);
      expect(["unavailable", "allowed"]).toContain(settled);
      expect(await page.locator("[data-push-prompt]").count()).toBe(0);
    } finally { await close(); }
  });
});
