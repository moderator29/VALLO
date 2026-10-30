/**
 * THE THREAD'S NEW PARTS, ON THE REAL `ThreadView` IN CHROMIUM (founder, 11
 * October 2026): the "On Vallo since" line under the line that keeps chats
 * and payments inside Vallo, the avatars at the head of each run of bubbles
 * and in the header, Forward in the menu for a sent text message only, a
 * swipe that puts the reply in the composer, and photos drawn as a group.
 *
 * The thread is mounted whole, as the locale-fit test mounts it, with the
 * harness standing in for the server actions and the Supabase client. The
 * photos are drawn pictures, so nothing is fetched.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

const CSS = productCss("app/css/threads.css", "app/css/motion.css");

const picture = (w: number, h: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='gray'/></svg>`,
  )}`;

const MESSAGES = [
  { id: "a1", mine: false, body: "Is the flat still available?", timeLabel: "10:24", imageUrl: null },
  { id: "a2", mine: true, body: "Yes, it is.", timeLabel: "10:30", imageUrl: null },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    mine: true,
    body: "\u{1F4F7} Photo",
    timeLabel: "10:42",
    imageUrl: picture(i % 2 ? 300 : 400, i % 2 ? 400 : 300),
    imageSize: { width: i % 2 ? 300 : 400, height: i % 2 ? 400 : 300 },
  })),
  { id: "a3", mine: false, body: "Lovely, thank you.", timeLabel: "10:50", imageUrl: null },
];

const entry = (live: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  mount(
    <div style={{ height: 900, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live={${live}}
        conversationId="00000000-0000-4000-8000-00000000c001"
        meId="00000000-0000-4000-8000-000000000001"
        meName="Seyi Omojuni"
        meAvatarUrl={null}
        counterpartName="Ada Eze"
        counterpartTier="none"
        counterpartAvatarUrl="${picture(64, 64)}"
        counterpartHandle="ada"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        sinceLine="On Vallo since 9 October 2026"
        messages={${JSON.stringify(MESSAGES)}}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the thread's new parts", () => {
  it("puts On Vallo since directly under the line that keeps chats and payments inside Vallo, small", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      const since = page.getByTestId("thread-since");
      expect((await since.textContent())?.trim()).toBe("Ada Eze: On Vallo since 9 October 2026");
      const placed = await since.evaluate((el) => ({
        after: el.previousElementSibling?.className,
        size: parseFloat(getComputedStyle(el).fontSize),
        safety: parseFloat(getComputedStyle(el.previousElementSibling!).fontSize),
      }));
      expect(placed.after).toBe("nf-thread__safety");
      expect(placed.size).toBeLessThan(placed.safety);
    } finally {
      await close();
    }
  });

  it("draws the time once under a bubble, never inside it, and reads my message as read once they have replied", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      expect(await page.locator(".nf-bubble .nf-numeric").count()).toBe(0);
      const mine = page.locator(".nf-msg--mine", { hasText: "Yes, it is." });
      const status = mine.getByTestId("msg-status");
      expect((await status.textContent())?.trim()).toBe("10:30");
      /* After the bubble in the document, right aligned, and a reply makes it read. */
      expect(await mine.locator(".nf-swipe-reply + .nf-msg__status").count()).toBe(1);
      expect(await status.evaluate((el) => getComputedStyle(el).justifyContent)).toMatch(/end/);
      expect(await status.getByRole("img", { name: "Read" }).getAttribute("data-state")).toBe("read");
      /* A short message is a small box, not the column. */
      const w = await mine.locator(".nf-bubble").evaluate((el) => el.getBoundingClientRect().width);
      expect(w).toBeLessThan(160);
    } finally {
      await close();
    }
  });

  it("heads each run of bubbles with the person's photo, or their initial when there is none", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      const theirs = page.locator(".nf-msg:not(.nf-msg--mine) .nf-msg__avatar").first();
      expect(await theirs.locator("img").count()).toBe(1);
      const mine = page.locator(".nf-msg--mine .nf-msg__avatar").first();
      expect(await mine.locator("img").count()).toBe(0);
      expect((await mine.textContent())?.trim()).toBe("S");
      /* The header avatar carries the photo too. */
      expect(await page.locator(".nf-thread__ring img").count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("offers Forward for a sent text message on a live thread, never for a photo, and never in seed mode", async () => {
    const live = await mountInBrowser({ entry: entry(true), css: CSS });
    try {
      await live.page.getByText("Is the flat still available?").click({ button: "right" });
      expect(await live.page.getByRole("menuitem", { name: "Forward" }).count()).toBe(1);
      await live.page.getByRole("button", { name: "Close menu" }).click();
      await live.page.locator(".nf-photo-group__cell").first().click({ button: "right" });
      expect(await live.page.getByRole("menuitem", { name: "Reply" }).count()).toBe(1);
      expect(await live.page.getByRole("menuitem", { name: "Forward" }).count()).toBe(0);
    } finally {
      await live.close();
    }
    const seed = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      await seed.page.getByText("Is the flat still available?").click({ button: "right" });
      expect(await seed.page.getByRole("menuitem", { name: "Forward" }).count()).toBe(0);
    } finally {
      await seed.close();
    }
  });

  it("puts the swiped message in the composer as the reply, and draws the five photos as one swiping group", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      await page.getByText("Lovely, thank you.").evaluate((el) => {
        const box = el.getBoundingClientRect();
        const fire = (type: string, dx: number) =>
          el.dispatchEvent(
            new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, pointerType: "touch", isPrimary: true, clientX: box.left + 10 + dx, clientY: box.top + 5 }),
          );
        fire("pointerdown", 0);
        for (let i = 1; i <= 8; i += 1) fire("pointermove", i * 9);
        fire("pointerup", 72);
      });
      const reply = page.getByTestId("composer-reply");
      await reply.waitFor();
      expect(await reply.textContent()).toContain("Lovely, thank you.");
      expect(await page.locator(".nf-photo-group__cell").count()).toBe(5);
      expect(await page.locator(".nf-photo-group__dot").count()).toBe(2);
      expect(await page.locator(".nf-bubble--photos").count()).toBe(1);
    } finally {
      await close();
    }
  });
});
