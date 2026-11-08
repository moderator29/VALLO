/**
 * Listing Health, mounted for real in Chromium from `health-model` fixtures
 * (the page itself needs a database; what it draws does not).
 *
 * Proves, in both themes and with axe: the six explanations always render in
 * the register's order with a chip that carries a word; the summary is a
 * sentence and never a score; a dated fact prints its date; recommendations
 * appear only when a rule fired and each carries its one control; a listing
 * with nothing missing says so and offers nothing to do; and the "still
 * available" button calls the existing action and says the result in words.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const CSS_DIR = join(__dirname, "..", "..", "..", "app", "css");
/* The rows' and chips' own sheets, and `light.css`, which globals.css loads
   after them and which gives every badge its paper ink in the light theme:
   without it the light run would be measuring a badge no member sees. */
const CSS = [PORTED_CSS, ...["list-group.css", "chips.css", "light.css"].map((f) => readFileSync(join(CSS_DIR, f), "utf8"))].join("\n");

/*
 * Structural fixtures. The listing id is a fixed uuid; the dates are fixed;
 * nothing names a real place or person. `needs` builds a listing the rules
 * fire on (few photos, short description, no authority date, a stale
 * confirmation, a funnel fix); `whole` builds one they do not.
 */
const entry = (theme: "dark" | "light", kind: "needs" | "whole") => `
  import { getDictionary } from "@vallo/i18n";
  import { HealthReport } from "@/components/agent/intel/HealthReport";
  import { listingHealth } from "@/components/agent/intel/health-model";
  import { MIN_DESCRIPTION_WORDS, MIN_PHOTOS } from "@/lib/agent/listings-model";
  import { mount } from "@/lib/testing/browser-root";
  document.documentElement.dataset.theme = "${theme}";
  const NOW = Date.parse("2026-10-06T12:00:00Z");
  const DAY = 86400000;
  const words = (n) => Array.from({ length: n }, () => "room").join(" ");
  const needs = ${kind === "needs"};
  const health = listingHealth({
    gate: {
      title: "Fixture listing title", description: words(needs ? 12 : MIN_DESCRIPTION_WORDS),
      propertyType: "apartment", stateCode: "LA", city: "City", area: "Area", intent: "rent",
      rentMinor: 100000, rentPeriod: "year", rateMinor: 0, ratePeriod: null, salePriceMinor: null, tenure: null,
      bedrooms: 1, bathrooms: 1, amenityCount: needs ? 0 : 2, photoCount: needs ? 1 : MIN_PHOTOS + 1, hasCover: true,
    },
    status: "PUBLISHED",
    listingRole: "agent",
    inspectedAt: needs ? null : "2026-09-01T10:00:00Z",
    addressCheckedAt: needs ? null : "2026-08-20T10:00:00Z",
    ownershipVerifiedAt: null,
    mandateVerifiedAt: needs ? null : "2026-08-01T10:00:00Z",
    publishedAt: new Date(NOW - 40 * DAY).toISOString(),
    listerConfirmedAt: new Date(NOW - (needs ? 20 : 2) * DAY).toISOString(),
    fix: needs ? { key: "no-viewing", values: { enquired: 3 } } : null,
    now: NOW,
  });
  import { ToastHost } from "@/components/ui/ToastHost";
  /* "Confirmed" is said by the one top banner (founder, 7 November 2026). */
  mount(<div style={{ maxWidth: 640, padding: 16 }}><HealthReport health={health} listingId="00000000-0000-4000-8000-000000000001" t={getDictionary("en")} locale="en" /><ToastHost /></div>);
`;

const ROWS = ["floorPlan", "amenities", "inspection", "photos", "availability", "verification"];

describe.skipIf(!hasBrowser && !process.env.CI)("HealthReport", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`draws a listing the rules fire on, and passes axe (${theme})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(theme, "needs"), css: CSS });
      try {
        await page.getByTestId("health-summary").waitFor();
        const order = await page.locator("[data-testid^='health-row-']").evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-testid")!.replace("health-row-", "")),
        );
        expect(order).toEqual(ROWS);
        /* A sentence, never a score: no figure out of a hundred, no percent. */
        const summary = await page.getByTestId("health-summary").innerText();
        expect(summary).toMatch(/things to add/);
        expect(summary).not.toMatch(/%|\/\s*100/);
        /* Every chip carries a word, so state is never colour alone. */
        expect(await page.getByTestId("health-row-floorPlan").innerText()).toMatch(/Not held/);
        expect(await page.getByTestId("health-row-photos").innerText()).toMatch(/Missing/);
        for (const rec of ["photos", "verification", "description", "availability", "amenities", "funnel"]) {
          expect(await page.getByTestId(`health-rec-${rec}`).count()).toBe(1);
        }
        expect(await page.getByTestId("health-rec-verification").locator("a").getAttribute("href")).toBe(
          "/agent/listings/00000000-0000-4000-8000-000000000001/mandate",
        );
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });

    it(`says a whole listing is in place, dates its facts, and offers nothing to do (${theme})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(theme, "whole"), css: CSS });
      try {
        await page.getByTestId("health-summary").waitFor();
        expect(await page.getByTestId("health-summary").innerText()).toMatch(/in place/);
        expect(await page.locator("[data-testid^='health-rec-']").count()).toBe(0);
        /* A fact is a date, never a tick. */
        expect(await page.getByTestId("health-row-inspection").innerText()).toMatch(/1 Sept? 2026/);
        expect(await page.getByTestId("health-row-verification").innerText()).toMatch(/Address checked/);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    });
  }

  it("confirms availability through the existing action and says so in words", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry("dark", "needs"),
      css: CSS,
      actions: { confirmListingsAvailable: "async () => ({ ok: true, data: { confirmed: 1 } })" },
    });
    try {
      await page.getByTestId("health-confirm-available").click();
      await page.getByText("Confirmed. Renters see it is current.").waitFor();
      expect(await page.evaluate(() => (window as unknown as { __router: { calls: unknown[][] } }).__router.calls)).toContainEqual(["refresh"]);
    } finally {
      await close();
    }
  });
});
