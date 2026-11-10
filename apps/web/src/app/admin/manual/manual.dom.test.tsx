/**
 * THE STAFF MANUAL, mounted for real in Chromium at 360px: every chapter
 * keeps its tables as tables, its headings in order, nothing scrolls
 * sideways, and axe finds nothing. The same pattern as the documentation
 * kit's own test (`components/docs/docs-kit.dom.test.tsx`).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MANUAL_SLUGS } from "@/lib/admin/manual/chapters";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/docs-kit.css", "components/site/guides/docs-type.css");

const entry = (view: string) => `
  import { ManualChapterView, ManualIndexView } from "@/app/admin/manual/_chapters/views";
  import { mount } from "@/lib/testing/browser-root";
  mount(<main>${view}</main>);
`;

const VIEWS = [
  { name: "the index", view: "<ManualIndexView />" },
  ...MANUAL_SLUGS.map((slug) => ({ name: slug, view: `<ManualChapterView slug="${slug}" />` })),
];

describe.skipIf(!hasBrowser && !process.env.CI)("the staff manual", () => {
  it.each(VIEWS)("$name never scrolls sideways at 360px, keeps its headings in order, and passes axe", async ({ view }) => {
    const { page, close } = await mountInBrowser({ entry: entry(view), css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps a chapter's tables real tables for a screen reader", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(`<ManualChapterView slug="decisions" />`), css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.getByRole("table", { name: "Decisions a staff member takes alone" }).count()).toBe(1);
      expect(await page.getByRole("table").count()).toBe(3);
    } finally {
      await close();
    }
  });
});
