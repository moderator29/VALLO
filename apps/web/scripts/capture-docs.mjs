#!/usr/bin/env node
/**
 * CAPTURE THE EXAMPLE SCREENS THE DOCUMENTATION SHOWS (Agent DOCS, 11 Nov 2026).
 *
 * Reads `src/lib/docs/capture-plan.json`, opens each preview-fixture page with
 * Chromium (Playwright, already installed) at a phone size, in BOTH themes, at
 * device scale factor 2, and writes `public/docs/<guide>/<step>-<theme>.webp`.
 * It then writes `src/lib/docs/shots.json`, the list of keys that exist, which
 * the step guide reads: a step whose capture is missing shows a plain frame,
 * never a broken image.
 *
 * HONESTY. These come from the PREVIEW HARNESS (`VALLO_PREVIEW_HARNESS=1`):
 * real components drawn with typed fixture data, never a live account and never
 * a real person's data. The guide labels every image "Example screen, not a
 * live account". There is no signed-in capture here because no Supabase and no
 * test account exist in this environment.
 *
 *   node apps/web/scripts/capture-docs.mjs                 start a dev server, capture, stop it
 *   BASE_URL=http://localhost:3060 node apps/web/scripts/capture-docs.mjs   use a server already running
 *   --only making-an-offer                                  capture one guide
 *   --check                                                 verify every plan key has both files, change nothing
 *
 * The server MUST have been started with VALLO_PREVIEW_HARNESS=1 (this script
 * sets it when it starts one itself). Images are compressed (webp, quality 78).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const PLAN = JSON.parse(readFileSync(join(WEB, "src/lib/docs/capture-plan.json"), "utf8"));
const OUT = join(WEB, "public/docs");
const SHOTS = join(WEB, "src/lib/docs/shots.json");
const THEMES = ["dark", "light"];
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const check = args.includes("--check");

if (check) {
  const missing = PLAN.flatMap((p) => THEMES.map((t) => `${p.key}-${t}.webp`)).filter((f) => !existsSync(join(OUT, f)));
  if (missing.length) {
    console.error(`missing captures:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`all ${PLAN.length * THEMES.length} captures present`);
  process.exit(0);
}

const require = createRequire(import.meta.url);
let playwright;
for (const id of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
  try {
    playwright = require(id);
    break;
  } catch {}
}
if (!playwright) throw new Error("playwright is not installed here");
let sharp = null;
try {
  sharp = require("sharp");
} catch {}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`server at ${url} did not answer in ${ms / 1000}s`);
}

let server = null;
let base = process.env.BASE_URL;
if (!base) {
  const port = 3190;
  base = `http://localhost:${port}`;
  server = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: WEB,
    env: { ...process.env, VALLO_PREVIEW_HARNESS: "1", NODE_OPTIONS: "--max-old-space-size=2500" },
    stdio: "ignore",
  });
  await waitFor(`${base}/preview/offers`, 240_000);
}

const browser = await playwright.chromium.launch();
const done = new Set(JSON.parse(existsSync(SHOTS) ? readFileSync(SHOTS, "utf8") : "[]"));
let failed = 0;
try {
  for (const item of PLAN.filter((p) => !only || p.key.startsWith(`${only}/`))) {
    let both = true;
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`${base}${item.path}`, { waitUntil: "networkidle", timeout: 60_000 });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.waitForTimeout(400);
        const file = join(OUT, `${item.key}-${theme}.webp`);
        mkdirSync(dirname(file), { recursive: true });
        const png = await page.screenshot({ type: "png" });
        if (sharp) await sharp(png).webp({ quality: 78 }).toFile(file);
        else throw new Error("sharp is not available to compress to webp");
        console.log(`${item.key}-${theme}: ${(statSync(file).size / 1024).toFixed(0)} KB`);
      } catch (error) {
        both = false;
        failed += 1;
        console.error(`FAILED ${item.key}-${theme}: ${error.message}`);
      } finally {
        await ctx.close();
      }
    }
    if (both) done.add(item.key);
    else done.delete(item.key);
  }
} finally {
  await browser.close();
  if (server) server.kill("SIGTERM");
}
const keys = PLAN.map((p) => p.key).filter((k) => done.has(k));
writeFileSync(SHOTS, JSON.stringify(keys, null, 2) + "\n");
console.log(`${keys.length} of ${PLAN.length} guide steps captured in both themes`);
process.exit(failed ? 1 : 0);
