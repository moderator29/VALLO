/**
 * LOCK MONEY WITH THIS PHONE, THE WHOLE ROUND TRIP IN A REAL BROWSER (14
 * November 2026, the founder: "wtf is this it's not working it's not even
 * asking to set it ... it's not flow steps ... pages to enter to turn off and
 * turn it on again flow").
 *
 * The real Settings group in Chromium, with the server actions staged (the
 * harness turns every "use server" export into a call the test answers) and
 * the phone's own passkey sheet stubbed by a fake `navigator.credentials`.
 *
 * WHAT IS PROVEN HERE:
 *   1. A phone that already locks the money is NOT offered "Add this phone".
 *      It is told it is on, offered the way off, and told how another phone is
 *      added. The screen never carries both states at once.
 *   2. A phone that is not one of them is offered the set-up, and a phone with
 *      no record of its own is offered it too and claimed about neither way.
 *   3. The second tap is the Face ID step: tap one checks the password and
 *      never touches `navigator.credentials`; tap two is a DIFFERENT button
 *      with different words, and it is the one that asks the phone.
 *   4. Nothing is enrolled without the proof first: with no password typed the
 *      step-one button cannot be tapped and `beginEnrol` is never called.
 *   5. The ceremony carries the account's keys as `excludeCredentials`, so the
 *      phone's own sheet refuses a second key for a phone that has one.
 *   6. Turning it off is a screen, not a tap: it says what stops, what does
 *      not change, and that it takes the same proof as changing where money is
 *      paid; nothing is removed until that proof is given.
 *   7. Off and on again: after a removal this phone forgets the key the
 *      account no longer holds and the set-up is offered again.
 *
 * WHAT NO TEST HERE CAN PROVE, and only a real iPhone can: that WebKit's own
 * Face ID sheet rises inside the second tap. The stub answers; Apple's
 * authenticator is not in this room.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";
import { MONEY_LOCK_DONE, MONEY_LOCK_REMOVED } from "@/lib/money/copy";

const copy = getDictionary("en").platform.moneyLock;

/** What the fake `navigator.credentials` below records on the page. */
type Probe = { __created: number; __excluded: number[] | null };

beforeAll(warmBrowser);
afterAll(closeBrowser);

/** A key id this phone's record and the account can agree on. */
const MINE = "AQIDBAUGBwgJCgsMDQ4PEA";
/** A key the account holds that this phone did not make. */
const THEIRS = "ZXhhbXBsZS1vdGhlci1waG9uZQ";
const ROW_ID = "11111111-1111-4111-8111-111111111111";

const row = { id: ROW_ID, label: null, createdAt: "2026-10-01T09:00:00.000Z", lastUsedAt: null };

const entry = (list: unknown) => `
  import { MoneyLockGroup } from "@/app/(app)/settings/MoneyLockGroup";
  import { mount } from "@/lib/testing/browser-root";
  mount(<MoneyLockGroup list={${JSON.stringify(list)}} locale="en" />);
`;

const ok = (rows: unknown[]) => ({ state: "ok", rows, fallback: "password", staff: false });

/**
 * The phone: WebAuthn is available, and `navigator.credentials` records every
 * ceremony so a test can ask whether the phone was asked at all.
 */
const PHONE = `
  window.__created = 0;
  window.__excluded = null;
  window.PublicKeyCredential = function () {};
  window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
  Object.defineProperty(navigator, "credentials", { configurable: true, value: {
    create: async (options) => {
      window.__created += 1;
      window.__excluded = (options.publicKey.excludeCredentials || []).map((c) => c.id.length);
      return {
        rawId: new Uint8Array(32).fill(7).buffer,
        response: {
          clientDataJSON: new Uint8Array(40).fill(1).buffer,
          getPublicKey: () => new Uint8Array(64).fill(2).buffer,
          getPublicKeyAlgorithm: () => -7,
        },
      };
    },
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

/** No WebAuthn at all: the browser cannot ask this phone's lock. */
const NO_PHONE = `
  window.__created = 0;
  delete window.PublicKeyCredential;
`;

const seed = (ids: string[], accountIds: string[]) => `
  ${ids.length > 0 ? `localStorage.setItem("vallo.device-keys", JSON.stringify({ ids: ${JSON.stringify(ids)}, fails: 0, none: false }));` : ""}
  window.__ids = ${JSON.stringify(accountIds)};
