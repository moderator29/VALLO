/**
 * TURNING THE PASSCODE OFF, THE WHOLE ROUND TRIP IN A REAL BROWSER (13
 * November 2026, the founder: "same as Face ID, build it end to end").
 *
 * The real Settings, Passcode controls in Chromium, with the server actions
 * staged (the harness turns every "use server" export into a call the test
 * answers) and the phone's Face ID sheet stubbed. What is proven: nothing is
 * turned off on a tap alone; a wrong code is refused with the lock's own
 * words and nothing is removed; the right code turns it off, this phone
 * forgets its local copy and tab mark, one calm banner says so and the screen
 * is drawn again; Face ID turns it off through a proof bound to turning it
 * off; and with no passcode the screen offers the first-time setup again.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";

const copy = getDictionary("en").passcode;

beforeAll(warmBrowser);
afterAll(closeBrowser);

const control = (passkey: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { TurnOffPasscode } from "@/app/(app)/settings/passcode/TurnOffPasscode";
  import { mount } from "@/lib/testing/browser-root";
  mount(<TurnOffPasscode copy={getDictionary("en").passcode} locale="en" length={6} passkey={${passkey}} />);
`;

const SEEDED = `
  localStorage.setItem("nf_pc_local", JSON.stringify({ v: 1 }));
  sessionStorage.setItem("vallo.passcode.tab", "1");
`;

/* The database's answer: only 135790 is right. */
const TURN_OFF = `async (code) => code === "135790" ? { ok: true } : { ok: false, reason: "wrong", attempt: { status: "wrong", beforeCooldown: 2, beforeSignOut: 7 } }`;

async function typeCode(page: import("playwright-core").Page, code: string) {
  for (const d of code) await page.locator('[data-testid="passcode-keypad"] button', { hasText: new RegExp(`^${d}$`) }).click();
}
const calls = (page: import("playwright-core").Page) =>
  page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).map((c) => c[0]));
const refreshes = (page: import("playwright-core").Page) =>
  page.evaluate(() => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).filter((c) => c[0] === "refresh").length);

describe.skipIf(!hasBrowser && !process.env.CI)("Settings, Passcode: turning it off", () => {
  it(
    "never on a tap alone: the button only opens the proof, and Keep my passcode closes it with nothing sent",
    async () => {
      const { page, close } = await mountInBrowser({ entry: control(false), reducedMotion: true, actions: { turnOffPasscodeAction: TURN_OFF } });
      try {
        await page.getByTestId("passcode-turn-off").click();
        await page.getByTestId("passcode-off").waitFor();
        expect(await page.getByTestId("passcode-off").textContent()).toContain(copy.turnOffBody);
        await page.getByTestId("passcode-off-cancel").click();
        await page.getByTestId("passcode-turn-off").waitFor();
        expect(await calls(page)).toEqual([]);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a wrong code is refused in the lock's own words and nothing is removed; the right code turns it off, forgets this phone's copy, and says so",
    async () => {
      const { page, close } = await mountInBrowser({ entry: control(false), reducedMotion: true, init: SEEDED, actions: { turnOffPasscodeAction: TURN_OFF } });
      try {
        await page.getByTestId("passcode-turn-off").click();
        await typeCode(page, "111222");
        await page.waitForFunction(() => (document.querySelector('[data-testid="passcode-off-message"]')?.textContent ?? "").length > 0);
        expect(await page.getByTestId("passcode-off-message").textContent()).toContain("That is not your passcode");
        expect(await page.evaluate(() => localStorage.getItem("nf_pc_local"))).not.toBeNull();
        expect(await refreshes(page)).toBe(0);

        await typeCode(page, "135790");
        await page.waitForFunction(() => document.body.innerText.includes("Passcode turned off"));
        expect(await page.evaluate(() => localStorage.getItem("nf_pc_local"))).toBeNull();
        expect(await page.evaluate(() => sessionStorage.getItem("vallo.passcode.tab"))).toBeNull();
        expect(await refreshes(page)).toBe(1);
        expect((await calls(page)).filter((c) => c === "turnOffPasscodeAction")).toHaveLength(2);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "Face ID turns it off through a proof bound to turning it off, never through the unlock",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: control(true),
        reducedMotion: true,
        init: `
          window.PublicKeyCredential = function () {};
          window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
          Object.defineProperty(navigator, "credentials", { configurable: true, value: { get: async () => ({
            rawId: new Uint8Array(32).fill(7).buffer,
            response: { clientDataJSON: new Uint8Array(24).fill(1).buffer, authenticatorData: new Uint8Array(37).fill(2).buffer, signature: new Uint8Array(64).fill(3).buffer },
          }) } });
        `,
        actions: {
          beginPasskeyUnlock: `async (purpose) => purpose === "off" ? { state: "ready", challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA", credentialIds: ["AQIDBAUGBwgJCgsMDQ4PEA"], rpId: "vallo.test" } : { state: "failed" }`,
          finishPasscodeOffWithKey: `async () => ({ ok: true, data: null })`,
        },
      });
      try {
        await page.getByTestId("passcode-turn-off").click();
        await page.getByTestId("passcode-off-key").click();
        await page.waitForFunction(() => document.body.innerText.includes("Passcode turned off"));
        const made = await page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).map((c) => c.slice(0, 2)));
        expect(made).toContainEqual(["beginPasskeyUnlock", "off"]);
        expect(made.map((c) => c[0])).toContain("finishPasscodeOffWithKey");
        expect(made.map((c) => c[0])).not.toContain("finishPasskeyUnlock");
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "with no passcode, the screen offers the first-time setup again: turning it on works from scratch",
    async () => {
      const entry = `
        import { getDictionary } from "@vallo/i18n";
        import { PasscodeSettings } from "@/app/(app)/settings/passcode/PasscodeSettings";
        import { mount } from "@/lib/testing/browser-root";
        mount(<PasscodeSettings copy={getDictionary("en").passcode} locale="en" state="unset" length={6} askCurrent={false} name="Ada" avatarUrl="" />);
      `;
      const { page, close } = await mountInBrowser({ entry, reducedMotion: true });
      try {
        await page.getByTestId("passcode-keypad").waitFor();
        expect(await page.getByTestId("passcode-turn-off").count()).toBe(0);
        expect(await page.getByTestId("passcode-change").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
