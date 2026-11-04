/**
 * THE DOCK IS ICON ONLY, THE CHOSEN TAB INCLUDED (the founder, 7 October 2026:
 * "When I click any icon it shows the text, like Home. Make it not show the
 * text of the icon, just the icon, when clicked."; shell-m.css, "ICON ONLY").
 *
 * The real `MobileTabBar` on both sides, on the product's compiled cascade, at
 * 390px: no tab draws a word, chosen or tapped; the chosen one still reads as
 * chosen (its pill is drawn and it carries `aria-current`); every tab keeps its
 * accessible name and a 44px target; and the chosen slot is no wider than the
 * others, so the dock does not re-lay out on a tap.
 *
 * It replaced the test that held the chosen word steady while it grew (A8 NIT
 * 8): there is no word to grow any more.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss, fitMount } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const IMPORTS = `
  import { MobileTabBar } from "@/components/app/MobileTabBar";
  import { CreateDock } from "@/components/app/CreateDock";
  import { shellDictionary } from "@/lib/i18n/shell-dictionary";`;

const dock = (active: string, side: "property" | "stays") => `
  <MobileTabBar t={shellDictionary(t)} side="${side}" active="${active}" signedIn
    createSlot={<CreateDock t={shellDictionary(t)} listHref="/profile/setup" isHost={false} signedIn />} />`;

type TabReading = { label: string | null; current: boolean; text: string; w: number; h: number; pill: string };

const read = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".nf-tabbar .nf-tab__link")].map((link) => {
      const r = link.getBoundingClientRect();
      return {
        label: link.getAttribute("aria-label"),
        current: link.getAttribute("aria-current") === "page",
        text: link.innerText.trim(),
        w: Math.round(r.width),
        h: Math.round(r.height),
        pill: getComputedStyle(link, "::before").opacity,
      };
    }),
  ) as Promise<TabReading[]>;

describe.skipIf(!hasBrowser && !process.env.CI)("the dock is icon only", () => {
  for (const [active, side, name] of [
    ["/home", "property", "Home"],
    ["/stays", "stays", "Stays"],
  ] as const) {
    it(`draws no word on the chosen tab (${side} side, ${name} chosen), keeps its name and 44px, with no pill`, async () => {
      const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body: dock(active, side), css: await appCss(), bleed: true });
      try {
        await page.waitForTimeout(400);
        const tabs = await read(page);
        expect(tabs.length).toBeGreaterThanOrEqual(4);
        for (const tab of tabs) {
          expect(tab.text, `${tab.label} draws a word`).toBe("");
          expect(tab.label, "every tab keeps its accessible name").toBeTruthy();
          expect(tab.w).toBeGreaterThanOrEqual(44);
          expect(tab.h).toBeGreaterThanOrEqual(44);
        }
        const chosen = tabs.filter((tab) => tab.current);
        expect(chosen).toHaveLength(1);
        expect(chosen[0]!.label).toBe(name);
        expect(chosen[0]!.pill, "no pill behind the chosen tab (founder, 4 November 2026)").toBe("0");
        /* The round search disc carries its optical overshoot (7 October). */
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('.nf-tabbar [data-glyph="search-disc"]')!).scale)).toBe("1.12");
        const resting = tabs.find((tab) => !tab.current)!;
        expect(Math.abs(chosen[0]!.w - resting.w), "the chosen slot is no wider than the others").toBeLessThanOrEqual(1);

        /* A tap on another tab (its pending state) draws no word either. */
        await page.evaluate(() => {
          const links = document.querySelectorAll<HTMLElement>('.nf-tabbar .nf-tab__link:not([aria-current="page"])');
          links[0]!.setAttribute("data-on", "");
        });
        await page.waitForTimeout(400);
        for (const tab of await read(page)) expect(tab.text, `${tab.label} draws a word after a tap`).toBe("");
      } finally {
        await close();
      }
    });
  }
});
