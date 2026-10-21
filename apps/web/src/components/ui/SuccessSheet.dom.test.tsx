/**
 * The success sheet, mounted for real in Chromium (lib/testing/mount-in-browser):
 * what it draws, where focus lands, what a quiet reader is shown, and that
 * Continue does what it says. docs/SUCCESS_MOMENTS.md.
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

/* The browser starts in the hook; each test gets the budget its mount needs. */
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* The product's own stylesheet for this component, unwrapped from its layer,
   so the reduced-motion rules are the ones that ship. */
const CSS = [
  /* The tokens first: an animation shorthand naming an undefined easing token
     is invalid, and would read as "no animation" for the wrong reason. */
  readFileSync(join(__dirname, "..", "..", "..", "..", "..", "packages", "design-tokens", "src", "tokens.css"), "utf8"),
  /* The sheet's own geometry, which the success card's shape is layered on. */
  "*, ::before, ::after { box-sizing: border-box; }",
  readFileSync(join(__dirname, "..", "..", "app", "css", "overlays.css"), "utf8"),
  readFileSync(join(__dirname, "..", "..", "app", "css", "buttons.css"), "utf8"),
  readFileSync(join(__dirname, "..", "..", "app", "css", "success.css"), "utf8"),
].join("\n");

function entry(variant: "success" | "submitted" | "approved" = "success", object?: string): string {
  return `
    import { useState } from "react";
    import { mount } from "@/lib/testing/browser-root";
    import { SuccessSheet } from "@/components/ui/SuccessSheet";
    function Harness() {
      const [open, setOpen] = useState(true);
      window.__open = open;
      return (
        <>
          <button id="opener" onClick={() => setOpen(true)}>Open</button>
          <SuccessSheet
            open={open}
            onOpenChange={setOpen}
            variant=${JSON.stringify(variant)}
            ${object ? `object=${JSON.stringify(object)}` : ""}
            title="Stay paid"
            body="Your payment is in and these dates are confirmed."
            amount={{ minorUnits: 48500000 }}
            details={[{ label: "Reference", value: "rm-book-7f3a9c21e4", mono: true }]}
            primary={{ label: "Continue", onClick: () => { window.__continued = (window.__continued || 0) + 1; } }}
            secondary={{ label: "Close" }}
            haptic={false}
          />
        </>
      );
    }
    mount(<Harness />);
  `;
}

