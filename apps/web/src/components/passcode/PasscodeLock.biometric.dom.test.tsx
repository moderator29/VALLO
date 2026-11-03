/**
 * FACE ID OR FINGERPRINT ON THE LOCK, driven for real in Chromium (7 October
 * 2026, the founder: "set and build Face ID to work").
 *
 * The biometric is the WebAuthn platform key verified on the SERVER
 * (`lib/passcode/passkey-unlock.ts`); here the two server actions are staged
 * and the browser's `navigator.credentials.get` is stubbed, so each path is
 * the real component's: enrolled (biometric first, passcode second), not
 * enrolled (the keypad), the person cancelling the system sheet, the server
 * refusing the proof, and the server accepting it. Only the last unlocks;
 * the cancel and the refusal both land on the keypad with one plain line,
 * and neither refreshes the route.
 */
import type { Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";

const copy = getDictionary("en").passcode;

beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (passkey: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { PasscodeLock } from "@/components/passcode/PasscodeLock";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <PasscodeLock
      copy={getDictionary("en").passcode}
      locale="en"
      mode="code"
      length={4}
      name="Ada Okafor"
      passkey={${passkey}}
      verify={async () => ({ status: "error" })}
    />,
  );
`;

/* The device says it has a platform lock; what its sheet answers is the case. */
const device = (answer: "cancel" | "assert") => `
  window.PublicKeyCredential = window.PublicKeyCredential || function () {};
  window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
  /* The harness page is not a secure context, so the browser has no
     credentials container of its own: one is given here. */
  Object.defineProperty(navigator, "credentials", { configurable: true, value: { get: ${
    answer === "cancel"
      ? `async () => { throw new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"); }`
      : `async () => ({
          rawId: new Uint8Array(32).fill(7).buffer,
          response: {
            clientDataJSON: new Uint8Array(24).fill(1).buffer,
            authenticatorData: new Uint8Array(37).fill(2).buffer,
            signature: new Uint8Array(64).fill(3).buffer,
          },
        })`
  } } });
`;

const READY = `async () => ({ state: "ready", challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA", credentialIds: ["AQIDBAUGBwgJCgsMDQ4PEA"], rpId: "vallo.test" })`;

const refreshes = (page: Page) =>
  page.evaluate(
    () =>
      ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).filter(
        (c) => c[0] === "refresh",
      ).length,
  );

describe.skipIf(!hasBrowser && !process.env.CI)("the lock's Face ID or fingerprint", () => {
  it(
    "enrolled: the biometric is the primary, the passcode the second, and the keypad waits for it",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(true), reducedMotion: true, init: device("cancel") });
      try {
        await page.getByTestId("passcode-passkey").waitFor();
        expect(await page.getByTestId("passcode-passkey").textContent()).toContain(copy.passkeyUnlockBy["this-device"]);
        expect(await page.getByTestId("passcode-keypad").count()).toBe(0);
        await page.getByTestId("passcode-use-keypad").click();
        await page.getByTestId("passcode-keypad").waitFor();
        /* Focus lands on the keypad's first key, not on <body>. */
        expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="passcode-keypad"]') !== null)).toBe(true);
        /* The biometric is still one tap away, in the keypad's corner. */
        expect(await page.getByTestId("passcode-passkey").count()).toBe(1);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "not enrolled: the keypad, and no biometric anywhere",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(false), reducedMotion: true });
      try {
        await page.getByTestId("passcode-keypad").waitFor();
        expect(await page.getByTestId("passcode-passkey").count()).toBe(0);
        expect(await page.getByTestId("passcode-use-keypad").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "cancelled: the person closes the system sheet and lands on the keypad, still locked",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(true),
        reducedMotion: true,
        init: device("cancel"),
        actions: { beginPasskeyUnlock: READY, finishPasskeyUnlock: `async () => ({ ok: true })` },
      });
      try {
        await page.getByTestId("passcode-passkey").click();
        await page.getByTestId("passcode-keypad").waitFor();
        expect(await page.getByTestId("passcode-message").textContent()).toBe(copy.passkeyFailed);
        const calls = await page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).map((c) => c[0]));
        expect(calls).not.toContain("finishPasskeyUnlock");
        expect(await refreshes(page)).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "failure: the server refuses the proof, and the passcode is the way in",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(true),
        reducedMotion: true,
        init: device("assert"),
        actions: { beginPasskeyUnlock: READY, finishPasskeyUnlock: `async () => ({ error: "rejected" })` },
      });
      try {
        await page.getByTestId("passcode-passkey").click();
        await page.getByTestId("passcode-keypad").waitFor();
        expect(await page.getByTestId("passcode-message").textContent()).toBe(copy.passkeyFailed);
        expect(await refreshes(page)).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "success: only a proof the server accepts unlocks, and the app is refreshed into",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(true),
        reducedMotion: true,
        init: device("assert"),
        actions: { beginPasskeyUnlock: READY, finishPasskeyUnlock: `async () => ({ ok: true })` },
      });
      try {
        await page.getByTestId("passcode-passkey").click();
        await page.waitForFunction(
          () => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "refresh"),
          null,
          { timeout: 5000 },
        );
        const sent = await page.evaluate(
          () => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).find((c) => c[0] === "finishPasskeyUnlock")?.[1] as Record<string, string>,
        );
        /* The proof the server checks is what the device signed, under the server's own challenge. */
        expect(sent.challenge).toBe("Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA");
        expect(typeof sent.signature).toBe("string");
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
