/**
 * ===========================================================================
 * THE CONSISTENCY SWEEP: one row of NUMBERS per route, per width, per theme.
 * ===========================================================================
 *
 * WHY. The handoff's phase 3 (M5) asks for a consistency audit "with
 * numbers, measured, not a new look". Every earlier pass at this was a person
 * looking at screenshots, which finds the loud differences and misses the
 * quiet ones: a header gap that is 24px on one page and 32 on the next, a
 * card at 14px radius in a product whose card tier is 18, a control painted
 * at 40px that nobody can tap cleanly. Those are arithmetic, so a script
 * should find them and a person should only decide what to do about them.
 *
 * WHAT IT MEASURES, per page load, all from the rendered DOM:
 *
 *   header       whether a page header is drawn, which parts it has (title,
 *                subtitle, actions) and the title's position
 *   back         whether `[data-nav-back]` exists, where it sits, and its
 *                real painted size (the rule: 44 by 44, top left of the
 *                header; `docs/BACK_NAVIGATION.md`)
 *   primary      where the first `.nf-btn--primary` sits, if any
 *   headerGap    the gap in CSS px between the bottom of the header and the
 *                top of the first content below it
 *   cardRadius   the border radius of the first card surface on the page,
 *                with `cardRadii` carrying every distinct corner on it and
 *                the class that draws each, so a page is not judged by
 *                whichever card happened to come first in its markup
 *   overflow     `scrollWidth - clientWidth` on the document (the rule: 0)
 *   smallTargets every interactive element whose TARGET is under 44 by 44,
 *                counted, with the three worst named. The target is the
 *                painted box, or a child or pseudo-element hit area that
 *                overflows it: this platform grows a target without moving a
 *                pixel (`.nf-tap::after`, `.nf-btn--sm::before`), and a
 *                sweep that cannot see those reports the whole platform as
 *                broken. A link inside a sentence is counted separately
 *                (`inlineSmallCount`), the exemption WCAG 2.5.8 writes down.
 *
 * WHAT IT DOES NOT MEASURE, and why. Loading, empty and error states are
 * facts about a route's FILES (`loading.tsx`, `error.tsx`) and about states a
 * page only reaches with particular data, so they are read from the tree by
 * `--states`, not guessed at from one render.
 *
 * A ROUTE THAT REDIRECTS IS NOT A FAILURE. A signed-out sweep meets the
 * sign-in door on every member route. The run records the final address and
 * marks the row `needs-session` rather than measuring the door and calling it
 * the page. Those routes are covered through the preview harness instead.
 *
 * HOW THE THEME IS CHOSEN. The `nf_theme` cookie, which the server reads, so
 * both passes really render in different themes rather than both rendering
 * the default and the script claiming otherwise.
 *
 * HOW THE POINTER IS CHOSEN. The narrow pass runs with a touch screen and the
 * wide pass with a mouse, because the 44px rule is a touch rule and this
 * product keeps it with `@media (pointer: coarse)`. See the context below.
 *
 * IT WRITES EVERY ROW AS IT IS MEASURED, and can be killed. The first run of
 * this script lost 146 measured rows to a five-hour limit because it wrote
 * its JSON only at the end. Now each row is appended to `<json>.jsonl` the
 * moment it is taken, and on a restart every job already in that file is
 * skipped. So a sweep of 644 page loads can be run in pieces, across
 * sessions, and nothing measured is ever measured twice.
 *
 *   node scripts/consistency-sweep.mjs --base http://localhost:3300 \
 *     --routes /tmp/routes.txt --json /tmp/out.json [--widths 390,1440]
 *
 * To resume: run it again with the same `--json`. To start over: delete the
 * `.jsonl` beside it. `--only-missing` prints what is left and measures
 * nothing, so a person can see how much of the job remains.
 */
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

/* The same bootstrap every other probe in this folder uses: the workspace
   carries `playwright-core` and the browser lives outside it. */
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const CHROME = process.env.VALLO_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const base = arg("base", "http://localhost:3300");
const routesFile = arg("routes", null);
const jsonOut = arg("json", "consistency-sweep.json");
const widths = arg("widths", "390,1440").split(",").map(Number);
const themes = arg("themes", "dark,light").split(",");
const concurrency = Number(arg("concurrency", "4"));

