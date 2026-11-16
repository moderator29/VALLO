/**
 * THE PROOF SHEET OPENS INSIDE THE CALLER'S TRANSITION (14 November 2026,
 * found while rebuilding the money lock's own settings screen).
 *
 * Every call site asks for the proof the way the doc comment on
 * `useMoneyStepUp` shows it: `start(async () => { const stepUp = await
 * lock.prove(...) })`. In React 19 that is an ACTION, and the state updates
 * made in its synchronous head are not committed until the action settles.
 * `prove()` settles only when the person answers the sheet, so `setOpen(true)`
 * was waiting for the sheet it was meant to open: the screen sat with its
 * controls disabled and nothing to answer, and no proof was ever asked for.
 *
 * It was invisible to anybody who had NOT enrolled a phone, because `prove`
 * answers at once when no proof is needed, which is almost every account.
 * Settings, Remove this phone was dead for exactly the people who had used
 * the feature.
 *
 * This mounts the documented caller shape in Chromium and holds the rule: the
 * sheet is on screen inside the tap, and the proof it collects reaches the
 * caller. `flushSync` in `ask` is what makes that true; deleting it fails
 * here.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";

const copy = getDictionary("en").platform.moneyLock;

beforeAll(warmBrowser);
afterAll(closeBrowser);

/** The caller shape `useMoneyStepUp`'s own documentation prescribes. */
const CALLER = `
  import { useTransition } from "react";
  import { useMoneyStepUp } from "@/components/app/money/MoneyStepUp";
  import { mount } from "@/lib/testing/browser-root";

  function Caller() {
    const lock = useMoneyStepUp();
    const [pending, start] = useTransition();
    return (
      <div>
        <button
          type="button"
          data-testid="go"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const stepUp = await lock.prove({ kind: "remove_lock", target: "a-phone" });
              window.__proved = stepUp;
            })
          }
        >
          Remove this phone
        </button>
        {lock.sheet}
      </div>
    );
  }

  mount(<Caller />);
`;

const PHONE = `
  window.__proved = undefined;
  window.PublicKeyCredential = function () {};
  window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
  Object.defineProperty(navigator, "credentials", { configurable: true, value: {
    get: async () => ({
      rawId: new Uint8Array(32).fill(7).buffer,
      response: {
        clientDataJSON: new Uint8Array(24).fill(1).buffer,
        authenticatorData: new Uint8Array(37).fill(2).buffer,
        signature: new Uint8Array(64).fill(3).buffer,
      },
    }),
  } });
`;

describe.skipIf(!hasBrowser && !process.env.CI)("useMoneyStepUp, asked from inside a transition", () => {
  it(
    "shows the sheet inside the tap and hands the proof back to the caller",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: CALLER,
        reducedMotion: true,
        init: PHONE,
        actions: {
          stepUpStatus: `async () => ({ needed: true, credentialIds: ["AQIDBAUGBwgJCgsMDQ4PEA"], rpId: "vallo.test", fallback: "password" })`,
          beginMoneyConfirm: `async () => ({ ok: true, data: { challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA" } })`,
          finishMoneyConfirm: `async () => ({ ok: true, data: { stepUp: "99999999-9999-4999-8999-999999999999" } })`,
        },
      });
      try {
        await page.getByTestId("go").click();
        /* The sheet, not a dead screen: this is the assertion that was false. */
        await page.getByTestId("money-step-up").waitFor();
        expect(await page.evaluate(() => (window as unknown as { __proved?: string }).__proved)).toBeUndefined();

        await page.getByRole("button", { name: copy.confirm, exact: true }).click();
        await page.waitForFunction(() => (window as unknown as { __proved?: string }).__proved !== undefined);
        expect(await page.evaluate(() => (window as unknown as { __proved?: string }).__proved)).toBe(
          "99999999-9999-4999-8999-999999999999",
        );
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a dismissal still settles the promise, so the caller's transition ends",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: CALLER,
        reducedMotion: true,
        init: PHONE,
        actions: {
          stepUpStatus: `async () => ({ needed: true, credentialIds: ["AQIDBAUGBwgJCgsMDQ4PEA"], rpId: "vallo.test", fallback: "password" })`,
        },
      });
      try {
        await page.getByTestId("go").click();
        await page.getByTestId("money-step-up").waitFor();
        await page.getByRole("button", { name: copy.cancel, exact: true }).click();
        await page.waitForFunction(() => (window as unknown as { __proved?: string | null }).__proved === null);
        await page.waitForFunction(() => !document.querySelector('[data-testid="go"]')?.hasAttribute("disabled"));
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
