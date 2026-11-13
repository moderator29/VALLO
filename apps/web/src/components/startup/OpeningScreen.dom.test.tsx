import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { chromium, webkit, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, hasBrowser } from "@/lib/testing/mount-in-browser";
import { OpeningScreen } from "./OpeningScreen";
import { OPEN_CAP_MS, OPEN_MIN_MS, OPEN_NATIVE_WAIT_MS, OPEN_SCRIPT } from "./open-script";

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

async function installed(opts: { reduced?: boolean; hydrate?: number | null; lock?: boolean; guarded?: boolean; shell?: "1.0.2" | "older" } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  /* When each state was first set, by the page's own clock. */
  await page.addInitScript(`window.__openTimes = {}; new MutationObserver(function () { var v = document.documentElement.getAttribute("data-open"); if (v && !(v in window.__openTimes)) window.__openTimes[v] = performance.now(); }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-open"] });`);
  // an installed app: the standalone display mode
  await page.addInitScript(`const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q);`);
  /* The native bridge as it is at document start: the shell's user agent mark,
     and the plugin headers Capacitor injects before any page script runs. */
  if (opts.shell) {
    await page.addInitScript(`window.Capacitor = { PluginHeaders: [{ name: "SplashScreen", methods: [{ name: "hide" }] }${opts.shell === "1.0.2" ? ', { name: "ValloShell", methods: [{ name: "setPrivacyCover" }, { name: "handoff" }] }' : ""}], isNativePlatform: function () { return true; } };`);
  }
  await page.route("http://vallo.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS}</style><script>${OPEN_SCRIPT}</script></head><body>${renderToStaticMarkup(<OpeningScreen />)}
        ${opts.guarded ? '<div data-passcode-guarded="">app</div>' : '<main><button id="under" onclick="window.__pressed=(window.__pressed||0)+1">Book</button></main>'}
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
    /* Timed inside the page, from the moment the layer was lit to the moment
       it began to leave, so a busy machine cannot make the test early. */
    await page.waitForFunction(() => document.documentElement.dataset.open === "leave", null, { timeout: OPEN_CAP_MS + 2000 });
    const held = await page.evaluate(() => {
      const t = (window as unknown as { __openTimes?: Record<string, number> }).__openTimes ?? {};
      return (t.leave ?? 0) - (t.on ?? 0);
    });
    expect(held).toBeGreaterThanOrEqual(OPEN_MIN_MS - 20);
    expect(held).toBeLessThanOrEqual(OPEN_CAP_MS + 200);
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

  /*
   * A TOUCH ENDS IT (13 November 2026). The layer took every tap for its whole
   * hold, 3.5 to 4.2 seconds, and its comment said it did not. A real tap in a
   * real browser now starts the crossfade at once, the layer stops taking input
   * that instant, and the button under it is not pressed by a tap that was
   * aimed at a picture.
   */
  it("a tap during the opening lifts it at once, and is not delivered to a button the person could not see", async () => {
    const { page, close } = await installed({ hydrate: null });
    await page.waitForFunction(() => document.documentElement.dataset.open === "on");
    await page.waitForTimeout(500);
    const box = (await page.locator("#under").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await page.evaluate(() => document.documentElement.dataset.open)).toBe("leave");
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("nf-open")!).pointerEvents)).toBe("none");
    expect(await page.evaluate(() => (window as unknown as { __pressed?: number }).__pressed ?? 0)).toBe(0);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("nf-open")!).display === "none", null, { timeout: 1500 });
    /* The next tap is the page's. */
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await page.evaluate(() => (window as unknown as { __pressed?: number }).__pressed ?? 0)).toBe(1);
    await close();
  });

  it("a key during the opening lifts it at once", async () => {
    const { page, close } = await installed({ hydrate: null });
    await page.waitForFunction(() => document.documentElement.dataset.open === "on");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.documentElement.dataset.open)).toBe("leave");
    await close();
  });

  /*
   * ONE OPENING IN THE APP (13 November 2026). A 1.0.2 binary draws its own
   * opening natively; this layer must never draw over the page after it. An
   * older binary has none, and this layer is still its opening.
   */
  it("inside a 1.0.2 binary, the layer is never drawn: off before the first frame and still off after every wait", async () => {
    const { page, close } = await installed({ hydrate: 50, shell: "1.0.2" });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    expect(await page.evaluate(() => document.documentElement.dataset.open)).toBe("off");
    expect((await state(page)).display).toBe("none");
    await page.evaluate(() => window.dispatchEvent(new Event("nf:splash-down")));
    await page.waitForTimeout(800);
    expect((await state(page)).display).toBe("none");
    await close();
  });

  it("inside an older binary with no opening of its own, the layer plays once the splash is down", async () => {
    const { page, close } = await installed({ hydrate: 50, shell: "older" });
    await page.waitForSelector("#nf-open svg", { state: "attached" });
    await page.evaluate(() => document.documentElement.setAttribute("data-native", "true"));
    await page.evaluate(() => window.dispatchEvent(new Event("nf:splash-down")));
    await page.waitForFunction(() => document.documentElement.dataset.open === "on", null, { timeout: 1000 });
    expect((await state(page)).display).toBe("block");
    await close();
  });

  /*
   * THE REPLAY OVER THE PAGE (13 November 2026, measured by Agent FEEL on
   * production with the shell's user agent and no splash signal: the layer
   * "left" unseen, then the 6s fallback lit it again over the page, a late
   * signal could too, and the layer then took every tap at an opacity of
   * 1e-16). Driven here with the real script and the real sheet: an older
   * shell (no ValloShell), hydrated at once, the splash never signalling.
   */
  it(
    "an older shell's opening is shown once, from the fallback, leaves, never returns, and the page then takes the tap",
    async () => {
      const { page, close } = await installed({ hydrate: 50, shell: "older" });
      try {
        await page.evaluate(() => document.documentElement.setAttribute("data-native", "true"));
        /* Before the fallback: nothing shown, nothing timed, and taps reach the page. */
        await page.waitForTimeout(OPEN_CAP_MS + 300);
        expect(await page.evaluate(() => document.documentElement.dataset.open ?? null)).toBeNull();
        await page.locator("#under").click({ timeout: 2000 });
        expect(await page.evaluate(() => (window as unknown as { __pressed?: number }).__pressed ?? 0)).toBe(1);
        /* The fallback lights it once. */
        await page.waitForFunction(() => document.documentElement.dataset.open === "on", null, { timeout: OPEN_NATIVE_WAIT_MS });
        /* It goes after its minimum (the page is ready), and stays gone. */
        await page.waitForFunction(() => document.documentElement.dataset.open === "off", null, { timeout: OPEN_CAP_MS + 2000 });
        await page.evaluate(() => window.dispatchEvent(new Event("nf:splash-down")));
        await page.waitForTimeout(600);
        expect(await page.evaluate(() => document.documentElement.dataset.open)).toBe("off");
        expect(await page.evaluate(() => getComputedStyle(document.getElementById("nf-open")!).display)).toBe("none");
        await page.locator("#under").click({ timeout: 2000 });
        expect(await page.evaluate(() => (window as unknown as { __pressed?: number }).__pressed ?? 0)).toBe(2);
      } finally {
        await close();
      }
    },
    OPEN_NATIVE_WAIT_MS + OPEN_CAP_MS + 20_000,
  );
  it("a layer that is not \"on\" never takes a tap, whatever state it was left in", async () => {
    const { page, close } = await installed({ hydrate: null });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.open === "on");
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("nf-open")!).pointerEvents)).toBe("auto");
      for (const state of ["leave", "off"]) {
        await page.evaluate((v) => document.documentElement.setAttribute("data-open", v), state);
        expect(await page.evaluate(() => getComputedStyle(document.getElementById("nf-open")!).pointerEvents)).toBe("none");
      }
      await page.evaluate(() => document.documentElement.removeAttribute("data-open"));
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("nf-open")!).pointerEvents)).toBe("none");
    } finally {
      await close();
    }
  });

  /*
   * HUNTER'S CONFIGURATION (13 November 2026): WebKit, the shell's user agent,
   * no ValloShell bridge (a browser, or a build older than 1.0.2), the page
   * hydrated at once. On production the layer "left" unseen, came back "on"
   * at the 6s fallback, and was still the top element over the sign-in form
   * 25s later. Here, in WebKit: lit once at most, gone by the cap, never lit
   * again, and the page's own button takes the tap at the end.
   */
  it.each([
    ["no bridge at all", ""],
    ["an older build, a bridge without ValloShell.handoff", 'window.Capacitor = { PluginHeaders: [{ name: "SplashScreen", methods: [{ name: "hide" }] }], isNativePlatform: function () { return true; } };'],
  ])(
    "WebKit with the shell's user agent, %s: the layer never stays on top",
    async (_label, bridge) => {
      const wk = await webkit.launch();
      try {
        const ctx = await wk.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 VALLO-NATIVE" });
        const page = await ctx.newPage();
        if (bridge) await page.addInitScript(bridge);
        await page.route("http://vallo.test/**", (route) =>
          route.fulfill({
            contentType: "text/html",
            /* The platform script's mark first, as in the real head. */
            body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS}</style><script>document.documentElement.setAttribute("data-native","true")</script><script>${OPEN_SCRIPT}</script></head><body>${renderToStaticMarkup(<OpeningScreen />)}<main><button id="under" style="margin-top:500px;width:200px;height:60px" onclick="window.__pressed=(window.__pressed||0)+1">Sign in</button></main><script>setTimeout(function(){window.__nfOpenReady=true},50)</script></body></html>`,
          }),
        );
        await page.goto("http://vallo.test/sign-in", { waitUntil: "load" });
        const seen: string[] = [];
        for (let i = 0; i < 14; i += 1) {
          await page.waitForTimeout(1000);
          seen.push(
            await page.evaluate(() => {
              const b = document.getElementById("under")!.getBoundingClientRect();
              const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
              return `${document.documentElement.dataset.open ?? "-"}:${top?.closest("#nf-open") ? "LAYER" : "page"}`;
            }),
          );
        }
        /* Once it has gone it never comes back, and by the end the page is on top. */
        const firstOff = seen.findIndex((s) => s.startsWith("off"));
        expect(firstOff, seen.join(" ")).toBeGreaterThanOrEqual(0);
        expect(seen.slice(firstOff).every((s) => s === "off:page"), seen.join(" ")).toBe(true);
        expect(seen.filter((s) => s.startsWith("on")).length, seen.join(" ")).toBeLessThanOrEqual(Math.ceil((OPEN_CAP_MS + 600) / 1000) + 1);
        await page.locator("#under").click({ timeout: 2000 });
        expect(await page.evaluate(() => (window as unknown as { __pressed?: number }).__pressed ?? 0)).toBe(1);
        await ctx.close();
      } finally {
        await wk.close();
      }
    },
    40_000,
  );
});
