/**
 * THE DOCUMENTATION TOOLS, mounted in Chromium at 360px: the flow is an
 * ordered list whose step names are the links, the fee calculator's figures
 * come out of the rates it is handed and update as the reader types, and axe
 * finds nothing. The rates below exist only for the arithmetic: the page
 * itself never holds one (`app/(site)/docs/fee-calculator/config.ts` reads them).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/docs-kit.css", "app/css/chips.css");

const entry = `
  import { DocFlow } from "@/components/docs/DocFlow";
  import { FeeCalculator } from "@/app/(site)/docs/fee-calculator/FeeCalculator";
  import { mount } from "@/lib/testing/browser-root";
  const policy = { rateVersion: "t", valloBps: 200, escrowProtectionBps: 200, directProcessorFeeCapMinor: 200000, capMinor: null };
  mount(
    <main style={{ width: 360, padding: 16 }}>
      <DocFlow label="Booking a stay" end="The end line."
        steps={[
          { icon: "calendar-booking", title: "Pick your dates", href: "/stays", outcome: "Every price becomes the total." },
          { icon: "credit-card", title: "Pay by card", outcome: "Split when it is paid." },
        ]} />
      <FeeCalculator config={{ stay: { policy, processorKnown: true }, hotel: null, restaurant: { seatedFeeMinor: 100000 } }} />
    </main>
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the documentation tools", () => {
  it("draws the flow as an ordered list whose step name is the link", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.locator("ol.nf-doc-flow__list > li").count()).toBe(2);
      expect(await page.getByRole("link", { name: /Pick your dates/ }).getAttribute("href")).toBe("/stays");
      expect(await page.locator(".nf-doc-flow__end").textContent()).toContain("The end line.");
    } finally {
      await close();
    }
  });

  it("works a stay out from the rates it is handed, says when a part is unreadable, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.getByLabel("Nightly price you set").fill("50,000");
      await page.getByLabel("Nights").fill("2");
      const table = page.getByRole("table");
      await expect.poll(() => table.count()).toBe(1);
      expect(await table.textContent()).toContain("2,000");
      await page.getByRole("button", { name: "A hotel room" }).click();
      expect(await page.getByText("We cannot show your fee figures just now").count()).toBe(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
