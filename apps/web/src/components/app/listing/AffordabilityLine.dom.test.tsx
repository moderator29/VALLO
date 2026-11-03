/**
 * The income line, mounted for real in Chromium in both themes with axe
 * (backlog row 26): it draws the field and a note and no figures until an
 * income is typed; then two plain sentences, a percent and months, with no
 * verdict; the income survives a remount (it stays on the device); and a
 * rent of nothing draws nothing.
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

const entry = (theme: "dark" | "light", rent: number) => `
  import { getDictionary } from "@vallo/i18n";
  import { AffordabilityLine } from "@/components/app/listing/AffordabilityLine";
  import { mount } from "@/lib/testing/browser-root";
  document.documentElement.dataset.theme = "${theme}";
  mount(<div style={{ maxWidth: 420, padding: 16 }}><AffordabilityLine rentMinor={${rent}} period="year" moveInMinor={500000000} copy={getDictionary("en").catalogue.affordability} locale="en" /></div>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("AffordabilityLine", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`states the share and the months once an income is typed, with no verdict, and passes axe (${theme})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(theme, 360_000_000), css: PORTED_CSS });
      try {
        const box = page.getByTestId("detail-affordability");
        await box.waitFor();
        expect(await page.getByTestId("affordability-result").count()).toBe(0);
        expect(await box.innerText()).toMatch(/Arithmetic only/);

        await page.getByTestId("affordability-income").fill("1000000");
        const result = await page.getByTestId("affordability-result").innerText();
        expect(result).toMatch(/rent is about 30% of one month/);
        expect(result).toMatch(/move-in total is about 5 months/);
        expect(result).not.toMatch(/afford|too|cannot|can /i);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });
  }

  it("keeps the income on the device and draws nothing without a rent", async () => {
    const a = await mountInBrowser({ entry: entry("dark", 360_000_000), css: PORTED_CSS });
    try {
      await a.page.getByTestId("affordability-income").fill("2000000");
      await a.page.getByTestId("affordability-result").waitFor();
      /* Kept on the device under one local key, as plain digits. */
      expect(await a.page.evaluate(() => window.localStorage.getItem("vallo.income.v1"))).toBe("2000000");
      expect(await a.page.getByTestId("affordability-income").inputValue()).toMatch(/2,000,000/);
    } finally {
      await a.close();
    }
    const b = await mountInBrowser({ entry: entry("dark", 0), css: PORTED_CSS });
    try {
      await b.page.waitForTimeout(300);
      expect(await b.page.getByTestId("detail-affordability").count()).toBe(0);
    } finally {
      await b.close();
    }
  });
});
