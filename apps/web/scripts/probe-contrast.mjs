/*
 * CONTRAST FROM THE PIXELS THAT WERE ACTUALLY PAINTED, ACROSS THE WHOLE
 * PREVIEW HARNESS, IN BOTH THEMES.
 *
 * Two earlier probes computed it from the cascade and both were wrong: one took
 * a 15%-alpha `color-mix` surface as if it were opaque, and one walked past a
 * gradient because it only ever read `background-color`. The second was caught
 * by a sanity case reading 1.09 for white on a brand button, which cannot
 * happen. Nothing derived from `getComputedStyle` is trusted here.
 *
 * WHAT CHANGED ON 22 SEPTEMBER, AND WHY. The previous version of this file
 * measured FOUR named elements on ONE route. That is not a contrast check, it
 * is four assertions. So it now SWEEPS: every text-bearing leaf element on
 * every route of the preview harness, at phone width, in dark and in light,
 * measured off the pixels.
 *
 * WHAT CHANGED ON 22 SEPTEMBER AT 22:30, AND IT IS THE WHOLE REASON THIS FILE
 * COULD NOT BE BELIEVED.
 *
 * The sweep took ONE `page.screenshot({ fullPage: true })` per route and read
 * every element's rectangle out of that single canvas. Chromium's full-page
 * capture stops containing content somewhere past roughly 4,700 CSS pixels on
 * this box: the PNG is still full height, it is still the right width, and
 * everything below the cut is BLANK. Nothing in the old file noticed. Its only
 * guard skipped elements whose rectangle fell outside the image bounds, and a
 * blank-but-full-height PNG is inside the bounds everywhere, so every element
 * below the cut was scored against paper that was never painted. A blank box
 * reads one colour twice, which the file then filed as `painted: false` if the
 * blankness was perfect and as a REAL FAILURE the moment a single stray pixel
 * of compression noise or a sliver of genuinely captured content landed in it.
 * Of 84 sampled failures from that run, 43 did not reproduce. The headline
 * "150 below the floor, 51 dark and 99 light" was measured this way and is
 * withdrawn.
 *
 * THE REPAIR, AND IT IS THE CHEAP ONE RATHER THAN THE CLEVER ONE. Do not ask
 * the browser for an image bigger than the browser can draw. Shoot the
 * VIEWPORT, which is the one rectangle Chromium is always honest about, scroll
 * down half a screen at a time, and measure only the elements that are on
 * SCREEN at that moment. Coordinates then come from `getBoundingClientRect`
 * directly, with no scroll offset arithmetic to get wrong, and the pixels under
 * an element are by construction pixels the compositor painted this frame.
 *
 * Three consequences worth stating because they are what makes the number
 * trustworthy rather than merely different:
 *
 *   1. EVERY ELEMENT IS MEASURED EXACTLY ONCE. It is tagged when it is taken,
 *      so an element visible at three scroll positions is not three findings.
 *   2. AN ELEMENT NEVER SEEN WHOLE IS REPORTED, NOT GUESSED AT. Anything taller
 *      than the step that never lands fully on screen gets its own pass with
 *      its top parked at the top of the viewport; anything still unreachable
 *      after that is counted and named in `unreached`, because "we could not
 *      look at it" is a different fact from "it passes".
 *   3. THE CAPTURE IS ITSELF CHECKED. A viewport shot whose pixels are all one
 *      colour is a blank frame, and a blank frame is refused rather than
 *      measured. That is the guard whose absence made the old number an
 *      artefact.
 *
 * Usage:
 *   node scripts/probe-contrast.mjs --base http://127.0.0.1:3184
 *   node scripts/probe-contrast.mjs --base ... --routes /preview/f4/settings
 *   node scripts/probe-contrast.mjs --base ... --json
 *
 * The server must be a PRODUCTION server with `VALLO_PREVIEW_HARNESS=1`.
 * `next dev` does not hydrate reliably on this box, so no proof from it counts.
 */
