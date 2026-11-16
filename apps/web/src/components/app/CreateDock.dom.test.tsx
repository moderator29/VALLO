/**
 * The dock's "+" (at the right end since the swap of 13 October 2026) and its
 * Create sheet, mounted for real in Chromium (lib/testing/mount-in-browser):
 * the sheet offers Post to story, Post to feed and List a property, in that
 * order, each with a clean icon and a short line (the founder, 13 October
 * 2026; it was three plain titles under handoff A.6), the booking row it
 * always had stays below them, the workspace switch is not in it (it lives on
 * `/profile`, `SwitchRoleRow`), a guest goes through the sign-up door, and
 * closing the sheet hands focus back to the "+" it was opened from.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";

/* The browser starts in the hook; each test gets the budget its mount needs. */
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

function entry({
  isHost,
  side = "property",
  socialOn = true,
  signedIn = true,
}: {
  isHost: boolean;
  side?: string;
  socialOn?: boolean;
  signedIn?: boolean;
}): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { mount } from "@/lib/testing/browser-root";
    import { shellDictionary } from "@/lib/i18n/shell-dictionary";
    import { CreateDock } from "@/components/app/CreateDock";
    const t = shellDictionary(getDictionary("en"));
    mount(
      <CreateDock
        t={t}
        listHref="/profile/setup"
        side={${JSON.stringify(side)}}
        isHost={${JSON.stringify(isHost)}}
        socialOn={${JSON.stringify(socialOn)}}
        signedIn={${JSON.stringify(signedIn)}}
      />,
    );
  `;
}

/** The options as the sheet draws them: the test ids in order, and their words. */
async function optionsOf(page: import("playwright-core").Page) {
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("dialog").waitFor();
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-testid='create-options'] a")].map((a) => ({
      id: a.getAttribute("data-testid"),
      href: a.getAttribute("href"),
      text: a.querySelector(".nf-create-sheet__title")?.textContent?.trim(),
      sub: a.querySelector(".nf-create-sheet__sub")?.textContent?.trim() ?? null,
      icons: a.querySelectorAll("svg").length,
      chevron: a.querySelector(".nf-chevron, [data-chevron]") !== null,
    })),
  );
}

describe.skipIf(!hasBrowser && !process.env.CI)("CreateDock", () => {
  it("offers story, Intelligence, feed and list in that order on the property side, then the booking row, and no workspace row", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: false }) });
    try {
      const options = await optionsOf(page);
      expect(options.map((o) => o.id)).toEqual(["create-story", "create-intelligence", "create-post", "create-list", "create-viewing", "create-roommate"]);
      expect(options.map((o) => o.text)).toEqual(["Post to story", "VALLO Intelligence", "Post to feed", "List a property", "Book a viewing", "Find a roommate or share a room"]);
      expect(options.map((o) => o.href)).toEqual(["/stories/new", "/intelligence", "/around?compose=1", "/profile/setup", "/search", "/roommates/new"]);
      /* Clean: one icon, one line and a short line under it; no chevron. */
      for (const option of options) {
        expect(option.icons, option.text).toBe(1);
        expect(option.sub, `${option.text} has its short line`).toBeTruthy();
        expect(option.chevron).toBe(false);
      }
      expect(await page.getByTestId("create-switch-workspace").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("gives a host on the property side the same six, not a seventh", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: true }) });
    try {
      expect((await optionsOf(page)).length).toBe(6);
    } finally {
      await close();
    }
  });

  it("offers the stays side its own listing and booking, with a host's listing going to their rooms", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: true, side: "stays" }) });
    try {
      const options = await optionsOf(page);
      expect(options.map((o) => o.text)).toEqual(["Post to story", "VALLO Intelligence", "Post to feed", "Create a stay listing", "Book a stay"]);
      expect(options.map((o) => o.href)).toEqual(["/stories/new", "/intelligence", "/around?compose=1", "/host/rooms", "/stays/search"]);
    } finally {
      await close();
    }
  });

  it("hides the two post options when the social switch is off, and keeps Intelligence (first), List and the booking row", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: false, socialOn: false }) });
    try {
      expect((await optionsOf(page)).map((o) => o.id)).toEqual(["create-intelligence", "create-list", "create-viewing", "create-roommate"]);
    } finally {
      await close();
    }
  });

  it("sends a guest through the sign-up door and back, and booking and Intelligence stay public", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: false, signedIn: false }) });
    try {
      const options = await optionsOf(page);
      expect(options.map((o) => o.href)).toEqual([
        "/sign-up?next=%2Fstories%2Fnew",
        "/intelligence",
        "/sign-up?next=%2Faround%3Fcompose%3D1",
        "/sign-up?next=%2Fprofile%2Fsetup",
        "/search",
        "/sign-up?next=%2Froommates%2Fnew",
      ]);
    } finally {
      await close();
    }
  });

  it("puts VALLO Intelligence DIRECTLY below Post to story, with the spark and its short line (the founder, 16 November 2026)", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: false }) });
    try {
      const options = await optionsOf(page);
      const story = options.findIndex((o) => o.id === "create-story");
      expect(story).toBeGreaterThanOrEqual(0);
      expect(options[story + 1]).toMatchObject({
        id: "create-intelligence",
        href: "/intelligence",
        text: "VALLO Intelligence",
        sub: "Search and discover across Vallo",
        icons: 1,
      });
    } finally {
      await close();
    }
  });

  it("returns focus to the + when the sheet closes", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ isHost: false }) });
    try {
      const plus = page.getByRole("button", { name: "Create" });
      await plus.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.activeElement?.hasAttribute("data-dock-create") === true);
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Create");
    } finally {
      await close();
    }
  });
});
