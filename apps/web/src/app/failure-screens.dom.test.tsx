/**
 * A FAILURE SCREEN IS DESIGNED, AND IT ARRIVES AT ONCE (W2, round 5;
 * CRAFT-PRINCIPLES "failure is designed", CRAFT_DOCTRINE 5: an error is
 * immediate, 160ms, never a slow reveal).
 *
 * The in-app failure (`StateMoment kind="error"`) leads with the kind's small
 * mark on its plate, and its card fades in on the fast rung with no delay and
 * no travel; the settle a place earns (the offline and missing screens) is
 * left as it was. Read from the computed styles in Chromium.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { getDictionary } from "@vallo/i18n";
import { bannedPhrasesIn, stateCopyProblems } from "@/lib/design/voice";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { GLASS_CSS, productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const SRC = join(__dirname, "..");
const src = (path: string) => readFileSync(join(SRC, path), "utf8");
const CSS = productCss(GLASS_CSS, "app/css/animation.css", "app/css/controls.css", "app/css/system.css");

const entry = (kind: "error" | "empty") => `
  import { mount } from "@/lib/testing/browser-root";
  import { StateMoment } from "@/components/ui/StateMoment";
  mount(<StateMoment kind="${kind}" overline="Not loaded" title="That screen did not load" body="A sentence." actions={<div className="nf-system__actions"><button>Try again</button></div>} />);
`;

const motion = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const cs = getComputedStyle(document.querySelector(s)!);
    return { name: cs.animationName, duration: cs.animationDuration, delay: cs.animationDelay };
  }, sel);

describe.skipIf(!hasBrowser && !process.env.CI)("the failure screen", () => {
  it("cuts in on the fast rung, at once and without travel, and leads with the kind's small mark", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("error"), css: CSS });
    try {
      for (const sel of [".nf-system__card", ".nf-system__brand"]) {
        expect(await motion(page, sel), sel).toEqual({ name: "nf-fade-in", duration: "0.16s", delay: "0s" });
      }
      const mark = page.locator("[data-state-kind=error] .nf-system__mark");
      expect(await mark.count()).toBe(1);
      expect(await mark.evaluate((el) => el.className)).toMatch(/nf-plate--danger/);
      /* The mark comes before the words, so it is read first. */
      expect(await page.evaluate(() => document.querySelector("[data-state-kind=error]")!.firstElementChild!.className)).toMatch(/nf-system__mark/);
    } finally {
      await close();
    }
  });

  it("leaves a place's settle alone: a state that is not a failure still rises", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("empty"), css: CSS });
    try {
      expect((await motion(page, ".nf-system__card")).name).toBe("nf-rise");
    } finally {
      await close();
    }
  });
});

describe("the failure screens' words", () => {
  const copy = getDictionary("en").trustVisible.state;
  it("say what happened, what is safe and what to do, in the voice, with no banned phrase", () => {
    expect(stateCopyProblems({ kind: "error", title: copy.screenErrorTitle, body: copy.screenErrorBody, actions: ["Try again", "Back to home"] })).toEqual([]);
    /* 13 November 2026: the calm words. "undoes nothing you had already sent or
       saved" became "Nothing you sent or saved was undone", the same safe claim;
       what to do is still said ("Tap Try again in a moment"). */
    expect(copy.screenErrorBody).toMatch(/Nothing you sent or saved was undone\./);
    expect(copy.screenErrorBody).toMatch(/Tap Try again in a moment\./);
    expect(copy.screenErrorRef).toContain("{digest}");
    for (const file of ["app/error.tsx", "app/global-error.tsx", "app/(app)/error.tsx"]) {
      expect(bannedPhrasesIn(src(file).replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, "")), file).toEqual([]);
    }
    expect(src("app/error.tsx")).toMatch(/Nothing\s+you sent or saved was undone\./);
    expect(src("app/global-error.tsx")).toMatch(/Nothing you sent or saved was undone\./);
  });
});
