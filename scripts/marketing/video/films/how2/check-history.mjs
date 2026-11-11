/**
 * WHERE A FRAME DEPENDS ON HISTORY.
 *
 *   node films/how2/check-history.mjs <t_before> <t_at> [outDir]
 *
 * Renders t_at on a fresh page, then t_at on a page that has just shown
 * t_before, and writes both PNGs and the bounding box of the pixels that
 * differ. engine/render.mjs --check says THAT a frame differs; this says where.
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startServer } from "../../engine/server.mjs";

const [tBefore, tAt, outDir = "."] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-gpu-compositing", "--disable-partial-raster", "--run-all-compositor-stages-before-draw", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "--hide-scrollbars"],
});
async function open() {
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${url}/film.html?film=mobile&ending=live&proj=how2`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300000, polling: 200 });
  const cdp = await context.newCDPSession(page);
  return async (t) => {
    await page.evaluate((x) => window.__film.seek(x), t);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, fromSurface: true });
    return Buffer.from(data, "base64");
  };
}
const a = await open();
const fresh = await a(Number(tAt));
const b = await open();
await b(Number(tBefore));
const after = await b(Number(tAt));
await sharp(fresh).toFile(join(outDir, "fresh.png"));
await sharp(after).toFile(join(outDir, "after.png"));
const A = await sharp(fresh).raw().toBuffer({ resolveWithObject: true });
const B = await sharp(after).raw().toBuffer();
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
for (let i = 0; i < A.data.length; i += A.info.channels) {
  if (Math.abs(A.data[i] - B[i]) + Math.abs(A.data[i + 1] - B[i + 1]) + Math.abs(A.data[i + 2] - B[i + 2]) > 6) {
    const p = i / A.info.channels, x = p % A.info.width, y = Math.floor(p / A.info.width);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n += 1;
  }
}
console.log(n ? `${n} pixels differ, box x ${x0}..${x1}, y ${y0}..${y1}` : "identical");
await browser.close();
server.close();