import { chromium } from "playwright-core";
import { readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEW_ROOT = join(HERE, "..", "src", "app", "(dev)", "preview");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://127.0.0.1:3184").replace(/\/$/, "");
const JSON_OUT = process.argv.includes("--json");
/*
 * `--faded` MEASURES THE ELEMENTS THE SWEEP OTHERWISE DECLINES TO LOOK AT, and
 * it is off by default so that a run with it and a run without it are the same
 * run as far as the headline number is concerned.
 *
 * The guard below walks past anything whose effective opacity is under nine
 * tenths, for the good reason written there: a sheet that is closed and a band
 * that has not been revealed are not statements about contrast. But a faded
 * element is not always a sheet. The agent calendar draws a PAST DAY as
 * `--nf-content-muted` at `opacity: 0.35`, which composites to about 1.55:1 on
 * a white page, and a date a person cannot read is a real defect that this
 * sweep has been silently walking past since the guard went in. "We decline to
 * measure this" and "this passes" are different facts, and only one of them was
 * reaching the report.
 *
 * So with the flag these are measured and reported in a bucket of their own.
 * They are NEVER counted in `fails`, because a faint element may be faint for a
 * frame rather than by design and the sweep cannot tell which from one
 * screenshot. The bucket is a list for a person to read, exactly like
 * `onMedia`.
 */
const FADED = process.argv.includes("--faded");
const WIDTH = Number(arg("width", "390"));
const VIEWPORT_H = Number(arg("height", "844"));
/*
 * ONE THEME. The founder removed light mode from the platform on 23 September
 * 2026, so this sweeps the only palette there is.
 *
 * `--themes` IS GONE RATHER THAN DEFAULTED, and the difference matters for a
 * measuring instrument. A flag that still accepts "light" would run a whole
 * sweep, find nothing wrong, and hand back a clean report about a theme that
 * does not exist; a report that cannot be distinguished from a passing one is
 * worse than no report. The seeding that set `nf_theme` in storage and put
 * `data-theme` on the root has gone with it: neither has a reader any more.
 *
 * `docs/design/LIGHT_MODE_REMOVED.md` is the record.
 */
const THEMES = ["dark"];

/*
 * THE ROUTE LIST IS READ OFF DISK, NOT WRITTEN DOWN HERE.
 *
 * A hardcoded list is a list that is wrong the week after it is written, and a
 * route added to the harness by someone who has never opened this file is
 * exactly the route that will carry the next defect. So the sweep walks
 * `src/app/(dev)/preview` for `page.tsx` and opens what it finds. A group index
 * page is a list of links and carries no product surface, so the bare group
 * routes are skipped; `/preview` itself is skipped for the same reason.
 */
function harnessRoutes() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        const rel = relative(PREVIEW_ROOT, dir).split(sep).filter(Boolean);
        /* Depth 0 is `/preview`, depth 1 is a group index. Both are link lists. */
        if (rel.length >= 2) out.push("/preview/" + rel.join("/"));
      }
    }
  };
  walk(PREVIEW_ROOT);
  return out.sort();
}

const ROUTES = (arg("routes", null) ?? harnessRoutes().join(","))
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

function lum([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  /*
   * WITHOUT THESE, HEADLESS CHROMIUM SILENTLY DROPS `backdrop-filter`, so every
   * glass surface measures as a flat fill and the measurement looks
   * authoritative.
   */
  args: [
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    /*
     * SUBPIXEL ANTIALIASING MAKES EVERY GLYPH PIXEL A DIFFERENT COLOUR, AND
     * THAT IS WHY LOW-CONTRAST SMALL TEXT READ 1.00:1.
     *
     * With LCD text on, Chromium blends each glyph edge per colour channel, so
     * a 12px word is drawn in a few hundred RGB triples of which none is
     * common. The histogram then has no colour above the half-a-per-cent floor
     * except the ground, and the probe reports the ground against itself.
     * Measured on `/preview/f5/agent-listings`: "5 photos" is plainly legible
     * in an element crop opened by hand and read 1.00:1 in both the sweep and
     * the crop until this flag went in. Greyscale antialiasing keeps the glyph
     * core one colour, which is the colour the stylesheet actually asked for.
     */
    "--disable-lcd-text",
  ],
});

const findings = [];
const errors = [];
const unreached = [];
const blankFrames = [];

/*
 * THE MEASURING FUNCTION, RUN ONCE PER SCROLL POSITION AGAINST A VIEWPORT SHOT.
 *
 * It is a string rather than a function reference because it is handed to
 * `page.evaluate` twice, from two different loops, and duplicating it is how
 * the two loops drift apart.
 */
