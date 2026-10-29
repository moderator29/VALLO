/**
 * PHOTOS IN A BUBBLE, MEASURED IN CHROMIUM (founder, 11 October 2026).
 *
 * The real `PhotoGroup` inside the real `BubbleGestures`, in the thread's row
 * structure, on the product's own thread stylesheet, at 390px. The photos are
 * drawn pictures of known sizes, so "exact proportions" is a number the browser
 * hands back: each photo's box has the photo's own width over height (so
 * `cover` crops nothing), the bubble is no wider than its photos (no padding),
 * a row shares one height and fills the bubble, and past three the group
 * swipes with a dot per three.
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

const CSS = productCss("app/css/threads.css");

const picture = (w: number, h: number, fill: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${fill}'/></svg>`,
  )}`;

const P = {
  tall: { id: "tall", url: picture(300, 400, "steelblue") },
  wide: { id: "wide", url: picture(800, 450, "seagreen") },
  square: { id: "square", url: picture(500, 500, "gray") },
};
/* Nine with no recorded size, so each is measured when it loads; the second
   carries its size, as a row with `width` and `height` would. */
const NINE = Array.from({ length: 9 }, (_, i) => ({
  id: `n${i}`,
  url: picture(i % 2 ? 300 : 400, i % 2 ? 400 : 300, i % 3 ? "slategray" : "teal"),
  ...(i === 1 ? { size: { width: 300, height: 400 } } : {}),
}));

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { PhotoGroup } from "@/components/app/messages/PhotoGroup";
  import { BubbleGestures } from "@/components/app/messages/BubbleGestures";
  const P = ${JSON.stringify(P)};
  const NINE = ${JSON.stringify(NINE)};
  window.__replied = 0;
  function Bubble({ photos, mine, testId, caption }) {
    return (
      <div data-testid={testId} className={"nf-msg" + (mine ? " nf-msg--mine" : "")}>
        <span className="nf-msg__avatar">A</span>
        <div className="nf-msg__stack nf-msg__stack--media">
          {!mine ? <p className="nf-msg__meta"><span className="nf-msg__sender">A long display name here</span></p> : null}
          <BubbleGestures
            side={mine ? "mine" : "theirs"}
            className={"nf-bubble " + (mine ? "nf-bubble--mine" : "nf-bubble--theirs") + " nf-bubble--media" + (caption ? "" : " nf-bubble--photos")}
            onLongPress={() => {}}
            onSwipeReply={() => { window.__replied += 1; }}
          >
            <PhotoGroup photos={photos} alt="Photo you attached" />
            {caption ? <p className="nf-bubble__body">{caption}</p> : null}
          </BubbleGestures>
          <p className="nf-msg__status"><span>10:42</span></p>
        </div>
      </div>
    );
  }
  mount(
    <div className="nf-thread" style={{ width: 390, height: 2000 }}>
      <div className="nf-thread__scroll" style={{ padding: "0 16px" }}>
        <Bubble testId="single-tall" photos={[P.tall]} />
        <Bubble testId="single-wide" photos={[P.wide]} mine />
        <Bubble testId="three" photos={[P.wide, P.tall, P.square]} />
        <Bubble testId="nine" photos={NINE} mine />
        <Bubble testId="captioned" photos={[P.tall, P.square]} mine caption="Here are more photos of the apartment. The yearly rent is two million eight hundred thousand naira, paid inside Vallo." />
      </div>
    </div>,
  );
