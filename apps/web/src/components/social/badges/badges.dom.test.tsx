/**
 * The badge row and the earned moment, mounted for real in Chromium on the
 * real Sheet: six at most, earned told apart from given, the moment for the
 * owner's earned badge only, Share and Back, and the stillness under reduced
 * motion. Set `W4_SHOTS_DIR` to also write screenshots there (a proof aid; the
 * suite never depends on it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = [
  PORTED_CSS,
  readFileSync(join(__dirname, "badges.css"), "utf8"),
  /* The few rules the row leans on from the shared sheets. */
  ".nf-asi{}",
].join("\n");

const COPY = {
  title: "Badges",
  givenBy: "Given by the Vallo team",
  earnedOn: "Earned on {date}",
  means: "What it means",
  overline: "Badge earned",
  share: "Share",
  back: "Back",
  shareText: "I earned {badge} on Vallo.",
  copied: "Copied. Paste it anywhere.",
  copyFailed: "Could not share from this browser. Copy the address instead.",
  replayHint: "Tap the medal to see it again",
};

const DAY = 24 * 60 * 60 * 1000;

/*
 * Where Share goes. "sheet": the browser has a share sheet. "clipboard": none,
 * and the clipboard takes the link only after `CLIPBOARD_MS`. "denied": none,
 * and neither the async clipboard nor the old execCommand path takes it.
 */
type ShareEnv = "sheet" | "clipboard" | "denied";
const CLIPBOARD_MS = 600;

function entry(isOwner: boolean, count = 8, env: ShareEnv = "sheet") {
  return `
    import { BadgeRow } from "@/components/social/badges/BadgeRow";
    import { mount } from "@/lib/testing/browser-root";
    import { subscribeToast } from "@/lib/ui/toast";
    /* Every message the one toast host would draw, with its tone. */
    window.__toasts = [];
    subscribeToast((item) => { if (item) window.__toasts.push([item.message, item.tone]); });
    const now = Date.now();
    const badges = ${JSON.stringify(
      Array.from({ length: count }, (_, i) => ({
        code: `code-${i}`,
        name: ["Verified agent", "First listing", "Fast responder", "Ten stays", "Estate specialist", "Photo pro", "Year one", "Top contributor"][i % 8],
        description: "Awarded from events the platform recorded.",
        objectName: ["shield-check", "keys-home", "clock-check", "calendar-check", "map-spot", "camera", "gift-star", "reviews"][i % 8],
        tier: count - i,
        grantedLabel: "4 October 2026",
        earned: i !== 2,
      })),
    )}.map((b, i) => ({ ...b, grantedAt: new Date(now - i * ${DAY}).toISOString() }));
    window.__shared = [];
    window.__clipboard = [];
    const env = ${JSON.stringify(env)};
    if (env === "sheet") {
      navigator.share = (data) => { window.__shared.push(data); return Promise.resolve(); };
    } else {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      const writeText = env === "clipboard"
        ? (text) => new Promise((done) => setTimeout(() => { window.__clipboard.push(text); done(); }, ${CLIPBOARD_MS}))
        : () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      document.execCommand = () => false;
    }
    mount(<BadgeRow badges={badges} isOwner={${isOwner}} copy={${JSON.stringify(COPY)}} shareUrl="https://example.test/u/seyi" />);
  `;
}

const toasts = (page: import("playwright-core").Page) =>
  page.evaluate(() => (window as unknown as { __toasts: [string, string][] }).__toasts);

async function maybeShot(page: import("playwright-core").Page, name: string) {
  const dir = process.env.W4_SHOTS_DIR;
  if (!dir) return;
  await page.route("**/brand/**", (route) =>
    route.fulfill({
      path: join(process.cwd(), "public", new URL(route.request().url()).pathname),
    }),
  );
  /* Pictures that already failed against the bare harness are asked again. */
  await page.evaluate(() =>
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src;
      img.src = "";
      img.src = src;
    }),
  );
  await page.waitForTimeout(1400);
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

