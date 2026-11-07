/**
 * GET STARTED, MOUNTED FOR REAL in Chromium on its own stylesheets: the step
 * progress the founder asked for on 8 October 2026 ("add those 1 of 4, 2 of 4
 * stuffs", to the Plasma onboarding), and the behaviour every way in depends
 * on, which the enhancement had to keep.
 *
 *   - a visible "1 of 4" over the title, four step dots under the line (each
 *     a 44px target, the current one marked), one Continue capsule
 *   - Continue, the arrow keys and the dots move between steps, the counter
 *     follows, and every move is announced
 *   - the last step: Create account and Sign in are real links keeping where
 *     the stranger was going, and reaching it records the device
 *     (`vallo_first_run`)
 *   - Skip hands a stranger on to `next` and records the device; a browser
 *     that refuses the cookie gets the `welcomed` flag instead
 *   - somebody signed in: Continue on the last step records the opener and
 *     asks the interests question while it is unanswered
 *   - reduced motion: nothing animates
 *   - axe finds nothing
 *
 * Fixtures are the real English dictionary and the real arrival reader
 * (`arrivalOf`), so no word here is written by this test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/welcome/welcome.css", "app/welcome/onboarding-motion.css");

/* A browser that silently refuses the cookie: the write goes nowhere. */
const COOKIES_REFUSED = `Object.defineProperty(document, "cookie", { get() { return ""; }, set() {}, configurable: true });`;

function guest(next: string | null = null): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { FirstRun } from "@/components/app/welcome/FirstRun";
    import { arrivalOf } from "@/app/welcome/plan";
    import { mount } from "@/lib/testing/browser-root";
    const t = getDictionary("en");
    const next = ${JSON.stringify(next)};
    window.__facts = {
      cont: t.onboardingMotion.continue,
      progress: t.onboardingMotion.progress,
      slides: t.onboardingMotion.slides,
      skip: t.welcomeCards.skip,
      create: t.welcomeCards.firstRun.choice.create,
      signIn: t.welcomeCards.firstRun.choice.signIn,
    };
    mount(<FirstRun introSlides t={t} interests={[]} showCards asked viewer="guest" next={next} arrival={arrivalOf(next)} />);
  `;
}

function member(): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { FirstRun } from "@/components/app/welcome/FirstRun";
    import { mount } from "@/lib/testing/browser-root";
    const t = getDictionary("en");
    window.__facts = { cont: t.welcomeCards.firstRun.member.continue, question: t.interests.question };
    mount(<FirstRun introSlides t={t} interests={[]} showCards asked={false} viewer="member" next={null} />);
  `;
}

type Slide = { titleA: string; titleB: string };
type Facts = {
  cont: string;
  progress: string;
  slides: Record<"worlds" | "know" | "talk" | "ready", Slide>;
  skip: string;
  create: string;
  signIn: string;
  question?: string;
};
const facts = (page: Page) => page.evaluate(() => (window as unknown as { __facts: Facts }).__facts);
const step = async (page: Page) => Number(await page.getByTestId("first-run").getAttribute("data-step"));
const counter = (page: Page) => page.getByTestId("welcome-count").textContent();
const title = async (page: Page) => (await page.getByRole("heading", { level: 1 }).textContent())?.replace(/\s+/g, " ").trim();
const named = (s: Slide) => `${s.titleA} ${s.titleB}`;
const routerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []);
const seenCookie = (page: Page) => page.evaluate(() => document.cookie.includes("vallo_first_run=seen"));

