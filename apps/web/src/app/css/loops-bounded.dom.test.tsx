/**
 * THE LAST LOOPS ARE BOUNDED, IN CHROMIUM (Session 3, C1; MOTION_SYSTEM
 * principle 10: nothing loops forever except the aurora and the assistant's
 * thinking state). The skeleton shimmers, the landing columns and the docs flow
 * pulse run a fixed number of times and rest, and a quiet reader (reduced
 * motion, Calm, Off, data saver) gets the same resting state without the motion.
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
  "app/css/controls.css",
  "app/social.css",
  "app/css/docs-motion.css",
  "app/css/animation.css",
  "app/css/data-saver.css",
  "app/css/motion-pref.css",
  "app/css/side-flip.css",
  "app/css/symbols.css",
  "app/css/motion.css",
  "app/css/auth.css",
);

const entryWith = (saver: boolean) => `
  import { mount } from "@/lib/testing/browser-root";
  ${saver ? `document.documentElement.setAttribute("data-save-data", "on");` : ""}
  mount(<div>
    <div id="sk" className="nf-skeleton" style={{ width: 300, height: 24 }} />
    <div id="skg" className="nf-skeleton nf-skeleton--glass" style={{ width: 300, height: 24 }} />
    <div id="soc" className="nf-social-skeleton" style={{ width: 300, height: 24 }} />
    <div id="tall" className="nf-skeleton" style={{ width: 300, height: 200 }} />
    <div id="tallglass" className="nf-skeleton nf-skeleton--glass" style={{ width: 300, height: 200 }} />
    <div id="tallsoc" className="nf-social-skeleton" style={{ width: 300, height: 200 }} />
    <div style={{ position: "relative", width: 600, height: 40 }}><span id="pulse" className="nf-flow__pulse" /></div>
  </div>);
`;

const VIEW = { width: 1000, height: 800 };
const SELECTORS = ["#sk", "#skg", "#soc", "#pulse"] as const;

/* The app and social slabs sweep on their `::after` (W2, round 5: a translated band, not a
   repainted background). */
const PSEUDO: Record<string, string | undefined> = {
  "#sk": "::after",
  "#skg": "::after",
  "#soc": "::after",
  "#tall": "::after",
  "#tallglass": "::after",
  "#tallsoc": "::after",
};
const style = (page: Page, sel: string, prop: string) =>
  page.evaluate(
    ([s, p, pseudo]) => (getComputedStyle(document.querySelector(s!)!, pseudo ?? null) as unknown as Record<string, string>)[p!],
    [sel, prop, PSEUDO[sel]] as const,
  );

/* The resting place of each sweep: the band's transform, one slab-width (300px) right of the box. */
const REST = { sk: "matrix(1, 0, 0, 1, 300, 0)", skg: "matrix(1, 0, 0, 1, 300, 0)", soc: "matrix(1, 0, 0, 1, 300, 0)" };
const rest = (page: Page) =>
  page.evaluate(() => {
    const band = (s: string) => getComputedStyle(document.querySelector(s)!, "::after").transform;
    return { sk: band("#sk"), skg: band("#skg"), soc: band("#soc") };
  });

/** Run every animation to its end now, as the clock would, and report where each sweep rests. */
const settle = async (page: Page) => {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.finish();
  });
  return rest(page);
};

