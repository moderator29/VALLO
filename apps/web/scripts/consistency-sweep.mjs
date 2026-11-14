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
 *   cardRadius   the border radius of the first card surface on the page
 *   overflow     `scrollWidth - clientWidth` on the document (the rule: 0)
 *   smallTargets every interactive element painted under 44 by 44, counted,
 *                with the three worst named
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
 *   node scripts/consistency-sweep.mjs --base http://localhost:3300 \
 *     --routes /tmp/routes.txt --json /tmp/out.json [--widths 390,1440]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
  let headerGap = null;
  if (headEl) {
    const bottom = headEl.getBoundingClientRect().bottom;
    const below = [...document.querySelectorAll("main *, body > div *")]
      .filter((el) => visible(el) && !headEl.contains(el) && !el.contains(headEl))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.top >= bottom - 1 && r.height > 4)
      .sort((a, b) => a.top - b.top)[0];
    if (below) headerGap = px(below.top - bottom);
  }

  /* THE FIRST CARD's corner. The card tier is 18px (`--nf-radius-card`). */
  const cardEl =
    [...document.querySelectorAll(".nf-panel--card, .nf-card, [data-card], .nf-list-group")].find(visible) ?? null;
  const cardRadius = cardEl ? px(Number.parseFloat(getComputedStyle(cardEl).borderTopLeftRadius)) : null;

  /* SIDEWAYS SCROLL on the document. The rule is zero. */
  const overflow = px(document.documentElement.scrollWidth - document.documentElement.clientWidth);

  /* CONTROLS UNDER 44. A control inside a row that scrolls sideways is still
     a control, so nothing is excused by its container; what IS excused is an
     element with no painted box (a hidden input behind a styled label). */
  const SELECTOR =
    'a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select,textarea,summary,[role="button"],[role="tab"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])';
  const small = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    /* The painted box OR a hit area that overflows it (the chip's own trick,
       an absolutely positioned child taller than its parent). */
    let h = r.height;
    let w = r.width;
    for (const child of el.children) {
      const cr = child.getBoundingClientRect();
      if (cr.height > h) h = cr.height;
      if (cr.width > w) w = cr.width;
    }
    if (h < 43.5 || w < 43.5) {
      small.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? "").toString().split(" ").slice(0, 2).join(" ").slice(0, 44),
        label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24),
        w: px(w),
        h: px(h),
      });
    }
  }

  return {
    header,
    back,
    primary,
    headerGap,
    cardRadius,
    overflow,
    smallCount: small.length,
    small: small.slice(0, 3),
    title: document.title.slice(0, 60),
  };
};

const jobs = [];
for (const theme of themes) for (const width of widths) for (const route of routes) jobs.push({ theme, width, route });

const rows = [];
const failures = [];
let done = 0;

const browser = await chromium.launch({ executablePath: CHROME });

async function worker(queue) {
  for (;;) {
    const job = queue.shift();
    if (!job) break;
    const ctx = await browser.newContext({ viewport: { width: job.width, height: 900 } });
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
          return r;
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("did not settle in 35s")), 35_000)),
      ]);
      const finalUrl = new URL(page.url()).pathname;
      const redirected = finalUrl !== job.route;
      const needsSession = redirected && /^\/(sign-in|sign-up|start|$)/.test(finalUrl);
      const measured = await page.evaluate(MEASURE);
      rows.push({
        ...job,
        status: response?.status() ?? 0,
        finalUrl,
        redirected,
        needsSession,
        ...measured,
      });
    } catch (error) {
      failures.push({ ...job, error: String(error).split("\n")[0] });
    } finally {
      await ctx.close();
      done += 1;
      if (done % 25 === 0) process.stderr.write(`  ... ${done}/${jobs.length}\n`);
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

writeFileSync(jsonOut, JSON.stringify({ rows, failures, base, widths, themes }, null, 2));
for (const failure of failures) {
  console.error(`  could not load ${failure.route} (${failure.theme}, ${failure.width}): ${failure.error}`);
}
console.log(
  `consistency sweep: ${rows.length} measured, ${failures.length} failed, ` +
    `${rows.filter((r) => r.needsSession).length} need a session. Written to ${jsonOut}`,
);
