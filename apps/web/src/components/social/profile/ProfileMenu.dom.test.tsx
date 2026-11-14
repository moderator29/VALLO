/**
 * THE PROFILE'S "..." MENU OPENS WHOLLY ON SCREEN (D79), WHATEVER ITS
 * TRIGGER'S POSITION.
 *
 * The founder on a phone: Copy, Mute, Report and Block "render clipped off the
 * right edge of the screen". The menu was a popover hanging off one edge of
 * its trigger whatever room there was on that side, and a layout effect
 * measured the viewport and slid it back in. It is the platform's action
 * sheet since 14 November 2026, anchored to the bottom edge of the screen,
 * so a trigger's position cannot clip it at all. The trigger is still placed
 * at the left edge, in the middle and at the right edge of a 390px screen,
 * and the open sheet must sit inside the viewport every time: the defect the
 * founder reported is the thing being measured, not the mechanism that was
 * replaced.
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
  read("src", "app", "social-feed.shared.css"),
  read("src", "app", "social-feed.css"),
  read("src", "components", "social", "profile", "social-profile.css"),
  read("src", "app", "css", "list-views.css"),
  read("src", "components", "ui", "action-sheet.css"),
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

describe.skipIf(!hasBrowser && !process.env.CI)("the profile's overflow menu at 390px", () => {
  for (const justify of ["flex-start", "center", "flex-end"]) {
    it(`opens inside the screen with its trigger at ${justify}`, async () => {
      const { page, close } = await mountInBrowser({ entry: entry(justify), css: CSS });
      try {
        await page.getByRole("button", { name: /More actions for/ }).click();
        const sheet = page.getByTestId("profile-menu");
        await sheet.waitFor();
        const box = await sheet.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
        /* And the page itself never gains a sideways scroll from it. */
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      } finally {
        await close();
      }
    });
  }

  it("offers copy, mute, report and block, with the two destructive rows last", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("center"), css: CSS });
    try {
      await page.getByRole("button", { name: /More actions for/ }).click();
      await page.getByTestId("profile-menu").waitFor();
      expect(await page.getByTestId("profile-menu-copy").isVisible()).toBe(true);
      expect(await page.getByTestId("profile-menu-mute").isVisible()).toBe(true);
      const keys = await page
        .locator('[data-testid="profile-menu"] .nf-list-item')
        .evaluateAll((els) => els.map((el) => el.querySelector("[data-testid]")?.getAttribute("data-testid") ?? ""));
      expect(keys).toEqual(["profile-menu-report", "profile-menu-block"]);
    } finally {
      await close();
    }
  });
});
