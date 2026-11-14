/**
 * THE PROFILE'S "..." MENU OPENS WHOLLY ON SCREEN (D79).
 *
 * The founder on a phone: Copy, Mute, Report and Block "render clipped off the
 * right edge of the screen". The menu hung from one edge of its trigger
 * whatever room there was on that side.
 *
 * Since 14 November 2026 the menu is the shared action sheet (handoff 6.3):
 * the platform's sheet on a phone, a popover hung from the trigger on a wide
 * screen with a mouse. Here the trigger is placed at the left edge, in the
 * middle and at the right edge, at 390 and at 1440, and the open menu must
 * sit inside the viewport every time, with its four rows whole.
 *
 * Fictional person; nothing is sent (server actions are stubbed).
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
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const CSS = [
  PORTED_CSS,
  read("src", "components", "ui", "action-sheet.css"),
  read("src", "app", "social-feed.shared.css"),
  read("src", "app", "social-feed.css"),
  read("src", "components", "social", "profile", "social-profile.css"),
].join("\n");

const entry = (justify: string) => `
  import { ProfileMenu } from "@/components/social/profile/ProfileMenu";
  import { reportWordsOf } from "@/components/social/sheet-words";
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <div style={{ display: "flex", justifyContent: "${justify}", padding: "120px 16px 0" }}>
      <ProfileMenu
        handle="ada_lekki"
        userId="00000000-0000-4000-8000-0000000000aa"
        displayLabel="Adaeze Okafor-Williamson"
        isOwner={false}
        signedIn
        reportWords={reportWordsOf(getDictionary("en"))}
      />
    </div>
  );
`;

const ROWS = ["Copy link to this page", "Mute Adaeze Okafor-Williamson", "Report Adaeze Okafor-Williamson", "Block Adaeze Okafor-Williamson"];

describe.skipIf(!hasBrowser && !process.env.CI)("the profile's overflow menu", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    for (const justify of ["flex-start", "center", "flex-end"]) {
      it(`opens inside a ${viewport.width}px screen with its trigger at ${justify}`, async () => {
        const { page, close } = await mountInBrowser({ entry: entry(justify), css: CSS, viewport, reducedMotion: true });
        try {
          const trigger = page.getByRole("button", { name: /More actions for/ });
          await trigger.click();
          const menu = page.getByRole("dialog", { name: "Actions for Adaeze Okafor-Williamson" });
          await menu.waitFor();
          expect(await trigger.getAttribute("aria-expanded")).toBe("true");
          /* A sheet on the phone, a popover with no scrim on the wide screen. */
          const cls = (await menu.getAttribute("class")) ?? "";
          expect(cls).toContain(viewport.width < 1024 ? "nf-acts-sheet" : "nf-acts-pop");
          if (viewport.width >= 1024) {
            await page.waitForFunction(() => document.querySelector(".nf-acts-pop")?.getAttribute("data-placed") === "true");
            expect(await page.locator(".nf-sheet-backdrop").count()).toBe(0);
          }
          const box = await menu.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
          /* The four acts, the destructive pair last, every word whole. */
          expect(await menu.locator(".nf-acts__label").allTextContents()).toEqual(ROWS);
          const clipped = await menu.locator(".nf-acts__row").evaluateAll((rows) => rows.some((row) => row.scrollWidth > row.clientWidth));
          expect(clipped).toBe(false);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
          /* Escape closes it and the keyboard is back on the trigger. */
          await page.keyboard.press("Escape");
          await menu.waitFor({ state: "detached" });
          await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.startsWith("More actions for"));
        } finally {
          await close();
        }
      });
    }
  }

  it("hands Report and Block to their own sheets, and copies the link", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("center"), css: CSS, reducedMotion: true });
    try {
      const trigger = page.getByRole("button", { name: /More actions for/ });
      await trigger.click();
      await page.getByTestId("profile-menu-block").click();
      await page.getByRole("dialog", { name: "Block Adaeze Okafor-Williamson?" }).waitFor();
      expect(await page.getByRole("dialog", { name: "Actions for Adaeze Okafor-Williamson" }).count()).toBe(0);
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("dialog", { name: "Block Adaeze Okafor-Williamson?" }).waitFor({ state: "detached" });

      await trigger.click();
      await page.getByTestId("profile-menu-report").click();
      await page.getByRole("dialog", { name: "Report Adaeze Okafor-Williamson" }).waitFor();
    } finally {
      await close();
    }
  });
});
