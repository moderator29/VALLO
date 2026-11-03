#!/usr/bin/env node
/**
 * THE FIVE-WIDTH SWEEP (27 October 2026 brief, section 2.1).
 *
 * Walks routes at the five widths the product is held to (phone 390, tablet
 * 820, laptop 1180, desktop 1440, wide 1920) in light and dark, and for each
 * page and width reports:
 *
 *   - visible elements that cross the left or right edge with no clipping
 *     ancestor (`tests/_overflow.mjs`, the check that can actually fail here:
 *     the root is `overflow-x: clip`, so `scrollWidth` never can);
 *   - images that finished loading broken (a broken-image glyph on screen);
 *   - that the page painted the theme asked for.
 *
 * Screenshots land in PROOF_DIR (default /tmp/vallo-responsive) so the
 * pictures can be looked at; the exit code is the number of failing page,
 * width and theme combinations, capped at 100, so it can gate a release.
 *
 *   BASE_URL=http://localhost:3000 node apps/web/scripts/design/responsive/sweep.mjs \
 *     --routes /,/stays,/search --themes dark,light --widths 390,1440 --shots
 *
 * Signed-in routes need a session; this sweep reads only what a stranger can
 * open (set VALLO_PUBLIC_CATALOGUE=on on the server to include the catalogue).
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { horizontalOverflow } from "../../../tests/_overflow.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.PROOF_DIR ?? "/tmp/vallo-responsive";
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const SHOTS = process.argv.includes("--shots");
const WIDTHS = arg("widths", "390,820,1180,1440,1920").split(",").map(Number);
const THEMES = arg("themes", "dark,light").split(",");
const ROUTES = arg(
  "routes",
  [
    "/", "/stays", "/search", "/restaurants", "/sign-in", "/sign-up", "/welcome", "/about", "/contact",
    "/help", "/terms", "/privacy", "/safety", "/standards", "/disclaimer", "/eula", "/cancellations",
    "/host-agreement", "/for-hosts", "/for-agents", "/for-landlords", "/guides", "/docs", "/careers",
    "/move-in-cost", "/offline", "/forgot-password",
  ].join(","),
).split(",");
const EXECUTABLE = ["/opt/pw-browsers/chromium"].find(existsSync);
if (SHOTS) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const failures = [];
const rows = [];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const touch = width < 820;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 900 },
      deviceScaleFactor: 1,
      isMobile: touch,
      hasTouch: touch,
    });
    await context.addCookies([{ name: "nf_theme", value: theme, url: BASE }]);
    const page = await context.newPage();
    for (const route of ROUTES) {
      const label = `${route} @${width} ${theme}`;
      try {
        const response = await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
        await page.waitForTimeout(900);
        const status = response?.status() ?? 0;
        /* Off-canvas parking (the skip link at -9999) is deliberate, not overflow. */
        const over = (await page.evaluate(horizontalOverflow)).filter((o) => o.right > -1000 && o.left < o.viewport + 1000);
        const painted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        const broken = await page.evaluate(() =>
          [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(-70)),
        );
        const problems = [];
        if (status >= 500) problems.push(`status ${status}`);
        if (over.length) problems.push(`overflow: ${over.slice(0, 2).map((o) => `${o.element} ${o.left}..${o.right}`).join("; ")}`);
        if (broken.length) problems.push(`broken images: ${broken.slice(0, 2).join(", ")}`);
        /* The sign-up flow is pinned dark by the founder (30 September 2026). */
        if (painted && painted !== theme && theme !== "system" && !route.startsWith("/sign-up")) problems.push(`painted ${painted}`);
        rows.push({ route, width, theme, ok: problems.length === 0, problems });
        if (problems.length) failures.push(`${label}: ${problems.join(" | ")}`);
        if (SHOTS) {
          const name = `${route === "/" ? "root" : route.replace(/[^a-z0-9]+/gi, "_")}_${width}_${theme}.png`;
          await page.screenshot({ path: `${OUT}/${name}` });
        }
      } catch (error) {
        failures.push(`${label}: ${String(error.message).split("\n")[0]}`);
        rows.push({ route, width, theme, ok: false, problems: ["did not load"] });
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(`responsive sweep: ${rows.length} page, width and theme combinations, ${failures.length} failing`);
for (const f of failures) console.log("  " + f);
process.exit(Math.min(failures.length, 100));