const MEASURE = async ({ src, dpr, onlyTall, vw, vh, faded }) => {
  const img = new Image();
  img.src = "data:image/png;base64," + src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  /*
   * IS THERE ANYTHING IN THIS FRAME AT ALL. A uniform capture is a frame the
   * compositor never drew, and measuring one is exactly the fault this rewrite
   * exists to kill. Sampled on a coarse grid because reading every pixel of
   * every frame of every route is minutes of nothing.
   */
  let first = null;
  let varied = false;
  for (let y = 0; y < c.height && !varied; y += 16) {
    for (let x = 0; x < c.width; x += 16) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const k = `${p[0]},${p[1]},${p[2]}`;
      if (first === null) first = k;
      else if (k !== first) {
        varied = true;
        break;
      }
    }
  }
  if (!varied) return { blank: true, out: [] };

  const L = (v) => {
    const f = (x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
  };

  /*
   * A TEXT-BEARING LEAF, and leaf is the whole precision of it. A wrapper whose
   * descendants carry the words would be measured with every colour in the
   * subtree inside its rectangle, so the "surface" would be whatever happened
   * to cover the most pixels and the "ink" would be some unrelated glyph two
   * elements away. Only an element whose OWN child text nodes carry
   * non-whitespace is measured.
   */
  const own = (el) => {
    let s = "";
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue;
    }
    return s.replace(/\s+/g, " ").trim();
  };

  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.dataset.nfcDone === "1") continue;
    const text = own(el);
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
    /*
     * OPACITY COMPOUNDS, AND ASKING ONLY THE ELEMENT MISSES EVERY SHEET.
     *
     * A sheet that is closed, a scrim that is fading, a panel behind a modal:
     * in all three the leaf's own opacity is 1 and an ancestor's is not. The
     * words are then drawn as a faint wash of themselves and the histogram
     * reads the ground twice. `/preview/g1/sheet` in light reported
     * "Notifications" as ink rgb(237,240,246) on rgb(236,239,244), which is one
     * colour and its neighbour: that is a statement about a sheet that is not
     * open, not about the contrast of the word Notifications.
     *
     * So the effective opacity is the product down the chain, and anything
     * under nine tenths is not measured at all. It is not a pass and it is not
     * a failure; it is a surface that was not on screen in the state this frame
     * caught it in.
     */
    let effective = Number(cs.opacity);
    for (let a = el.parentElement; a && effective >= 0.9; a = a.parentElement) {
      const o = Number(getComputedStyle(a).opacity);
      if (!Number.isNaN(o)) effective *= o;
    }
    /* `faded` is the `--faded` flag: without it this is the skip the note above
       describes, with it the reading is taken and carried out marked. */
    if (effective < 0.9 && !faded) continue;
    const isFaded = effective < 0.9;
    /*
     * THE RECT HAS TO BE CLIPPED TO WHAT IS ACTUALLY ON SCREEN, AND THE
     * ODOMETER IS WHY.
     *
     * `.nf-odometer__digit` is a vertical strip of ten numerals in a window one
     * numeral tall. Its bounding rect is the whole strip, nine tenths of which
     * the ancestor clips away, so the first version of this sweep measured nine
     * invisible digits against whatever happened to be behind them and reported
     * sixteen failures on one balance figure. None of them is a fact about
     * anything a person sees.
     */
    /*
     * MEASURE THE WORDS, NOT THE BOX THEY SIT IN, AND THIS IS THE LARGEST
     * SINGLE SOURCE OF FALSE FAILURES THIS PROBE EVER HAD.
     *
     * A leaf's bounding rectangle is the whole line box. A `<p>` 222px wide
     * holding the words "5 photos" is nine tenths ground, so the glyph colour
     * covers about four pixels in a thousand and falls under the half-a-per-cent
     * floor that keeps stray pixels from being called ink. The histogram is then
     * left with the ground and one shade of the ground, and the probe reports
     * the ground against itself: 1.00:1 on text that an element crop opened by
     * hand shows plainly, in pale blue on navy, at something like seven to one.
     *
     * Measured on `/preview/f5/agent-listings`, dark, "5 photos": box 222x15,
     * ground rgb(0,3,21) at 57 per cent, glyph rgb(143,157,197) at 0.4 per
     * cent. Every short label in a wide box failed this way, in both themes,
     * and they were a large share of the number this probe has been reporting.
     *
     * The browser knows exactly where the glyphs are: a Range over the element's
     * own text nodes returns their client rectangles. The union of those is the
     * ink's actual footprint, and inside it the glyph is a large enough share of
     * the pixels to clear the floor honestly. It is also the right rectangle on
     * the merits: the contrast a person experiences is the contrast where the
     * letters are, not averaged over the empty half of the line.
     */
    let box = null;
    try {
      const r = document.createRange();
      for (const n of el.childNodes) {
        if (n.nodeType !== Node.TEXT_NODE || !n.nodeValue.trim()) continue;
        r.selectNodeContents(n);
        for (const rect of r.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          box = box
            ? {
                top: Math.min(box.top, rect.top),
                left: Math.min(box.left, rect.left),
                bottom: Math.max(box.bottom, rect.bottom),
                right: Math.max(box.right, rect.right),
              }
            : { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right };
        }
      }
    } catch {
      /* Fall through to the element box below. */
    }
    if (!box) {
      const b = el.getBoundingClientRect();
      box = { top: b.top, left: b.left, bottom: b.bottom, right: b.right };
    }
    /*
     * A GLYPH RUN IS TIGHTER THAN ITS LINE, so pad by a little of the type size
     * in each direction. Without the pad the sample can be all ink and no
     * ground on a bold short word, and "the surface" becomes the letter.
     */
    {
      const pad = Math.max(2, (parseFloat(getComputedStyle(el).fontSize) || 16) * 0.25);
      box = {
        top: box.top - pad,
        left: box.left - pad,
        bottom: box.bottom + pad,
        right: box.right + pad,
      };
    }
    for (let a = el.parentElement; a; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflow === "visible" && acs.overflowX === "visible" && acs.overflowY === "visible")
        continue;
      const ar = a.getBoundingClientRect();
      box = {
        top: Math.max(box.top, ar.top),
        left: Math.max(box.left, ar.left),
        bottom: Math.min(box.bottom, ar.bottom),
        right: Math.min(box.right, ar.right),
      };
    }
    const fullH = box.bottom - box.top;
    const fullW = box.right - box.left;
    if (fullW < 12 || fullH < 8) continue;

    /*
     * THE SCREEN IS THE ONLY PLACE THE PIXELS ARE REAL.
     *
     * The capture is the viewport, so an element is measurable exactly insofar
     * as it is inside the viewport right now. In the ordinary pass an element
     * is only taken when it is WHOLLY on screen, which is what makes one
     * element one reading. The tall pass, which runs afterwards for the few
     * elements that are taller than the step, takes the visible intersection
     * instead and says so, because a paragraph 900px tall still has real ink on
     * real ground in the part of it we can see.
     */
    const vis = {
      top: Math.max(box.top, 0),
      left: Math.max(box.left, 0),
      bottom: Math.min(box.bottom, vh),
      right: Math.min(box.right, vw),
    };
    const visH = vis.bottom - vis.top;
    const visW = vis.right - vis.left;
    if (visW <= 0 || visH <= 0) continue;
    const whole = visH >= fullH - 0.5 && visW >= fullW - 0.5;
    if (!onlyTall && !whole) continue;
    if (onlyTall && whole) continue;

    const size = parseFloat(cs.fontSize) || 16;
    /* A clipped remainder shorter than the type cannot hold a whole glyph, so
       whatever is in it is a fragment and not a reading. */
    if (visH < size * 0.7) continue;
    if (visW < 12 || visH < 8) continue;
    /* sr-only: clipped to nothing and taken out of flow. Nobody sees it, so its
       contrast is not a fact about the product. */
    if (cs.clipPath === "inset(50%)" || cs.clip === "rect(0px, 0px, 0px, 0px)") continue;

    const px = Math.round(vis.left * dpr);
    const py = Math.round(vis.top * dpr);
    const pw = Math.round(visW * dpr);
    const ph = Math.round(visH * dpr);
    if (px < 0 || py < 0 || px + pw > c.width || py + ph > c.height) continue;
    if (pw < 4 || ph < 4) continue;

    const d = ctx.getImageData(px, py, pw, ph).data;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    const sorted = [...hist.entries()].sort((a, b) => b[1] - a[1]);
    const toPx = (k) => k.split(",").map(Number);
    const total = pw * ph;
    const surface = toPx(sorted[0][0]);
    const surfaceShare = sorted[0][1] / total;

    /*
     * THE INK IS THE COLOUR FURTHEST FROM THE SURFACE IN LUMINANCE THAT STILL
     * COVERS HALF A PER CENT OF THE BOX. The floor is what keeps a single stray
     * pixel from being called ink.
     *
     * IT USED TO LOOK ONLY AT THE SIXTY MOST COMMON COLOURS, AND THAT IS WHY
     * LOW-CONTRAST SMALL TEXT READ 1.00:1.
     *
     * Antialiased type at 12px spreads its glyph over a few hundred distinct
     * shades, none of them common. On `/preview/f5/agent-listings` the words
     * "5 photos" are genuinely drawn, in dark navy on darker navy, and an
     * element crop of that box opened by hand shows them plainly; the sweep
     * reported 1.00:1, because the glyph core ranked below sixtieth by count
     * and the only colour left in the window was the ground. A reading of
     * "one colour twice" on text a person can see is the same class of fault
     * as the full-page capture this file was rewritten to kill: the number is
     * an artefact of the search, not a fact about the paint. So the whole
     * histogram is searched, bounded by the same 0.5 per cent floor.
     */
    let ink = surface;
    let best = 0;
    for (const [k, n] of sorted) {
      const v = toPx(k);
      const gap = Math.abs(L(v) - L(surface));
      if (gap > best && n > total * 0.005) {
        best = gap;
        ink = v;
      }
    }

    /*
     * NOTHING WAS PAINTED IN THIS BOX, which is not the same fact as "this text
     * has no contrast" and must not be reported as one. When the ink the
     * histogram finds IS the surface, the rectangle held a single colour: the
     * element is transformed out from under its own box, clipped by something
     * this walk did not catch, or still animating. A ratio of 1.00 computed
     * from one colour twice is an artefact of the measurement.
     */
    const painted = ink[0] !== surface[0] || ink[1] !== surface[1] || ink[2] !== surface[2];

    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    el.dataset.nfcDone = "1";
    out.push({
      text: text.slice(0, 44),
      tag: el.tagName.toLowerCase(),
      cls:
        typeof el.className === "string"
          ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")
          : "",
      ink,
      surface,
      surfaceShare: Math.round(surfaceShare * 100) / 100,
      size: Math.round(size * 10) / 10,
      large,
      painted,
      partial: !whole,
      faded: isFaded,
      opacity: Math.round(effective * 100) / 100,
    });
  }
  return { blank: false, out };
};

