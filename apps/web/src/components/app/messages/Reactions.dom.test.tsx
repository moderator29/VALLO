/**
 * REACTIONS, ON THE REAL `ThreadView` IN CHROMIUM (Platform Grade 1, P1.3;
 * reference R62).
 *
 * A held bubble (here the right click, which opens the same menu at once)
 * offers the eight reactions at the top of the message menu. A choice shows
 * at once under the bubble; the staged server answer decides whether it
 * stays. A refusal puts back exactly what was there and says so in the top
 * banner. The same choice again takes it away. A thread whose database has
 * no reactions yet (`reactions` null) offers none.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css", "app/css/grade1.css", "app/css/messages-g1.css");
const ME = "00000000-0000-4000-8000-000000000001";
const ADA = "00000000-0000-4000-8000-000000000002";
const M1 = "00000000-0000-4000-8000-0000000000a1";
const M2 = "00000000-0000-4000-8000-0000000000a2";
const HEART = "\u{2764}\u{FE0F}";
const THUMBS = "\u{1F44D}";

const MESSAGES = [
  { id: M1, mine: false, body: "Is the flat still available?", timeLabel: "10:24", imageUrl: null },
  { id: M2, mine: true, body: "Yes, it is.", timeLabel: "10:30", imageUrl: null },
];

const entry = (reactions: unknown) => `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  mount(
    <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live
        conversationId="00000000-0000-4000-8000-00000000c001"
        meId="${ME}"
        counterpartName="Ada Eze"
        counterpartTier="none"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        messages={${JSON.stringify(MESSAGES)}}
        reactions={${JSON.stringify(reactions)}}
      />
      <ToastHost />
    </div>,
  );
`;

const openMenu = (page: Page, id: string) => page.locator(`[data-msg-id="${id}"] .nf-bubble`).click({ button: "right" });
const countsOf = (page: Page, id: string) =>
  page.locator(`[data-msg-id="${id}"] [data-testid="reaction-counts"]`);
const calls = (page: Page, name: string) =>
  page.evaluate((n) => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).filter((c) => c[0] === n).map((c) => c[1]), name);

describe.skipIf(!hasBrowser && !process.env.CI)("reactions", () => {
  it("adds a reaction from the menu, shows it counted under the bubble as mine, and takes it away again", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ [M1]: { [ADA]: HEART } }),
      css: CSS,
      actions: {
        setReaction: `async (input) => ({ ok: true, data: input })`,
        clearReaction: `async (input) => ({ ok: true, data: input })`,
      },
    });
    try {
      /* The other person's heart is already there, and not mine. */
      expect(await countsOf(page, M1).textContent()).toBe(`${HEART}1`);
      expect(await countsOf(page, M1).locator("[data-mine]").count()).toBe(0);

      await openMenu(page, M1);
      const row = page.getByTestId("reaction-row");
      await row.waitFor();
      expect(await row.getByRole("menuitemcheckbox").count()).toBe(8);
      await row.getByRole("menuitemcheckbox", { name: "Heart" }).click();
      expect(await page.getByTestId("message-menu").count()).toBe(0);
      expect(await countsOf(page, M1).textContent()).toBe(`${HEART}2`);
      expect(await countsOf(page, M1).locator("[data-mine]").count()).toBe(1);
      expect(await calls(page, "setReaction")).toEqual([{ messageId: M1, emoji: HEART }]);

      /* Changing it replaces it: one reaction per person. */
      await openMenu(page, M1);
      await page.getByTestId("reaction-row").getByRole("menuitemcheckbox", { name: "Thumbs up" }).click();
      expect(await countsOf(page, M1).textContent()).toBe(`${THUMBS}1${HEART}1`);

      /* The same again takes it away. */
      await openMenu(page, M1);
      const mine = page.getByTestId("reaction-row").getByRole("menuitemcheckbox", { checked: true });
      expect(await mine.getAttribute("aria-label")).toBe("Thumbs up, your reaction. Tap to remove it");
      await mine.click();
      expect(await countsOf(page, M1).textContent()).toBe(`${HEART}1`);
      expect(await calls(page, "clearReaction")).toEqual([{ messageId: M1 }]);

      /* A tap on a count agrees with it in one go. */
      await countsOf(page, M1).getByRole("button").click();
      expect(await countsOf(page, M1).textContent()).toBe(`${HEART}2`);
    } finally {
      await close();
    }
  });

  it("puts back what was there and says so when the server refuses", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({}),
      css: CSS,
      actions: {
        setReaction: `() => new Promise((resolve) => { window.__refuse = () => resolve({ ok: false, error: "Couldn't add your reaction. Try again." }); })`,
      },
    });
    try {
      await openMenu(page, M2);
      await page.getByTestId("reaction-row").getByRole("menuitemcheckbox", { name: "Fire" }).click();
      /* Shown at once, before any answer. */
      expect(await countsOf(page, M2).textContent()).toBe("\u{1F525}1");
      await page.evaluate(() => (window as unknown as { __refuse: () => void }).__refuse());
      await expect.poll(() => countsOf(page, M2).count()).toBe(0);
      await expect.poll(() => page.getByText("Couldn't add your reaction. Try again.").count()).toBe(1);
      expect(await page.getByRole("button", { name: "Try again" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("offers no reactions where the database has none yet", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(null), css: CSS });
    try {
      await openMenu(page, M1);
      await page.getByTestId("message-menu").waitFor();
      expect(await page.getByTestId("reaction-row").count()).toBe(0);
      expect(await page.getByTestId("reaction-counts").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
