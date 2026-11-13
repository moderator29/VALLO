/**
 * ===========================================================================
 * THE VERTICAL TEXT DETECTOR: text that renders one character per line.
 * ===========================================================================
 *
 * WHY THIS SCRIPT EXISTS. The founder sent a screenshot of the move-in cost
 * breakdown on his phone in which a cost's name was drawn one letter per
 * line, running down the screen as a column of single characters. He said
 * there were many more like it, in many areas and many pages, "in docs too".
 * Nothing in the repository failed. The page had a passing build, passing
 * types, passing tests and a passing `check-css-tokens.mjs`, and it looked
 * correct in every screenshot anybody had taken, because nobody had taken one
 * at the width where it collapses.
 *
 * THE MECHANISM, measured rather than guessed. Three ingredients have to meet:
 *
 *   1. A line-breaking opportunity INSIDE every word. In this codebase that
 *      is almost always `overflow-wrap: anywhere` (157 declarations in the
 *      stylesheets when this was written) and occasionally
 *      `word-break: break-all`. Both were added for a good reason: a pasted
 *      URL, a Nigerian estate name with no spaces, a long email address.
 *
 *   2. An ancestor that is allowed to shrink to its MIN-CONTENT width. A flex
 *      or grid child with `min-width: 0`, or an `auto`-sized grid track, or an
 *      `inline-size: min-content`.
 *
 *   3. Something beside it wide enough to use the space up: a tabular figure
 *      with `white-space: nowrap`, a glyph plate, a badge that cannot shrink.
 *
 * And here is the part that is easy to get wrong, and is the whole reason
 * this is a RUNTIME check and not a grep. `overflow-wrap: anywhere` and
 * `overflow-wrap: break-word` break text in exactly the same places. They
 * differ in ONE respect, which is invisible in a screenshot of a wide
 * viewport: `anywhere` is counted when the browser works out the element's
 * MIN-CONTENT size, and `break-word` is not. So under `anywhere` a
 * shrinkable ancestor's min-content width becomes ONE CHARACTER, and when
 * the row runs out of room that ancestor is squeezed to one character wide
 * and the words run vertically. Under `break-word` the same ancestor's
 * min-content stays the width of its longest word, so the row overflows a
 * little or the word is clipped, which is a blemish rather than gibberish.
 *
 * That is why "it has overflow-wrap: anywhere" is not a bug report and this
 * script does not report one. It reports GEOMETRY: a run of text that the
 * browser actually laid out at fewer than `MAX_CHARS_PER_LINE` characters per
 * line box. Whatever the cause (a missing `min-width: 0`, a `min-content`
 * width, a custom property that failed to resolve so a width collapsed, a
 * grid track that lost its `minmax`), if the result is a vertical column of
 * letters this check sees it, and if the result is fine this check stays
 * quiet. It cannot be fooled by source text, because it never reads any.
 *
 * HOW IT MEASURES. For every text node on the page it selects the node's
 * contents in a `Range` and calls `getClientRects()`. One rect comes back per
 * LINE BOX the browser made, which is the only honest count of lines there
 * is: `scrollHeight / lineHeight` lies whenever line-height is unusual and
 * `offsetWidth` tells you nothing about wrapping. Then
 * `characters / line boxes` is the average line length, and anything under
 * the threshold with at least `MIN_LINES` lines is reported with its width,
 * its text and its ancestor chain, so the fix is one named element away.
 *
 * WHAT IT DOES NOT PROVE.
 *
 *   - Only the routes it is given, at the widths it is given, in the themes it
 *     is given. The theme is resolved SERVER SIDE from the `nf_theme` cookie
 *     in this product, so the cookie is set per context here; Playwright's
 *     `colorScheme` option alone would measure the same theme twice.
 *   - SIGNED OUT only, unless credentials are supplied in the environment.
 *     Every screen the founder reports is a signed-in screen. A clean run of
 *     this script is NOT evidence that a signed-in screen is clean, and it
 *     must never be reported as such.
 *   - Nothing about text that is merely tight. Two characters per line is
 *     gibberish; eight is a narrow column, and this script is deliberately
 *     blind to it.
 *
 * USAGE
 *   node scripts/check-vertical-text.mjs --base http://127.0.0.1:3471 \
 *        [--routes routes.txt] [--widths 360,390] [--themes dark,light] \
 *        [--concurrency 6] [--json out.json]
 *
 * Exits 1 when any run of text is laid out vertically.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const CHROME =
  process.env.VALLO_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";

/** Fewer than this many characters per line box is gibberish, not a column. */
const MAX_CHARS_PER_LINE = 2.6;
/** One or two stray line boxes are a normal wrap. Four is a pattern. */
const MIN_LINES = 4;
/** Below this a run is too short for the average to mean anything. */
const MIN_CHARS = 4;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/*
 * The page-side scan. Written as a string rather than a function reference so
 * that it is obvious it runs in the browser and closes over nothing.
 */