const routes = routesFile
  ? readFileSync(routesFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : process.argv.slice(2).filter((a) => a.startsWith("/"));

if (routes.length === 0) {
  console.error("No routes. Pass --routes <file> or paths starting with /.");
  process.exit(2);
}

/**
 * Read from the page. Everything here is geometry off `getBoundingClientRect`
 * and `getComputedStyle`: no class name is treated as proof of anything, so a
 * page that draws its own header by hand is measured the same way as one on
 * the shared frame.
 */
const MEASURE = () => {
  const px = (n) => Math.round(n * 10) / 10;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) };
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.01;
  };

  /* THE HEADER. The shared frame draws `.nf-ph-large`; a page that draws its
     own top is found by taking the first visible h1 and the block that holds
     it, so a hand-rolled header is measured rather than reported as absent. */
  const frameHead = document.querySelector(".nf-ph-large, .nf-page-head, .nf-pagehead");
  const h1 = [...document.querySelectorAll("h1")].find(visible) ?? null;
  const headEl = frameHead && visible(frameHead) ? frameHead : h1 ? h1.closest("header, div, section") : null;

  const header = headEl
    ? {
        kind: frameHead && visible(frameHead) ? "frame" : "own",
        box: box(headEl),
        title: h1 ? { text: (h1.textContent ?? "").trim().slice(0, 40), box: box(h1) } : null,
        hasSubtitle: Boolean(headEl.querySelector(".nf-ph-large__sub, [data-page-subtitle]")),
        hasActions: Boolean(headEl.querySelector(".nf-ph-large__actions, [data-page-actions]")),
      }
    : null;

  /* THE BACK CONTROL. One selector, the one the rulebook names. */
  const backs = [...document.querySelectorAll("[data-nav-back]")].filter(visible);
  const back = backs.length
    ? {
        count: backs.length,
        box: box(backs[0]),
        destination: backs[0].getAttribute("data-back-destination") ?? null,
        name: (backs[0].getAttribute("aria-label") ?? "").slice(0, 40),
      }
    : { count: 0 };

  /* THE PRIMARY ACTION. The first one painted, wherever it is. */
  const primaryEl = [...document.querySelectorAll(".nf-btn--primary")].find(visible) ?? null;
  const primary = primaryEl
    ? { box: box(primaryEl), text: (primaryEl.textContent ?? "").trim().slice(0, 30) }
    : null;

  /* THE GAP under the header: the first element below it that paints
     something, and how far its top sits from the header's bottom. */
  /*
   * BOUNDED, because the first version of this was the whole sweep's cost.
   * It read every element under `main` and took a rect for each, which is a
   * forced layout per node: on a long page that is tens of thousands of
   * them, and 644 page loads of it did not finish in half an hour.
   *
   * The first thing drawn under a header is one of its own later siblings,
   * or one of their first few children. So it walks the siblings after the
   * header, and for each one descends at most two levels looking for
   * something painted. It stops at the first hit, which is the answer.
   */
  let headerGap = null;
  if (headEl) {
    const bottom = headEl.getBoundingClientRect().bottom;
    const painted = (el, depth) => {
      if (depth > 2) return null;
      const r = el.getBoundingClientRect();
      if (visible(el) && r.height > 4 && r.top >= bottom - 1) return r;
      for (const child of el.children) {
        const hit = painted(child, depth + 1);
        if (hit) return hit;
      }
      return null;
    };
    let node = headEl;
    let found = null;
    /* Up through the ancestors: a header wrapped in its own box has its
       siblings one level out, which is where the page's body actually is. */
    for (let up = 0; up < 3 && !found && node; up += 1) {
      let sibling = node.nextElementSibling;
      while (sibling && !found) {
        found = painted(sibling, 0);
        sibling = sibling.nextElementSibling;
      }
      node = node.parentElement;
    }
    if (found) headerGap = px(found.top - bottom);
  }

  /*
   * EVERY CARD's corner, not just the first one. The card tier is 18px
   * (`--nf-radius-card`).
   *
   * The first version read only the first card surface it found, and which
   * surface that is depends on the width: on `/stays/search` the 14px tile
   * is first at 390 and a 18px switch is first at 1440, so the same page
   * failed at one width and passed at the other for no reason that had
   * anything to do with the page. The distinct values are collected with
   * the class that carries each, so an off-tier corner is named and can be
   * argued with; `cardRadius` stays the first one so the table's column is
   * unchanged.
   */
  const cardEls = [...document.querySelectorAll(".nf-panel--card, .nf-card, [data-card], .nf-list-group")].filter(visible);
  const cardRadius = cardEls.length ? px(Number.parseFloat(getComputedStyle(cardEls[0]).borderTopLeftRadius)) : null;
  const radiiSeen = new Map();
  for (const el of cardEls) {
    const r = px(Number.parseFloat(getComputedStyle(el).borderTopLeftRadius));
    if (!Number.isFinite(r) || radiiSeen.has(r)) continue;
    radiiSeen.set(r, (el.className?.baseVal ?? el.className ?? "").toString().split(" ").slice(0, 3).join(" ").slice(0, 52));
  }
  const cardRadii = [...radiiSeen.entries()].map(([r, cls]) => ({ r, cls }));

  /* SIDEWAYS SCROLL on the document. The rule is zero. */
  const overflow = px(document.documentElement.scrollWidth - document.documentElement.clientWidth);

  /* CONTROLS UNDER 44. A control inside a row that scrolls sideways is still
     a control, so nothing is excused by its container; what IS excused is an
     element with no painted box (a hidden input behind a styled label). */
  const SELECTOR =
    'a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select,textarea,summary,[role="button"],[role="tab"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])';

  /*
   * THE TARGET A FINGER GETS, WHICH IS NOT ALWAYS THE BOX THAT PAINTS.
   *
   * This platform grows a target without moving a pixel, on purpose and in
   * two places: `.nf-tap::after` is `max(100%, 44px)` in both axes
   * (`app/css/base.css`) and `.nf-btn--sm::before` is `max(--nf-btn-h,
   * 2.75rem)` tall (`app/css/buttons.css`), which is how the button ladder
   * can paint the compact rung at 40px (the founder, 7 November 2026: "fix
   * our button size, they are too wide, they are too big") and still hand a
   * thumb 44. A pseudo-element is NOT a child node, so the first version of
   * this sweep could not see either one and reported 509 of 640 rows as
   * failing: 356 of them the compact button, 167 of them `.nf-tap`. Every
   * one of those was the measurement being wrong, not the page.
   *
   * Chromium resolves a pseudo-element's `width` and `height` to used pixels,
   * so they can simply be read. An area stretched with `left: 0; right: 0`
   * reports its width as `auto`, and its used width is then the element's
   * own, which is what the two rules above intend.
   */
  const pseudoHit = (el, which, ownWidth) => {
    const s = getComputedStyle(el, which);
    if (!s) return null;
    if (s.content === "none" || s.content === "normal") return null;
    if (s.position !== "absolute" && s.position !== "fixed") return null;
    const h = Number.parseFloat(s.height);
    let w = Number.parseFloat(s.width);
    if (!Number.isFinite(w) && s.left !== "auto" && s.right !== "auto") w = ownWidth;
    if (!Number.isFinite(h) || !Number.isFinite(w)) return null;
    return { w, h };
  };

  /*
   * A LINK INSIDE A LINE OF TYPE IS NOT A BUTTON, and the rule says so: WCAG
   * 2.5.8 exempts a target "in a sentence or whose size is otherwise
   * constrained by the line-height of non-target text". An `inline` box is
   * constrained by its line-height by definition, which is the whole of the
   * test: a legal page's prose links are 16px tall because that is what a
   * line of type is, and growing one would move the words around it. They
   * are counted apart (`inlineSmallCount`) rather than excused silently, so
   * the number stays arguable. Anything that is a BLOCK of its own, an
   * inline-flex row or a field, is judged by the 44px rule as before.
   */
  const inSentence = (el) => getComputedStyle(el).display === "inline";

  const small = [];
  const inlineSmall = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    /* A box clipped to a pixel is a screen-reader node behind a styled
       label (`.sr-only`), not a target anybody aims at. */
    if (r.width <= 2 && r.height <= 2) continue;
    /* The painted box OR a hit area that overflows it (the chip's own trick,
       an absolutely positioned child taller than its parent). */
    let h = r.height;
    let w = r.width;
    /* A hit area that overflows its own box is the chip's own trick, so a
       control that already passes needs no second look; only one that fails
       is asked about its children and its own pseudo-elements. */
    if (h < 43.5 || w < 43.5) {
      for (const child of el.children) {
        const cr = child.getBoundingClientRect();
        if (cr.height > h) h = cr.height;
        if (cr.width > w) w = cr.width;
      }
      for (const which of ["::before", "::after"]) {
        const hit = pseudoHit(el, which, r.width);
        if (!hit) continue;
        if (hit.h > h) h = hit.h;
        if (hit.w > w) w = hit.w;
      }
    }
    if (h < 43.5 || w < 43.5) {
      const found = {
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? "").toString().split(" ").slice(0, 2).join(" ").slice(0, 44),
        label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24),
        w: px(w),
        h: px(h),
      };
      (inSentence(el) ? inlineSmall : small).push(found);
    }
  }

  return {
    header,
    back,
    primary,
    headerGap,
    cardRadius,
    cardRadii,
    overflow,
    smallCount: small.length,
    small: small.slice(0, 3),
    inlineSmallCount: inlineSmall.length,
    inlineSmall: inlineSmall.slice(0, 3),
    title: document.title.slice(0, 60),
  };
};

