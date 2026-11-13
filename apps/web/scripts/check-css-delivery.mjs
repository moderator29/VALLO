/**
 * ===========================================================================
 * THE STYLESHEET THAT WAS BUILT, LISTED, AND NEVER SENT.
 * ===========================================================================
 *
 * WHY THIS SCRIPT EXISTS. While measuring the founder's "one character per
 * line" screenshot it turned out that two production builds of the SAME
 * source did not serve the same CSS. In one of them `app/css/agent.css` (20KB,
 * the agent and host desks) and `app/css/stays.css` were compiled into
 * `.next/static/chunks/*.css`, were listed in the route's own
 * `page_client-reference-manifest.js`, and were linked by NO page. Measured in
 * Chromium on `/host` and `/agent/dashboard` in that build: zero rules whose
 * selector mentions `desk-kpis` were present in `document.styleSheets`, and
 * the KPI tiles, which get their two-up grid from that file, drew as four
 * full-width blocks. An earlier build of the same tree served the file and
 * drew the grid. Nothing failed in either build.
 *
 * That is the shape of fault `check-css-tokens.mjs` opens by naming, one level
 * further out: the stylesheet is correct, the import is correct, the build
 * says it is there, and the browser never receives it. Every source-text check
 * in this repository passes a build like that, and so does every screenshot
 * taken of a different build. It is the most plausible mechanism behind a
 * screen that "ships looking finished and is broken on his phone": a page with
 * its grid and width declarations missing collapses text into exactly the
 * vertical columns `check-vertical-text.mjs` reports.
 *
 * HOW IT MEASURES, and why it needs no list to maintain. For each route it
 * loads the page in a real browser and collects two sets:
 *
 *   1. Every `nf-`prefixed class actually present on an element in the DOM.
 *   2. Every `nf-`prefixed class mentioned by any selector in any stylesheet
 *      the page LOADED, read through `document.styleSheets` (same origin, so
 *      `cssRules` is readable), walking into `@layer`, `@media`, `@supports`
 *      and `@container` blocks.
 *
 * A class in the first set and not the second is a class the markup is wearing
 * that no loaded rule can style. There are only two causes, and both are worth
 * failing a build over: a stylesheet that did not arrive, or a class name no
 * stylesheet has ever defined. The report says which, by looking the class up
 * in the repository's stylesheets: a class that exists in a file names the file
 * that did not arrive, and a class that exists nowhere is dead markup.
 *
 * WHAT IT DOES NOT PROVE. Only the routes, widths and themes it is given, and
 * SIGNED OUT unless credentials are supplied. The theme is resolved server
 * side from the `nf_theme` cookie here, so the cookie is set rather than
 * Playwright's `colorScheme`. It says nothing about whether a rule that did
 * arrive is correct, and nothing about a class a runtime string builds and
 * this page happened not to build.
 *
 * USAGE
 *   node scripts/check-css-delivery.mjs --base http://127.0.0.1:3472 \
 *        --routes routes.txt [--themes dark,light] [--width 360] \
 *        [--concurrency 6] [--json out.json]
 *
 * Exits 1 when any route wears an `nf-` class no loaded rule can match.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const CHROME =
  process.env.VALLO_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://127.0.0.1:3472").replace(/\/$/, "");
const width = Number(arg("width", "360")) || 360;
const themes = arg("themes", "dark").split(",").map((t) => t.trim()).filter(Boolean);
const concurrency = Number(arg("concurrency", "6")) || 6;
const routesFile = arg("routes", null);
const jsonOut = arg("json", null);

const routes = routesFile
  ? readFileSync(routesFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : process.argv.slice(2).filter((a) => a.startsWith("/"));

if (routes.length === 0) {
  console.error("No routes given. Pass --routes <file> or route paths starting with /.");
  process.exit(2);
}

/* ---------------------------------------------------------------------------
 * MARKER CLASSES: a class the markup wears on purpose with no rule of its own.
 * Every one below was checked by hand on 13 November 2026, with what it is for,
 * because an unexplained entry here would hide the fault this script exists to
 * catch. A class gets in only when it is a hook for a test, for a descendant
 * selector or for a script, never because a rule for it is missing.
 */
