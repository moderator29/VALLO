/**
 * The completeness meter on a listing card, mounted for real in Chromium in
 * both themes with axe. Steps done out of steps, never a score or a percent;
 * the next step is one link into the wizard for an editable listing and plain
 * text for one that is not; a whole listing says so and offers nothing.
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

const entry = (theme: "dark" | "light", done: number, editable: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { ListingMeter } from "@/components/agent/ListingMeter";
  import { mount } from "@/lib/testing/browser-root";
  document.documentElement.dataset.theme = "${theme}";
  const steps = ["details", "price", "description", "photos", "amenities", "video", "utilities", "landmark"];
  const flags = Object.fromEntries(steps.map((s, i) => [s, i < ${done}]));
  const completeness = { done: ${done}, total: 8, steps: flags, next: steps[${done}] ?? null, readyForReview: ${done} >= 5 };
  mount(<div style={{ maxWidth: 360, padding: 16 }}><ListingMeter completeness={completeness} listingId="00000000-0000-4000-8000-000000000001" editable={${editable}} copy={getDictionary("en").agentListings.workspace.completeness} locale="en" /></div>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("ListingMeter", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`shows steps done, links the next step, and passes axe (${theme})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(theme, 5, true), css: PORTED_CSS });
      try {
        await page.getByTestId("listing-meter").waitFor();
        const text = await page.getByTestId("listing-meter").innerText();
        expect(text).toMatch(/5 of 8 done/);
        expect(text).not.toMatch(/%|score/i);
        expect(await page.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("5");
        expect(await page.getByTestId("listing-meter-next").getAttribute("href")).toBe(
          "/agent/list?id=00000000-0000-4000-8000-000000000001",
        );
        expect(await page.getByTestId("listing-meter-next").innerText()).toMatch(/walkthrough video/);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });
  }

  it("is plain text when the listing cannot be edited, and says all done at 8 of 8", async () => {
    const a = await mountInBrowser({ entry: entry("dark", 3, false), css: PORTED_CSS });
    try {
      await a.page.getByTestId("listing-meter").waitFor();
      expect(await a.page.getByTestId("listing-meter-next").count()).toBe(0);
      expect(await a.page.getByTestId("listing-meter").innerText()).toMatch(/Next: add photos/);
    } finally {
      await a.close();
    }
    const b = await mountInBrowser({ entry: entry("light", 8, true), css: PORTED_CSS });
    try {
      await b.page.getByTestId("listing-meter").waitFor();
      expect(await b.page.getByTestId("listing-meter").innerText()).toMatch(/Everything in place/);
      expect(await b.page.getByTestId("listing-meter-next").count()).toBe(0);
    } finally {
      await b.close();
    }
  });
});