/* ---------------------------------------------------------------------------
   RESUME. Rows live in a JSONL file beside the JSON: one measured row per
   line, appended as it is taken. A row is identified by route, width and
   theme together, so the same route at another width is still owed.
   --------------------------------------------------------------------------- */
const jsonlOut = jsonOut.replace(/\.json$/, "") + ".jsonl";
const key = (j) => `${j.route}\u0000${j.width}\u0000${j.theme}`;

const rows = [];
const failures = [];
const alreadyHave = new Set();
if (existsSync(jsonlOut)) {
  for (const line of readFileSync(jsonlOut, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; /* A line cut in half by a kill. Measure that job again. */
    }
    if (row.error) {
      failures.push(row);
      /* NOT marked as had: a job that failed is owed, and a later run tries
         it again. Fifteen routes failed in the first run when the server fell
         over under four browsers; that is a sandbox fact, not a verdict. */
    } else {
      rows.push(row);
      alreadyHave.add(key(row));
    }
  }
  console.log(`resuming: ${alreadyHave.size} of this sweep's jobs already measured in ${jsonlOut}`);
}

const allJobs = [];
for (const theme of themes) for (const width of widths) for (const route of routes) allJobs.push({ theme, width, route });
const jobs = allJobs.filter((j) => !alreadyHave.has(key(j)));

