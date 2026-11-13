/**
 * THE CHAT'S FULL-SCREEN MEDIA VIEWER, ON THE REAL `ThreadView` IN CHROMIUM
 * (founder, 13 October 2026: "tapping a photo does nothing").
 *
 * The thread is mounted whole, at a phone's 390px, with drawn pictures so
 * nothing is fetched. What is held here is what a person does with a photo:
 * tap it and it opens full screen in a dark viewer showing who sent it and when;
 * swipe or press an arrow and the next photo of the thread is there; double tap
 * zooms and a drag pans; swipe down, the X, Escape or the browser's Back close
 * it and focus goes back to the photo that was tapped; Tab never leaves it.
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
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css", "app/css/motion.css", "app/css/photo-viewer.css");

const picture = (w: number, h: number, fill: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${fill}'/></svg>`,
  )}`;

const COLOURS = ["steelblue", "seagreen", "tomato", "goldenrod"];
const MESSAGES = [
  { id: "a1", mine: false, body: "Here are the photos.", timeLabel: "10:24", imageUrl: null, createdAt: "2026-10-09T09:24:00.000Z" },
  /* Three photos in one run: one group in the thread. */
  ...[0, 1, 2].map((i) => ({
    id: `p${i}`,
    mine: false,
    body: "\u{1F4F7} Photo",
    timeLabel: "10:25",
    imageUrl: picture(600, 400, COLOURS[i]!),
    imageSize: { width: 600, height: 400 },
    createdAt: "2026-10-09T09:25:00.000Z",
  })),
  { id: "a2", mine: true, body: "Lovely, thank you.", timeLabel: "10:30", imageUrl: null, createdAt: "2026-10-09T09:30:00.000Z" },
  {
    id: "p9",
    mine: true,
    body: "\u{1F4F7} Photo",
    timeLabel: "10:31",
    imageUrl: picture(400, 600, COLOURS[3]!),
    imageSize: { width: 400, height: 600 },
    createdAt: "2026-10-09T09:31:00.000Z",
  },
];

const VIDEO_MESSAGE = {
  id: "v1",
  mine: false,
  body: "Walkthrough",
  timeLabel: "10:40",
  imageUrl: null,
  createdAt: "2026-10-09T09:40:00.000Z",
  file: { url: "data:video/mp4;base64,AAAA", name: "walkthrough.mp4", mime: "video/mp4", bytes: 1200 },
};

const entry = (messages: unknown[]) => `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  mount(
    <div style={{ height: 844, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live={false}
        conversationId="00000000-0000-4000-8000-00000000c001"
        meId="00000000-0000-4000-8000-000000000001"
        meName="Seyi Omojuni"
        counterpartName="Ada Eze"
        counterpartTier="none"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        viewerCopy={t.chatPolish.viewer}
        messages={${JSON.stringify(messages)}}
      />
    </div>,
  );
`;

const open = async (page: Page, index = 0) => {
  await page.getByTestId("photo-open").nth(index).click();
  await page.getByTestId("media-viewer").waitFor();
};
const position = async (page: Page) => (await page.getByTestId("media-viewer-position").textContent())?.trim();
const activeSrc = (page: Page) =>
  page.locator('[data-testid="media-viewer-slide"][data-active] img').evaluate((img) => (img as HTMLImageElement).src);
const scaleOf = (page: Page) =>
  page.locator('[data-testid="media-viewer-slide"][data-active] .nf-media-viewer__zoom').evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { scale: Number(m.a.toFixed(2)), x: Math.round(m.e), y: Math.round(m.f) };
  });
const drag = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
};