`;

/** The lock's own doors, answered from `window.__ids` so a change is visible to the next read. */
const ACTIONS = {
  stepUpStatus: `async () => ({ needed: window.__ids.length > 0, credentialIds: window.__ids, rpId: "vallo.test", fallback: "password" })`,
  beginEnrol: `async () => ({ ok: true, data: { challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA", userId: "11111111-2222-4333-8444-555555555555", email: "ada@example.com", rpId: "vallo.test" } })`,
  finishEnrol: `async (input) => { window.__ids = [input.credentialId]; return { ok: true, data: null }; }`,
  removeMoneyCredential: `async () => { window.__ids = []; return { ok: true, data: null }; }`,
  beginMoneyConfirm: `async () => ({ ok: true, data: { challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA" } })`,
  finishMoneyConfirm: `async () => ({ ok: true, data: { stepUp: "99999999-9999-4999-8999-999999999999" } })`,
  sendFallbackCode: `async () => ({ ok: true, data: null })`,
};

const calls = (page: import("playwright-core").Page) =>
  page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).map((c) => c[0]));
const callArgs = (page: import("playwright-core").Page, name: string) =>
  page.evaluate(
    (which) => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).filter((c) => c[0] === which).map((c) => c[1]),
    name,
  );

describe.skipIf(!hasBrowser && !process.env.CI)("Settings, money lock: one state at a time", () => {
  it(
    "this phone already locks the money: the add row is not offered, and the screen says so once",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([row])),
        reducedMotion: true,
        init: `${PHONE} ${seed([MINE], [MINE])}`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-this-phone").waitFor();
        /* THE CONTRADICTION FROM HIS SCREENSHOT: never again. */
        expect(await page.getByTestId("money-lock-enrol").count()).toBe(0);
        expect(await page.evaluate(() => document.body.innerText)).not.toContain(copy.settingsEnrol);

        const here = await page.getByTestId("money-lock-this-phone").innerText();
        expect(here).toContain(copy.thisPhoneOn);
        expect(here).toContain(copy.thisPhoneOnBody);

        /* The one row is the way off, and it is a verb about this phone. */
        expect(await page.getByTestId("money-lock-phone").innerText()).toContain(copy.settingsRemove);
        expect(await page.getByTestId("money-lock-phone").innerText()).toContain(copy.settingsRemoveNeedsProof);

        /* And the honest answer to "add another phone": on that phone. */
        expect(await page.getByTestId("money-lock-another-phone").innerText()).toContain(copy.anotherPhoneBody);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "the key is on another phone: this one is offered the set-up and told it is not among them",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([row])),
        reducedMotion: true,
        /* This phone tried twice and never made one: its record says `none`. */
        init: `${PHONE} window.__ids = ${JSON.stringify([THEIRS])}; localStorage.setItem("vallo.device-keys", JSON.stringify({ ids: [], fails: 2, none: true }));`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-enrol").waitFor();
        const here = await page.getByTestId("money-lock-this-phone").innerText();
        expect(here).toContain(copy.thisPhoneOff);
        expect(here).toContain(copy.thisPhoneOffBody);
        /* A row that may not be this phone does not claim to be. */
        expect(await page.getByTestId("money-lock-phone").innerText()).toContain(copy.settingsRemoveOther);
        expect(await page.getByTestId("money-lock-another-phone").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a phone with no record of its own claims nothing either way, and is still offered the set-up",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([row])),
        reducedMotion: true,
        init: `${PHONE} ${seed([], [THEIRS])}`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-enrol").waitFor();
        await page.waitForFunction(() => !document.querySelector('[data-testid="money-lock-enrol"]')?.hasAttribute("disabled"));
        expect(await page.getByTestId("money-lock-this-phone").count()).toBe(0);
        expect(await page.getByTestId("money-lock-another-phone").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a browser that cannot ask this phone's lock says which it is instead of greying out in silence",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([])),
        reducedMotion: true,
        init: `${NO_PHONE} window.__ids = [];`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-enrol").waitFor();
        await page.waitForFunction(
          (unsupported) => (document.querySelector('[data-testid="money-lock-enrol"]') as HTMLElement | null)?.innerText.includes(unsupported) === true,
          copy.settingsUnsupported,
        );
        expect(await page.getByTestId("money-lock-enrol").isDisabled()).toBe(true);
        expect(await page.evaluate(() => (window as unknown as Probe).__created)).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});

describe.skipIf(!hasBrowser && !process.env.CI)("Settings, money lock: two taps, two steps", () => {
  it(
    "the first tap checks the password and never asks the phone; the second tap is the Face ID step, in its own words",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([])),
        reducedMotion: true,
        init: `${PHONE} ${seed([], [])}`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-enrol").waitFor();
        await page.waitForFunction(() => !document.querySelector('[data-testid="money-lock-enrol"]')?.hasAttribute("disabled"));
        await page.getByTestId("money-lock-enrol").click();

        /* STEP ONE says it is step one, and its button is about the password. */
        await page.getByTestId("money-lock-step").waitFor();
        expect(await page.getByTestId("money-lock-step").innerText()).toBe(copy.stepCount.replace("{step}", "1").replace("{total}", "2"));
        expect(await page.getByTestId("money-lock-check-proof").innerText()).toContain(copy.stepOneAction);
        /* Nothing is enrolled on an empty password, and the server is not asked. */
        expect(await page.getByTestId("money-lock-check-proof").isDisabled()).toBe(true);
        expect(await calls(page)).not.toContain("beginEnrol");

        await page.locator('input[type="password"]').fill("correct horse battery");
        await page.getByTestId("money-lock-check-proof").click();

        /* STEP TWO. A different button, different words, and the phone has
           NOT been asked yet: the tap that asks it is the one below. */
        await page.getByTestId("money-lock-confirm-key").waitFor();
        expect(await page.getByTestId("money-lock-step").innerText()).toBe(copy.stepCount.replace("{step}", "2").replace("{total}", "2"));
        const second = await page.getByTestId("money-lock-confirm-key").innerText();
        expect(second).toContain(copy.stepTwoAction);
        expect(second).not.toContain(copy.settingsEnrol);
        expect(second).not.toBe(await page.getByTestId("money-lock-step").innerText());
        expect(await page.getByTestId("money-lock-check-proof").count()).toBe(0);
        expect(await page.evaluate(() => document.body.innerText)).toContain(copy.stepTwoBody);
        expect(await page.evaluate(() => (window as unknown as Probe).__created)).toBe(0);

        await page.getByTestId("money-lock-confirm-key").click();
        await page.waitForFunction((done) => document.body.innerText.includes(done), MONEY_LOCK_DONE);
        expect(await page.evaluate(() => (window as unknown as Probe).__created)).toBe(1);

        /* And the screen has stopped offering to add the phone it just added,
           before the server render catches up. */
        await page.waitForFunction(() => document.querySelector('[data-testid="money-lock-enrol"]') === null);
        expect(await page.getByTestId("money-lock-another-phone").count()).toBe(1);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "the ceremony carries the keys the account already holds, so the phone's own sheet refuses a duplicate",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([row])),
        reducedMotion: true,
        init: `${PHONE} ${seed([], [THEIRS])}`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-enrol").waitFor();
        await page.waitForFunction(() => !document.querySelector('[data-testid="money-lock-enrol"]')?.hasAttribute("disabled"));
        await page.getByTestId("money-lock-enrol").click();
        await page.locator('input[type="password"]').fill("correct horse battery");
        await page.getByTestId("money-lock-check-proof").click();
        await page.getByTestId("money-lock-confirm-key").click();
        await page.waitForFunction(() => ((window as unknown as Probe).__created) === 1);
        expect(await page.evaluate(() => (window as unknown as Probe).__excluded)).toHaveLength(1);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});

