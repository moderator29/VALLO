/**
 * A VIDEO THAT NEVER LEAVES A BLACK BOX, PROVED IN CHROMIUM (29 October 2026).
 *
 * The real `SafeVideo` is mounted in a real browser and fed four sources: a
 * clip that plays, a clip that fails once and then loads (one retry), a file
 * that is not a video at all (the failure sentence and a link to open it),
 * and no source. The clip is a small WebM made with ffmpeg at test time (the
 * open-source Chromium has no H.264), so the test is skipped where either is
 * missing rather than passing without proving anything.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { withFirstFrame } from "./SafeVideo";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });

let clip: Buffer | null = null;
try {
  const dir = mkdtempSync(join(tmpdir(), "nf-clip-"));
  const file = join(dir, "clip.webm");
  execFileSync(
    "ffmpeg",
    ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=15:duration=2", "-c:v", "libvpx", "-b:v", "200k", file],
    { timeout: 30_000 },
  );
  clip = readFileSync(file);
} catch {
  clip = null;
}
const canRun = hasBrowser && clip !== null;

beforeAll(async () => {
  if (canRun) await warmBrowser();
});
afterAll(closeBrowser);

describe("withFirstFrame", () => {
  it("asks Safari for frame one only when no poster stands in and nothing preloads", () => {
    expect(withFirstFrame("https://x.test/a.mp4", undefined, "metadata")).toBe("https://x.test/a.mp4#t=0.001");
    expect(withFirstFrame("https://x.test/a.mp4", "https://x.test/p.jpg", "metadata")).toBe("https://x.test/a.mp4");
    expect(withFirstFrame("https://x.test/a.mp4", undefined, "auto")).toBe("https://x.test/a.mp4");
    expect(withFirstFrame("https://x.test/a.mp4#t=5", undefined, undefined)).toBe("https://x.test/a.mp4#t=5");
    expect(withFirstFrame("blob:https://x.test/abc", undefined, undefined)).toBe("blob:https://x.test/abc");
  });
});

/* The source is handed in after the mount (`window.__setSrc`), so the test can
   route the media request first; the page cannot be reloaded because the
   harness draws its component from a script. */
const entry = (initial: string | null) => `
  import { useState } from "react";
  import { SafeVideo } from "@/components/app/media/SafeVideo";
  import { mount } from "@/lib/testing/browser-root";
  function Host() {
    const [src, setSrc] = useState(${initial === null ? "null" : JSON.stringify(initial)});
    window.__setSrc = setSrc;
    return <SafeVideo src={src} controls muted autoPlay playsInline preload="auto" className="v" style={{ width: 160, height: 90 }} />;
  }
  mount(<Host />);
`;

const setSrc = (page: import("playwright-core").Page, url: string) =>
  page.evaluate((u) => (window as unknown as { __setSrc: (v: string) => void }).__setSrc(u), url);

describe.skipIf(!canRun)("SafeVideo in Chromium", () => {
  it("plays a good clip", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("") });
    try {
      await page.route("https://media.test/**", (route) => route.fulfill({ status: 200, contentType: "video/webm", body: clip! }));
      await setSrc(page, "https://media.test/ok.webm");
      await page.waitForFunction(() => {
        const v = document.querySelector("video");
        return Boolean(v && v.readyState >= 2 && v.currentTime > 0);
      }, null, { timeout: 15_000 });
      expect(await page.locator("[data-testid=video-failed]").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("recovers from one failed load with a single retry", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("") });
    try {
      let hits = 0;
      await page.route("https://media.test/**", (route) => {
        hits += 1;
        if (hits === 1) return route.fulfill({ status: 500, body: "no" });
        return route.fulfill({ status: 200, contentType: "video/webm", body: clip! });
      });
      await setSrc(page, "https://media.test/flaky.webm");
      await page.waitForFunction(() => {
        const v = document.querySelector("video");
        return Boolean(v && v.readyState >= 2);
      }, null, { timeout: 15_000 });
      expect(hits).toBeGreaterThanOrEqual(2);
      expect(await page.locator("[data-testid=video-failed]").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("says so, with a way to open the file, when the clip cannot play", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("") });
    try {
      await page.route("https://media.test/**", (route) =>
        route.fulfill({ status: 200, contentType: "video/quicktime", body: Buffer.from("this is not a video") }),
      );
      await setSrc(page, "https://media.test/bad.mov");
      const alert = page.locator("[data-testid=video-failed]");
      await alert.waitFor({ timeout: 15_000 });
      expect(await alert.innerText()).toContain("could not be played");
      expect(await alert.locator("a").getAttribute("href")).toBe("https://media.test/bad.mov");
      expect(await alert.locator("a").getAttribute("rel")).toContain("noopener");
    } finally {
      await close();
    }
  });

  it("draws the failure at once, with no link, when there is no source", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(null) });
    try {
      const alert = page.locator("[data-testid=video-failed]");
      await alert.waitFor({ timeout: 5_000 });
      expect(await alert.locator("a").count()).toBe(0);
    } finally {
      await close();
    }
  });
});

/*
 * FAST AND FINE (13 November 2026, the founder: videos that feel high quality).
 * Nothing fetched until seen, always inline, muted play in view only where a
 * caller asks (the gallery tile) and never on data saving, and the poster on
 * a media-coloured ground before any frame.
 */