if (process.argv.includes("--only-missing")) {
  console.log(`${allJobs.length} jobs in this sweep, ${alreadyHave.size} measured, ${jobs.length} left.`);
  for (const j of jobs.slice(0, 40)) console.log(`  owed: ${j.route} ${j.width} ${j.theme}`);
  if (jobs.length > 40) console.log(`  ... and ${jobs.length - 40} more`);
  process.exit(0);
}

if (jobs.length === 0) {
  console.log(`nothing left to measure: all ${allJobs.length} jobs are in ${jsonlOut}.`);
}

let done = 0;

/* One line per row, flushed immediately, so a kill at any moment costs at
   most the row being measured when it landed. */
function appendRow(row) {
  appendFileSync(jsonlOut, JSON.stringify(row) + "\n");
}

const browser = await chromium.launch({ executablePath: CHROME });

async function worker(queue) {
  for (;;) {
    const job = queue.shift();
    if (!job) break;
    /*
     * THE PHONE WIDTH IS MEASURED AS A PHONE, which it was not, and that one
     * omission made the touch column wrong on every page.
     *
     * The 44px rule is a TOUCH rule (`docs/RESPONSIVE_RESEARCH.md` section
     * 7, Apple's 44pt), and this product keeps it with media queries that
     * ask about the POINTER, not the width: the site footer's links are
     * `min-height: 2.75rem` and drop to 2.25rem only inside
     * `@media (hover: hover) and (pointer: fine)` ("a mouse does not need the
     * finger's 44px row", `app/css/site.css`). A headless Chromium at a 390px
     * viewport still reports a fine pointer, so the sweep took the mouse
     * branch of a touch rule and reported 297 rows of a 36px footer link that
     * is 44px on every phone that will ever load it.
     *
     * So the narrow pass gets a touch screen and the wide pass keeps its
     * mouse, which is what the two widths are for. `hasTouch` alone, not
     * `isMobile`: the pointer is the thing being corrected, and `isMobile`
     * would change the layout as well and make the two passes incomparable.
     */
    const touch = job.width <= 430;
    const ctx = await browser.newContext({ viewport: { width: job.width, height: 900 }, hasTouch: touch });
    await ctx.addCookies([{ name: "nf_theme", value: job.theme, url: base }]);
    /* The cookie bar covers the foot of every signed-out page and would be
       measured as content. It is answered once per context, as a person
       would, so the page under it is what the sweep sees. */
    await ctx.addCookies([{ name: "vallo_consent", value: "necessary", url: base }]);
    const page = await ctx.newPage();
    try {
      const response = await Promise.race([
        (async () => {
          const r = await page.goto(base + job.route, { waitUntil: "domcontentloaded", timeout: 25_000 });
          await page.waitForTimeout(400);
          /*
           * LET THE ENTRANCE FINISH BEFORE READING THE GEOMETRY.
           *
           * The document pages run a reveal on arrival, and 400ms landed in
           * the middle of it: a 44px control inside a block still being
           * scaled measured 42.2, and the audit's first pass reported that
           * as four pages failing the touch rule when nothing was wrong
           * with any of them. A page caught mid-animation is not the page.
           *
           * Bounded at two seconds, and an endless animation (a spinner, a
           * pulse) is not waited for, or a page with one would never be
           * measured at all.
           */
          await page.evaluate(async () => {
            const deadline = Date.now() + 1_200;
            for (;;) {
              const running = document.getAnimations().filter((a) => {
                if (a.playState !== "running") return false;
                const timing = a.effect?.getComputedTiming?.();
                return !timing || timing.iterations !== Infinity;
              });
              if (running.length === 0 || Date.now() > deadline) return;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          });
          return r;
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("did not settle in 35s")), 35_000)),
      ]);
      /*
       * MEASURE, WITH A BOUND, AND ONCE MORE IF THE PAGE MOVED UNDER IT.
       *
       * `page.evaluate` takes no timeout of its own. A route that navigates
       * on the client after it paints (the circle pages do) either destroys
       * the execution context mid-read, which throws, or leaves the promise
       * unsettled, which hangs the worker for good: two workers sat on
       * `/circle` and `/circle/ask` for six minutes and measured nothing
       * until they were killed. So the read is raced against 10 seconds,
       * and a context destroyed by a navigation is simply the page arriving
       * somewhere else: let it land and read THAT page, which is the one a
       * person would see. The address is taken after the read for the same
       * reason, so the row names what was actually measured.
       */
      const readOnce = () =>
        Promise.race([
          page.evaluate(MEASURE),
          new Promise((_, reject) => setTimeout(() => reject(new Error("measure did not return in 10s")), 10_000)),
        ]);
      let measured;
      try {
        measured = await readOnce();
      } catch (first) {
        if (!/context was destroyed|Execution context|navigation/i.test(String(first))) throw first;
        await page.waitForTimeout(1_200);
        measured = await readOnce();
      }
      const finalUrl = new URL(page.url()).pathname;
      const redirected = finalUrl !== job.route;
      const needsSession = redirected && /^\/(sign-in|sign-up|start|$)/.test(finalUrl);
      const row = {
        ...job,
        pointer: touch ? "coarse" : "fine",
        status: response?.status() ?? 0,
        finalUrl,
        redirected,
        needsSession,
        ...measured,
      };
      rows.push(row);
      appendRow(row);
    } catch (error) {
      const row = { ...job, error: String(error).split("\n")[0] };
      failures.push(row);
      appendRow(row);
    } finally {
      /*
       * CLOSING IS BOUNDED TOO. A wedged renderer makes `context.close()`
       * hang, and then the worker never takes another job: two of them sat
       * there with 39 of 644 rows measured and no error to show for it,
       * because the hang is in the cleanup rather than in the measurement.
       * A context that will not close is left to the `browser.close()` at
       * the end rather than allowed to stop the run.
       */
      await Promise.race([ctx.close(), new Promise((resolve) => setTimeout(resolve, 5_000))]).catch(() => {});
      done += 1;
      if (done % 10 === 0) process.stderr.write(`  ... ${done}/${jobs.length} this run\n`);
    }
  }
}

