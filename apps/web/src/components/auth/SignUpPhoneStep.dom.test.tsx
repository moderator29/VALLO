/**
 * SIGN-UP, STEP THREE: the phone code after the email code. The code goes out
 * as the screen opens, the last digit confirms, and no other number is offered:
 * a wrong number goes to support.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { SignUpPhoneStep } from "@/components/auth/SignUpPhoneStep";
  mount(<SignUpPhoneStep t={getDictionary("en")} phone="+2348031234567" next="/home" />);
`;
const CSS = productCss("app/css/auth.css");
const calls = (page: import("playwright-core").Page) =>
  page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).map((c) => [c[0], c[1]]));

describe.skipIf(!hasBrowser && !process.env.CI)("the sign-up phone step", () => {
  it("sends the code as it opens, shows the number in full, and confirms on the last digit", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: {
        sendPhoneCode: `async () => ({ ok: true, data: { sentTo: "+2348031234567" } })`,
        confirmPhoneCode: `async () => ({ ok: true, data: { confirmed: true } })`,
        saveProfilePhone: `async () => ({ ok: true, data: { last: "4567" } })`,
      },
    });
    try {
      await page.getByText("We sent a six-digit code to").waitFor();
      expect(await page.getByTestId("sign-up-phone").innerText()).toContain("+234 803 123 4567");
      await page.locator("#sign-up-phone-code").fill("123456");
      await page.getByText("Confirmed.").waitFor();
      const seen = await calls(page);
      expect(seen.filter((c) => c[0] === "sendPhoneCode")).toEqual([["sendPhoneCode", { phone: "+2348031234567" }]]);
      expect(seen.filter((c) => c[0] === "confirmPhoneCode")).toEqual([["confirmPhoneCode", { code: "123456" }]]);
      /* The same number: nothing to save. */
      expect(seen.some((c) => c[0] === "saveProfilePhone")).toBe(false);
    } finally {
      await close();
    }
  });

  it("offers no other number: a confirmed number is who the account is, so a wrong one goes to support", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: { sendPhoneCode: `async () => ({ ok: true, data: { sentTo: "+2348031234567" } })` },
    });
    try {
      await page.getByText("We sent a six-digit code to").waitFor();
      expect(await page.getByTestId("sign-up-phone-change").count()).toBe(0);
      expect(await page.getByTestId("sign-up-phone-support").getAttribute("href")).toBe("/support");
      expect(await page.getByTestId("sign-up-phone").innerText()).toContain("Wrong number?");
    } finally {
      await close();
    }
  });

  it("a refused send is said on the screen, and Do this later goes on", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: {
        sendPhoneCode: `async () => ({ ok: false, error: "We could not send a code just now. Nothing was changed. Try again in a moment." })`,
        confirmPhoneCode: `async () => ({ ok: true, data: { confirmed: true } })`,
        saveProfilePhone: `async () => ({ ok: true, data: { last: "4567" } })`,
      },
    });
    try {
      await page.getByText("We could not send a code just now.").waitFor();
      expect(await page.getByTestId("sign-up-phone-later").getAttribute("href")).toBe("/home");
    } finally {
      await close();
    }
  });
});
