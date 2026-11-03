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