for (const theme of THEMES) {
  for (const route of ROUTES) {
    /*
     * `colorScheme: "light"` ON PURPOSE, AND IT IS NOT A LEFTOVER.
     *
     * The emulated OS preference is now the one thing worth varying, because
     * `html { color-scheme: dark }` in `base.css` is what stops a light
     * operating system painting its own white into the controls no stylesheet
     * can reach. Asking Chromium for LIGHT and still measuring a dark page is
     * the sweep quietly re-proving that line on every route it opens.
     */
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: VIEWPORT_H },
      colorScheme: "light",
      deviceScaleFactor: 2,
    });
    try {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      /*
       * WHAT THE BROWSER ACTUALLY GOT, BEFORE ANYTHING IS MEASURED ON IT.
       * The old surface comparison learned this the expensive way and this
       * file had never learned it at all: a 404, a 500 or a redirect to `/sign-in`
       * measures clean, because a sign-in screen has excellent contrast.
       */
      const status = response?.status() ?? 0;
      if (status < 200 || status >= 300) throw new Error(`server answered ${status}`);
      const landed = new URL(page.url()).pathname.replace(/\/$/, "") || "/";
      const asked = new URL(`${BASE}${route}`).pathname.replace(/\/$/, "") || "/";
      if (landed !== asked) throw new Error(`browser ended up at ${landed}`);
      /* A Next.js layout `notFound()` answers HTTP 200 with the not-found body,
         so the status above cannot see it and the marker has to be asked for. */
      if (await page.locator("[data-nf-not-found]").count())
        throw new Error("not-found body served at 200");

      await page.waitForTimeout(350);

      /*
       * A REVEAL BAND AT OPACITY 0 IS NOT A CONTRAST FAILURE, AND THE FIRST FULL
       * RUN OF THIS SWEEP REPORTED DOZENS OF THEM AS ONE. Only bands that are
       * ON SCREEN are asked about, because a band four screens down has not been
       * scrolled to yet and is supposed to be at opacity 0.
       */
      const settle = async () => {
        const deadline = Date.now() + 8_000;
        for (;;) {
          const stuck = await page.evaluate(
            () =>
              [...document.querySelectorAll(".nf-reveal")].filter((el) => {
                const r = el.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight) return false;
                return Number(getComputedStyle(el).opacity) < 0.5;
              }).length,
          );
          if (stuck === 0) return 0;
          if (Date.now() > deadline) return stuck;
          await page.waitForTimeout(400);
        }
      };
      if ((await settle()) > 0) throw new Error("reveal band(s) still under opacity 0.5 at the top");

      await page.evaluate(() => {
        document.querySelectorAll("[data-nfc-done]").forEach((el) => delete el.dataset.nfcDone);
      });

      const metrics = await page.evaluate(() => ({
        scrollH: Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0,
        ),
        vh: window.innerHeight,
        vw: window.innerWidth,
      }));

      /*
       * HALF A SCREEN AT A TIME. With a step of half the viewport, any element
       * no taller than the step lands WHOLLY inside the viewport at some
       * position, which is the covering argument that lets the ordinary pass
       * insist on whole elements and still see everything.
       */
      const step = Math.floor(metrics.vh / 2);
      const stops = [];
      for (let y = 0; y < Math.max(metrics.scrollH - metrics.vh, 0) + step; y += step) {
        stops.push(Math.min(y, Math.max(metrics.scrollH - metrics.vh, 0)));
        if (stops[stops.length - 1] >= Math.max(metrics.scrollH - metrics.vh, 0)) break;
      }
      if (stops.length === 0) stops.push(0);

      const found = [];
      for (const y of stops) {
        /* `scroll-behavior: smooth` in base.css makes a bare `scrollTo` a
           silent no-op without a compositor. `instant` is not optional. */
        await page.evaluate((top) => window.scrollTo({ top, left: 0, behavior: "instant" }), y);
        await page.waitForTimeout(260);
        await settle();
        const src = (await page.screenshot({ type: "png" })).toString("base64");
        const res = await page.evaluate(MEASURE, {
          src,
          dpr: 2,
          onlyTall: false,
          vw: metrics.vw,
          vh: metrics.vh,
          faded: FADED,
        });
        if (res.blank) {
          blankFrames.push(`${theme} ${route} @y=${y}`);
          continue;
        }
        found.push(...res.out);
      }

      /*
       * THE LEFTOVERS: anything taller than the step, which never lands whole
       * on screen however far we scroll. Each gets its own frame with its top
       * parked just below the top of the viewport, and is measured on the part
       * of it that is visible, marked `partial` so nobody reads it as a whole
       * reading. Anything still unreachable after that is NAMED, because
       * "could not look" and "passes" are different facts.
       */
      for (let pass = 0; pass < 12; pass++) {
        const next = await page.evaluate(() => {
          const own = (el) => {
            let s = "";
            for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue;
            return s.replace(/\s+/g, " ").trim();
          };
          for (const el of document.querySelectorAll("body *")) {
            if (el.dataset.nfcDone === "1") continue;
            if (!own(el)) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
            const r = el.getBoundingClientRect();
            if (r.width < 12 || r.height < 8) continue;
            if (r.height <= window.innerHeight) continue;
            return Math.max(0, r.top + window.scrollY - 8);
          }
          return null;
        });
        if (next === null) break;
        await page.evaluate((top) => window.scrollTo({ top, left: 0, behavior: "instant" }), next);
        await page.waitForTimeout(220);
        const src = (await page.screenshot({ type: "png" })).toString("base64");
        const res = await page.evaluate(MEASURE, {
          src,
          dpr: 2,
          onlyTall: true,
          vw: metrics.vw,
          vh: metrics.vh,
          faded: FADED,
        });
        if (res.blank) {
          blankFrames.push(`${theme} ${route} @tall y=${next}`);
          break;
        }
        found.push(...res.out);
      }

      const left = await page.evaluate(() => {
        const own = (el) => {
          let s = "";
          for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue;
          return s.replace(/\s+/g, " ").trim();
        };
        let n = 0;
        for (const el of document.querySelectorAll("body *")) {
          if (el.dataset.nfcDone === "1") continue;
          if (!own(el)) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
          const r = el.getBoundingClientRect();
          if (r.width < 12 || r.height < 8) continue;
          n++;
        }
        return n;
      });
      if (left > 0) unreached.push(`${theme} ${route}: ${left} leaf/leaves never seen whole on screen`);

      for (const f of found) {
        findings.push({ route, theme, ...f, ratio: ratio(f.ink, f.surface) });
      }
    } catch (e) {
      errors.push(`${theme} ${route}: ${e.message.split("\n")[0]}`);
    } finally {
      await page.close();
    }
  }
}
await browser.close();

