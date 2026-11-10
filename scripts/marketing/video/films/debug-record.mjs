// Opens an October film page and writes what it recorded (window.__dbg: shows, taps, lifts) as JSON, for checking taps and crops against the screens.
import { chromium } from "playwright-core";
import { startServer } from "../engine/server.mjs";
import { writeFileSync } from "node:fs";
const [proj, film, out] = process.argv.slice(2);
const { server, url } = await startServer();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl"] });
const page = await browser.newPage({ viewport: film === "desktop" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } });
await page.goto(`${url}/film.html?proj=${proj}&film=${film}&ending=live`, { timeout: 120000 });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300000 });
const d = await page.evaluate(() => ({ err: window.__error ?? null, dbg: window.__dbg }));
writeFileSync(out, JSON.stringify(d, null, 1));
await browser.close(); server.close();
console.log(d.err ?? `shows ${d.dbg.shows.length} taps ${d.dbg.taps.length} lifts ${d.dbg.lifts.length}`);
