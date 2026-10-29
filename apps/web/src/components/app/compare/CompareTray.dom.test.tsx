/**
 * The compare tray and its toggle, mounted for real in Chromium in both
 * themes with axe (backlog row 7): nothing until a place is set aside, one
 * place asks for another, two open the compare page with both ids in the
 * address, the toggles are pressable and say their state, a fifth is refused,
 * and Clear empties it.
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

const IDS = [1, 2, 3, 4, 5].map((n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`);

const entry = (theme: "dark" | "light") => `
  import { CompareTray } from "@/components/app/compare/CompareTray";
  import { CompareToggle } from "@/components/app/compare/CompareToggle";
  import { mount } from "@/lib/testing/browser-root";
  document.documentElement.dataset.theme = "${theme}";
  const ids = ${JSON.stringify(IDS)};
  mount(<div style={{ padding: 16 }}>{ids.map((id, i) => <span key={id} data-n={i}><CompareToggle listingId={id} /></span>)}<CompareTray /></div>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("CompareTray", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`fills as places are set aside, opens the page, refuses a fifth, clears, and passes axe (${theme})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(theme), css: PORTED_CSS });
      try {
        const toggles = page.getByTestId("listing-compare");
        await toggles.first().waitFor();
        expect(await page.getByTestId("compare-tray").count()).toBe(0);

        await toggles.nth(0).click();
        expect(await toggles.nth(0).getAttribute("aria-pressed")).toBe("true");
        const one = await page.getByTestId("compare-tray").innerText();
        expect(one).toMatch(/1 to compare/);
        expect(one).toMatch(/Add another/);
        expect(await page.getByTestId("compare-tray-open").count()).toBe(0);

        await toggles.nth(1).click();
        expect(await page.getByTestId("compare-tray").innerText()).toMatch(/2 to compare/);
        expect(await page.getByTestId("compare-tray-open").getAttribute("href")).toBe(`/compare?ids=${IDS[0]},${IDS[1]}`);
        expect(await axeViolations(page)).toEqual([]);

        await toggles.nth(2).click();
        await toggles.nth(3).click();
        await toggles.nth(4).click();
        expect(await page.getByTestId("compare-tray").innerText()).toMatch(/4 to compare/);
        expect(await toggles.nth(4).getAttribute("aria-pressed")).toBe("false");

        await toggles.nth(1).click();
        expect(await page.getByTestId("compare-tray").innerText()).toMatch(/3 to compare/);
        expect(await toggles.nth(1).getAttribute("aria-pressed")).toBe("false");

        await page.getByTestId("compare-tray-clear").click();
        expect(await page.getByTestId("compare-tray").count()).toBe(0);
        expect(await toggles.nth(0).getAttribute("aria-pressed")).toBe("false");
      } finally {
        await close();
      }
    });
  }
});
