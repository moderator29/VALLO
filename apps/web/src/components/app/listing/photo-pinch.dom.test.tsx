/**
 * THE LISTING'S PHOTO VIEWER ZOOMS BY ITSELF (14 November 2026). The native
 * shell's web view has no pinch of its own, so the photograph carries its
 * zoom. Mounted for real in Chromium at a phone's size, with the product's
 * compiled cascade, and driven with touch events:
 *
 *   pinch       two fingers spreading to three times the gap zoom the
 *               photograph three times, and the track stops scrolling sideways
 *   pan         one finger then moves it, never past the photograph's edge,
 *               and a drag down while zoomed does not close the viewer
 *   double tap  two quick taps go back to rest; two more zoom in on the tap
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT * 2 });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* An 800 by 600 picture that needs no network: fitted to a 390 by 844 phone it is 390 by 292.5. */
const PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="teal"/></svg>')}`;

/* The product cascade the harness compiles has no Tailwind utilities, so the
   handful the viewer lays itself out with are written here as they resolve. */
const LAYOUT = `
  body { margin: 0; }
  [data-testid="listing-lightbox"] { position: fixed; inset: 0; }
  .nf-photo-viewer__track { display: flex; width: 100%; height: 100%; overflow-x: auto; }
  .nf-photo-viewer__track > div { position: relative; flex-shrink: 0; width: 100%; height: 100%; overflow: hidden; }
  [data-zoomable] { position: absolute; inset: 0; }
  [data-zoomable] img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
`;

const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { PhotoViewerProvider, usePhotoViewer } from "@/components/app/listing/PhotoViewer";
  const PHOTOS = [${JSON.stringify(PHOTO)}, ${JSON.stringify(PHOTO)}];
  function Opener() {
    const viewer = usePhotoViewer();
    return <button type="button" data-testid="open" onClick={() => viewer?.open(0)}>Open</button>;
  }
  mount(
    <PhotoViewerProvider title="Two bedroom flat, Yaba" photos={PHOTOS} hue={210} kind="apartment">
      <Opener />
    </PhotoViewerProvider>,
  );
`;

/* In the page: fire touch events at the photograph on screen, and read its zoom. */
const HELPERS = `
  window.__photo = () => document.querySelector('[data-testid="listing-lightbox"] [data-zoomable]');
  window.__touch = (type, points, changed) => {
    const target = window.__photo().querySelector("img");
    const make = (list) => list.map((p) => new Touch({ identifier: p[2] ?? 1, target, clientX: p[0], clientY: p[1] }));
    const touches = make(points);
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: make(changed ?? points) }));
  };
  window.__zoom = () => {
    const viewer = document.querySelector('[data-testid="listing-lightbox"]');
    const m = new DOMMatrixReadOnly(getComputedStyle(window.__photo()).transform);
    return {
      scale: Math.round(m.a * 100) / 100,
      x: Math.round(m.e * 100) / 100,
      y: Math.round(m.f * 100) / 100,
      zoomed: viewer.hasAttribute("data-zoomed"),
      trackHeld: getComputedStyle(viewer.querySelector(".nf-photo-viewer__track")).overflowX === "hidden",
    };
  };
  window.__frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))));
`;

type Zoomed = { scale: number; x: number; y: number; zoomed: boolean; trackHeld: boolean };
type W = {
  __touch: (type: string, points: number[][], changed?: number[][]) => void;
  __zoom: () => Zoomed;
  __frame: () => Promise<null>;
};

describe.skipIf(!hasBrowser && !process.env.CI)("the listing photo viewer's own zoom", () => {
  it("pinches, pans inside the photograph's edges, and double taps in and out", async () => {
    /* Reduced motion, so each zoom is read where it lands and not mid-way
       there. Not the harness's touch screen: its page has no viewport tag, so
       a phone context lays it out 980px wide, and the numbers below are a 390
       by 844 screen's. The touch events are made by hand either way. */
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: appCss() + LAYOUT, init: HELPERS, reducedMotion: true });
    try {
      await page.locator('[data-testid="open"]').click();
      await page.locator('[data-testid="listing-lightbox"] [data-zoomable] img').first().waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector<HTMLImageElement>('[data-testid="listing-lightbox"] [data-zoomable] img');
        return Boolean(img && img.naturalWidth === 800);
      });

      const stage = await page.evaluate(() => {
        const viewer = document.querySelector('[data-testid="listing-lightbox"]')!;
        return { width: viewer.clientWidth, height: viewer.clientHeight };
      });
      expect(stage).toEqual({ width: 390, height: 844 });
      const rest = await page.evaluate(() => (window as unknown as W).__zoom());
      expect(rest).toMatchObject({ scale: 1, zoomed: false, trackHeld: false });

      /* Two fingers 60px apart, spread to 180px about the same midpoint: three times. */
      const pinched = await page.evaluate(async () => {
        const w = window as unknown as W;
        w.__touch("touchstart", [[165, 422, 1], [225, 422, 2]]);
        w.__touch("touchmove", [[135, 422, 1], [255, 422, 2]]);
        w.__touch("touchmove", [[105, 422, 1], [285, 422, 2]]);
        await w.__frame();
        const during = w.__zoom();
        w.__touch("touchend", [], [[105, 422, 1], [285, 422, 2]]);
        await w.__frame();
        return { during, after: w.__zoom() };
      });
      expect(pinched.during).toMatchObject({ scale: 3, zoomed: true, trackHeld: true });
      /* The midpoint is the screen's centre, so the photograph stays centred. */
      expect(Math.abs(pinched.during.x)).toBeLessThan(1);
      expect(pinched.after).toMatchObject({ scale: 3, zoomed: true, trackHeld: true });

      /* One finger far to the right and far down: it stops at the photograph's
         own edges (1170 wide on a 390 screen is 390 each way; 877.5 tall on
         844 is 16.75), and the viewer is still open. */
      const panned = await page.evaluate(async () => {
        const w = window as unknown as W;
        w.__touch("touchstart", [[100, 300, 1]]);
        w.__touch("touchmove", [[400, 500, 1]]);
        w.__touch("touchmove", [[900, 900, 1]]);
        await w.__frame();
        w.__touch("touchend", [], [[900, 900, 1]]);
        await w.__frame();
        return { zoom: w.__zoom(), open: Boolean(document.querySelector('[data-testid="listing-lightbox"]')) };
      });
      expect(panned.open).toBe(true);
      expect(panned.zoom).toMatchObject({ scale: 3, x: 390, y: 16.75 });

      /* Two quick taps: back to rest, and the track scrolls again. */
      const tap = async () =>
        page.evaluate(async () => {
          const w = window as unknown as W;
          for (let i = 0; i < 2; i++) {
            w.__touch("touchstart", [[250, 400, 1]]);
            w.__touch("touchend", [], [[250, 400, 1]]);
          }
          await w.__frame();
          return w.__zoom();
        });
      expect(await tap()).toMatchObject({ scale: 1, x: 0, y: 0, zoomed: false, trackHeld: false });

      /* Two more: in to two and a half times with the tapped point (55px
         right of centre) brought to the centre, as the chat's viewer does. The
         photograph is still shorter than the screen, so it does not move up. */
      const inAgain = await tap();
      expect(inAgain).toMatchObject({ scale: 2.5, x: -137.5, y: 0, zoomed: true, trackHeld: true });
    } finally {
      await close();
    }
  });
});
