/**
 * THE CHROME ROUND THE CHAT: THE KEYBOARD FOOT, THE SCROLLBAR AND THE TAP
 * (the founder, 11 November 2026, on his iPhone). Three things he could see
 * at once in one screenshot of a thread, pinned here on the real `ThreadView`
 * in a real Chromium, on the product's own four stylesheets:
 *
 *   A  the "Type a message" bar sat too far down with the keyboard open, a
 *      visible band of nothing between it and the keys. The bar pads itself
 *      by `env(safe-area-inset-bottom)`, which describes the home indicator
 *      at the bottom of the DEVICE; with the keys up the bottom of the
 *      viewport is the top of the keyboard and no indicator is there, so the
 *      padding is dead air. `data-keyboard="open"` collapses it, and the
 *      point of this test is that the collapse WINS over every other
 *      declaration of that padding (threads.css, grade1.css, input-bar.css).
 *   B  a pale scrollbar drawn down the right edge while he scrolled. A chat
 *      shows none.
 *   C  a lit rectangle round the whole bar when a thumb taps it. iMessage and
 *      WhatsApp light nothing; the ring is kept where a keyboard user needs
 *      it, on a pointer-and-keyboard machine.
 *
 * WHY THE STYLESHEET IS REWRITTEN BEFORE IT IS LOADED. A headless browser is
 * on no device, so `env(safe-area-inset-bottom)` is 0 there and both states
 * would measure the same. The one substitution below puts the iPhone's 34
 * points back, which is the only way to measure the gap being fixed. Nothing
 * else about the product CSS is touched.
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

/** The home indicator this device would report, which a headless one does not. */
const HOME_INDICATOR = "34px";
const CSS = productCss(
  "app/css/threads.css",
  "app/css/grade1.css",
  "app/css/messages-g1.css",
  "app/css/input-bar.css",
).replace(/env\(safe-area-inset-bottom(?:, *0px)?\)/g, HOME_INDICATOR);

const CONV = "00000000-0000-4000-8000-00000000c001";
const MESSAGES = [
  { id: "a1", mine: false, body: "Is the flat still available?", timeLabel: "10:24", imageUrl: null },
  { id: "a2", mine: true, body: "Yes, it is.", timeLabel: "10:30", imageUrl: null },
];

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  mount(
    <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live
        conversationId="${CONV}"
        meId="00000000-0000-4000-8000-000000000001"
        counterpartName="Ada Eze"
        counterpartTier="none"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        messages={${JSON.stringify(MESSAGES)}}
      />
    </div>,
  );
`;

/** The computed bottom padding of the composer, in pixels as a string. */
const composerFoot = (page: Page) =>
  page.evaluate(() => {
    const form = document.querySelector("form.nf-composer");
    return form ? getComputedStyle(form).paddingBottom : "(no composer)";
  });

/** Tell the page a keyboard of this height is up, the way the runtime does. */
const openKeyboard = (page: Page, height: number) =>
  page.evaluate((px) => {
    document.documentElement.style.setProperty("--nf-keyboard-inset", `${px}px`);
    document.documentElement.dataset.keyboard = "open";
  }, height);

describe.skipIf(!hasBrowser && !process.env.CI)("the composer's foot, with and without a keyboard", () => {
  it("clears the home indicator with the keys down and sits straight on the keys with them up", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      /* Closed: the bar clears the home indicator, which is what that padding
         is for and must not regress. */
      expect(await composerFoot(page)).toBe(HOME_INDICATOR);

      /* Open: the indicator's reservation is gone, and what is left is the
         small resting gap (`--nf-space-xs`) and nothing else. */
      await openKeyboard(page, 336);
      /* `--nf-space-xs` is written in rem; resolve it the way the browser
         does rather than asserting a number this file chose. */
      const tight = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.paddingBottom = "var(--nf-space-xs)";
        document.body.append(probe);
        const value = getComputedStyle(probe).paddingBottom;
        probe.remove();
        return value;
      });
      expect(await composerFoot(page)).toBe(tight);
      expect(Number.parseFloat(await composerFoot(page))).toBeLessThan(Number.parseFloat(HOME_INDICATOR));

      /* And back again when they go, so a dismissed keyboard does not leave
         the bar hard against the home indicator. */
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--nf-keyboard-inset", "0px");
        delete document.documentElement.dataset.keyboard;
      });
      expect(await composerFoot(page)).toBe(HOME_INDICATOR);
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the conversation's scrollbar", () => {
  it("is not drawn at all, and the pane still scrolls", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      const measured = await page.evaluate(() => {
        const pane = document.querySelector(".nf-thread__scroll");
        if (!pane) return null;
        const style = getComputedStyle(pane);
        return { width: style.scrollbarWidth, overflow: style.overflowY };
      });
      expect(measured).not.toBeNull();
      expect(measured!.width).toBe("none");
      expect(measured!.overflow).toBe("auto");
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("tapping the chat bar", () => {
  const edge = (page: Page) =>
    page.evaluate(() => {
      const box = document.querySelector(".nf-composer__box");
      return box ? getComputedStyle(box).borderBottomColor : "(no box)";
    });

  it("lights nothing on a touch screen", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, touch: true });
    try {
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const resting = await edge(page);
      await page.focus("#thread-input");
      expect(await edge(page)).toBe(resting);
    } finally {
      await close();
    }
  });

  it("still lights the edge on a pointer-and-keyboard machine, where it is the only indicator", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(true);
      const resting = await edge(page);
      await page.focus("#thread-input");
      expect(await edge(page)).not.toBe(resting);
    } finally {
      await close();
    }
  });
});
