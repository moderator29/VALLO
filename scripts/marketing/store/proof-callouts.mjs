/* A proof sheet of the pop-out container family on the night ground. */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { page } from "./page.mjs";
import { statCallout, lineCallout, cellsCallout, quoteCallout, countersCallout, figureOutline, prop } from "./callouts.mjs";

const W = 1320, H = 2868;
const S = 1.3;
const body = [
  lineCallout({ x: 90, y: 150, fit: true, scale: S, tab: "Example", lucide: "bed-double", title: "Room booked", line: "Lagoon Crest Resort · 3 nights", meta: null }),
  statCallout({ x: 90, y: 480, fit: true, scale: S, tab: "Move-in total", label: "All fees added up", figure: "₦2,640,000", note: "Rent, agency, caution, legal." }),
  cellsCallout({ x: 90, y: 860, fit: true, scale: S, tab: "Verified", lucide: "shield-check", title: "Checked by a person", cells: [["ID", "Seen"], ["Property", "Visited"], ["Papers", "Read"]], foot: "Not a promise. A check." }),
  quoteCallout({ x: 90, y: 1310, fit: true, scale: S, tab: "Member", initial: "A", quote: "I saw the full cost before I called.", who: "Amaka, Lekki" }),
  countersCallout({ x: 90, y: 1620, fit: true, scale: S, items: [["home", "1,284 homes"], ["hotel", "96 stays"], ["utensils", "140 tables"]] }),
  statCallout({ x: 90, y: 1800, fit: true, scale: S, tone: "sky", tab: "Live", label: "Price check, Lekki Phase 1", figure: "₦8.4m", unit: "a year", lucide: "trending-up" }),
  figureOutline({ x: 90, y: 2080, text: "₦0 held", size: 150, scale: S, rotate: -3 }),
  prop({ name: "keys", x: 820, y: 2060, size: 260, rotate: -8 }),
  prop({ name: "verified", x: 760, y: 1250, size: 220, rotate: 7 }),
  prop({ name: "receipt", x: 860, y: 540, size: 230, rotate: -5 }),
  prop({ name: "megaphone", x: 800, y: 2420, size: 250, rotate: 6 }),
].join("\n");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--force-color-profile=srgb"] });
const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: W, height: H } });
const tab = await ctx.newPage();
const f = "/tmp/claude-0/-home-user-read-it-well/e877abda-8aaf-57c8-a7aa-c0953c2acde6/scratchpad/pf/sheet.html";
writeFileSync(f, page({ width: W, height: H, body }));
await tab.goto(`file://${f}`, { waitUntil: "load" });
await tab.waitForFunction(() => window.__fit === true, null, { timeout: 30000 });
await tab.evaluate(async () => { await Promise.all([...document.images].map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))); });
await tab.waitForTimeout(200);
const shot = await tab.screenshot({ type: "png", omitBackground: true });
await browser.close();
const g = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y += 1) {
  const k = y / (H - 1);
  const c = [Math.round(5 + (1 - 5) * k), Math.round(11 + (1 - 11) * k), Math.round(61 + (24 - 61) * k)];
  for (let x = 0; x < W; x += 1) g.set(c, (y * W + x) * 3);
}
await sharp(g, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: shot }]).removeAlpha()
  .jpeg({ quality: 92 }).toFile("/tmp/claude-0/-home-user-read-it-well/e877abda-8aaf-57c8-a7aa-c0953c2acde6/scratchpad/pf/sheet.jpg");
console.log("ok");
