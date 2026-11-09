/**
 * "Show my passport" in a conversation's options sheet, in a real Chromium:
 * it posts the passport card as an ordinary message through `sendMessage`, with
 * the share body the thread turns into the card, and it never posts when the
 * passport is off.
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

const ME = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THEM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const entry = (on: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { PassportThreadRows } from "@/components/passport/PassportThreadRows";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  const p = getDictionary("en").passportV2;
  const words = { show: p.showInChat, hint: p.showInChatHint, offTitle: p.showInChatOff, offHint: p.showInChatOffHint,
    sent: p.shownInChat, failed: p.sendFailed, viewTheirs: p.viewTheirs, viewTheirsHint: p.viewTheirsHint };
  mount(<><ToastHost /><PassportThreadRows passport={{ on: ${on}, words }} conversationId="conv-1" meId="${ME}" counterpartId="${THEM}" counterpartName="Amaka" /></>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the passport rows in the options sheet", () => {
  it("posts the reader's own passport as a share message, and nobody else's", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(true),
      actions: { sendMessage: "async () => ({ ok: false, error: 'stay here' })" },
    });
    try {
      await page.getByTestId("thread-passport-show").click();
      await page.getByRole("alert").waitFor();
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls).toEqual([["sendMessage", { conversationId: "conv-1", body: `Shared a passport\n/passport/${ME}` }]]);
      /* A refusal (a block, a pause) is said, not swallowed. */
      /* Said by the one top banner (founder, 7 November 2026). */
      expect(await page.getByRole("alert").innerText()).toContain("stay here");
    } finally {
      await close();
    }
  });

  it("links to the other member's passport", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), actions: {} });
    try {
      expect(await page.getByTestId("thread-passport-view").getAttribute("href")).toBe(`/passport/${THEM}`);
      expect(await page.getByTestId("thread-passport-view").innerText()).toContain("View Amaka's passport");
    } finally {
      await close();
    }
  });

  it("with the passport off, posts nothing and points at the page that turns it on", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), actions: {} });
    try {
      expect(await page.getByTestId("thread-passport-show").count()).toBe(0);
      const off = page.getByTestId("thread-passport-off");
      expect(await off.getAttribute("href")).toBe("/settings/passport");
      expect(await off.innerText()).toContain("Turn on your passport to show it");
      const calls = await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
      expect(calls).toEqual([]);
    } finally {
      await close();
    }
  });
});