`;

type Box = { w: number; h: number; x: number };

async function settle(page: Page) {
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const measure = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((row) => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.left };
    };
    const strip = row.querySelector<HTMLElement>(".nf-photo-group__strip")!;
    return {
      bubble: box(row.querySelector(".nf-bubble")!),
      row: box(row),
      group: box(row.querySelector(".nf-photo-group")!),
      strip: { ...box(strip), client: strip.clientWidth, scroll: strip.scrollWidth },
      cells: Array.from(row.querySelectorAll(".nf-photo-group__cell"), box),
      natural: Array.from(row.querySelectorAll("img"), (img) => img.naturalWidth / img.naturalHeight),
      dots: row.querySelectorAll(".nf-photo-group__dot").length,
      current: Array.from(row.querySelectorAll(".nf-photo-group__dot"), (d) => d.getAttribute("data-on")),
    };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("photos in a bubble", () => {
  it("lets one photo fill the bubble at its exact proportions, with no padding round it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await settle(page);
      for (const id of ["single-tall", "single-wide"]) {
        const m = await measure(page, id);
        const [cell] = m.cells;
        expect(cell!.w / cell!.h, id).toBeCloseTo(m.natural[0]!, 1);
        /* The bubble is the photo: as wide as it, and no taller than it. */
        expect(Math.abs(m.bubble.w - cell!.w), id).toBeLessThanOrEqual(2.5);
        expect(Math.abs(m.bubble.h - cell!.h), id).toBeLessThanOrEqual(2.5);
        expect(cell!.h, id).toBeLessThanOrEqual(352.5);
        expect(m.dots, id).toBe(0);
      }
    } finally {
      await close();
    }
  });

  it("keeps every photo bubble inside its row, and a caption wraps to the photos' width", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await settle(page);
      for (const id of ["single-tall", "single-wide", "three", "nine", "captioned"]) {
        const m = await measure(page, id);
        expect(m.bubble.x, id).toBeGreaterThanOrEqual(m.row.x - 0.5);
        expect(m.bubble.x + m.bubble.w, id).toBeLessThanOrEqual(m.row.x + m.row.w + 0.5);
      }
      const c = await measure(page, "captioned");
      expect(Math.abs(c.bubble.w - c.group.w)).toBeLessThanOrEqual(2.5);
    } finally {
      await close();
    }
  });

  it("sits two or three photos in one row at one height, together exactly the bubble's width", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await settle(page);
      const m = await measure(page, "three");
      const heights = m.cells.map((c) => c.h);
      for (const h of heights) expect(Math.abs(h - heights[0]!)).toBeLessThanOrEqual(1);
      m.cells.forEach((c, i) => expect(c.w / c.h).toBeCloseTo(m.natural[i]!, 1));
      const row = m.cells.reduce((sum, c) => sum + c.w, 0) + 2 * 2;
      expect(Math.abs(row - m.strip.client)).toBeLessThanOrEqual(1.5);
      expect(m.strip.scroll).toBeLessThanOrEqual(m.strip.client + 1);
      expect(m.dots).toBe(0);
    } finally {
      await close();
    }
  });

  it("shows three in a row past three, swipes to the rest, and keeps a dot per three in step", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await settle(page);
      const m = await measure(page, "nine");
      expect(m.cells).toHaveLength(9);
      const firstRow = m.cells.slice(0, 3).reduce((sum, c) => sum + c.w, 0) + 2 * 2;
      expect(Math.abs(firstRow - m.strip.client)).toBeLessThanOrEqual(1.5);
      m.cells.forEach((c, i) => expect(c.w / c.h, `photo ${i}`).toBeCloseTo(m.natural[i]!, 1));
      for (const c of m.cells) expect(Math.abs(c.h - m.cells[0]!.h)).toBeLessThanOrEqual(1);
      expect(m.strip.scroll).toBeGreaterThan(m.strip.client);
      expect(m.dots).toBe(3);
      expect(m.current).toEqual(["true", null, null]);

      /* Swiped to the end: the last dot. */
      await page.getByTestId("nine").locator(".nf-photo-group__strip").evaluate((s) => {
        s.scrollTo({ left: s.scrollWidth, behavior: "auto" });
        s.dispatchEvent(new Event("scroll"));
      });
      await page.waitForFunction(() =>
        document.querySelectorAll('[data-testid="nine"] .nf-photo-group__dot')[2]?.hasAttribute("data-on") === true,
      );
      /* The keyboard moves it too: focused, the left arrow scrolls it back. */
      const strip = page.getByTestId("nine").locator(".nf-photo-group__strip");
      const atEnd = await strip.evaluate((s) => s.scrollLeft);
      await strip.focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(
        (from) => document.querySelector<HTMLElement>('[data-testid="nine"] .nf-photo-group__strip')!.scrollLeft < from,
        atEnd,
      );
      /* And back at the start, the first dot is lit again. */
      await strip.evaluate((s) => {
        s.scrollTo({ left: 0, behavior: "auto" });
        s.dispatchEvent(new Event("scroll"));
      });
      await page.waitForFunction(() =>
        document.querySelectorAll('[data-testid="nine"] .nf-photo-group__dot')[0]?.hasAttribute("data-on") === true,
      );
      expect((await measure(page, "nine")).current).toEqual(["true", null, null]);
      /* The dots are an indicator: nothing to tab to, nothing a screen reader reads. */
      expect(await page.getByTestId("nine").locator("button").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("never sets a reply from a swipe that starts on photos that swipe, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await settle(page);
      await page.getByTestId("nine").locator(".nf-photo-group__cell").first().evaluate((cell) => {
        const box = cell.getBoundingClientRect();
        const fire = (type: string, dx: number) =>
          cell.dispatchEvent(
            new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: "touch", isPrimary: true, clientX: box.left + 100 + dx, clientY: box.top + 10 }),
          );
        fire("pointerdown", 0);
        for (let i = 1; i <= 8; i += 1) fire("pointermove", -i * 12);
        fire("pointerup", -96);
      });
      expect(await page.evaluate(() => (window as unknown as { __replied: number }).__replied)).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
