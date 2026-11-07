/**
 * THE INBOX'S GRADE 1 POLISH, ON THE REAL `Inbox` IN CHROMIUM.
 *
 * Search marks where each row matched (and a preview that matched past its
 * first line is re-cut around the match); a row slides left on touch to
 * uncover Mark read and Archive; Archive is said in the top banner with
 * Undo. The server actions are staged by the harness.
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

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { Inbox } from "@/app/(app)/messages/Inbox";
  import { INBOX } from "@/app/(dev)/preview/f5/fixtures";
  const t = getDictionary("en");
  const rows = [
    ...INBOX,
    {
      id: "00000000-0000-4000-8000-00000000c009",
      counterpartName: "Tunde Bello",
      listingTitle: "Studio in Yaba",
      lastMessage: "Thanks for the photos yesterday, the kitchen looks good and the deposit is fine for me",
      whenLabel: "Mon",
      unread: 0,
      isRequest: false,
      counterpartKind: "member",
      counterpartVerified: false,
      counterpartTier: "none",
      contextKind: "listing",
    },
  ];
  mount(
    <div className="nf-shell" style={{ width: 390 }}>
      <Inbox rows={rows} meId="00000000-0000-4000-8000-000000000001" canMarkRead archiveOpen inboxCopy={t.experienceInbox.inbox} plusCopy={t.inboxPlus} />
      <ToastHost />
    </div>,
  );
`;

/** A finger on a row: down, a slide left, up. */
const slide = (page: Page, index: number, to: number) =>
  page.evaluate(
    ({ index, to }) => {
      const row = document.querySelectorAll<HTMLElement>(".nf-inbox-swipe__row")[index]!;
      const box = row.getBoundingClientRect();
      const x0 = box.left + box.width * 0.7;
      const y0 = box.top + box.height / 2;
      const fire = (kind: string, dx: number) =>
        row.dispatchEvent(new PointerEvent(kind, { bubbles: true, cancelable: true, pointerId: 4, pointerType: "touch", isPrimary: true, clientX: x0 + dx, clientY: y0 }));
      fire("pointerdown", 0);
      for (let i = 1; i <= 8; i += 1) fire("pointermove", Math.round((to * i) / 8));
      fire("pointerup", to);
    },
    { index, to },
  );

describe.skipIf(!hasBrowser && !process.env.CI)("the inbox's polish", () => {
  it("marks where each row matched the search, re-cutting a long preview around the match", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.getByTestId("inbox-search-toggle").click();
      await page.getByTestId("inbox-search").fill("deposit");
      const rows = page.getByTestId("inbox-row");
      await expect.poll(() => rows.count()).toBe(1);
      expect(await rows.first().locator("mark.nf-inbox-hit").allTextContents()).toEqual(["deposit"]);
      expect(await rows.first().textContent()).toContain("…");
    } finally {
      await close();
    }
  });

  it("uncovers Mark read and Archive when a row slides left, and archives with Undo in the banner", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      actions: {
        archiveConversation: `async () => ({ ok: true, data: { archived: true } })`,
        unarchiveConversation: `async () => ({ ok: true, data: { archived: false } })`,
        markThreadRead: `async () => ({ ok: true, data: { updated: 2 } })`,
      },
    });
    try {
      /* The first row has unread messages: both actions. */
      expect(await page.locator(".nf-inbox-swipe").first().getAttribute("data-open")).toBeNull();
      await slide(page, 0, -140);
      await expect.poll(() => page.locator(".nf-inbox-swipe").first().getAttribute("data-open")).toBe("true");
      const actions = page.locator(".nf-inbox-swipe").first().locator(".nf-inbox-swipe__action");
      expect(await actions.allTextContents()).toEqual(["Mark read", "Archive"]);
      await page.getByTestId("inbox-swipe-read").first().click();
      await expect.poll(() => page.getByText("Marked as read").count()).toBe(1);
      expect(await page.getByTestId("inbox-row").first().getAttribute("data-unread")).toBeNull();

      /* The second row has nothing unread: Archive only. */
      const before = await page.getByTestId("inbox-row").count();
      await slide(page, 1, -140);
      await page.locator(".nf-inbox-swipe").nth(1).getByTestId("inbox-swipe-archive").click();
      await expect.poll(() => page.getByTestId("inbox-row").count()).toBe(before - 1);
      await expect.poll(() => page.getByRole("button", { name: "Undo" }).count()).toBe(1);
      await page.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => page.getByTestId("inbox-row").count()).toBe(before);
      const calls = await page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).map((c) => c[0]));
      expect(calls).toEqual(expect.arrayContaining(["markThreadRead", "archiveConversation", "unarchiveConversation"]));
    } finally {
      await close();
    }
  });

  it("leaves a short slide shut and a mouse never starts it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await slide(page, 0, -30);
      expect(await page.locator(".nf-inbox-swipe").first().getAttribute("data-open")).toBeNull();
      const row = page.locator(".nf-inbox-swipe__row").first();
      const box = (await row.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
      expect(await row.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
    } finally {
      await close();
    }
  });
});
