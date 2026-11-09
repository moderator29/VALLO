/**
 * THE DOCK (the founder, 13 October 2026, then 7 November 2026): the
 * capsule's centre slot is Vallo Circle (it was the grid menu) and the "+" is
 * the round brand-blue button at the right end.
 *
 * The real `MobileTabBar` on the product's compiled cascade at 390px, in both
 * themes: the order of the capsule's slots, the accessible names ("Circle",
 * "Create"), the 44px targets, Circle in line with the other four (same
 * vertical centre) and on the capsule's centre, the "+" outside the capsule
 * at the far end and filled with the brand, and Circle marked as the page on
 * /circle. */
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
  <MobileTabBar t={shellDictionary(t)} side="${side}" active="/home" signedIn />`;

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
      circle: li.querySelector('[data-testid="dock-circle"]') !== null,
    }));
    const circle = document.querySelector<HTMLAnchorElement>('[data-testid="dock-circle"]');
    const create = document.querySelector<HTMLElement>("[data-dock-create]");
    return {
      slots,
      capsule: box(capsule),
      circle: box(circle),
      circleHref: circle?.getAttribute("href") ?? null,
      circleLabel: circle?.getAttribute("aria-label") ?? null,
      circleText: circle?.innerText.trim() ?? null,
      circleCurrent: circle?.getAttribute("aria-current") ?? null,
      circleInCapsule: capsule?.contains(circle) ?? false,
      create: box(create),
      createLabel: create?.getAttribute("aria-label") ?? null,
      createInCapsule: capsule?.contains(create) ?? false,
      plusFill: create ? getComputedStyle(create.querySelector(".nf-dock-plus")!).backgroundImage : "",
      menu: document.querySelector(".nf-dockmore__button") !== null,
    };
  });

/*
 * THE DOCK'S CENTRE IS VALLO CIRCLE (founder, 7 November 2026). It was the
 * grid menu (`DockMore`) and its tray; the tray's destinations are all in the
 * side menu now (`nav-model.test.ts` checks every one), so there is no tray
 * to open and the centre is a destination like the four beside it.
 */
describe.skipIf(!hasBrowser && !process.env.CI)("the dock (Circle in the centre, + at the right end)", () => {
  for (const side of ["property", "stays"] as const) {
    for (const theme of ["dark", "light"] as const) {
      it(`${side} side, ${theme}: slots, names, targets and the Circle tab`, async () => {
        const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body: dock(side), css: await appCss(), bleed: true });
        try {
          await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
          await page.waitForTimeout(400);
          const at = await boxes(page);

          /* Four destinations and Circle between the second and the third. */
          expect(at.slots).toHaveLength(5);
          expect(at.slots[2]!.circle, "the centre slot is Circle").toBe(true);
          expect(at.slots.filter((slot) => slot.circle)).toHaveLength(1);
          expect(at.menu, "the grid menu is gone from the dock").toBe(false);
          expect(at.circleInCapsule).toBe(true);
          expect(at.circleHref).toBe("/circle");
          expect(at.circleLabel).toBe("Circle");
          expect(at.circleText, "icon only, the name is its label").toBe("");
          expect(at.circleCurrent, "not the page here (/home)").toBeNull();

          /* The "+" is outside the capsule, beyond its right edge, and named Create. */
          expect(at.createInCapsule).toBe(false);
          expect(at.createLabel).toBe("Create");
          expect(at.create!.x).toBeGreaterThanOrEqual(at.capsule!.r);
          expect(at.plusFill, "the + is filled with the brand gradient").toContain("gradient");

          /* 44px targets, and Circle sits on the capsule's own centre line. */
          expect(at.circle!.w).toBeGreaterThanOrEqual(44);
          expect(at.circle!.h).toBeGreaterThanOrEqual(44);
          expect(at.create!.w).toBeGreaterThanOrEqual(44);
          expect(at.create!.h).toBeGreaterThanOrEqual(44);
          expect(Math.abs(at.circle!.cy - at.capsule!.cy)).toBeLessThanOrEqual(1);
          expect(Math.abs(at.circle!.cx - at.capsule!.cx), "Circle is the capsule's centre").toBeLessThanOrEqual(1);
          expect(Math.abs(at.create!.cy - at.capsule!.cy)).toBeLessThanOrEqual(1);
        } finally {
          await close();
        }
      });
    }
  }

  it("on /circle the Circle tab is the page", async () => {
    const body = `<MobileTabBar t={shellDictionary(t)} side="property" active="/circle" signedIn />`;
    const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body, css: await appCss(), bleed: true });
    try {
      const at = await boxes(page);
      expect(at.circleCurrent).toBe("page");
    } finally {
      await close();
    }
  });
});