const MARKER_CLASSES = new Map([
  [
    "nf-btn__label",
    "The label span inside Button, DropdownButton, ListingStickyBar and " +
      "PlaceActions. It carries no style of its own; it is the handle a " +
      "descendant rule and two Button tests reach the words by.",
  ],
  [
    "nf-logo-art",
    "On every Logo and LogoMarkLive drawing, as the handle the passcode " +
      "screen sizes the mark by and as the mark the logo sweep test looks for.",
  ],
  [
    "nf-host-group",
    "The block of the host group whose __title and __note are styled in " +
      "agent.css. The block's own material comes from nf-panel nf-panel--card " +
      "beside it, so the block class is a namespace rather than a rule.",
  ],
  [
    "nf-site-newsletter",
    "The newsletter form element. Its field and button are styled through " +
      "nf-site-newsletter-field; the form itself needs nothing.",
  ],
  [
    "nf-tab--circle",
    "The Circle slot on the bottom bar, named so the tab can be found and so " +
      "a later rule has somewhere to land. The slot draws as nf-tab today.",
  ],
]);

/* ---------------------------------------------------------------------------
 * Where in the repository each class is declared, so a missing class can name
 * the file that did not arrive instead of only itself.
 */
const SRC = new URL("../src/", import.meta.url).pathname;
const declaredIn = new Map();
function indexStylesheets(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      indexStylesheets(full);
      continue;
    }
    if (!entry.endsWith(".css")) continue;
    const text = readFileSync(full, "utf8");
    const rel = full.slice(SRC.length);
    for (const match of text.matchAll(/\.(nf-[a-zA-Z0-9_-]+)/g)) {
      const name = match[1];
      if (!declaredIn.has(name)) declaredIn.set(name, new Set());
      declaredIn.get(name).add(rel);
    }
  }
}
indexStylesheets(SRC);

const SCAN = `(() => {
  const inMarkup = new Set();
  for (const el of document.querySelectorAll("[class]")) {
    const value = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    for (const name of value.trim().split(/\\s+/)) {
      if (name.indexOf("nf-") === 0) inMarkup.add(name);
    }
  }
  const inCss = new Set();
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText) {
        for (const match of rule.selectorText.matchAll(/\\.(nf-[a-zA-Z0-9_-]+)/g)) inCss.add(match[1]);
      }
      if (rule.cssRules) walk(Array.from(rule.cssRules));
    }
  };
  let readable = 0;
  const opaque = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(Array.from(sheet.cssRules));
      readable += 1;
    } catch (error) {
      /* A sheet served with a crossorigin attribute, or one whose request
         failed, hides its rules from the CSSOM. Its text is fetched below
         instead of being written off, because writing it off would report
         every class it carries as unmatched. A sheet that cannot be fetched
         either is a sheet the page did not get, and that is the finding. */
      if (sheet.href) opaque.push(sheet.href);
    }
  }
  return { inMarkup: Array.from(inMarkup), inCss: Array.from(inCss), readable, opaque };
})()`;

/* The second half of the page-side scan: the same class harvest over the text
   of a stylesheet the CSSOM would not open. */
const HARVEST = `(async (href) => {
  const response = await fetch(href, { credentials: "include" });
  if (!response.ok) return { ok: false, status: response.status, classes: [] };
  const text = await response.text();
  const classes = new Set();
  for (const match of text.matchAll(/[.](nf-[a-zA-Z0-9_-]+)/g)) classes.add(match[1]);
  return { ok: true, status: response.status, classes: Array.from(classes) };
})`;

const jobs = [];
for (const theme of themes) for (const route of routes) jobs.push({ theme, route });
/* The queue is drained with `shift()`, so the total is kept before the run. */
const total = jobs.length;

const findings = [];
const failures = [];
let done = 0;
let crossOrigin = 0;

const browser = await chromium.launch({ executablePath: CHROME });

