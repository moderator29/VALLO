/**
 * THE OWNER'S PASSPORT PAGE, in a real Chromium: every switch moves the preview
 * at once, each change is saved as one write of the whole state, and a refusal
 * puts the switch and the preview back and says why.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { PassportSettings } from "@/components/passport/PassportSettings";
  import { factsFrom, settingsFrom } from "@/lib/passport/model";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  const t = getDictionary("en");
  const facts = factsFrom({
    subject_id: "7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13", handle: "amaka", display_name: "Amaka Nwosu",
    photo: "https://example.test/amaka.jpg", roles: ["landlord"], joined_at: "2026-08-07T08:00:00Z",
    verification: "gold", rentals: 14, stays: null, review_count: 41, review_average: 4.8, reply_band: "hour", pidgin_ok: true,
  });
  mount(<><ToastHost /><PassportSettings facts={facts} initial={settingsFrom(null)} copy={t.passportV2} roleCopy={t.socialProfile.roleLine} locale="en" /></>);
`;

const OK = 'async (input) => ({ ok: true, data: { enabled: input.enabled, hidden: input.hidden } })';

describe.skipIf(!hasBrowser && !process.env.CI)("the owner's passport page", () => {
  it("shows every line on by default, with a switch for the whole passport and one per line", async () => {
    const { page, close } = await mountInBrowser({ entry, actions: { savePassportSettings: OK } });
    try {
      for (const id of ["all", "photo", "role", "joined", "verification", "rentals", "stays", "reviews", "response", "languages"]) {
        expect(await page.getByTestId(`passport-switch-${id}`).getAttribute("aria-checked"), id).toBe("true");
      }
      const preview = page.getByTestId("passport-preview");
      expect(await preview.getByTestId("passport-joined").innerText()).toBe("7 August 2026");
      expect(await preview.getByTestId("passport-photo").locator("img").count()).toBe(1);
      /* A line with nothing recorded says so on its switch, and is not drawn. */
      expect(await page.getByTestId("passport-switch-stays").count()).toBe(1);
      expect(await preview.getByTestId("passport-stat-stays").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("hides a line in the preview at once and saves the whole state", async () => {
    const { page, close } = await mountInBrowser({ entry, actions: { savePassportSettings: OK } });
    try {
      await page.getByTestId("passport-switch-photo").click();
      await page.getByTestId("passport-switch-reviews").click();
      const preview = page.getByTestId("passport-preview");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="passport-photo"] img').length === 0);
      expect(await preview.getByTestId("passport-stat-reviews").count()).toBe(0);
      expect(await preview.getByTestId("passport-stat-rentals").count()).toBe(1);
      /* The machine lines carry no hidden date either way; the join date is still on. */
      expect(await preview.getByTestId("passport-joined").count()).toBe(1);
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual(["savePassportSettings", { enabled: true, hidden: ["photo", "reviews"] }]);
    } finally {
      await close();
    }
  });

  it("turns the whole passport off, fades the preview and says nobody can open it", async () => {
    const { page, close } = await mountInBrowser({ entry, actions: { savePassportSettings: OK } });
    try {
      await page.getByTestId("passport-switch-all").click();
      await page.getByTestId("passport-off-note").waitFor();
      expect(await page.getByTestId("passport-off-note").innerText()).toBe("Your passport is off, so nobody can open it.");
      expect(await page.getByTestId("passport-preview").getAttribute("class")).toContain("nf-vp--off");
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual(["savePassportSettings", { enabled: false, hidden: [] }]);
    } finally {
      await close();
    }
  });

  it("puts a switch back and says why when the save is refused", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      actions: { savePassportSettings: 'async () => ({ ok: false, error: "That change was not saved. Try again." })' },
    });
    try {
      await page.getByTestId("passport-switch-photo").click();
      /* Said by the one top banner (founder, 7 November 2026), with Try again. */
      await page.getByRole("alert").waitFor();
      expect(await page.getByRole("alert").innerText()).toContain("That change was not saved. Try again.");
      expect(await page.getByRole("alert").getByRole("button", { name: "Try again" }).count()).toBe(1);
      expect(await page.getByTestId("passport-switch-photo").getAttribute("aria-checked")).toBe("true");
      expect(await page.getByTestId("passport-photo").locator("img").count()).toBe(1);
    } finally {
      await close();
    }
  });
});
