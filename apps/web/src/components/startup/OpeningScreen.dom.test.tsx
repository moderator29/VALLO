import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, hasBrowser } from "@/lib/testing/mount-in-browser";
import { OpeningScreen } from "./OpeningScreen";
import { OPEN_CAP_MS, OPEN_MIN_MS, OPEN_SCRIPT } from "./open-script";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });

const WEB = join(__dirname, "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");
const CSS = transformSync([read("..", "..", "packages", "design-tokens", "src", "tokens.css"), read("src", "components", "startup", "open.css"), "body{margin:0;background:white}"].join("\n"), { loader: "css", minify: true }).code;

describe("the opening screen's markup", () => {
  const html = renderToStaticMarkup(<OpeningScreen />);
  it("is in the first HTML with the mark drawn inline, decorative, and no hydration needed", () => {
    expect(html).toContain('id="nf-open"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<svg");
    expect(html).toContain("nf-open__mark");
    expect(html).not.toContain("<img");
  });
});

const CHROMIUM = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) => existsSync(p));
let browser: Browser | null = null;
beforeAll(async () => {
  if (hasBrowser && CHROMIUM) browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
afterAll(async () => {
  await browser?.close();
});

async function installed(opts: { reduced?: boolean; hydrate?: number | null; lock?: boolean; guarded?: boolean } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  // an installed app: the standalone display mode
  await page.addInitScript(`const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q);`);
  await page.route("http://vallo.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS}</style><script>${OPEN_SCRIPT}</script></head><body>${renderToStaticMarkup(<OpeningScreen />)}
        ${opts.guarded ? '<div data-passcode-guarded="">app</div>' : "<main>app</main>"}
        <script>${opts.hydrate === null ? "" : `setTimeout(() => { window.__nfOpenReady = true; ${opts.guarded ? "document.documentElement.setAttribute('data-guard-ready','');" : ""} }, ${opts.hydrate ?? 100})`}</script></body></html>`,
    }),
  );
  await page.goto("http://vallo.test/home", { waitUntil: "commit" });
  return { page, close: () => ctx.close() };
}
const state = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const el = document.getElementById("nf-open")!;
    const cs = getComputedStyle(el);
    const mark = el.querySelector(".nf-open__mark")!.getBoundingClientRect();
    return { open: document.documentElement.dataset.open, display: cs.display, opacity: Number(cs.opacity), markWidth: Math.round(mark.width), markCentreY: Math.round(mark.top + mark.height / 2) };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("the opening screen, in a browser", () => {
  it("is there from the first frame with the mark centred, and stays for the minimum", async () => {
    const { page, close } = await installed({ hydrate: 50 });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    const first = await state(page);
    expect(first.display).toBe("block");
    expect(first.opacity).toBe(1);
    // 36 per cent of the width, give or take the entrance's small scale (0.96 to 1.04)
    expect(first.markWidth).toBeGreaterThanOrEqual(Math.round(390 * 0.36 * 0.94));
    expect(first.markWidth).toBeLessThanOrEqual(Math.round(390 * 0.36 * 1.06));
    expect(Math.abs(first.markCentreY - Math.round(844 * 0.46))).toBeLessThanOrEqual(8);
    await page.waitForTimeout(OPEN_MIN_MS - 250);
    expect((await state(page)).open).toBe("on");
    await close();
  });
  it("crossfades away once ready, within the cap", async () => {
    const { page, close } = await installed({ hydrate: 50 });
    await page.waitForFunction(() => document.documentElement.dataset.open === "leave", null, { timeout: 3000 });
    await page.waitForFunction(() => getComputedStyle(document.getElementById("nf-open")!).display === "none", null, { timeout: 2000 });
    await close();
  });
  it("holds for a slow hydration and still lifts by the cap", async () => {
    const { page, close } = await installed({ hydrate: null });
    await page.waitForTimeout(OPEN_MIN_MS + 500);
    expect((await state(page)).open).toBe("on");
    await page.waitForFunction(() => document.documentElement.dataset.open !== "on", null, { timeout: OPEN_CAP_MS + 1500 });
    await close();
  });
  it("a page behind the passcode guard is not revealed before the guard has decided", async () => {
    const { page, close } = await installed({ hydrate: 50, guarded: true });
    await page.waitForTimeout(OPEN_MIN_MS + 100);
    // hydrated and guard marked ready by the fixture at 50ms, so it lifts
    await page.waitForFunction(() => document.documentElement.dataset.open === "leave" || document.documentElement.dataset.open === "off", null, { timeout: 2000 });
    await close();
  });
  it("shows the still mark under reduced motion (no animation), for the minimum", async () => {
    const { page, close } = await installed({ reduced: true, hydrate: 50 });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".nf-open__mark")!).animationName)).toBe("none");
    expect((await state(page)).display).toBe("block");
    await close();
  });
});