describe.skipIf(!hasBrowser && !process.env.CI)("Get started", () => {
  it("shows 1 of 4 over the title, four 44px dots under the line and one Continue capsule", async () => {
    const { page, close } = await mountInBrowser({ entry: guest(), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      expect(await counter(page)).toBe("1 of 4");
      expect(await title(page)).toBe(named(f.slides.worlds));
      const dots = page.getByRole("group", { name: f.progress }).getByRole("button");
      expect(await dots.count()).toBe(4);
      expect(await dots.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))).toEqual([
        "Step 1 of 4",
        "Step 2 of 4",
        "Step 3 of 4",
        "Step 4 of 4",
      ]);
      expect(await dots.evaluateAll((els) => els.map((el) => el.getAttribute("aria-current")))).toEqual([
        "step",
        null,
        null,
        null,
      ]);
      for (const box of await dots.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      /* In the reference's order: the words, then the dots, then the button. */
      const top = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);
      expect(await top(".nf-om-words:not(.nf-om-words--sizer)")).toBeLessThan(await top(".nf-om-progress"));
      expect(await top(".nf-om-progress")).toBeLessThan(await top(".nf-om-foot"));
      /* One full-width capsule. */
      const cta = page.getByRole("button", { name: f.cont, exact: true });
      expect(await cta.count()).toBe(1);
      const shape = await cta.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return { radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), height: box.height, width: box.width };
      });
      expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
      expect(shape.width).toBeGreaterThan(300);
      expect(await page.getByRole("button", { name: f.skip, exact: true }).count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("moves on Continue, the arrow keys and the dots; the counter follows and each move is announced", async () => {
    const { page, close } = await mountInBrowser({ entry: guest(), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.cont, exact: true }).click();
      expect(await step(page)).toBe(2);
      expect(await counter(page)).toBe("2 of 4");
      expect(await title(page)).toBe(named(f.slides.know));
      expect(await page.locator("[aria-live='polite']").textContent()).toContain("2 of 4");
      await page.keyboard.press("ArrowRight");
      expect(await step(page)).toBe(3);
      expect(await counter(page)).toBe("3 of 4");
      await page.keyboard.press("ArrowLeft");
      expect(await step(page)).toBe(2);
      await page.getByTestId("welcome-dot-1").click();
      expect(await step(page)).toBe(1);
      expect(await page.getByTestId("welcome-dot-1").getAttribute("aria-current")).toBe("step");
      await page.keyboard.press("End");
      expect(await step(page)).toBe(4);
      expect(await counter(page)).toBe("4 of 4");
    } finally {
      await close();
    }
  });

  it("ends on Create account and Sign in, and reaching the end records the device", async () => {
    const { page, close } = await mountInBrowser({ entry: guest(), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      expect(await seenCookie(page)).toBe(false);
      await page.keyboard.press("End");
      expect(await title(page)).toBe(named(f.slides.ready));
      expect(await page.getByRole("button", { name: f.skip, exact: true }).count()).toBe(0);
      expect(await page.getByRole("link", { name: f.create }).getAttribute("href")).toBe("/sign-up");
      expect(await page.getByRole("link", { name: f.signIn, exact: true }).getAttribute("href")).toBe("/sign-in");
      expect(await seenCookie(page)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps where an arrival was going: both doors carry the address", async () => {
    const next = "/sign-in?next=%2Flisting%2Fabc";
    const { page, close } = await mountInBrowser({ entry: guest(next), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      await page.keyboard.press("End");
      expect(await page.getByRole("link", { name: f.signIn, exact: true }).getAttribute("href")).toBe(next);
      expect(await page.getByRole("link", { name: f.create }).getAttribute("href")).toBe("/sign-up?next=%2Flisting%2Fabc");
    } finally {
      await close();
    }
  });

  it("Skip hands a stranger on to where they were going and records the device", async () => {
    const { page, close } = await mountInBrowser({ entry: guest("/sign-up"), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.skip, exact: true }).click();
      /* A door always carries the passed flag, so it can never bounce back here. */
      expect(await routerCalls(page)).toEqual([["push", "/sign-up?welcomed=1"]]);
      expect(await seenCookie(page)).toBe(true);
    } finally {
      await close();
    }
  });

  it("Skip carries the welcomed flag when the browser refuses the cookie", async () => {
    const { page, close } = await mountInBrowser({
      entry: guest("/sign-up"),
      css: CSS,
      reducedMotion: true,
      init: COOKIES_REFUSED,
    });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.skip, exact: true }).click();
      expect(await routerCalls(page)).toEqual([["push", "/sign-up?welcomed=1"]]);
    } finally {
      await close();
    }
  });

  it("somebody signed in: Continue at the end records the opener, then asks the interests question", async () => {
    const { page, close } = await mountInBrowser({
      entry: member(),
      css: CSS,
      reducedMotion: true,
      actions: { markWelcomeSeen: "async () => ({ ok: true, data: null })" },
    });
    try {
      const f = await facts(page);
      await page.keyboard.press("End");
      await page.getByTestId("welcome-continue").click();
      await page.getByRole("heading", { level: 1, name: f.question! }).waitFor({ timeout: 15_000 });
      const calls = await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
      expect(calls.map((c) => c[0])).toContain("markWelcomeSeen");
    } finally {
      await close();
    }
  });

  it("under reduced motion nothing animates, step to step", async () => {
    const { page, close } = await mountInBrowser({ entry: guest(), css: CSS, reducedMotion: true });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.cont, exact: true }).click();
      await page.waitForTimeout(50);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    } finally {
      await close();
    }
  });
});
