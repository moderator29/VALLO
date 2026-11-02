/**
 * CONFIRMING A NUMBER WHILE THE MEMBER WATCHES (round 5, "something is
 * verified"), in Chromium on the product's button system. The Confirm control
 * becomes the confirmed state (7060 to 7061) only on the server's yes, with
 * one heavy haptic on its pop, and the SAME panel then turns to the confirmed
 * words. A refusal is immediate: no motion, one error pattern, focus on the
 * next action.
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
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* animation.css carries the reduced-motion floor the quiet answer must survive. */
const CSS = productCss("app/css/animation.css", "components/verification/verified-face.css");
const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { PhoneConfirmForm } from "@/app/(app)/settings/phone/PhoneConfirmForm";
  window.__buzz = [];
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p) => { window.__buzz.push(p); return true; } });
  mount(<PhoneConfirmForm copy={getDictionary("en").trustVisible.phone} />);
`;
const SENT = `async () => ({ ok: true, data: { sentTo: "8031234567" } })`;
const buzz = (page: Page) => page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz);

async function toCode(page: Page) {
  await page.getByLabel("Mobile number").fill("08031234567");
  await page.getByRole("button", { name: "Send the code" }).click();
  await page.getByLabel("Code").fill("123456");
}

describe.skipIf(!hasBrowser && !process.env.CI)("confirming a phone number", () => {
  it("on the server's yes the control morphs to the tick and pops once, felt once, then the same panel turns to the confirmed words", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: { sendPhoneCode: SENT, confirmPhoneCode: `async () => ({ ok: true, data: { confirmed: true } })` },
    });
    try {
      await toCode(page);
      await page.evaluate(() => {
        (window as unknown as { __panel: Element }).__panel = document.querySelector('[data-testid="phone-form"]')!;
      });
      await page.getByRole("button", { name: "Confirm" }).click();
      /* The control is the moment: the ring closes, the tick draws, the pop (transform only). */
      await page.locator('[data-morph="done"]').waitFor();
      const morph = await page.locator('[data-morph="done"]').evaluate((el) =>
        el.getAnimations().map((a) => {
          const frames = (a.effect as KeyframeEffect).getKeyframes();
          return { name: (a as CSSAnimation).animationName, props: [...new Set(frames.flatMap((f) => Object.keys(f)))].filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k)) };
        }),
      );
      expect(morph.find((a) => a.name === "nf-btn-pop")?.props).toEqual(["transform"]);
      await page.getByTestId("phone-done").waitFor();
      /* The same panel element, its face turned: not a line printed where a panel was. */
      expect(await page.evaluate(() => (window as unknown as { __panel: Element }).__panel === document.querySelector('[data-testid="phone-form"]'))).toBe(true);
      expect(await page.getByTestId("phone-done").textContent()).toContain("Confirmed.");
      const face = await page.getByTestId("phone-done").evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName));
      expect(face).toEqual(["nf-vface-rise"]);
      await page.waitForTimeout(400);
      expect(await buzz(page), "one heavy haptic, on the pop").toEqual([[14, 70, 28]]);
    } finally {
      await close();
    }
  });

  it("a wrong code is a cut: the words at once, no motion, one error pattern, and focus back in the code to retype", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: { sendPhoneCode: SENT, confirmPhoneCode: `async () => ({ ok: false, error: "That code does not match. Check the message and try again." })` },
    });
    try {
      await toCode(page);
      await page.getByRole("button", { name: "Confirm" }).click();
      const alert = page.getByRole("alert");
      await alert.waitFor();
      expect(await alert.evaluate((el) => el.getAnimations().length)).toBe(0);
      expect(await page.locator('[data-morph="done"]').count()).toBe(0);
      await page.waitForFunction(() => document.activeElement?.getAttribute("autocomplete") === "one-time-code");
      expect(await buzz(page)).toEqual([[40, 60, 40, 60, 40]]);
    } finally {
      await close();
    }
  });

  it("a spent code sends focus to the one action that helps: a new code", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: { sendPhoneCode: SENT, confirmPhoneCode: `async () => ({ ok: false, error: "That code has expired. Ask for a new one." })` },
    });
    try {
      await toCode(page);
      await page.getByRole("button", { name: "Confirm" }).click();
      await page.getByRole("alert").waitFor();
      await page.waitForFunction(() => document.activeElement?.textContent === "Send a new code");
    } finally {
      await close();
    }
  });

  it("quiet readers: no pop to wait for, the panel turns at once with a 160ms fade, and it is still felt once", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      reducedMotion: true,
      actions: { sendPhoneCode: SENT, confirmPhoneCode: `async () => ({ ok: true, data: { confirmed: true } })` },
    });
    try {
      await toCode(page);
      await page.getByRole("button", { name: "Confirm" }).click();
      await page.getByTestId("phone-done").waitFor();
      const face = await page.getByTestId("phone-done").evaluate((el) =>
        el.getAnimations().map((a) => [(a as CSSAnimation).animationName, Number(a.effect!.getComputedTiming().duration)]),
      );
      expect(face).toEqual([["nf-vface-in", 160]]);
      expect(await buzz(page)).toEqual([[14, 70, 28]]);
    } finally {
      await close();
    }
  });

  it("a number from another country: choose the country, type it as it is written at home, and the server is asked with that country", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: {
        sendPhoneCode: `async (input) => { window.__sent = input; return { ok: true, data: { sentTo: "+447911123456" } }; }`,
        confirmPhoneCode: `async () => ({ ok: true, data: { confirmed: true } })`,
      },
    });
    try {
      await page.getByTestId("phone-country").click();
      await page.getByLabel("Search countries").fill("United Kingdom");
      await page.getByRole("button", { name: /United Kingdom/ }).click();
      await page.getByLabel("Mobile number").fill("07911 123456");
      await page.getByRole("button", { name: "Send the code" }).click();
      await page.getByLabel("Code").waitFor();
      expect(await page.evaluate(() => (window as unknown as { __sent: unknown }).__sent)).toEqual({ phone: "+44 7911 123456", country: "GB" });
      expect(await page.getByText(/We sent a six-digit code to/).textContent()).toContain("+44 7911 123456");
    } finally {
      await close();
    }
  });
});