describe.skipIf(!hasBrowser && !process.env.CI)("the badge row", () => {
  it("shows six at most, and says in words which one was given rather than earned", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      await page.getByTestId("profile-badges").waitFor();
      expect(await page.locator(".nf-merit-tile").count()).toBe(6);
      /* code-2 is the hand-given one and sits inside the top six. */
      expect(await page.getByText("Given by the Vallo team").count()).toBe(1);
      await maybeShot(page, "badge-row");
    } finally {
      await close();
    }
  });

  it("a visitor gets a sheet saying what it means, never the celebration", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS });
    try {
      await page.getByTestId("badge-code-0").click();
      const sheet = page.getByTestId("badge-sheet");
      await sheet.waitFor();
      expect(await sheet.innerText()).toContain("Awarded from events the platform recorded.");
      expect(await sheet.innerText()).toContain("Earned on 4 October 2026");
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("the owner's earned badge opens the moment with Share and Back; Back closes it", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS });
    try {
      await page.getByTestId("badge-code-0").click();
      const moment = page.getByTestId("badge-moment");
      await moment.waitFor();
      expect((await moment.innerText()).toLowerCase()).toContain("badge earned");
      await page.getByRole("button", { name: "Share" }).click();
      await page.waitForFunction(() => (window as unknown as { __shared: unknown[] }).__shared.length === 1);
      /* The sheet took it: nothing claims a copy. */
      expect(await toasts(page)).toEqual([]);
      const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string; url: string }[] }).__shared[0]);
      expect(shared?.text).toBe("I earned Verified agent on Vallo.");
      expect(shared?.url).toBe("https://example.test/u/seyi");
      await maybeShot(page, "badge-moment");
      await page.getByRole("button", { name: "Back" }).click();
      await page.getByTestId("badge-moment").waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  /* D49.3: the toast used to say "Copied" before, and regardless of, the clipboard's answer. */
  it("says Copied only after the clipboard has actually taken the link", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true, 8, "clipboard"), css: CSS });
    try {
      await page.getByTestId("badge-code-0").click();
      await page.getByTestId("badge-moment").waitFor();
      await page.getByRole("button", { name: "Share" }).click();
      await page.waitForTimeout(CLIPBOARD_MS / 3);
      expect(await page.evaluate(() => (window as unknown as { __clipboard: string[] }).__clipboard)).toEqual([]);
      expect(await toasts(page)).toEqual([]);
      await page.waitForFunction(() => (window as unknown as { __toasts: unknown[] }).__toasts.length > 0);
      expect(await toasts(page)).toEqual([[COPY.copied, "success"]]);
      expect(await page.evaluate(() => (window as unknown as { __clipboard: string[] }).__clipboard)).toEqual([
        "https://example.test/u/seyi",
      ]);
    } finally {
      await close();
    }
  });

  it("never says Copied when nothing was copied, and says what to do instead", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true, 8, "denied"), css: CSS });
    try {
      await page.getByTestId("badge-code-0").click();
      await page.getByTestId("badge-moment").waitFor();
      await page.getByRole("button", { name: "Share" }).click();
      await page.waitForFunction(() => (window as unknown as { __toasts: unknown[] }).__toasts.length > 0);
      expect(await toasts(page)).toEqual([[COPY.copyFailed, "error"]]);
    } finally {
      await close();
    }
  });

  it("the owner's hand-given badge is a sheet, not a celebration", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS });
    try {
      await page.getByTestId("badge-code-2").click();
      await page.getByTestId("badge-sheet").waitFor();
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("holds still under reduced motion: no animation on the sunburst or the medal", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS, reducedMotion: true });
    try {
      await page.getByTestId("badge-code-0").click();
      await page.getByTestId("badge-moment").waitFor();
      const names = await page.evaluate(() => [
        getComputedStyle(document.querySelector(".nf-medal-moment__burst")!).animationName,
        getComputedStyle(document.querySelector(".nf-medal-moment__medal")!).animationName,
      ]);
      expect(names).toEqual(["none", "none"]);
    } finally {
      await close();
    }
  });

  it("scales the medal in over 620ms on the deliberate token", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS });
    try {
      await page.getByTestId("badge-code-0").click();
      await page.getByTestId("badge-moment").waitFor();
      const first = await page.evaluate(() => getComputedStyle(document.querySelector(".nf-medal-moment__medal")!).animationDuration);
      expect(first.split(",")[0]?.trim()).toBe("0.62s");
    } finally {
      await close();
    }
  });
});