describe.skipIf(!hasBrowser && !process.env.CI)("the last loops are bounded", () => {
  it("every one runs a fixed number of times, none infinite", async () => {
    const { page, close } = await mountInBrowser({ entry: entryWith(false), css: CSS, viewport: VIEW });
    try {
      const counts: Record<string, string> = {};
      for (const sel of SELECTORS) counts[sel] = String(await style(page, sel, "animationIterationCount"));
      expect(counts).toEqual({ "#sk": "4", "#skg": "4", "#soc": "4", "#pulse": "2" });
      expect(await style(page, "#sk", "animationFillMode")).toBe("forwards");
      expect(await style(page, "#soc", "animationFillMode")).toBe("forwards");
    } finally {
      await close();
    }
  });

  it("the skeletons settle to the tint a still slab has (the same in the glass and social slabs)", async () => {
    const standard = await mountInBrowser({ entry: entryWith(false), css: CSS, viewport: VIEW });
    const saver = await mountInBrowser({ entry: entryWith(true), css: CSS, viewport: VIEW });
    try {
      const ran = await settle(standard.page);
      /* Data saver never starts them: the band is at its base position. */
      const still = await rest(saver.page);
      expect(ran).toEqual(still);
      expect(still).toEqual(REST);
    } finally {
      await standard.close();
      await saver.close();
    }
  });

  it("moves the app and social slabs' band with transform alone, so the sweep repaints nothing (W2, round 5)", async () => {
    const { page, close } = await mountInBrowser({ entry: entryWith(false), css: CSS, viewport: VIEW });
    try {
      const sweeps = await page.evaluate(() =>
        ["#sk", "#skg", "#tall", "#soc", "#tallsoc"].map((sel) =>
          document
            .querySelector(sel)!
            .getAnimations({ subtree: true })
            .map((a) => {
              const effect = a.effect as KeyframeEffect;
              const props = new Set(effect.getKeyframes().flatMap((k) => Object.keys(k)));
              for (const meta of ["offset", "computedOffset", "easing", "composite"]) props.delete(meta);
              return { pseudo: effect.pseudoElement, props: [...props] };
            }),
        ),
      );
      for (const list of sweeps) expect(list).toEqual([{ pseudo: "::after", props: ["transform"] }]);
      /* The slab itself runs nothing: it paints its still tint once. */
      for (const sel of ["#sk", "#soc"]) {
        expect(await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).animationName, sel), sel).toBe("none");
      }
    } finally {
      await close();
    }
  });

  it("data saver starts none of them", async () => {
    const { page, close } = await mountInBrowser({ entry: entryWith(true), css: CSS, viewport: VIEW });
    try {
      for (const sel of ["#sk", "#skg", "#soc"]) expect(await style(page, sel, "animationName"), sel).toBe("none");
    } finally {
      await close();
    }
  });

  it("reduced motion, Calm and Off run them at most once and leave the same still tint", async () => {
    const quiet: { name: string; opts: Record<string, unknown> }[] = [
      { name: "reduced", opts: { reducedMotion: true } },
      { name: "calm", opts: { motion: "calm" } },
      { name: "off", opts: { motion: "off" } },
    ];
    for (const { name, opts } of quiet) {
      const { page, close } = await mountInBrowser({ entry: entryWith(false), css: CSS, viewport: VIEW, ...opts });
      try {
        for (const sel of SELECTORS) {
          expect(await style(page, sel, "animationIterationCount"), `${name} ${sel}`).toMatch(/^1$|^none$/);
        }
        const rested = await settle(page);
        expect(rested, name).toEqual(REST);
      } finally {
        await close();
      }
    }
  });
});

/*
 * THE LOADING AND PRESENCE MARKS (the lead's ruling, Session 3): the verifying
 * bar, the flip cover's breathing and the opt-in symbol loop are bounded; the
 * counterpart's typing dots and the code caret keep looping as live signals and
 * must stop under every quiet mode.
 */
const marksEntry = (saver: boolean) => `
  import { mount } from "@/lib/testing/browser-root";
  ${saver ? `document.documentElement.setAttribute("data-save-data", "on");` : ""}
  const sheet = document.createElement("style");
  sheet.textContent = "@layer utilities { .w3 { width: 33.333%; } }";
  document.head.append(sheet);
  mount(<div>
    <span id="track" style={{ display: "block", width: 120, height: 4, overflow: "hidden" }}>
      <span id="sweep" className="nf-verify-sweep w3" style={{ display: "block", height: "100%" }} />
    </span>
    <ul className="nf-flip-cover__miniature" data-shimmer=""><li id="mini" style={{ width: 20, height: 20 }} /></ul>
    <svg id="sym" className="nf-sym nf-sym--bounce nf-sym--loop" width="20" height="20" />
    <span id="dot" className="nf-typing-dot" style={{ display: "block", width: 6, height: 6 }} />
    <div className="nf-code__cell" data-next="" id="cell" style={{ width: 40, height: 40 }} />
  </div>);
`;

const MARKS = ["#sweep", "#mini", "#sym", "#dot"] as const;