/* ONE shared queue, so the workers take from the same pile. */
const queue = jobs.slice();
await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));
await browser.close();

/* The states a route declares, read from the tree rather than from a render. */
const APP = join(process.cwd(), "src", "app");
const GROUPS = ["(app)", "(site)", "(auth)", "(landing)", ""];
function statesFor(route) {
  const tail = route === "/" ? "" : route.replace(/^\//, "");
  for (const group of GROUPS) {
    const dir = group ? join(APP, group, tail) : join(APP, tail);
    if (existsSync(join(dir, "page.tsx"))) {
      return {
        loading: existsSync(join(dir, "loading.tsx")),
        error: existsSync(join(dir, "error.tsx")),
        found: true,
      };
    }
  }
  return { loading: false, error: false, found: false };
}
for (const row of rows) row.states = statesFor(row.route);

/* A job that failed once and was measured later is not a failure. */
const measuredKeys = new Set(rows.map(key));
const realFailures = failures.filter((f) => !measuredKeys.has(key(f)));

writeFileSync(jsonOut, JSON.stringify({ rows, failures: realFailures, base, widths, themes }, null, 2));
for (const failure of realFailures) {
  console.error(`  could not load ${failure.route} (${failure.theme}, ${failure.width}): ${failure.error}`);
}
console.log(
  `consistency sweep: ${rows.length} measured, ${realFailures.length} failed, ` +
    `${rows.filter((r) => r.needsSession).length} need a session. ` +
    `Written to ${jsonOut}, row by row in ${jsonlOut}. ` +
    `${allJobs.length - rows.length} of ${allJobs.length} jobs still owed.`,
);