describe.skipIf(!hasBrowser && !process.env.CI)("Settings, money lock: turning it off, and on again", () => {
  it(
    "turning it off is a screen that says what stops and what does not, and nothing is removed until the proof is given",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(ok([row])),
        reducedMotion: true,
        init: `${PHONE} ${seed([MINE], [MINE])}`,
        actions: ACTIONS,
      });
      try {
        await page.getByTestId("money-lock-phone").waitFor();
        await page.getByTestId("money-lock-phone").click();

        const off = await page.getByTestId("money-lock-off").innerText();
        expect(off).toContain(copy.offKeeps);
        /* The only phone: the screen says what that means. */
        expect(off).toContain(copy.offLast);
        expect(off).toContain(copy.settingsRemoveNeedsProof);
        expect(await page.evaluate(() => document.body.innerText)).toContain(copy.offTitle);
        expect(await calls(page)).not.toContain("removeMoneyCredential");

        /* Keep it on: nothing asked, nothing removed. */
        await page.getByRole("button", { name: copy.offKeep }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="money-lock-off"]') === null);
        expect(await calls(page)).not.toContain("removeMoneyCredential");

        /* Confirmed: the proof for exactly this, then the removal. */
        await page.getByTestId("money-lock-phone").click();
        await page.getByTestId("money-lock-off-confirm").click();
        await page.getByTestId("money-step-up").waitFor();
        expect(await calls(page)).not.toContain("removeMoneyCredential");

        await page.getByRole("button", { name: copy.confirm, exact: true }).click();
        await page.waitForFunction((gone) => document.body.innerText.includes(gone), MONEY_LOCK_REMOVED);
        expect(await callArgs(page, "removeMoneyCredential")).toEqual([
          { id: ROW_ID, stepUp: "99999999-9999-4999-8999-999999999999" },
        ]);
        expect(await callArgs(page, "beginMoneyConfirm")).toEqual([{ kind: "remove_lock", target: ROW_ID }]);

        /* OFF AND ON AGAIN: the phone forgets the key the account no longer
           holds, the row is gone, and the set-up is offered again. */
        await page.getByTestId("money-lock-enrol").waitFor();
        expect(await page.getByTestId("money-lock-phone").count()).toBe(0);
        expect(await page.getByTestId("money-lock-another-phone").count()).toBe(0);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vallo.device-keys") ?? "{}"))).toEqual({
          ids: [],
          fails: 0,
          none: true,
        });
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