/*
 * WHAT IS REPORTED, AND WHAT IS HELD BACK AS UNPROVEN.
 *
 * An element sitting on a PHOTOGRAPH has no single surface colour, so the
 * histogram's most common pixel is not "the background" and the ratio computed
 * from it is not a fact. Rather than drop those silently or report them as
 * failures, they are counted separately and named as needing a human. The
 * threshold is the surface's share of the element's own rectangle: below half,
 * there is no flat ground under the words.
 */
const FLAT = 0.5;
/*
 * A FADED READING IS NEVER A FAILURE HERE. See the note beside `--faded`: the
 * sweep cannot tell a designed fade from a frame caught mid-animation, so these
 * are listed for a person and kept out of every count. Without the flag there
 * are none of them and this changes nothing.
 */
const solid = findings.filter((f) => !f.faded);
const fails = solid.filter(
  (f) => f.painted && f.surfaceShare >= FLAT && f.ratio < (f.large ? 3 : 4.5),
);
const onMedia = solid.filter((f) => f.painted && f.surfaceShare < FLAT && f.ratio < 4.5);
const unpainted = solid.filter((f) => !f.painted);
const faded = findings.filter(
  (f) => f.faded && f.painted && f.surfaceShare >= FLAT && f.ratio < (f.large ? 3 : 4.5),
);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        fails,
        onMedia,
        faded,
        unpainted: unpainted.length,
        errors,
        unreached,
        blankFrames,
        measured: findings.length,
      },
      null,
      2,
    ),
  );
} else {
  const line = (f) =>
    `  ${f.theme.padEnd(5)} ${f.route}  ${f.tag}.${f.cls}  "${f.text}"  ${f.size}px  ` +
    `ink rgb(${f.ink}) on rgb(${f.surface}) = ${f.ratio.toFixed(2)}:1${f.partial ? "  [partial]" : ""}`;
  console.log(
    `contrast sweep: ${ROUTES.length} route(s) x ${THEMES.join(", ")} at ${WIDTH}px, ` +
      `viewport captures at ${VIEWPORT_H}px stepping half a screen.\n` +
      `${findings.length} text-bearing leaves measured off pixels that were on screen when they were read.\n`,
  );
  console.log(`BELOW THE FLOOR (4.5:1, or 3:1 for large text), on a flat ground: ${fails.length}`);
  fails.sort((a, b) => a.ratio - b.ratio).forEach((f) => console.log(line(f)));
  console.log(
    `\nON A PATTERNED OR PHOTOGRAPHIC GROUND, so the number is not a verdict: ${onMedia.length}`,
  );
  onMedia
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 40)
    .forEach((f) => console.log(line(f)));
  console.log(
    `\nNOTHING PAINTED IN THE ELEMENT'S OWN BOX, so no ratio can be read from it: ${unpainted.length}`,
  );
  if (FADED) {
    console.log(
      `\nFADED BELOW NINE TENTHS AND UNDER THE FLOOR ANYWAY, counted in nothing above` +
        ` because the sweep cannot tell a designed fade from a frame caught mid-animation: ${faded.length}`,
    );
    faded
      .sort((a, b) => a.ratio - b.ratio)
      .forEach((f) => console.log(`${line(f)}  [opacity ${f.opacity}]`));
  }
  if (unreached.length) {
    console.log(`\nLEAVES NEVER SEEN WHOLE ON SCREEN, so nothing is claimed about them: ${unreached.length}`);
    unreached.forEach((u) => console.log(`  ${u}`));
  }
  if (blankFrames.length) {
    console.log(`\nBLANK FRAMES REFUSED, which is the fault this rewrite exists for: ${blankFrames.length}`);
    blankFrames.forEach((b) => console.log(`  ${b}`));
  }
  if (errors.length) {
    console.log(`\nROUTES THAT DID NOT OPEN: ${errors.length}`);
    errors.forEach((e) => console.log(`  ${e}`));
  }
  const byTheme = Object.fromEntries(
    THEMES.map((t) => [t, fails.filter((f) => f.theme === t).length]),
  );
  console.log(
    `\n${fails.length === 0 ? "every measured leaf on a flat ground clears its floor." : `${fails.length} below the floor (` + THEMES.map((t) => `${t} ${byTheme[t]}`).join(", ") + ")."}`,
  );
}
process.exit(fails.length === 0 && errors.length === 0 ? 0 : 1);
