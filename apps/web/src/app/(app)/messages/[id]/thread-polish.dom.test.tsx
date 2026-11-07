/**
 * THE THREAD'S GRADE 1 POLISH, ON THE REAL `ThreadView` IN CHROMIUM.
 *
 * Runs of bubbles (one side, a few minutes apart) sit together with the time
 * under the last of them; the day is a chip; a web address in a message is a
 * link that opens outside the app; Reply names who is answered and what it
 * was (a voice note is "Voice note", never its placeholder words) and puts
 * the cursor in the field; far up a long thread, a round arrow takes the
 * reader back to the newest message.
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

const CSS = productCss("app/css/threads.css", "app/css/grade1.css", "app/css/messages-g1.css");

const at = (minute: number) => new Date(Date.UTC(2026, 10, 6, 9, minute)).toISOString();
const label = (minute: number) => `10:${String(minute).padStart(2, "0")}`;

const RUN = [
  { id: "r1", mine: false, body: "Hello, is it still free?", timeLabel: label(0), createdAt: at(0), imageUrl: null },
  { id: "r2", mine: false, body: "Details here: https://vallo.ng/listing/abc.", timeLabel: label(1), createdAt: at(1), imageUrl: null },
  { id: "r3", mine: false, body: "Thanks", timeLabel: label(2), createdAt: at(2), imageUrl: null },
  { id: "r4", mine: true, body: "Yes it is", timeLabel: label(20), createdAt: at(20), imageUrl: null },
  {
    id: "v1",
    mine: false,
    body: "\u{1F3A4} Voice note",
    timeLabel: label(21),
    createdAt: at(21),
    imageUrl: null,
    audio: { url: "data:audio/wav;base64,", durationMs: 4000, peaks: [0.2, 0.8, 0.5] },
  },
];

const LONG = Array.from({ length: 60 }, (_, i) => ({
  id: `l${i}`,
  mine: i % 2 === 0,
  body: `Message number ${i} about the flat in Yaba`,
  timeLabel: label(i % 60),
  createdAt: new Date(Date.UTC(2026, 10, 6, 9, 0) + i * 10 * 60_000).toISOString(),
  imageUrl: null,
}));

const entry = (messages: unknown[]) => `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  mount(
    <div style={{ height: 760, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live={false}
        conversationId="00000000-0000-4000-8000-00000000c001"
        meId="00000000-0000-4000-8000-000000000001"
        counterpartName="Ada Eze"
        counterpartTier="none"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        nowMs={${Date.UTC(2026, 10, 7, 12)}}
        messages={${JSON.stringify(messages)}}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the thread's polish", () => {
  it("groups a run, with the time once under its last bubble and the corners tucked", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(RUN), css: CSS });
    try {
      const run = await page.evaluate(() =>
        ["r1", "r2", "r3", "r4"].map((id) => document.querySelector(`[data-msg-id="${id}"]`)!.getAttribute("data-run")),
      );
      expect(run).toEqual(["first", "middle", "last", "single"]);
      expect(await page.locator('[data-msg-id="r1"] [data-testid="msg-status"]').count()).toBe(0);
      expect(await page.locator('[data-msg-id="r3"] [data-testid="msg-status"]').textContent()).toBe("10:02");
      /* The day is a chip that rides at the top while its messages scroll. */
      expect(await page.getByTestId("day-divider").first().evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    } finally {
      await close();
    }
  });

  it("draws a web address as a link that opens outside the app, keeping the full stop with the words", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(RUN), css: CSS });
    try {
      const link = page.locator('[data-msg-id="r2"] a.nf-bubble__link');
      expect(await link.getAttribute("href")).toBe("https://vallo.ng/listing/abc");
      expect(await link.getAttribute("target")).toBe("_blank");
      expect(await link.getAttribute("rel")).toContain("noopener");
      expect(await page.locator('[data-msg-id="r2"] .nf-bubble__body').textContent()).toBe("Details here: https://vallo.ng/listing/abc.");
    } finally {
      await close();
    }
  });

  it("names a voice note in the reply bar by its kind and puts the cursor in the field", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(RUN), css: CSS });
    try {
      await page.locator('[data-msg-id="v1"] .nf-bubble').click({ button: "right" });
      await page.getByTestId("message-menu").getByRole("menuitem", { name: "Reply" }).click();
      const reply = page.getByTestId("composer-reply");
      await reply.waitFor();
      expect(await reply.textContent()).toContain("Replying to Ada Eze");
      expect(await reply.textContent()).toContain("Voice note");
      expect(await reply.textContent()).not.toContain("\u{1F3A4}");
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("thread-input");
    } finally {
      await close();
    }
  });

  it("offers the way back to the newest message once the reader is far up", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(LONG), css: CSS });
    try {
      const scroller = page.locator(".nf-thread__scroll");
      expect(await page.getByTestId("jump-newest").count()).toBe(0);
      await scroller.evaluate((el) => {
        el.scrollTop = 0;
        el.dispatchEvent(new Event("scroll"));
      });
      await page.getByTestId("jump-newest").waitFor();
      await page.getByTestId("jump-newest").click();
      await expect
        .poll(() => scroller.evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight)), { timeout: 5000 })
        .toBeLessThan(4);
      await expect.poll(() => page.getByTestId("jump-newest").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