const SCAN = `(() => {
  const MAX_PER_LINE = ${MAX_CHARS_PER_LINE};
  const MIN_LINES = ${MIN_LINES};
  const MIN_CHARS = ${MIN_CHARS};
  const describe = (el) => {
    const parts = [];
    let p = el;
    for (let i = 0; i < 5 && p && p !== document.body; i += 1) {
      const cls =
        typeof p.className === "string" && p.className.trim()
          ? "." + p.className.trim().split(/\\s+/).slice(0, 4).join(".")
          : "";
      parts.push(p.tagName.toLowerCase() + cls);
      p = p.parentElement;
    }
    return parts.join(" < ");
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue || "").trim();
    if (text.length < MIN_CHARS) continue;
    const el = node.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    /* Deliberately vertical text is not this bug. */
    if (cs.writingMode && cs.writingMode !== "horizontal-tb") continue;
    if (cs.textOrientation === "upright") continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length < MIN_LINES) continue;
    const perLine = text.length / rects.length;
    if (perLine > MAX_PER_LINE) continue;
    const box = el.getBoundingClientRect();
    out.push({
      text: text.slice(0, 70),
      chars: text.length,
      lines: rects.length,
      perLine: Number(perLine.toFixed(2)),
      width: Math.round(box.width),
      wrap: cs.overflowWrap + "/" + cs.wordBreak,
      path: describe(el),
    });
  }
  return out;
})()`;

const base = arg("base", "http://127.0.0.1:3471").replace(/\/$/, "");
const widths = arg("widths", "360,390")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter(Boolean);
const themes = arg("themes", "dark,light")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const concurrency = Number(arg("concurrency", "6")) || 6;
const routesFile = arg("routes", null);
const jsonOut = arg("json", null);

const routes = routesFile
  ? readFileSync(routesFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : process.argv.slice(2).filter((a) => a.startsWith("/"));

if (routes.length === 0) {
  console.error("No routes given. Pass --routes <file> or route paths starting with /.");
  process.exit(2);
}

const jobs = [];
for (const theme of themes) for (const width of widths) for (const route of routes) jobs.push({ theme, width, route });

const findings = [];
const failures = [];
let done = 0;

const browser = await chromium.launch({ executablePath: CHROME });

async function worker(queue) {
  const context = await browser.newContext({ viewport: { width: 1, height: 1 } });
  await context.close();
  for (;;) {
    const job = queue.shift();
    if (!job) break;
    const ctx = await browser.newContext({
      viewport: { width: job.width, height: 820 },
      deviceScaleFactor: 2,
    });
    /* THE THEME IS RESOLVED SERVER SIDE from this cookie. Without it both
       passes measure the same theme and the run proves half of what it says. */
    await ctx.addCookies([{ name: "nf_theme", value: job.theme, url: base }]);
    const page = await ctx.newPage();
    try {
      await page.goto(base + job.route, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(250);
      const hits = await page.evaluate(SCAN);
      for (const hit of hits) findings.push({ ...hit, ...job });
    } catch (error) {
      failures.push({ ...job, error: String(error).split("\n")[0] });
    } finally {
      await ctx.close();
      done += 1;
      if (done % 50 === 0) process.stderr.write(`  ... ${done}/${jobs.length} page loads\n`);
    }
  }
}

const queue = jobs.slice();
await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));
await browser.close();

if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ findings, failures }, null, 2));

for (const failure of failures) {
  console.error(`  could not load ${failure.route} (${failure.theme}, ${failure.width}): ${failure.error}`);
}

if (findings.length === 0) {
  console.log(
    `vertical text: clean - ${jobs.length} page loads (${routes.length} route(s), ` +
      `${widths.join(" and ")} wide, ${themes.join(" and ")}), 0 runs of text laid out at ` +
      `under ${MAX_CHARS_PER_LINE} characters per line. SIGNED OUT only: this is no ` +
      "evidence about a signed-in screen.",
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

/* One line of text can be reported by several widths and both themes. Group by
   where it is, so the output is a list of bugs rather than a list of loads. */
const groups = new Map();
for (const f of findings) {
  const key = `${f.route}|${f.path}|${f.text}`;
  const g = groups.get(key) ?? { ...f, seen: [] };
  g.seen.push(`${f.theme} ${f.width}`);
  g.lines = Math.max(g.lines, f.lines);
  g.perLine = Math.min(g.perLine, f.perLine);
  groups.set(key, g);
}

console.error(
  "\nTEXT LAID OUT ONE CHARACTER PER LINE. The founder's screenshot of the\n" +
    "move-in cost breakdown, measured. A run of words below was drawn by the\n" +
    "browser at fewer than " + MAX_CHARS_PER_LINE + " characters per line box, which is a vertical\n" +
    "column of letters on the screen, not a narrow column of words.\n\n" +
    "THE USUAL CAUSE, and the one to check first: `overflow-wrap: anywhere` (or\n" +
    "`word-break: break-all`) on text inside a flex or grid child that is\n" +
    "allowed to shrink. `anywhere` counts towards the element's MIN-CONTENT\n" +
    "width and `break-word` does not, so `anywhere` lets a shrinkable ancestor\n" +
    "collapse to one character wide while `break-word` holds it at the longest\n" +
    "word. They break text in the same places otherwise. Switching the\n" +
    "declaration to `break-word` keeps the long-URL protection it was added for\n" +
    "and removes the collapse.\n\n" +
    "OTHER CAUSES WORTH MEASURING before changing anything: a flex or grid\n" +
    "child with no `min-width: 0` beside something that cannot shrink; an\n" +
    "`inline-size` or `width` of `min-content`; a custom property that fails to\n" +
    "resolve so a width declaration is dropped at computed-value time.\n",
);
for (const g of [...groups.values()].sort((a, b) => a.perLine - b.perLine)) {
  console.error(
    `  ${g.route}  [${g.lines} lines for ${g.chars} chars, ${g.perLine}/line, ${g.width}px wide, overflow-wrap/word-break: ${g.wrap}]\n` +
      `      "${g.text}"\n` +
      `      ${g.path}\n` +
      `      seen at: ${[...new Set(g.seen)].join(", ")}`,
  );
}
console.error(`\n${groups.size} run(s) of text laid out vertically across ${jobs.length} page loads.\n`);
process.exit(1);
