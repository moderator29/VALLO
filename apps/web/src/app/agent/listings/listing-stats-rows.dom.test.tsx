/**
 * THE LISTER'S OWN FIGURES ON /agent/listings (listing stats, founder,
 * 13 November 2026), mounted in Chromium with the f5 workspace fixture: a
 * listing that has been live shows its days live, views and saves; one that
 * never went live shows none; with no figures (the read failed, or the SQL is
 * not applied) no row shows any.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (stats: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { ListingsWorkspace } from "@/app/agent/listings/ListingsWorkspace";
  import { AGENT_LISTINGS } from "@/app/(dev)/preview/f5/ops-fixtures";
  const t = getDictionary("en");
  const at = Date.parse("2026-11-13T10:00:00+01:00");
  const rows = AGENT_LISTINGS.map((row, i) => i === 0
    ? { ...row, status: "PUBLISHED", publishedAt: new Date(at - 9 * 86400000).toISOString() }
    : { ...row, publishedAt: null });
  const stats = ${stats};
  mount(<main><ListingsWorkspace t={t.agentListings} reference={t.listingReference} listings={rows} locale="en" stats={stats} statsAt={at} /></main>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the lister's own figures", () => {
  it("shows days live, views and saves on a listing that has been live, and nothing on the rest", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(`Object.fromEntries(AGENT_LISTINGS.map((r) => [r.id, { views: 1500, saves: 3 }]))`),
      css: productCss("app/css/base.css", "app/css/controls.css"),
    });
    try {
      const rows = page.getByTestId("listing-stats");
      await rows.first().waitFor();
      expect(await rows.count()).toBe(1);
      expect(await rows.first().getAttribute("aria-label")).toBe("Views, saves and time live for this listing");
      expect(await rows.first().locator("[data-stat] .nf-numeric").allInnerTexts()).toEqual(["9 days live", "1.5k views", "3 saves"]);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("shows no figures at all when they could not be read", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("null"), css: productCss() });
    try {
      await page.locator("main li").first().waitFor();
      expect(await page.getByTestId("listing-stats").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