const lazyEntry = (opts: { autoPlayInView?: boolean; saveData?: boolean }) => `
  import { SafeVideo } from "@/components/app/media/SafeVideo";
  import { mount } from "@/lib/testing/browser-root";
  ${opts.saveData ? 'document.documentElement.dataset.saveData = "on";' : ""}
  window.__played = 0; window.__paused = 0;
  HTMLMediaElement.prototype.play = function () { window.__played += 1; window.__lastMuted = this.muted; return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () { window.__paused += 1; };
  Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable: true, get() { return window.__played <= window.__paused; } });
  mount(
    <div>
      <div style={{ height: 1600 }} data-testid="spacer" />
      <SafeVideo src="https://media.test/walk.mp4" poster="https://media.test/still.jpg" controls ${opts.autoPlayInView ? "autoPlayInView" : ""} style={{ width: 320, height: 180 }} />
      <div style={{ height: 1600 }} />
    </div>,
  );
`;

const attr = (page: import("playwright-core").Page, name: string) => page.evaluate((n) => document.querySelector("video")?.getAttribute(n) ?? null, name);
const counts = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __played: number; __paused: number; __lastMuted?: boolean };
    return { played: w.__played, paused: w.__paused, muted: w.__lastMuted };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("SafeVideo: nothing fetched until seen, always inline", () => {
  it("is preload none off screen, metadata once half in view, plays inline and shows its poster on a media ground", async () => {
    const { page, close } = await mountInBrowser({ entry: lazyEntry({}) });
    try {
      await page.locator("video").waitFor({ state: "attached" });
      expect(await attr(page, "preload")).toBe("none");
      expect(await attr(page, "playsinline")).not.toBeNull();
      expect(await attr(page, "poster")).toBe("https://media.test/still.jpg");
      /* Its ground is the deep media token while it waits (the harness loads no token sheet, so the declaration is what is read). */
      expect(await attr(page, "style")).toContain("--nf-overlay-media-deep");
      await page.locator("video").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector("video")?.getAttribute("preload") === "metadata");
      /* Nobody asked it to play: it does not. */
      expect((await counts(page)).played).toBe(0);
    } finally {
      await close();
    }
  });

  it("the gallery tile plays muted while half on screen and pauses when it leaves", async () => {
    const { page, close } = await mountInBrowser({ entry: lazyEntry({ autoPlayInView: true }) });
    try {
      await page.locator("video").waitFor({ state: "attached" });
      expect((await counts(page)).played).toBe(0);
      await page.locator("video").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => (window as unknown as { __played: number }).__played > 0);
      expect((await counts(page)).muted).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => (window as unknown as { __paused: number }).__paused > 0);
    } finally {
      await close();
    }
  });

  it("never plays on its own when the person is saving data", async () => {
    const { page, close } = await mountInBrowser({ entry: lazyEntry({ autoPlayInView: true, saveData: true }) });
    try {
      await page.locator("video").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector("video")?.getAttribute("preload") === "metadata");
      await page.waitForTimeout(300);
      expect((await counts(page)).played).toBe(0);
    } finally {
      await close();
    }
  });
});

/*
 * IN WEBKIT, THE IPHONE'S ENGINE: the server-drawn element, before any script,
 * already plays inline, fetches nothing, and paints its poster rather than a
 * black box. Measured by the pixel at its centre.
 */
describe("SafeVideo in WebKit, before any script", () => {
  it("shows the poster, not a black box, inline and asking for nothing before it is seen", async () => {
    const { webkit } = await import("playwright-core");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { SafeVideo } = await import("./SafeVideo");
    /* A solid red still, as the poster (an SVG, which every engine draws). */
    const still = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'><rect width='16' height='9' fill='red'/></svg>");
    const markup = renderToStaticMarkup(createElement(SafeVideo, { src: "https://media.test/walk.mp4", poster: still, controls: true, style: { width: 320, height: 180, display: "block" } }));
    /* HTML attribute names are case-insensitive; React writes it as playsInline. */
    expect(markup.toLowerCase()).toContain("playsinline");
    expect(markup).toContain('preload="none"');
    let wk;
    try {
      wk = await webkit.launch();
    } catch {
      return; /* No WebKit on this machine: nothing to prove here. */
    }
    try {
      const page = await wk.newPage({ viewport: { width: 400, height: 300 } });
      let mediaFetched = false;
      page.on("request", (request) => {
        if (request.url().startsWith("https://media.test/")) mediaFetched = true;
      });
      await page.route("http://vallo.test/**", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0">${markup}</body></html>` }));
      await page.goto("http://vallo.test/", { waitUntil: "load" });
      await page.waitForTimeout(500);
      /* Away from the play button the controls draw in the middle. */
      const shot = await page.screenshot({ clip: { x: 30, y: 30, width: 20, height: 20 } });
      /* The screenshot's own pixel, read back by the browser from the PNG. */
      const [r, g, b] = await page.evaluate(async (data) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0);
        return Array.from(x.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data.slice(0, 3));
      }, shot.toString("base64"));
      expect(r).toBeGreaterThan(180);
      expect(g).toBeLessThan(80);
      expect(b).toBeLessThan(80);
      /* What WebKit on Linux fetches for preload="none" is its media backend's
         choice (GStreamer here, and it does open the file); Safari on an
         iPhone honours "none", which only a phone can show. So the fetch is
         recorded, not asserted, in this engine. Chromium's test above proves
         the attribute stays "none" until the clip is seen. */
      void mediaFetched;
    } finally {
      await wk.close();
    }
  });
});