async function worker(queue) {
  for (;;) {
    const job = queue.shift();
    if (!job) break;
    const ctx = await browser.newContext({ viewport: { width, height: 820 } });
    await ctx.addCookies([{ name: "nf_theme", value: job.theme, url: base }]);
    const page = await ctx.newPage();
    try {
      const result = await Promise.race([
        (async () => {
          await page.goto(base + job.route, { waitUntil: "load", timeout: 20_000 });
          /* EVERY LINKED SHEET HAS TO HAVE PARSED FIRST. A `<link>` whose
             stylesheet has not loaded yet exposes an EMPTY `cssRules`, not an
             error, so measuring too early reports every class in the markup as
             unmatched. The first run of this script did exactly that on
             `/terms` and blamed `base.css`. */
          await page.waitForFunction(
            () =>
              Array.from(document.querySelectorAll("link[rel=stylesheet]")).every((link) => {
                const sheet = link.sheet;
                if (!sheet) return false;
                try {
                  return sheet.cssRules.length > 0;
                } catch {
                  return true;
                }
              }),
            undefined,
            { timeout: 10_000 },
          );
          await page.waitForTimeout(150);
          const scan = await page.evaluate(SCAN);
          const inCss = new Set(scan.inCss);
          const unfetched = [];
          for (const href of scan.opaque) {
            const harvested = await page.evaluate(HARVEST, href);
            if (!harvested.ok) {
              unfetched.push(`${href} (HTTP ${harvested.status})`);
              continue;
            }
            for (const name of harvested.classes) inCss.add(name);
          }
          const orphans = scan.inMarkup
            .filter((name) => !inCss.has(name) && !MARKER_CLASSES.has(name))
            .sort();
          return { orphans, readable: scan.readable, opaque: scan.opaque.length, unfetched };
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("page did not settle within 30s")), 30_000)),
      ]);
      /* A sheet the CSSOM would not open is read by fetching it instead. One
         that cannot even be fetched IS a missing stylesheet and is reported. */
      crossOrigin += result.opaque;
      for (const href of result.unfetched) {
        failures.push({ ...job, error: `stylesheet linked but not served: ${href}` });
      }
      if (result.orphans.length > 0) findings.push({ ...job, ...result });
    } catch (error) {
      failures.push({ ...job, error: String(error).split("\n")[0] });
    } finally {
      await ctx.close();
      done += 1;
      if (done % 50 === 0) process.stderr.write(`  ... ${done}/${total} page loads\n`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker(jobs)));
await browser.close();

if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ findings, failures }, null, 2));

for (const failure of failures) {
  console.error(`  could not measure ${failure.route} (${failure.theme}): ${failure.error}`);
}

if (findings.length === 0) {
  console.log(
    `css delivery: clean - ${total} page loads (${routes.length} route(s), ${width} wide, ` +
      `${themes.join(" and ")}), every nf- class in the markup is matched by a rule in a stylesheet ` +
      `the page loaded (${crossOrigin} sheet(s) read by fetch, ${MARKER_CLASSES.size} marker ` +
      "classes listed in MARKER_CLASSES). " +
      "SIGNED OUT only: this is no evidence about a signed-in screen.",
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

/* Group by the stylesheet the class belongs to: one missing file shows up as
   one entry with many classes, which is the fact worth reading. */
const byFile = new Map();
for (const finding of findings) {
  for (const name of finding.orphans) {
    const files = declaredIn.get(name);
    const key = files ? [...files].sort().join(" + ") : "(declared in no stylesheet in this repository)";
    const entry = byFile.get(key) ?? { classes: new Set(), routes: new Set() };
    entry.classes.add(name);
    entry.routes.add(finding.route);
    byFile.set(key, entry);
  }
}

console.error(
  "\nTHE MARKUP IS WEARING CLASSES THE PAGE'S CSS CANNOT MATCH. Every class\n" +
    "below was on an element in the DOM, and no rule in any stylesheet the page\n" +
    "actually loaded mentions it. There are two causes and the grouping tells\n" +
    "them apart.\n\n" +
    "A GROUP NAMED AFTER A STYLESHEET: that file did not arrive. The import is\n" +
    "there, the file compiled, the route's manifest lists its chunk, and the\n" +
    "page's HTML links a different set. Rebuild and measure again before\n" +
    "changing any CSS: this has differed between two builds of one tree, and\n" +
    "the register the file carries (a grid, a width, a type scale) is simply\n" +
    "absent from the screen while it is missing.\n\n" +
    "A GROUP NAMED \"declared in no stylesheet\": the class name is dead markup,\n" +
    "or is spelled differently from the rule meant to catch it.\n",
);
for (const [file, entry] of [...byFile.entries()].sort((a, b) => b[1].classes.size - a[1].classes.size)) {
  const classes = [...entry.classes].sort();
  console.error(
    `  ${file}\n` +
      `      ${classes.length} class(es): ${classes.slice(0, 12).join(", ")}${classes.length > 12 ? ", ..." : ""}\n` +
      `      on ${entry.routes.size} route(s): ${[...entry.routes].slice(0, 6).join(", ")}${entry.routes.size > 6 ? ", ..." : ""}`,
  );
}
console.error(`\n${byFile.size} group(s) across ${findings.length} page load(s).\n`);
process.exit(1);
