/**
 * THE APP OPENING, IN A REAL BROWSER (D68c, 7 October 2026).
 *
 * The founder's test, made executable: "if a still frame taken at any point
 * in the first 1,500ms shows a logo and nothing else, it has failed". This
 * file serves a page built like the app's first screen (the header, the
 * content, the dock) with the root layout's three startup scripts and the
 * real stylesheets, opens it in Chromium, and asserts the new rule:
 *
 *   - no brand lockup and no overlay exist on the startup path at all, at
 *     300ms, 700ms or 1,200ms, and the header and the dock are on screen from
 *     the first frame;
 *   - the full opening settles by about 1,500ms and a returning one by about
 *     400ms;
 *   - a tap lands on what is under it AND settles the page at once;
 *   - on the shell the native splash is told to go on the first parse, before
 *     any frame and before `load`, and a bridge injected late is still found;
 *   - every stage is traced to `localStorage.nf_boot_trace`;
 *   - reduced motion, Calm, Off and data saver get one settled frame.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, hasBrowser } from "@/lib/testing/mount-in-browser";
import {
  BOOT_TRACE_KEY,
  OPENING_BRIEF_MS,
  OPENING_FULL_MS,
  STARTUP_GATE_SCRIPT,
  STARTUP_NATIVE_SCRIPT,
  STARTUP_RELEASE_MS,
} from "./startup-script";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });

const WEB = join(__dirname, "..", "..", "..");
const read = (...parts: string[]) => readFileSync(join(WEB, ...parts), "utf8");
const CSS = transformSync(
  [
    read("..", "..", "packages", "design-tokens", "src", "tokens.css"),
    read("src", "app", "css", "animation.css"),
    read("src", "app", "css", "threshold.css"),
    read("src", "components", "startup", "startup.css"),
    "body { margin: 0; } .nf-app-header { position: sticky; top: 0; height: 56px; } .nf-dockrow { position: fixed; bottom: 12px; left: 0; right: 0; height: 64px; }",
  ].join("\n"),
  { loader: "css", minify: true },
).code;

const CHROMIUM = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].find((path) => existsSync(path));

let browser: Browser | null = null;
beforeAll(async () => {
  if (hasBrowser && CHROMIUM) browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
afterAll(async () => {
  await browser?.close();
});

/* The shape of the app's first screen: real structure, no brand art. */
const SHELL = `
  <header class="nf-app-header"><span class="title">Home</span></header>
  <main id="main">
    <h1 class="nf-rise">Good evening</h1>
    <button id="first" class="nf-rise nf-rise-2" type="button">Rent in Lekki</button>
    <p class="nf-rise nf-rise-3">Homes a person has checked</p>
  </main>
  <nav class="nf-dockrow"><a href="#">Home</a></nav>`;

/* A fake bridge: `native` is how long the hide takes to answer (ms), and
   `late` is how long after parse the bridge appears at all. */
const PROBE = `
  window.__clicks = 0;
  document.addEventListener("click", (e) => { e.preventDefault(); window.__clicks++; }, true);
  window.__frames = 0;
  requestAnimationFrame(function count() { window.__frames++; requestAnimationFrame(count); });
  window.__hides = [];
  const q = new URLSearchParams(location.search);
  const bridge = () => ({
    isNativePlatform: () => true,
    nativePromise: (plugin, method) => {
      window.__hides.push({ plugin, method, frames: window.__frames, loaded: document.readyState === "complete" });
      return new Promise((r) => setTimeout(r, Number(q.get("native")) || 0));
    },
  });
  if (q.has("native") && !q.has("late")) window.Capacitor = bridge();
  if (q.has("late")) setTimeout(() => { window.Capacitor = bridge(); }, Number(q.get("late")));
`;

type Open = { native?: number; late?: number; returning?: boolean; root?: string };

