/**
 * VALLO INTELLIGENCE'S EMPTY PAGE FITS A PHONE (23 November 2026).
 *
 * The same fault as Talk to a person: a recent search, a popular search chip
 * and the "pick up where you left off" query are each one truncated line, and
 * the grids around them were sized to the whole line, so with one long search
 * every section of the page ran past the right edge of a 390px phone. This
 * mounts the real screen in the app's own stylesheet at phone width, inside a
 * 16px page gutter, with the engine stubbed at `fetch` (fixtures only), and
 * checks no section, recent search or chip reaches past the gutter. The
 * rails that bleed to the screen's edge on purpose are not sections and are
 * not measured.
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

const LONG = "two bedroom flat in lekki phase one with a boys quarters and a generator under five million";

const STUB = `
  const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  const LONG = ${JSON.stringify(LONG)};
  window.fetch = async (input) => {
    const url = new URL(String(input), location.origin);
    if (url.pathname === "/api/intelligence/discover") {
      return json({
        popular: [{ query: LONG, count: 3 }],
        recent: [
          { query: LONG, at: "2026-11-15T10:00:00Z" },
          { query: "Someone asked me to pay outside Vallo and kept insisting on a transfer", at: "2026-11-14T10:00:00Z" },
        ],
        fresh: [],
        people: [],
        examples: [LONG],
        categories: [
          { tab: "property", live: 3, newThisWeek: 2, areas: [{ name: "Yaba", city: "Lagos" }], latest: [] },
          { tab: "stay", live: 0, newThisWeek: 0, areas: [], latest: [] },
          { tab: "restaurant", live: 0, newThisWeek: 0, areas: [], latest: [] },
        ],
        trending: [],
        forYou: [],
      });
    }
    if (url.pathname === "/api/intelligence/suggest") return json({ q: url.searchParams.get("q"), suggestions: [] });
    return new Response(null, { status: 204 });
  };
`;

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  import { parseIntelUrl } from "@/lib/intelligence/client";
  import { IntelligenceScreen } from "@/components/app/intelligence/IntelligenceScreen";
  mount(
    <div style={{ paddingInline: "16px" }} id="gutter">
      <AuthGateProvider signedIn>
        <IntelligenceScreen
          copy={getDictionary("en").intelligence}
          locale="en"
          signedIn
          initial={parseIntelUrl(new URLSearchParams(window.location.search))}
          focusOnOpen={false}
        />
      </AuthGateProvider>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("VALLO Intelligence's empty page on a phone", () => {
  it("keeps every section, recent search and chip inside the screen's gutter", async () => {
    const css = await layoutCss("app/(app)/layout.tsx");
    const { page, close } = await mountInBrowser({
      entry,
      css,
      init: STUB,
      url: "http://vallo.test/intelligence",
      viewport: { width: 390, height: 844 },
    });
    try {
      await page.getByTestId("intel-pickup").waitFor();
      await page.getByTestId("intel-recent-remove").first().waitFor();
      const fit = await page.evaluate(() => {
        const limit = window.innerWidth - 16 + 0.5;
        const measured = [
          ...document.querySelectorAll<HTMLElement>(
            ".nf-intel-section, [data-testid=intel-continue] *, .nf-intel-chiprow:not(.nf-intel-chiprow--rail) > li",
          ),
        ];
        const over = measured
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ el, right }) => right > limit && getComputedStyle(el).display !== "none" && el.closest("svg") === null)
          .map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(right)}`);
        return { over, count: measured.length };
      });
      expect(fit.count).toBeGreaterThan(5);
      expect(fit.over).toEqual([]);
    } finally {
      await close();
    }
  });
});