describe.skipIf(!hasBrowser && !process.env.CI)("the chat's full-screen media viewer", () => {
  it("opens a tapped photo full screen on a dark ground, with who sent it and when, and the photos in thread order", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      /* Before the tap there is no viewer, and every photo is a button. */
      expect(await page.getByTestId("media-viewer").count()).toBe(0);
      expect(await page.getByTestId("photo-open").count()).toBe(4);
      await open(page, 1);
      const box = await page.getByTestId("media-viewer").boundingBox();
      expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
      expect(await page.getByTestId("media-viewer").getAttribute("aria-modal")).toBe("true");
      /* The photo that was tapped (the second of the group), the sender and the time. */
      expect(await position(page)).toBe("2 of 4");
      expect(decodeURIComponent(await activeSrc(page))).toContain("seagreen");
      const who = (await page.getByTestId("media-viewer-who").textContent()) ?? "";
      expect(who).toContain("Ada Eze");
      expect(who).toContain("10:25");
      /* The photograph is fitted to the screen, not cropped. */
      const fit = await page.locator('[data-testid="media-viewer-slide"][data-active] img').evaluate((img) => getComputedStyle(img).objectFit);
      expect(fit).toBe("contain");
      /* Save is always there; the close control has a name. */
      expect(await page.getByRole("button", { name: "Save" }).count()).toBe(1);
      expect(await page.getByRole("button", { name: "Close" }).count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("moves to the next and previous photo on a swipe, and on the arrow keys", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      await open(page, 0);
      expect(await position(page)).toBe("1 of 4");
      /* Swipe left: the next photo. */
      await drag(page, [320, 420], [60, 420]);
      await page.waitForFunction(() => document.querySelector('[data-testid="media-viewer-position"]')?.textContent?.trim() === "2 of 4");
      expect(decodeURIComponent(await activeSrc(page))).toContain("seagreen");
      /* A short drag springs back and stays. */
      await drag(page, [200, 420], [170, 420]);
      expect(await position(page)).toBe("2 of 4");
      /* Right arrow: the next; left arrow: back. */
      await page.keyboard.press("ArrowRight");
      expect(await position(page)).toBe("3 of 4");
      expect(decodeURIComponent(await activeSrc(page))).toContain("tomato");
      await page.keyboard.press("ArrowRight");
      expect(await position(page)).toBe("4 of 4");
      /* The thread's last photo is the last: the arrow does nothing past it. */
      await page.keyboard.press("ArrowRight");
      expect(await position(page)).toBe("4 of 4");
      expect(decodeURIComponent(await activeSrc(page))).toContain("goldenrod");
      /* The sender changes with the photo: this one is mine. */
      expect(await page.getByTestId("media-viewer-who").textContent()).toContain("You");
      await page.keyboard.press("ArrowLeft");
      expect(await position(page)).toBe("3 of 4");
      /* Swipe right: the one before. */
      await drag(page, [60, 420], [330, 420]);
      await page.waitForFunction(() => document.querySelector('[data-testid="media-viewer-position"]')?.textContent?.trim() === "2 of 4");
    } finally {
      await close();
    }
  });

  it("closes on Escape, the X, a swipe down and the browser's Back, and puts focus back on the photo", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      const viewer = page.getByTestId("media-viewer");
      const tapped = page.getByTestId("photo-open").nth(2);

      await tapped.focus();
      await tapped.click();
      await viewer.waitFor();
      await page.keyboard.press("Escape");
      await viewer.waitFor({ state: "detached" });
      expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid"))).toBe("photo-open");

      await open(page, 0);
      await page.getByTestId("media-viewer-close").click();
      await viewer.waitFor({ state: "detached" });

      await open(page, 0);
      await drag(page, [200, 200], [200, 700]);
      await viewer.waitFor({ state: "detached" });

      /* Back closes the viewer first and leaves the thread where it was. */
      const before = await page.evaluate(() => window.location.href);
      await open(page, 0);
      await page.goBack();
      await viewer.waitFor({ state: "detached" });
      expect(await page.evaluate(() => window.location.href)).toBe(before);
      /* And the page can be scrolled again: the lock was let go. */
      expect(await page.evaluate(() => document.body.style.position)).toBe("");
    } finally {
      await close();
    }
  });

  it("zooms on a double tap, pans while zoomed, and zooms back out on the next double tap", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      await open(page, 3);
      expect(await scaleOf(page)).toEqual({ scale: 1, x: 0, y: 0 });
      await page.mouse.dblclick(195, 422);
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="media-viewer-slide"][data-active] .nf-media-viewer__zoom');
        return el !== null && new DOMMatrixReadOnly(getComputedStyle(el).transform).a === 2.5;
      });
      const zoomed = await scaleOf(page);
      expect(zoomed.scale).toBeGreaterThan(2);
      /* A drag now pans the photograph instead of changing the page. */
      await drag(page, [250, 400], [200, 380]);
      await page.waitForTimeout(400);
      const panned = await scaleOf(page);
      expect(panned.scale).toBe(zoomed.scale);
      expect(panned.x).toBeLessThan(zoomed.x);
      await page.mouse.dblclick(195, 422);
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="media-viewer-slide"][data-active] .nf-media-viewer__zoom');
        return el !== null && new DOMMatrixReadOnly(getComputedStyle(el).transform).a === 1;
      });
      expect(await scaleOf(page)).toEqual({ scale: 1, x: 0, y: 0 });
    } finally {
      await close();
    }
  });

  it("zooms with two fingers, and swipes with one finger, on touch", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      await open(page, 0);
      const touch = (type: string, id: number, x: number, y: number) =>
        page.getByTestId("media-viewer-stage").evaluate(
          (el, a) => el.dispatchEvent(new PointerEvent(a.type, { bubbles: true, cancelable: true, pointerId: a.id, pointerType: "touch", isPrimary: a.id === 1, clientX: a.x, clientY: a.y })),
          { type, id, x, y },
        );
      /* Two fingers spread from 60px apart to 180px apart: about 3x. */
      await touch("pointerdown", 1, 165, 420);
      await touch("pointerdown", 2, 225, 420);
      for (let i = 1; i <= 6; i += 1) {
        await touch("pointermove", 1, 165 - i * 10, 420);
        await touch("pointermove", 2, 225 + i * 10, 420);
      }
      await touch("pointerup", 2, 285, 420);
      await touch("pointerup", 1, 105, 420);
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="media-viewer-slide"][data-active] .nf-media-viewer__zoom');
        return el !== null && new DOMMatrixReadOnly(getComputedStyle(el).transform).a > 2.9;
      });
      /* Pinched back in below 1.05x it rests again. */
      await touch("pointerdown", 1, 105, 420);
      await touch("pointerdown", 2, 285, 420);
      for (let i = 1; i <= 6; i += 1) {
        await touch("pointermove", 1, 105 + i * 10, 420);
        await touch("pointermove", 2, 285 - i * 10, 420);
      }
      await touch("pointerup", 2, 225, 420);
      await touch("pointerup", 1, 165, 420);
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="media-viewer-slide"][data-active] .nf-media-viewer__zoom');
        return el !== null && new DOMMatrixReadOnly(getComputedStyle(el).transform).a === 1;
      });
      /* One finger, left: the next photo. */
      await touch("pointerdown", 3, 330, 420);
      for (let i = 1; i <= 8; i += 1) await touch("pointermove", 3, 330 - i * 30, 420);
      await touch("pointerup", 3, 90, 420);
      await page.waitForFunction(() => document.querySelector('[data-testid="media-viewer-position"]')?.textContent?.trim() === "2 of 4");
    } finally {
      await close();
    }
  });

  it("keeps Tab inside the viewer", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      await open(page, 0);
      const inside = () => page.evaluate(() => document.querySelector('[data-testid="media-viewer"]')?.contains(document.activeElement) ?? false);
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press("Tab");
        expect(await inside()).toBe(true);
      }
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press("Shift+Tab");
        expect(await inside()).toBe(true);
      }
    } finally {
      await close();
    }
  });

  it("offers Share only where the browser can share, and shares the photo itself", async () => {
    const without = await mountInBrowser({ entry: entry(MESSAGES), css: CSS, init: "Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });" });
    try {
      await open(without.page, 0);
      expect(await without.page.getByTestId("media-viewer-share").count()).toBe(0);
    } finally {
      await without.close();
    }
    const withShare = await mountInBrowser({
      entry: entry(MESSAGES),
      css: CSS,
      init: `
        window.__shared = [];
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", { value: async (data) => { window.__shared.push({ files: (data.files || []).map((f) => f.type), title: data.title }); }, configurable: true });
      `,
    });
    try {
      await open(withShare.page, 0);
      await withShare.page.getByTestId("media-viewer-share").click();
      await withShare.page.waitForFunction(() => (window as unknown as { __shared: unknown[] }).__shared.length === 1);
      const shared = await withShare.page.evaluate(() => (window as unknown as { __shared: { files: string[]; title: string }[] }).__shared[0]!);
      expect(shared.files).toEqual(["image/svg+xml"]);
      expect(shared.title).toBe("Photo from Ada Eze");
    } finally {
      await withShare.close();
    }
  });

  it("saves the photo as a download", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(MESSAGES), css: CSS });
    try {
      await open(page, 0);
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("media-viewer-save").click()]);
      expect(download.suggestedFilename()).toMatch(/^vallo-photo-p0\.svg$/);
      expect(await page.getByTestId("media-viewer-note").textContent()).toBe("Download started");
    } finally {
      await close();
    }
  });

  it("plays a video in the same viewer", async () => {
    const { page, close } = await mountInBrowser({ entry: entry([...MESSAGES.slice(0, 2), VIDEO_MESSAGE]), css: CSS });
    try {
      expect(await page.getByTestId("video-tile").count()).toBe(1);
      await page.getByTestId("video-tile").click();
      await page.getByTestId("media-viewer").waitFor();
      expect(await page.getByTestId("media-viewer-video").count()).toBe(1);
      /* No poster here, and it loads metadata only (13 November 2026), so the
         source asks for frame one (SafeVideo's withFirstFrame): never a black box. */
      expect(await page.getByTestId("media-viewer-video").getAttribute("src")).toBe(`${VIDEO_MESSAGE.file.url}#t=0.001`);
      expect(await page.getByTestId("media-viewer-video").getAttribute("preload")).not.toBe("auto");
      expect(await page.getByTestId("media-viewer-video").evaluate((v: HTMLVideoElement) => v.controls && v.hasAttribute("playsinline") && !v.autoplay)).toBe(true);
      /* The photo before it is one swipe away. */
      expect(await position(page)).toBe("2 of 2");
      await page.keyboard.press("ArrowLeft");
      expect(await position(page)).toBe("1 of 2");
      expect(await page.getByTestId("media-viewer-video").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("leaves a thread with no viewer words as it was: photos are pictures, not buttons", async () => {
    const bare = entry(MESSAGES).replace("viewerCopy={t.chatPolish.viewer}", "");
    const { page, close } = await mountInBrowser({ entry: bare, css: CSS });
    try {
      expect(await page.getByTestId("photo-open").count()).toBe(0);
      expect(await page.locator(".nf-photo-group__cell img").count()).toBe(4);
    } finally {
      await close();
    }
  });
});

/* GRADE 1 (N2): the viewer is dark in both themes, so it holds light status
   bar glyphs while it is open and hands the bar back when it closes. */
describe.skipIf(!hasBrowser && !process.env.CI)("the viewer's status bar", () => {
  it("holds light glyphs while open and releases them on close", async () => {
    const watched = entry(MESSAGES).replace(
      'const t = getDictionary("en");',
      `const t = getDictionary("en");
  import { STATUS_BAR_HOLD_EVENT, heldGlyphs } from "@/lib/native/status-bar-hold";
  window.__held = [];
  window.addEventListener(STATUS_BAR_HOLD_EVENT, () => window.__held.push(heldGlyphs()));`,
    );
    const { page, close } = await mountInBrowser({ entry: watched, css: CSS });
    try {
      const held = () => page.evaluate(() => (window as unknown as { __held: unknown[] }).__held);
      expect(await held()).toEqual([]);
      await open(page);
      await expect.poll(held).toEqual(["light"]);
      await page.getByTestId("media-viewer-close").click();
      await expect.poll(held).toEqual(["light", null]);
    } finally {
      await close();
    }
  });
});
