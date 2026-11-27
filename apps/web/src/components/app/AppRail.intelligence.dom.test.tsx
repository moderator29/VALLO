/**
 * The side navigation draws VALLO Intelligence (the founder, 16 November
 * 2026): in the phone drawer it is the first row a person sees (the docked
 * group above it is hidden there, the dock carries it), with the spark and
 * its name, and it goes to /intelligence. Mounted for real in Chromium with
 * the side navigation's own stylesheets.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/side-nav.css", "app/css/nav-island.css", "app/css/shell-m.css");

function entry(signedIn: boolean): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { mount } from "@/lib/testing/browser-root";
    import { shellDictionary } from "@/lib/i18n/shell-dictionary";
    import { AppRail } from "@/components/app/AppRail";
    import { SideFlip } from "@/components/app/flip/SideFlip";
    const t = shellDictionary(getDictionary("en"));
    mount(
      <SideFlip side="property" t={t}>
        <AppRail t={t} userName="Test Member" signedIn={${signedIn}} variant="drawer" active="/home" />
      </SideFlip>,
    );
  `;
}

describe.skipIf(!hasBrowser && !process.env.CI)("the side navigation's Intelligence row", () => {
  for (const signedIn of [true, false]) {
    it(`is the first visible row of the phone drawer, with the spark (${signedIn ? "signed in" : "signed out"})`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(signedIn), css: CSS });
      try {
        await page.locator("a[href='/intelligence']").waitFor({ state: "attached" });
        const rows = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLAnchorElement>("aside a[href]")]
            .filter((a) => a.offsetParent !== null && a.closest(".nf-nav__section"))
            .map((a) => ({
              href: a.getAttribute("href"),
              /* The row's own name, without the Beta mark beside it: that is
                 asserted separately below, so a change to one does not read
                 as a change to the other. */
              text: a.querySelector(".nf-nav__label")?.textContent?.trim(),
              beta: a.querySelector(".nf-nav__beta")?.textContent?.trim() ?? null,
              icons: a.querySelectorAll("svg").length,
            })),
        );
        expect(rows[0]).toEqual({ href: "/intelligence", text: "VALLO Intelligence", beta: "Beta", icons: 1 });
      } finally {
        await close();
      }
    });
  }

  it("sits right under Home, Search and Feed on the desktop rail", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(true).replace('variant="drawer"', 'variant="rail"'),
      css: CSS,
      viewport: { width: 1280, height: 900 },
    });
    try {
      await page.locator("a[href='/intelligence']").waitFor({ state: "attached" });
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>(".nf-nav__section a[href]")].filter((a) => a.offsetParent !== null).map((a) => a.getAttribute("href")),
      );
      const at = hrefs.indexOf("/intelligence");
      expect(hrefs.slice(0, 3)).toEqual(["/home", "/search", "/around"]);
      expect(at).toBeGreaterThan(2);
      expect(at).toBeLessThanOrEqual(5);
    } finally {
      await close();
    }
  });
});
