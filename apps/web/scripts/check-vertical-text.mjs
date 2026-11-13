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

/** Fewer than this many characters per line is gibberish, not a column. */
const MAX_CHARS_PER_LINE = 4;
/** One or two stray lines are a normal wrap. Three is a pattern. */
const MIN_LINES = 3;
/** Below this a run is too short for the average to mean anything. */
const MIN_CHARS = 5;
/**
 * The second signal, and the one that names the mechanism rather than the
 * symptom: a box holding real words whose content width is under this many
 * times its own font size has collapsed towards min-content, whatever the
 * characters happened to do inside it. About 4 characters of Inter.
 */
const MIN_WIDTH_IN_FONT_SIZES = 2.4;

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
  const MIN_WIDTH_IN_FONT_SIZES = ${MIN_WIDTH_IN_FONT_SIZES};
  /*
   * ONE RECT IS NOT ONE LINE. \`getClientRects()\` returns a rect per box
   * FRAGMENT, and a soft hyphen, a bidi run or a mid-line font fallback each
   * add one. "Air conditioning" hyphenated over five lines came back as eight
   * rects, which is how a line count of 8 for 16 characters appeared on a
   * blemish rather than on gibberish. Rects are grouped by the top edge they
   * share (rounded, because sub-pixel tops differ by a hair) so a line is a
   * line.
   */
  const countLines = (rects) => {
    const tops = new Set();
    for (const r of rects) tops.add(Math.round(r.top));
    return tops.size;
  };
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
  /*
   * VISUALLY HIDDEN TEXT IS NOT A BUG. The screen-reader pattern in this
   * product clips a box to a pixel (\`inline-size: 1px\` with
   * \`clip-path: inset(50%)\`, or the older \`clip: rect(0 0 0 0)\`), and the
   * docs tables hide a whole \`thead\` that way at phone width. Text inside
   * one of those is laid out one character per line by design and is on
   * nobody's screen, so the first run of this check reported five sr-only
   * table headers as gibberish. An ancestor that clips itself out of sight
   * takes its text out of scope.
   */
  const hidden = (el) => {
    let p = el;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.contentVisibility === "hidden") return true;
      if (cs.clipPath && cs.clipPath.startsWith("inset(50%")) return true;
      if (cs.clip && cs.clip !== "auto" && /rect\(0px(,| )/.test(cs.clip)) return true;
      const r = p.getBoundingClientRect();
      if ((r.width <= 1 || r.height <= 1) && cs.overflow !== "visible") return true;
      p = p.parentElement;
    }
    return false;
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
    /* Deliberately vertical text is not this bug. */
    if (cs.writingMode && cs.writingMode !== "horizontal-tb") continue;
    if (cs.textOrientation === "upright") continue;
    if (hidden(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    const lines = countLines(rects);
    const perLine = text.length / lines;
    /* How wide the words were actually given, in units of their own type
       size. Measured from the line boxes, not from the element, because an
       inline element's box is the union of its fragments. */
    const widest = Math.max(...rects.map((r) => r.width));
    const fontSize = parseFloat(cs.fontSize) || 16;
    const widthInEm = widest / fontSize;
    const vertical = lines >= MIN_LINES && perLine <= MAX_PER_LINE;
    /* Two lines is a wrap. "Apr 28" over two lines in a squeezed table column
       is worth knowing about and is not what the founder photographed, so the
       floor is the same three lines for both signals. */
    const collapsed = lines >= MIN_LINES && widthInEm <= MIN_WIDTH_IN_FONT_SIZES;
    if (!vertical && !collapsed) continue;
    out.push({
      text: text.slice(0, 70),
      chars: text.length,
      lines,
      perLine: Number(perLine.toFixed(2)),
      width: Math.round(widest),
      em: Number(widthInEm.toFixed(2)),
      signal: vertical && collapsed ? "vertical+collapsed" : vertical ? "vertical" : "collapsed",
      wrap: cs.overflowWrap + "/" + cs.wordBreak + "/" + cs.hyphens,
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
      /* A HARD CEILING PER PAGE. One route that never settles must not take
         the sweep with it: a stalled load reads as a load that could not be
         measured, which is reported, and the run carries on. */
      const hits = await Promise.race([
        (async () => {
          await page.goto(base + job.route, { waitUntil: "domcontentloaded", timeout: 20_000 });
          await page.waitForTimeout(250);
          return page.evaluate(SCAN);
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("page did not settle within 30s")), 30_000),
        ),
      ]);
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
  g.em = Math.min(g.em, f.em);
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
    `  ${g.route}  [${g.signal}: ${g.lines} lines for ${g.chars} chars, ${g.perLine}/line, ${g.width}px = ${g.em}em wide, overflow-wrap/word-break/hyphens: ${g.wrap}]\n` +
      `      "${g.text}"\n` +
      `      ${g.path}\n` +
      `      seen at: ${[...new Set(g.seen)].join(", ")}`,
  );
}
console.error(`\n${groups.size} run(s) of text laid out vertically across ${jobs.length} page loads.\n`);
process.exit(1);
