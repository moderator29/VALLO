#!/usr/bin/env node
/**
 * THE PREVIEW SWEEP (28 October 2026): the signed-in screens at the five widths.
 *
 * The real member, host, agent and admin screens need a session, which a build
 * sandbox does not have. The development harness (`/preview` and `/gallery`)
 * renders the SAME components with fixture data and no session, so this walks
 * every static harness route at the five widths and reports what the public
 * sweep (`sweep.mjs`) reports: an element past the screen edge, a broken image,
 * and a page that threw. A harness route is a fixture, not a product page, so a
 * finding here is a finding in a component the product uses.
 *
 * The harness is closed in production unless the server is started with
 * VALLO_PREVIEW_HARNESS=1 (never set on Vercel):
 *
 *   VALLO_PREVIEW_HARNESS=1 npm run start
 *   BASE_URL=http://localhost:3000 ROUTES_FILE=/tmp/preview-routes.txt \
 *     node apps/web/scripts/design/responsive/preview-sweep.mjs --widths 390,820,1180,1440,1920 --themes dark
 *
 * Exit code is the number of routes with a finding, capped at 100.
 */
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { horizontalOverflow } from "../../../tests/_overflow.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const WIDTHS = arg("widths", "390,820,1180,1440,1920").split(",").map(Number);
const THEMES = arg("themes", "dark").split(",");
const WORKERS = Number(arg("workers", "3"));
const OUT = arg("out", "/tmp/preview-sweep.json");
const ROUTES = readFileSync(process.env.ROUTES_FILE ?? "/tmp/preview-routes.txt", "utf8").split("\n").filter(Boolean);
const EXECUTABLE = ["/opt/pw-browsers/chromium"].find(existsSync);

const jobs = [];
for (const theme of THEMES) for (const width of WIDTHS) for (const route of ROUTES) jobs.push({ theme, width, route });
const findings = [];
let done = 0;
const browser = await chromium.launch({ executablePath: EXECUTABLE });

async function worker() {
  const contexts = new Map();
  while (jobs.length) {
    const job = jobs.shift();
    const key = `${job.theme}-${job.width}`;
    if (!contexts.has(key)) {
      const touch = job.width < 820;
      const context = await browser.newContext({ viewport: { width: job.width, height: touch ? 844 : 900 }, isMobile: touch, hasTouch: touch });
      await context.addCookies([{ name: "nf_theme", value: job.theme, url: BASE }]);
      contexts.set(key, await context.newPage());
    }
    const page = contexts.get(key);
    const errors = [];
    const onError = (e) => errors.push(String(e.message).slice(0, 80));
    page.on("pageerror", onError);
    try {
      const res = await page.goto(BASE + job.route, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(500);
      const status = res?.status() ?? 0;
      const over = (await page.evaluate(horizontalOverflow)).filter((o) => o.right > -1000 && o.left < o.viewport + 1000);
      const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(-60)));
      const problems = [];
      if (status >= 500) problems.push(`status ${status}`);
      if (status === 404) problems.push("404");
      if (over.length) problems.push(`overflow ${over.slice(0, 2).map((o) => `${o.element} ${o.left}..${o.right}`).join("; ")}`);
      if (broken.length) problems.push(`broken ${broken.slice(0, 2).join(", ")}`);
      if (errors.length) problems.push(`error ${errors[0]}`);
      if (problems.length) findings.push({ ...job, problems });
    } catch (e) {
      findings.push({ ...job, problems: [`load ${String(e.message).split("\n")[0]}`] });
    }
    page.off("pageerror", onError);
    done += 1;
    if (done % 200 === 0) console.error(`${done} loads, ${findings.length} findings`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close();
writeFileSync(OUT, JSON.stringify(findings, null, 1));
const routes = new Set(findings.map((f) => f.route));
console.log(`preview sweep: ${done} loads, ${findings.length} findings across ${routes.size} routes (details in ${OUT})`);
process.exit(Math.min(routes.size, 100));
