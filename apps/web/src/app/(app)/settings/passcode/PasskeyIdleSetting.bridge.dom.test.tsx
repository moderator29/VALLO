/**
 * FACE ID IN SETTINGS, PASSCODE, INSIDE THE APP AND ON THE WEBSITE (13 November
 * 2026, the founder's screenshot from inside the iPhone app: "This browser
 * cannot reach this device's Face ID or fingerprint. The Vallo app and most
 * phone browsers can.").
 *
 * The row is the real component in Chromium, with the Capacitor bridge mocked
 * the way the native shell injects it (`window.Capacitor`), and WebKit's own
 * question answered "no" as an app's web view can answer it. The decision is
 * `lib/native/biometric-capability.ts`, the one every Face ID screen shares.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";

const copy = getDictionary("en").passcode;

beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { PasskeyIdleSetting } from "@/app/(app)/settings/passcode/PasskeyIdleSetting";
  import { mount } from "@/lib/testing/browser-root";
  mount(<PasskeyIdleSetting hasPasskey={false} copy={getDictionary("en").passcode} />);
`;

function device(opts: { bridge?: "ios" | "android"; webauthn: boolean; platformSays: boolean }) {
  return `
    ${opts.bridge ? `window.Capacitor = { isNativePlatform: function () { return true; }, getPlatform: function () { return "${opts.bridge}"; } };` : ""}
    ${
      opts.webauthn
        ? `window.PublicKeyCredential = function () {}; window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function () { return ${opts.platformSays}; };`
        : `try { delete window.PublicKeyCredential; } catch (e) {} window.PublicKeyCredential = undefined;`
    }
  `;
}

async function rowFor(init: string) {
  const { page, close } = await mountInBrowser({ entry, reducedMotion: true, init });
  try {
    /* The row settles once the device has answered. */
    await page.waitForFunction(() => document.querySelector('[data-testid^="passcode-bio-"]') !== null);
    await page.waitForTimeout(150);
    const unsupported = page.getByTestId("passcode-bio-unsupported");
    return {
      enrol: await page.getByTestId("passcode-bio-enrol").count(),
      unsupported: (await unsupported.count()) ? await unsupported.textContent() : null,
    };
  } finally {
    await close();
  }
}

describe.skipIf(!hasBrowser && !process.env.CI)("Settings, Passcode: the Face ID row", () => {
  it(
    "inside the iPhone app, WebKit's no is not the last word: the row offers the set-up, never 'This browser cannot'",
    async () => {
      const row = await rowFor(device({ bridge: "ios", webauthn: true, platformSays: false }));
      expect(row.enrol).toBe(1);
      expect(row.unsupported).toBeNull();
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "inside an app whose web view has no WebAuthn, it says so in the app's words and never points at the app",
    async () => {
      const row = await rowFor(device({ bridge: "android", webauthn: false, platformSays: false }));
      expect(row.enrol).toBe(0);
      expect(row.unsupported).toContain(copy.bioRowUnsupportedApp);
      expect(row.unsupported).not.toContain("browser");
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "on the website, a browser that can ask is offered the set-up",
    async () => {
      const row = await rowFor(device({ webauthn: true, platformSays: true }));
      expect(row.enrol).toBe(1);
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "on the website, a browser that cannot says so in the browser's words",
    async () => {
      const row = await rowFor(device({ webauthn: true, platformSays: false }));
      expect(row.enrol).toBe(0);
      expect(row.unsupported).toContain(copy.bioRowUnsupported);
    },
    BROWSER_TEST_TIMEOUT,
  );
});