async function open(context: BrowserContextOptions, o: Open = {}): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser!.newContext({ viewport: { width: 390, height: 844 }, ...context });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  if (o.returning) await page.addInitScript(`localStorage.setItem("nf_entered", String(Date.now() - 60000))`);
  await page.route(/^http:\/\/vallo\.test\/home(\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en" ${o.root ?? ""}><head><meta name="viewport" content="width=device-width, initial-scale=1">
        <script>${STARTUP_NATIVE_SCRIPT}</script><style>${CSS}</style></head><body>
        <script>${STARTUP_GATE_SCRIPT}</script>
        ${SHELL}
      </body></html>`,
    }),
  );
  const q = new URLSearchParams();
  if (o.native !== undefined) q.set("native", String(o.native));
  if (o.late !== undefined) q.set("late", String(o.late));
  await page.goto(`http://vallo.test/home${q.size ? `?${q}` : ""}`, { waitUntil: "commit" });
  await page.waitForSelector("#main", { state: "attached" });
  return { page, close: () => ctx.close() };
}

const dataset = (page: Page) => page.evaluate(() => ({ ...document.documentElement.dataset }));
const settled = (page: Page, timeout = 5000) =>
  page.waitForFunction(() => document.documentElement.dataset.splash === "done", null, { timeout });

/* One still frame, described: is there any brand art or overlay, and is the
   product's own structure on screen? */
const still = (page: Page) =>
  page.evaluate(() => {
    const opacity = (s: string) => Number(getComputedStyle(document.querySelector(s)!).opacity);
    return {
      brand: document.querySelectorAll('img[src*="brand"], .nf-startup, .nf-splash, .nf-assemble, [class*="logo" i]').length,
      header: opacity(".nf-app-header"),
      dock: opacity(".nf-dockrow"),
      main: opacity("#main"),
    };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("the app opening, in a browser", () => {
  it("never shows a logo: no brand art at 300, 700 or 1,200ms, and the header and dock are there from the first frame", async () => {
    const { page, close } = await open({});
    try {
      const first = await page.evaluate(
        () =>
          new Promise<{ header: number; dock: number }>((resolve) =>
            requestAnimationFrame(() =>
              resolve({
                header: Number(getComputedStyle(document.querySelector(".nf-app-header")!).opacity),
                dock: Number(getComputedStyle(document.querySelector(".nf-dockrow")!).opacity),
              }),
            ),
          ),
      );
      expect(first.header).toBeGreaterThanOrEqual(0.39);
      expect(first.dock).toBeGreaterThanOrEqual(0.39);
      expect((await dataset(page)).opening).toBe("full");
      for (const ms of [300, 700, 1200]) {
        await page.waitForFunction((t) => performance.now() >= t, ms);
        const frame = await still(page);
        expect(frame.brand, `brand art in the frame at ${ms}ms`).toBe(0);
        expect(frame.header).toBeGreaterThan(0.39);
        expect(frame.main).toBeGreaterThan(0.7);
      }
    } finally {
      await close();
    }
  });

  it("settles the full opening by about 1,500ms", async () => {
    const { page, close } = await open({});
    try {
      await settled(page);
      const at = await page.evaluate(() => performance.now());
      expect(at).toBeLessThan(OPENING_FULL_MS + STARTUP_RELEASE_MS + 600);
      expect((await still(page)).header).toBe(1);
    } finally {
      await close();
    }
  });

  it("is brief on a returning open: about 400ms, the content with no hold", async () => {
    const { page, close } = await open({}, { returning: true });
    try {
      expect((await dataset(page)).opening).toBe("brief");
      const hold = await page.evaluate(() => getComputedStyle(document.querySelector("h1")!).animationDelay);
      expect(hold).toBe("0s");
      await settled(page);
      expect(await page.evaluate(() => performance.now())).toBeLessThan(OPENING_BRIEF_MS + STARTUP_RELEASE_MS + 600);
    } finally {
      await close();
    }
  });

  it("a tap lands on what is under it, and settles the page at once", async () => {
    const { page, close } = await open({}, {});
    try {
      await page.waitForFunction(() => performance.now() >= 250);
      await page.mouse.click(60, 120);
      await page.locator("#first").click({ force: true });
      expect(await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks)).toBeGreaterThanOrEqual(1);
      expect((await dataset(page)).splash).toBe("done");
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
      expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector("h1")!).opacity))).toBe(1);
    } finally {
      await close();
    }
  });

  it("on the shell, the first open of the day plays the brief opening, never the full one (plan item 14)", async () => {
    const { page, close } = await open({ userAgent: "Mozilla/5.0 VALLO-NATIVE" }, { native: 50 });
    try {
      await settled(page);
      expect(await page.evaluate(() => document.documentElement.dataset.opening)).toBe("brief");
    } finally {
      await close();
    }
  });

  it("on the shell, tells the native splash to go on the first parse, before any frame and before load, and traces it", async () => {
    const { page, close } = await open({ userAgent: "Mozilla/5.0 VALLO-NATIVE" }, { native: 50 });
    try {
      await settled(page);
      const hides = await page.evaluate(() => (window as unknown as { __hides: { plugin: string; method: string; frames: number; loaded: boolean }[] }).__hides);
      expect(hides[0]).toMatchObject({ plugin: "SplashScreen", method: "hide", frames: 0, loaded: false });
      const trace = await page.evaluate((k) => localStorage.getItem(k), BOOT_TRACE_KEY);
      for (const stage of ["parse@", "hide:sent:parse@", "hide:answered:parse@", "opening:brief@", "wait:lifted@", "opening:done@"]) {
        expect(trace).toContain(stage);
      }
    } finally {
      await close();
    }
  });

  it("finds a bridge injected after the first parse, and hides through it", async () => {
    const { page, close } = await open({ userAgent: "Mozilla/5.0 VALLO-NATIVE" }, { late: 250 });
    try {
      await page.waitForFunction(() => (window as unknown as { __hides: unknown[] }).__hides.length > 0, null, { timeout: 4000 });
      const trace = await page.evaluate((k) => localStorage.getItem(k), BOOT_TRACE_KEY);
      expect(trace).toContain("bridge:absent:parse@");
      expect(trace).toMatch(/hide:sent:retry\d+@/);
    } finally {
      await close();
    }
  });

  it("stays silent on the website: no trace stored, no retries", async () => {
    const { page, close } = await open({});
    try {
      await settled(page);
      expect(await page.evaluate((k) => localStorage.getItem(k), BOOT_TRACE_KEY)).toBeNull();
    } finally {
      await close();
    }
  });

  it.each([
    ["reduced motion", { reducedMotion: "reduce" as const }, ""],
    ["Calm", {}, 'data-motion="calm"'],
    ["Off", {}, 'data-motion="off"'],
    ["data saver", {}, 'data-save-data="on"'],
  ])("%s gets one settled frame: the opening never switches on", async (_name, context, root) => {
    const { page, close } = await open(context, { root });
    try {
      const d = await dataset(page);
      expect(d.splash).toBeUndefined();
      const chrome = await page.evaluate(() =>
        [".nf-app-header", ".nf-dockrow", "#main"].map((s) => getComputedStyle(document.querySelector(s)!).animationName),
      );
      expect(chrome).toEqual(["none", "none", "none"]);
    } finally {
      await close();
    }
  });
});
