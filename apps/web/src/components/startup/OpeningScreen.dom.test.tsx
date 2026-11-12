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
    expect(html).toContain("nf-open__launch");
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
    const mark = el.querySelector(".nf-open__launch")!.getBoundingClientRect();
    return { open: document.documentElement.dataset.open, display: cs.display, opacity: Number(cs.opacity), markWidth: Math.round(mark.width), markCentreY: Math.round(mark.top + mark.height / 2) };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("the opening screen, in a browser", () => {
  it("is there from the first frame with the mark centred, and stays for the minimum", async () => {
    const { page, close } = await installed({ hydrate: 50 });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    const first = await state(page);
    expect(first.display).toBe("block");
    expect(first.opacity).toBe(1);
    /* The lockup (mark AND wordmark) is 72 per cent of the width, give or take
       the entrance's small scale (0.96 to 1). It was 36 per cent when only the
       mark was drawn; the artwork is three and a quarter times as wide as it is
       tall now, so it takes its own width. */
    expect(first.markWidth).toBeGreaterThanOrEqual(Math.round(390 * 0.72 * 0.94));
    expect(first.markWidth).toBeLessThanOrEqual(Math.round(390 * 0.72 * 1.06));
    expect(Math.abs(first.markCentreY - Math.round(844 * 0.46))).toBeLessThanOrEqual(8);
    await page.waitForTimeout(OPEN_MIN_MS - 250);
    expect((await state(page)).open).toBe("on");
    await close();
  });
  it("crossfades away once ready, within the cap", async () => {
    const { page, close } = await installed({ hydrate: 50 });
    /* Timed from the constants, not a number typed here, so the next time the
       founder asks for it slower this test follows instead of failing. */
    await page.waitForFunction(() => document.documentElement.dataset.open === "leave", null, { timeout: OPEN_CAP_MS + 1000 });
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
  it("shows the whole lockup under reduced motion with nothing travelling, for the minimum", async () => {
    const { page, close } = await installed({ reduced: true, hydrate: 50 });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    /* The layer fades; not one piece of the sequence moves, and every piece is
       at its finished value, so the ring cannot be left half drawn. */
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".nf-open__launch")!).animationName)).toBe("nf-open-still");
    const pieces = await page.evaluate(() =>
      [...document.querySelectorAll(".nf-open__launch .sw, .nf-open__launch .t, .nf-open__launch .mv, .nf-open__launch .l")].map((n) => {
        const cs = getComputedStyle(n);
        return { name: cs.animationName, opacity: Number(cs.opacity), transform: cs.transform };
      }),
    );
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) {
      expect(piece.name).toBe("none");
      expect(piece.opacity).toBe(1);
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(piece.transform);
    }
    expect((await state(page)).display).toBe("block");
    await close();
  });

  it("draws the sequence: the ring sweeps, the towers rise and the five letters arrive", async () => {
    const { page, close } = await installed({ hydrate: 50 });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    /* Frame one: the letters have not arrived yet. */
    const early = await page.evaluate(() =>
      [...document.querySelectorAll(".nf-open__launch .l")].map((n) => Number(getComputedStyle(n).opacity)),
    );
    expect(early).toHaveLength(5);
    expect(Math.max(...early)).toBeLessThan(1);
    /* Past the last letter's landing (1,260ms + 520ms), the whole lockup is up
       and every piece has stopped where it belongs. */
    await page.waitForTimeout(2000);
    const landed = await page.evaluate(() =>
      [...document.querySelectorAll(".nf-open__launch .l, .nf-open__launch .t, .nf-open__launch .mv")].map((n) => Number(getComputedStyle(n).opacity)),
    );
    expect(Math.min(...landed)).toBe(1);
    await close();
  });
});
