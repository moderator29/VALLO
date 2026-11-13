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

  /* The desktop lit the edge until 13 November 2026, when the founder asked
     for every text field to look native when focused: only the container,
     with the caret as the sign (`app/css/text-entry.css`). */
  it("lights nothing on a pointer-and-keyboard machine either", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(true);
      const resting = await edge(page);
      await page.focus("#thread-input");
      expect(await edge(page)).toBe(resting);
    } finally {
      await close();
    }
  });
});

/*
 * EVERY COMPOSER, NOT WHICHEVER ONE IS A FORM (the founder, 12 November 2026:
 * "you only fixed it for me and that users chat, it supposed to be fixed for
 * all messages, any message at all ... even for new conversations with
 * agent").
 *
 * The first message to somebody is the composer a person meets FIRST, and the
 * input bar pass of 7 November 2026 left it on the shape it replaced:
 * measured in WebKit at 390, a 314 by 44 field with a 14px corner, no glass
 * and no shadow, beside the thread's 358 by 50 island. This mounts the real
 * component and holds it to the platform's bar: one box, the island's corner,
 * the glass, a 16px field that iOS will not zoom, a send disc hit at the 44pt
 * floor, and the keyboard foot.
 *
 * `app/css/composer-contract.test.ts` is the other half: it fails if a
 * composer is added anywhere without the contract.
 */
const directEntry = `
  import { mount } from "@/lib/testing/browser-root";
  import { DirectFirstMessage } from "@/app/(app)/u/[handle]/message/DirectFirstMessage";
  mount(
    <div style={{ height: 700, display: "flex", flexDirection: "column" }}>
      <DirectFirstMessage
        handle="ada"
        name="Ada Eze"
        avatarUrl=""
        copy={{ placeholder: "Say hello", hint: "Say why you are writing.", send: "Send", sending: "Sending" }}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("a new conversation's composer", () => {
  /** The bar, the field and the send, as the browser draws them. */
  const measure = (page: Page) =>
    page.evaluate(() => {
      const form = document.querySelector("form.nf-composer");
      const box = document.querySelector(".nf-composer__box");
      const field = document.querySelector(".nf-composer__field");
      const send = document.querySelector(".nf-composer__send");
      if (!form || !box || !field || !send) return null;
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const grown = (el: Element) => {
        const before = getComputedStyle(el, "::before");
        const inset = Number.parseFloat(before.insetBlockStart || "0");
        const r = el.getBoundingClientRect();
        return before.content === "none" ? rect(el) : { w: Math.round(r.width - 2 * inset), h: Math.round(r.height - 2 * inset) };
      };
      const boxStyle = getComputedStyle(box);
      return {
        bar: rect(box),
        barRadius: boxStyle.borderTopLeftRadius,
        barGlass: boxStyle.backdropFilter || boxStyle.getPropertyValue("-webkit-backdrop-filter"),
        fieldFont: getComputedStyle(field).fontSize,
        sendHit: grown(send),
        footDown: getComputedStyle(form).paddingBottom,
      };
    });

  it("is the platform's input bar and not the shape it replaced", async () => {
    const { page, close } = await mountInBrowser({ entry: directEntry, css: CSS, touch: true });
    try {
      const m = await measure(page);
      expect(m).not.toBeNull();
      /* One box, the island's corner, the chat bar's glass. The old shape had
         no box at all, a 14px corner and no backdrop. */
      expect(m!.barRadius).toBe("28px");
      expect(m!.barGlass).not.toBe("none");
      /* 16px, or iOS zooms the page when the field takes focus. */
      expect(m!.fieldFont).toBe("16px");
      /* The send is drawn smaller and hit at the floor. */
      expect(m!.sendHit.h).toBeGreaterThanOrEqual(44);
      expect(m!.sendHit.w).toBeGreaterThanOrEqual(44);
    } finally {
      await close();
    }
  });

  it("takes its keyboard foot back, though nothing here is a form by accident", async () => {
    const { page, close } = await mountInBrowser({ entry: directEntry, css: CSS, touch: true });
    try {
      /* The home indicator's reservation, keys down. */
      expect(await composerFoot(page)).toBe(HOME_INDICATOR);
      await openKeyboard(page, 336);
      const foot = await composerFoot(page);
      expect(Number.parseFloat(foot)).toBeLessThan(Number.parseFloat(HOME_INDICATOR));
      /* And the contract reaches it through the class, so a composer written
         as a div or a section would be collapsed too. */
      const byClass = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.className = "nf-composer";
        document.body.append(probe);
        const value = getComputedStyle(probe).paddingBottom;
        probe.remove();
        return value;
      });
      expect(Number.parseFloat(byClass)).toBeLessThan(Number.parseFloat(HOME_INDICATOR));
    } finally {
      await close();
    }
  });
});
