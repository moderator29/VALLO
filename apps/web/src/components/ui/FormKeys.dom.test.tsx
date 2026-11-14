/**
 * NEXT AND DONE, THROUGH A FORM, IN A REAL BROWSER (the keyboard pass, 14
 * November 2026). The rule is unit tested in `lib/ui/form-keys.test.ts`; this
 * is the key actually moving the cursor, submitting, and putting the keyboard
 * away.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { FormKeys } from "@/components/ui/FormKeys";
  import { TextField } from "@/components/ui/Field";
  window.__submits = 0;
  mount(
    <main>
      <FormKeys />
      <form onSubmit={(event) => { event.preventDefault(); window.__submits += 1; }}>
        <TextField label="Full name" name="name" autoComplete="name" data-testid="name" />
        <TextField label="Email" name="email" type="email" autoComplete="email" enterKeyHint="next" data-testid="email" />
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" data-testid="phone" />
        <button type="submit">Save</button>
      </form>
      <input data-testid="loose" aria-label="A note" type="text" enterKeyHint="done" />
    </main>
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("Next and Done through a form", () => {
  it("says Next until the last field, moves on it, and submits on Done", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: productCss() });
    try {
      const name = page.locator("[data-testid=name]");
      const email = page.locator("[data-testid=email]");
      const phone = page.locator("[data-testid=phone]");
      await name.focus();
      expect(await name.getAttribute("enterkeyhint")).toBe("next");
      await page.keyboard.press("Enter");
      expect(await email.evaluate((el) => el === document.activeElement)).toBe(true);
      /* A field that named Next itself moves on too, instead of submitting half a form. */
      expect(await email.getAttribute("enterkeyhint")).toBe("next");
      await page.keyboard.press("Enter");
      expect(await phone.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await page.evaluate(() => (window as unknown as { __submits: number }).__submits)).toBe(0);
      /* The last field says Done and submits, as it always did. */
      expect(await phone.getAttribute("enterkeyhint")).toBe("done");
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => (window as unknown as { __submits: number }).__submits)).toBe(1);
    } finally {
      await close();
    }
  });

  it("gives each field the keyboard its type and autocomplete ask for", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: productCss() });
    try {
      const read = (testId: string) =>
        page.locator(`[data-testid=${testId}]`).evaluate((el) => ({
          mode: el.getAttribute("inputmode"),
          cap: el.getAttribute("autocapitalize"),
          correct: el.getAttribute("autocorrect"),
          spell: el.getAttribute("spellcheck"),
        }));
      expect(await read("name")).toEqual({ mode: null, cap: "words", correct: "off", spell: "false" });
      expect(await read("email")).toEqual({ mode: "email", cap: "none", correct: "off", spell: "false" });
      expect(await read("phone")).toEqual({ mode: "tel", cap: "none", correct: "off", spell: "false" });
    } finally {
      await close();
    }
  });

  it("Done on a field that belongs to no form puts the keyboard away", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: productCss() });
    try {
      const loose = page.locator("[data-testid=loose]");
      await loose.focus();
      await page.keyboard.press("Enter");
      expect(await loose.evaluate((el) => el === document.activeElement)).toBe(false);
      expect(await page.evaluate(() => (window as unknown as { __submits: number }).__submits)).toBe(0);
    } finally {
      await close();
    }
  });
});
