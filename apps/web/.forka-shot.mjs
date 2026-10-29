import { chromium } from "playwright-core";
const [,, route, ...rest] = process.argv;
const widths = (process.env.W ?? "1440").split(",").map(Number);
const themes = (process.env.T ?? "dark").split(",");
const name = process.env.N ?? route.replace(/[^a-z0-9]+/gi, "_");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const theme of themes) for (const w of widths) {
  const touch = w < 820;
  const ctx = await b.newContext({ viewport: { width: w, height: touch ? 844 : 900 }, isMobile: touch, hasTouch: touch });
  await ctx.addCookies([{ name: "nf_theme", value: theme, url: "http://localhost:3470" }]);
  const p = await ctx.newPage();
  await p.goto("http://localhost:3470" + route, { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(1500);
  if (process.env.SEL) { const el = p.locator(process.env.SEL).first(); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `/tmp/forka-shots/${name}-${theme}-${w}.png` }); } else await p.screenshot({ path: `/tmp/forka-shots/${name}-${theme}-${w}.png`, fullPage: process.env.FULL === "1" });
  await ctx.close();
}
await b.close();