describe.skipIf(!hasBrowser && !process.env.CI)("SuccessSheet", () => {
  it("renders an accessible dialog with the title, the line, the amount and the reference", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS });
    try {
      const dialog = page.getByRole("dialog", { name: "Stay paid" });
      await dialog.waitFor();
      expect(await dialog.getAttribute("aria-modal")).toBe("true");
      /* The live region is filled a frame after opening, so it is announced. */
      /* The title is the dialog's name and is NOT repeated in the live region;
         the line is what the live region announces. */
      const live = page.locator('[role="status"][aria-live="polite"]');
      await page.waitForFunction(() => document.querySelector('[role="status"] span[aria-hidden]') === null);
      expect(await live.textContent()).toBe("Your payment is in and these dates are confirmed.");
      expect(await page.getByTestId("success-title").getAttribute("aria-hidden")).toBe("true");
      expect(await page.getByTestId("success-amount").textContent()).toContain("485,000");
      expect(await page.locator(".nf-success__mono").textContent()).toBe("rm-book-7f3a9c21e4");
      /* The object, decorative, on its wash, with the tick seal (motion 13).
         No sparks: the first version's eight (three of them orange) broke the
         one-spark-per-screen rule and were removed with the float (W9). */
      expect(await page.locator(".nf-success__mark img").getAttribute("alt")).toBe("");
      expect(await page.locator(".nf-success__wash").count()).toBe(1);
      expect(await page.locator(".nf-success__seal").count()).toBe(1);
      expect(await page.locator(".nf-success__bit").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("moves focus to the primary action", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS });
    try {
      await page.getByTestId("success-primary").waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "success-primary");
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Continue");
    } finally {
      await close();
    }
  });

  it("Continue runs its action and closes the sheet", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS });
    try {
      await page.getByTestId("success-primary").click();
      await page.waitForFunction(() => (window as unknown as { __open: boolean }).__open === false);
      expect(await page.evaluate(() => (window as unknown as { __continued: number }).__continued)).toBe(1);
      /* The sheet now plays its leave before it unmounts (Sheet.tsx, A7 N1),
         so it is gone a moment after the state says closed, not in the same
         frame. */
      await page.locator("[role=dialog]").waitFor({ state: "detached" });
      expect(await page.locator("[role=dialog]").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("Escape closes it too, and the secondary action only closes", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS });
    try {
      await page.getByTestId("success-primary").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => (window as unknown as { __open: boolean }).__open === false);
      await page.locator("#opener").click();
      await page.getByTestId("success-secondary").click();
      await page.waitForFunction(() => (window as unknown as { __open: boolean }).__open === false);
      expect(await page.evaluate(() => (window as unknown as { __continued?: number }).__continued ?? 0)).toBe(0);
    } finally {
      await close();
    }
  });

  it("animates by default: the wash opens, the object lands, the seal pops once at 620ms and the words rise", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS });
    try {
      await page.waitForSelector('.nf-success[data-quiet="false"]');
      const names = await page.evaluate(() => {
        const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
        return {
          wash: cs(".nf-success__wash").animationName,
          pop: cs(".nf-success__pop").animationName,
          payoff: cs(".nf-success__payoff").animationName,
          payoffDelay: cs(".nf-success__payoff").animationDelay,
          payoffDuration: cs(".nf-success__payoff").animationDuration,
          title: cs(".nf-success__title").animationName,
          /* Nothing repeats: the moment settles and stays still. */
          iterations: [".nf-success__wash", ".nf-success__pop", ".nf-success__payoff", ".nf-success__seal"].map(
            (sel) => cs(sel).animationIterationCount,
          ),
        };
      });
      expect(names).toEqual({
        wash: "nf-success-wash",
        pop: "nf-success-land",
        payoff: "nf-success-payoff",
        payoffDelay: "0.62s",
        payoffDuration: "0.18s",
        title: "nf-success-rise",
        iterations: ["1", "1", "1", "1"],
      });
    } finally {
      await close();
    }
  });

  it("lands a submission with no seal and no pop, because it waits on a person", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("submitted"), css: CSS });
    try {
      await page.waitForSelector('.nf-success[data-quiet="false"]');
      expect(await page.locator(".nf-success__seal").count()).toBe(0);
      expect(
        await page.evaluate(() => getComputedStyle(document.querySelector(".nf-success__payoff")!).animationName),
      ).toBe("none");
    } finally {
      await close();
    }
  });

  it.each([
    ["the operating system asks for less motion", { reducedMotion: true }],
    ["the app's motion setting is Calm", { motion: "calm" as const }],
    ["the app's motion setting is Off", { motion: "off" as const }],
  ])("shows the static final state when %s", async (_why, options) => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS, ...options });
    try {
      await page.waitForSelector('.nf-success[data-quiet="true"]');
      await page.waitForSelector('.nf-sheet--card[data-open="true"]');
      const state = await page.evaluate(() => {
        const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
        return {
          pop: cs(".nf-success__pop").animationName,
          wash: cs(".nf-success__wash").animationName,
          seal: cs(".nf-success__seal").animationName,
          title: cs(".nf-success__title").animationName,
          actions: cs(".nf-success__actions").animationName,
          /* Everything in its final place, fully drawn. */
          popOpacity: cs(".nf-success__pop").opacity,
          titleOpacity: cs(".nf-success__title").opacity,
          pulseOpacity: cs(".nf-success__pulse").opacity,
        };
      });
      expect(state).toEqual({
        pop: "none",
        wash: "none",
        seal: "none",
        title: "none",
        actions: "none",
        popOpacity: "1",
        titleOpacity: "1",
        pulseOpacity: "0",
      });
    } finally {
      await close();
    }
  });

  it("fills a phone screen, with the pill at the foot and every action 44px or taller", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS, viewport: { width: 360, height: 740 } });
    try {
      await page.waitForSelector('.nf-sheet--card[data-open="true"]');
      await page.waitForTimeout(400);
      const box = await page.getByTestId("success-sheet").boundingBox();
      expect(box).toMatchObject({ x: 0, y: 0, width: 360, height: 740 });
      const primary = (await page.getByTestId("success-primary").boundingBox())!;
      const secondary = (await page.getByTestId("success-secondary").boundingBox())!;
      expect(primary.height).toBeGreaterThanOrEqual(44);
      expect(secondary.height).toBeGreaterThanOrEqual(44);
      /* The actions sit in the lower part of the screen, under the object. */
      const mark = (await page.locator(".nf-success__mark").boundingBox())!;
      expect(primary.y).toBeGreaterThan(mark.y + mark.height);
      expect(secondary.y + secondary.height).toBeGreaterThan(740 * 0.8);
    } finally {
      await close();
    }
  });

  it("is a centred card on a wide screen", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: CSS, viewport: { width: 1440, height: 900 } });
    try {
      await page.waitForSelector('.nf-sheet--card[data-open="true"]');
      await page.waitForTimeout(500);
      const box = (await page.getByTestId("success-sheet").boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(26 * 16 + 1);
      expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(2);
      expect(box.height).toBeLessThan(900);
    } finally {
      await close();
    }
  });

  it.each([
    ["success", "verified"],
    ["submitted", "clock"],
    ["approved", "verified"],
  ] as const)("draws the %s variant with its default object", async (variant, object) => {
    const { page, close } = await mountInBrowser({ entry: entry(variant), css: CSS });
    try {
      await page.waitForSelector(`.nf-success[data-variant="${variant}"]`);
      expect(await page.locator(".nf-success__mark").getAttribute("data-object")).toBe(object);
      expect(await page.locator(".nf-success__mark img").getAttribute("src")).toContain(`/brand/3d/${object}@2x.webp`);
    } finally {
      await close();
    }
  });

  it("draws the object it is given", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("success", "keys"), css: CSS });
    try {
      expect(await page.locator(".nf-success__mark").getAttribute("data-object")).toBe("keys");
    } finally {
      await close();
    }
  });

  it("puts a Copy control beside a reference, which copies it and says Copied", async () => {
    const withCopy = entry()
      .replace(
        'import { SuccessSheet } from "@/components/ui/SuccessSheet";',
        'import { SuccessSheet } from "@/components/ui/SuccessSheet";\n    import { ClientCopyProvider } from "@/lib/i18n/client-copy";',
      )
      .replace(
        "mount(<Harness />);",
        'mount(<ClientCopyProvider copy={{ details: { copy: { action: "Copy", copied: "Copied", linkCopied: "Link copied", codeCopied: "Code copied", failed: "Could not copy." } } } as never}><Harness /></ClientCopyProvider>);',
      );
    const { page, close } = await mountInBrowser({ entry: withCopy, css: CSS });
    try {
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: async (text: string) => { (window as unknown as { __copied: string }).__copied = text; } },
        });
      });
      const button = page.getByTestId("success-copy");
      await button.waitFor();
      expect(await button.getAttribute("aria-label")).toBe("Copy: Reference");
      /* The reference alone is still the one-tap selectable text. */
      expect(await page.locator(".nf-success__mono").textContent()).toBe("rm-book-7f3a9c21e4");
      await button.click();
      await page.waitForFunction(() => (window as unknown as { __copied?: string }).__copied === "rm-book-7f3a9c21e4");
      await page.waitForFunction(() => document.querySelector('[data-testid="success-copy"]')?.textContent?.includes("Copied"));
    } finally {
      await close();
    }
  });
});