describe.skipIf(!hasBrowser && !process.env.CI)("the loading marks are bounded and the presence signals stop when quiet", () => {
  it("runs a fixed number of times, except the two kept signals", async () => {
    const { page, close } = await mountInBrowser({ entry: marksEntry(false), css: CSS, viewport: VIEW });
    try {
      expect(await style(page, "#sweep", "animationIterationCount")).toBe("3, 1");
      expect(await style(page, "#mini", "animationIterationCount")).toBe("3");
      expect(await style(page, "#sym", "animationIterationCount")).toBe("3");
      expect(await style(page, "#dot", "animationIterationCount")).toBe("infinite");
      const caret = await page.evaluate(() => getComputedStyle(document.getElementById("cell")!, "::after").animationIterationCount);
      expect(caret).toBe("infinite");
    } finally {
      await close();
    }
  });

  it("the verifying bar settles part-way along its track and holds there, and the flip objects rest at full light", async () => {
    const { page, close } = await mountInBrowser({ entry: marksEntry(false), css: CSS, viewport: VIEW });
    try {
      const rest = await page.evaluate(() => {
        for (const a of document.getAnimations()) {
          if (a.effect?.getTiming().iterations === Infinity) continue;
          a.finish();
        }
        const track = document.getElementById("track")!.getBoundingClientRect();
        const seg = document.getElementById("sweep")!.getBoundingClientRect();
        return {
          offset: Math.round(seg.left - track.left),
          third: Math.round(track.width / 3),
          mini: getComputedStyle(document.getElementById("mini")!).opacity,
        };
      });
      expect(rest.offset).toBe(rest.third);
      expect(rest.mini).toBe("1");
    } finally {
      await close();
    }
  });

  it("data saver starts none of the marks, and still draws the verifying bar full", async () => {
    const { page, close } = await mountInBrowser({ entry: marksEntry(true), css: CSS, viewport: VIEW });
    try {
      for (const sel of MARKS.filter((m) => m !== "#sym")) expect(await style(page, sel, "animationName"), sel).toBe("none");
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("cell")!, "::after").animationName)).toBe("none");
      expect(await style(page, "#sweep", "width")).toBe(await style(page, "#track", "width"));
    } finally {
      await close();
    }
  });

  it("reduced motion, Calm and Off stop the typing dots and the caret (one pass at most)", async () => {
    const quiet: { name: string; opts: Record<string, unknown> }[] = [
      { name: "reduced", opts: { reducedMotion: true } },
      { name: "calm", opts: { motion: "calm" } },
      { name: "off", opts: { motion: "off" } },
    ];
    for (const { name, opts } of quiet) {
      const { page, close } = await mountInBrowser({ entry: marksEntry(false), css: CSS, viewport: VIEW, ...opts });
      try {
        expect(await style(page, "#dot", "animationIterationCount"), name).toMatch(/^1$|^none$|^0$/);
        const caret = await page.evaluate(() => getComputedStyle(document.getElementById("cell")!, "::after").animationName);
        expect(caret, name).toBe("none");
        for (const sel of ["#sweep", "#mini"]) {
          expect(await style(page, sel, "animationIterationCount"), `${name} ${sel}`).not.toMatch(/infinite|3/);
        }
      } finally {
        await close();
      }
    }
  });
});

/*
 * A SLAB AT REST IS THE PLAIN SURFACE, AT ANY HEIGHT (A8, fourth audit). The
 * shimmer used to be drawn at the 152 degree light angle, so on a tall slab
 * the frozen band still crossed the box; and the social ramp filled its whole
 * tile. The pixels are read back from a screenshot: the spread (darkest to
 * brightest RGB sum) over the slab's interior must be nothing at rest, and a
 * mid-sweep frame must show a band, or the sampler would prove nothing.
 */
const SLABS = ["#tall", "#tallglass", "#tallsoc"] as const;

/** The spread of RGB sums over the slab's interior (8px in from every edge). */
const spread = async (page: Page, sel: string): Promise<number> => {
  const png = (await page.locator(sel).screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const m = 8;
    const { data: px } = ctx.getImageData(m, m, bitmap.width - 2 * m, bitmap.height - 2 * m);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < px.length; i += 4) {
      const sum = px[i]! + px[i + 1]! + px[i + 2]!;
      if (sum < lo) lo = sum;
      if (sum > hi) hi = sum;
    }
    return hi - lo;
  }, png);
};

describe.skipIf(!hasBrowser && !process.env.CI)("a tall slab rests as the plain surface", () => {
  it("shows a band mid-sweep, and nothing once it has settled (the app, glass and social slabs)", async () => {
    const { page, close } = await mountInBrowser({ entry: entryWith(false), css: CSS, viewport: VIEW });
    try {
      /* Mid-sweep: hold each slab's animation a third of the way through a pass. */
      await page.evaluate((sels) => {
        for (const sel of sels) {
          for (const a of document.querySelector(sel)!.getAnimations({ subtree: true })) {
            a.pause();
            a.currentTime = 1400 * 0.4;
          }
        }
      }, [...SLABS]);
      for (const sel of SLABS) expect(await spread(page, sel), `${sel} mid-sweep`).toBeGreaterThan(12);
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      for (const sel of SLABS) expect(await spread(page, sel), `${sel} at rest`).toBeLessThanOrEqual(3);
    } finally {
      await close();
    }
  });

  it("is the same plain surface under data saver, where none of it runs", async () => {
    const { page, close } = await mountInBrowser({ entry: entryWith(true), css: CSS, viewport: VIEW });
    try {
      for (const sel of SLABS) expect(await spread(page, sel), `${sel} data saver`).toBeLessThanOrEqual(3);
    } finally {
      await close();
    }
  });
});
