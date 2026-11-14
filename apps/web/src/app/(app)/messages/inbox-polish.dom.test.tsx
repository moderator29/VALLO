/**
 * THE INBOX'S GRADE 1 POLISH, ON THE REAL `Inbox` IN CHROMIUM.
 *
 * Search marks where each row matched (and a preview that matched past its
 * first line is re-cut around the match); a row slides left on touch to
 * uncover Mark read and Archive; Archive is said in the top banner with
 * Undo. A row's More button, and a long press on the row, open its action
 * sheet with the same actions the swipe has. The views are the shared count
 * tabs. The server actions are staged by the harness.
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

const CSS = productCss(
  "app/css/threads.css",
  "app/css/grade1.css",
  "app/css/messages-g1.css",
  "components/ui/count-tabs.css",
  "components/ui/action-sheet.css",
  "app/(app)/messages/inbox-menu.css",
);

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
      <Inbox
        rows={rows}
        meId="00000000-0000-4000-8000-000000000001"
        canMarkRead
        archiveOpen
        assistantOn
        inboxCopy={t.experienceInbox.inbox}
        plusCopy={t.inboxPlus}
        supportRows={window.__support || []}
        prefsOpen={Boolean(window.__prefsOpen)}
      />
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

  it("holds support conversations as an inner page of Messages, a waiting reply pinned under the assistant", async () => {
    const support = `window.__support = [
      { id: "t1", title: "Payments", reference: "VAL-SUP-00042", preview: "We have refunded your deposit.", whenLabel: "09:10", unread: true },
      { id: "t2", title: "Bookings", reference: "VAL-SUP-00007", preview: "Thanks, all sorted.", whenLabel: "Mon", unread: false },
    ];`;
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: support });
    try {
      /* All: the assistant first, then the reply waiting from support. */
      const top = page.locator(".nf-inbox-list > li").nth(1).getByTestId("inbox-support-row");
      expect(await page.locator(".nf-inbox-list > li").first().getByTestId("inbox-assistant").count()).toBe(1);
      expect(await top.getAttribute("href")).toBe("/support/messages/t1");
      expect(await top.textContent()).toContain("New reply from Vallo Support");

      await page.getByTestId("inbox-view-support").click();
      const rows = page.getByTestId("inbox-support-row");
      expect(await rows.count()).toBe(2);
      expect(await rows.nth(1).getAttribute("href")).toBe("/support/messages/t2");
      expect(await page.getByTestId("inbox-row").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("draws no Support chip for a member with no support conversations", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.getByTestId("inbox-view-support").count()).toBe(0);
      expect(await page.getByTestId("inbox-support-row").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("pins a chat to the top and mutes it from the swipe, each said in the banner", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init: "window.__prefsOpen = true;",
      actions: {
        pinConversation: `async (input) => ({ ok: true, data: { pinnedAt: input.pinned ? new Date().toISOString() : null, mutedUntil: null } })`,
        muteConversation: `async (input) => ({ ok: true, data: { pinnedAt: null, mutedUntil: input.until ? "2100-01-01T00:00:00.000Z" : null } })`,
      },
    });
    try {
      const names = () => page.getByTestId("inbox-row").evaluateAll((rows) => rows.map((r) => r.querySelector(".truncate")?.textContent ?? ""));
      const before = await names();
      const last = before.length - 1;
      /* The last row, pinned, rides to the top. */
      await slide(page, last, -300);
      await page.locator(".nf-inbox-swipe").nth(last).getByTestId("inbox-swipe-pin").click();
      await expect.poll(async () => (await names())[0]).toBe(before[last]);
      await expect.poll(() => page.getByText("Pinned to the top").count()).toBe(1);
      expect(await page.getByTestId("inbox-row").first().getByRole("img", { name: "Pinned" }).count()).toBe(1);

      /* Mute asks for how long, then marks the row. */
      await slide(page, 1, -300);
      await page.locator(".nf-inbox-swipe").nth(1).getByTestId("inbox-swipe-mute").click();
      await page.getByTestId("inbox-mute-week").click();
      await expect.poll(() => page.getByText("Muted. You will not be notified about this chat").count()).toBe(1);
      expect(await page.getByTestId("inbox-row").nth(1).getByRole("img", { name: "Muted" }).count()).toBe(1);
      expect(await page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).find((c) => c[0] === "muteConversation")?.[1])).toMatchObject({ until: "week" });
    } finally {
      await close();
    }
  });

  it("puts a refused pin back and says why", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init: "window.__prefsOpen = true;",
      actions: { pinConversation: `async () => ({ ok: false, error: "You can pin up to 5 conversations." })` },
    });
    try {
      await slide(page, 1, -300);
      await page.locator(".nf-inbox-swipe").nth(1).getByTestId("inbox-swipe-pin").click();
      await expect.poll(() => page.getByText("You can pin up to 5 conversations.").count()).toBe(1);
      expect(await page.getByRole("img", { name: "Pinned" }).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("offers no Pin and no Mute where the database has none yet", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.getByTestId("inbox-swipe-pin").count()).toBe(0);
      expect(await page.getByTestId("inbox-swipe-mute").count()).toBe(0);
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
  it("draws the views as count tabs: radios, 44 px or more, a count on the tab with a queue, no sideways scroll", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      const tabs = page.locator('[data-testid="inbox-views"] [role="radio"]');
      await expect.poll(() => tabs.count()).toBeGreaterThanOrEqual(2);
      expect(await page.getByTestId("inbox-view-recent").getAttribute("aria-checked")).toBe("true");
      for (const tab of await tabs.all()) {
        const box = (await tab.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      expect(await page.getByTestId("inbox-view-unread").locator("[data-count-badge]").count()).toBe(1);
      expect(await page.getByTestId("inbox-view-recent").locator("[data-count-badge]").count()).toBe(0);
      await page.getByTestId("inbox-view-unread").click();
      expect(await page.getByTestId("inbox-view-unread").getAttribute("aria-checked")).toBe("true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally {
      await close();
    }
  });

  it("opens a row's action sheet from its More button with the swipe's own actions, and archives from it", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init: "window.__prefsOpen = true;",
      reducedMotion: true,
      actions: {
        archiveConversation: `async () => ({ ok: true, data: { archived: true } })`,
        unarchiveConversation: `async () => ({ ok: true, data: { archived: false } })`,
      },
    });
    try {
      const rows = page.getByTestId("inbox-row");
      const before = await rows.count();
      const name = (await rows.nth(1).locator(".truncate").first().textContent()) ?? "";
      const href = await rows.nth(1).getAttribute("href");
      const more = page.getByTestId("inbox-row-more").nth(1);
      expect((await more.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await more.click();
      const sheet = page.getByRole("dialog", { name: `Actions for ${name}` });
      await sheet.waitFor();
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      /* The header card is the person, and opens the conversation. */
      expect(await page.getByTestId("inbox-row-menu-open").getAttribute("href")).toBe(href);
      expect(await sheet.locator(".nf-acts__head-title").textContent()).toBe(name);
      /* Nothing unread on this row: Pin, Mute (which asks for how long) and Archive. */
      expect(await sheet.locator(".nf-acts__label").allTextContents()).toEqual(["Pin", "Mute", "Archive"]);
      expect(await page.getByTestId("inbox-row-menu-mute").locator(".nf-acts__chevron").count()).toBe(1);
      await page.getByTestId("inbox-row-menu-archive").click();
      await expect.poll(() => rows.count()).toBe(before - 1);
      await expect.poll(() => page.getByRole("button", { name: "Undo" }).count()).toBe(1);
      const calls = await page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).map((c) => c[0]));
      expect(calls).toContain("archiveConversation");
    } finally {
      await close();
    }
  });

  it("opens the same sheet on a long press, and Mute from it asks for how long", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init: "window.__prefsOpen = true;",
      reducedMotion: true,
      actions: {
        muteConversation: `async (input) => ({ ok: true, data: { pinnedAt: null, mutedUntil: input.until ? "2100-01-01T00:00:00.000Z" : null } })`,
      },
    });
    try {
      const rows = page.getByTestId("inbox-row");
      const name = (await rows.nth(1).locator(".truncate").first().textContent()) ?? "";
      /* A finger held on the row, not moving. */
      await page.evaluate(() => {
        const row = document.querySelectorAll<HTMLElement>('[data-testid="inbox-row"]')[1]!;
        const box = row.getBoundingClientRect();
        row.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: box.left + 80, clientY: box.top + 20 }),
        );
      });
      const sheet = page.getByRole("dialog", { name: `Actions for ${name}` });
      await sheet.waitFor();
      await page.evaluate(() => {
        const row = document.querySelectorAll<HTMLElement>('[data-testid="inbox-row"]')[1]!;
        row.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true }));
      });
      /* The click that ends a hold is swallowed for a moment after the lift
         (use-long-press.ts), so the lifting finger cannot press a row. */
      await page.waitForTimeout(450);
      /* The hold opened the sheet and did not open the conversation. */
      expect(await page.evaluate(() => window.location.pathname.startsWith("/messages/"))).toBe(false);
      await page.getByTestId("inbox-row-menu-mute").click();
      await page.getByTestId("inbox-mute-8h").click();
      await expect.poll(() => page.getByText("Muted. You will not be notified about this chat").count()).toBe(1);
      expect(await rows.nth(1).getByRole("img", { name: "Muted" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("draws no More button on a row that has no action to offer", async () => {
    const bare = entry.replace("canMarkRead", "").replace("archiveOpen", "");
    const { page, close } = await mountInBrowser({ entry: bare, css: CSS });
    try {
      await expect.poll(() => page.getByTestId("inbox-row").count()).toBeGreaterThan(0);
      expect(await page.getByTestId("inbox-row-more").count()).toBe(0);
    } finally {
      await close();
    }
  });
  it("opens the inbox's options from the header's More button as plain rows with a Done bar", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, reducedMotion: true });
    try {
      const more = page.getByTestId("inbox-more");
      await more.click();
      const sheet = page.getByTestId("inbox-menu");
      await sheet.waitFor();
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      /* Rows only: no header card, no quick actions. */
      expect(await sheet.locator(".nf-acts__head, .nf-acts__quick").count()).toBe(0);
      expect(await sheet.locator(".nf-acts__row").count()).toBeGreaterThanOrEqual(6);
      for (const row of await sheet.locator(".nf-acts__row").all()) {
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(52);
      }
      expect(await page.getByTestId("inbox-compose").getAttribute("href")).toBe("/search");
      /* A row filters the list and closes the sheet. */
      await page.getByTestId("inbox-menu-archived").click();
      await sheet.waitFor({ state: "detached" });
      expect(await page.getByTestId("inbox-view-archived").getAttribute("aria-checked")).toBe("true");
      /* Done closes it and chooses nothing. */
      await more.click();
      await sheet.waitFor();
      await page.getByTestId("inbox-menu-done").click();
      await sheet.waitFor({ state: "detached" });
      expect(await page.getByTestId("inbox-view-archived").getAttribute("aria-checked")).toBe("true");
    } finally {
      await close();
    }
  });
});
