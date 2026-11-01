/**
 * THE DOCK SWAP (the founder, 13 October 2026): the grid menu is the capsule's
 * centre slot and the "+" is the round brand-blue button at the right end.
 *
 * The real `MobileTabBar` on the product's compiled cascade at 390px, in both
 * themes: the order of the capsule's slots, the accessible names ("More",
 * "Create"), the 44px targets, the menu in line with the other four (same
 * vertical centre), the "+" outside the capsule at the far end and filled with
 * the brand, and the tray opening centred above the capsule, inside the
 * screen, never over the capsule and closing on Escape (the same path the
 * Android back button dispatches, `lib/native/back-button.ts`).
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
  import { shellDictionary } from "@/lib/i18n/shell-dictionary";`;

const dock = (side: "property" | "stays") => `
  <MobileTabBar t={shellDictionary(t)} side="${side}" active="/home" signedIn unreadConversationsPreview={3} />`;

const boxes = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, b: r.bottom, r: r.right };
    };
    const capsule = document.querySelector(".nf-tabbar");
    const slots = [...document.querySelectorAll(".nf-tabbar > li.nf-tab")].map((li) => ({
      label: li.querySelector("[aria-label]")?.getAttribute("aria-label") ?? null,
      menu: li.querySelector(".nf-dockmore__button") !== null,
    }));
    const menu = document.querySelector<HTMLElement>(".nf-dockmore__button");
    const create = document.querySelector<HTMLElement>("[data-dock-create]");
    return {
      slots,
      capsule: box(capsule),
      menu: box(menu),
      menuLabel: menu?.getAttribute("aria-label") ?? null,
      menuText: menu?.innerText.trim() ?? null,
      menuInCapsule: capsule?.contains(menu) ?? false,
      create: box(create),
      createLabel: create?.getAttribute("aria-label") ?? null,
      createInCapsule: capsule?.contains(create) ?? false,
      plusFill: create ? getComputedStyle(create.querySelector(".nf-dock-plus")!).backgroundImage : "",
      tray: box(document.querySelector(".nf-dockmore__tray:not([hidden])")),
      viewport: window.innerWidth,
    };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("the dock swap (menu in the capsule, + at the right end)", () => {
  for (const side of ["property", "stays"] as const) {
    for (const theme of ["dark", "light"] as const) {
      it(`${side} side, ${theme}: slots, names, targets and the tray`, async () => {
        const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body: dock(side), css: await appCss(), bleed: true });
        try {
          await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
          await page.waitForTimeout(400);
          const at = await boxes(page);

          /* Four destinations and the menu between the second and the third. */
          expect(at.slots).toHaveLength(5);
          expect(at.slots[2]!.menu, "the centre slot holds the menu").toBe(true);
          expect(at.slots.filter((slot) => slot.menu)).toHaveLength(1);
          expect(at.menuInCapsule).toBe(true);
          expect(at.menuLabel, "the menu keeps its name, and says what is waiting").toMatch(/^More/);
          expect(at.menuLabel).toContain("3");
          expect(at.menuText, "icon only, the unread count aside").toMatch(/^3?$/);

          /* The "+" is outside the capsule, beyond its right edge, and named Create. */
          expect(at.createInCapsule).toBe(false);
          expect(at.createLabel).toBe("Create");
          expect(at.create!.x).toBeGreaterThanOrEqual(at.capsule!.r);
          expect(at.plusFill, "the + is filled with the brand gradient").toContain("gradient");

          /* 44px targets, and the menu sits on the capsule's own centre line. */
          expect(at.menu!.w).toBeGreaterThanOrEqual(44);
          expect(at.menu!.h).toBeGreaterThanOrEqual(44);
          expect(at.create!.w).toBeGreaterThanOrEqual(44);
          expect(at.create!.h).toBeGreaterThanOrEqual(44);
          expect(Math.abs(at.menu!.cy - at.capsule!.cy)).toBeLessThanOrEqual(1);
          expect(Math.abs(at.menu!.cx - at.capsule!.cx), "the menu is the capsule's centre").toBeLessThanOrEqual(1);
          expect(Math.abs(at.create!.cy - at.capsule!.cy)).toBeLessThanOrEqual(1);

          /* The tray opens centred on the capsule, on screen, above it. */
          await page.getByRole("button", { name: /^More/ }).click();
          await page.locator(".nf-dockmore__tray").waitFor({ state: "visible" });
          await page.waitForTimeout(700);
          const open = await boxes(page);
          const tray = open.tray!;
          expect(tray.x).toBeGreaterThanOrEqual(0);
          expect(tray.r).toBeLessThanOrEqual(open.viewport);
          expect(tray.b, "above the capsule").toBeLessThanOrEqual(open.capsule!.y);
          expect(tray.w).toBeLessThanOrEqual(24 * 16 + 1);
          /* Centred on the capsule unless the row's edge clamps it. */
          const row = open.create!.r - open.capsule!.x;
          if (tray.w < row - 4) expect(Math.abs(tray.cx - open.capsule!.cx)).toBeLessThanOrEqual(1);

          /* Escape, which the Android back button dispatches, closes it. */
          await page.keyboard.press("Escape");
          await page.locator(".nf-dockmore__tray").waitFor({ state: "hidden" });
        } finally {
          await close();
        }
      });
    }
  }

  it("on a tablet the tray is 24rem wide and exactly centred on the capsule, not the screen", async () => {
    const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body: dock("property"), css: await appCss(), bleed: true });
    try {
      await page.setViewportSize({ width: 700, height: 844 });
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: /^More/ }).click();
      await page.locator(".nf-dockmore__tray").waitFor({ state: "visible" });
      await page.waitForTimeout(700);
      const open = await boxes(page);
      expect(open.tray!.w).toBeGreaterThan(24 * 16 - 4);
      expect(open.tray!.w).toBeLessThanOrEqual(24 * 16 + 1);
      expect(Math.abs(open.tray!.cx - open.capsule!.cx)).toBeLessThanOrEqual(1);
      expect(open.tray!.b).toBeLessThanOrEqual(open.capsule!.y);
    } finally {
      await close();
    }
  });
});
