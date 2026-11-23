/**
 * RECENT SEARCHES FIT A PHONE (23 November 2026).
 *
 * The same fault as Talk to a person: a recent search is one truncated line,
 * and the list around it is a grid whose column was sized to the whole line,
 * so one long search ("Lekki Phase 1, 3 beds, serviced, with a boys
 * quarters") grew the list, and every row in it, past the right edge of a
 * 390px phone. This opens the list under the real Stays bar and the search
 * screen's own bar, in the app's own stylesheet, inside a 16px page gutter,
 * and checks no row reaches past the gutter.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { layoutCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const STORED = JSON.stringify([
  { label: "Lekki Phase 1, 3 beds, serviced, with a boys quarters, under 5m", href: "/search?q=Lekki" },
  { label: "Victoria Island, 2 guests, 12 Dec to 15 Dec, with a pool and a gym", href: "/stays/search?q=Victoria%20Island" },
  { label: "Yaba", href: "/search?q=Yaba" },
]);

const BARS = {
  "Stays bar": {
    inputId: "stays-q",
    entry: `
      import { mount } from "@/lib/testing/browser-root";
      import { StaySearchBar } from "@/components/app/stays/StaySearchBar";
      const t = {
        catalogue: {
          stays: { search: "Search stays", wherePlaceholder: "Where are you going?", filters: "Filters" },
          recent: { title: "Recent searches", clear: "Clear", clearLabel: "Clear recent searches" },
        },
      };
      mount(<div style={{ paddingInline: "16px" }}><StaySearchBar t={t as never} filtersHref="/stays/search?filters=1" /></div>);
    `,
  },
  "Search screen bar": {
    inputId: "shelf-q",
    entry: `
      import { mount } from "@/lib/testing/browser-root";
      import { getDictionary } from "@vallo/i18n";
      import { ShelfBar } from "@/components/app/search/ShelfBar";
      import { parseShelfQuery } from "@/components/app/search/shelf-query";
      mount(<div style={{ paddingInline: "16px" }}><ShelfBar query={parseShelfQuery({})} facts={[]} locale="en" t={getDictionary("en")} /></div>);
    `,
  },
} as const;

describe.skipIf(!hasBrowser && !process.env.CI)("recent searches on a phone", () => {
  for (const [name, bar] of Object.entries(BARS)) {
    it(`${name}: a long recent search keeps every row inside the screen's gutter`, async () => {
      const css = await layoutCss("app/(app)/layout.tsx");
      const { page, close } = await mountInBrowser({
        entry: bar.entry,
        css,
        init: `localStorage.setItem("nf_recent_searches", ${JSON.stringify(STORED)});`,
        viewport: { width: 390, height: 844 },
      });
      try {
        await page.locator(`#${bar.inputId}`).focus();
        const panel = page.getByTestId("recent-searches");
        await expect.poll(() => panel.isVisible()).toBe(true);
        const fit = await page.evaluate(() => {
          const limit = window.innerWidth - 16 + 0.5;
          const rows = [...document.querySelectorAll<HTMLElement>("[data-testid=recent-searches] :is(ul, li, a)")];
          const over = rows
            .map((el) => ({ el, right: el.getBoundingClientRect().right }))
            .filter(({ right }) => right > limit)
            .map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(right)}`);
          return { over, rows: rows.length };
        });
        expect(fit.rows).toBeGreaterThan(2);
        expect(fit.over).toEqual([]);
      } finally {
        await close();
      }
    });
  }
});
