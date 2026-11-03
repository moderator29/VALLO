/**
 * THE LOCK ON A WEAK SIGNAL (2 November 2026, the founder's screenshot: "That
 * did not go through" on a slow network). Driven in Chromium: the code is
 * asked again under the same attempt id and opens when an answer gets
 * through; when nothing gets through the code stays entered with Try again;
 * and over a page already on the phone, the phone's own check opens it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* `answers` is a list the stub walks: "lost" throws like a dropped request. */
const entry = (answers: string[], guarded: boolean) => `
  import { getDictionary } from "@vallo/i18n";
  import { PasscodeLock } from "@/components/passcode/PasscodeLock";
  import { mount } from "@/lib/testing/browser-root";
  const answers = ${JSON.stringify(answers)};
  window.__verifyCalls = [];
  const verify = async (code, attemptId) => {
    window.__verifyCalls.push([code, attemptId]);
    const next = answers.shift() || "lost";
    if (next === "lost") throw new Error("Failed to fetch");
    if (next === "ok") return { status: "ok" };
    return { status: "wrong", beforeCooldown: 4, beforeSignOut: 9 };
  };
  mount(
    <PasscodeLock
      copy={getDictionary("en").passcode}
      locale="en"
      mode="code"
      length={4}
      name="Phantom"
      userId="user-1"
      verify={verify}
      retryGaps={[50, 50]}
      ${guarded ? `onUnlocked={() => { window.__unlocked = true; }}` : ""}
    />,
  );
`;

async function typeCode(page: import("playwright-core").Page, code: string) {
  for (const digit of code) await page.keyboard.press(digit);
}

describe.skipIf(!hasBrowser && !process.env.CI)("the lock on a weak signal", () => {
  it("asks again when the answer is lost, under the same attempt id, and opens", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(["lost", "lost", "ok"], true) });
    try {
      await typeCode(page, "4829");
      await page.waitForFunction(() => (window as unknown as { __unlocked?: boolean }).__unlocked === true);
      const calls = await page.evaluate(() => (window as unknown as { __verifyCalls: [string, string][] }).__verifyCalls);
      expect(calls).toHaveLength(3);
      expect(new Set(calls.map((c) => c[1])).size).toBe(1);
      expect(calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await close();
    }
  });

  it("keeps the code with Try again when nothing gets through, and sends it again", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(["lost", "lost", "lost", "ok"], false) });
    try {
      await typeCode(page, "4829");
      await page.getByTestId("passcode-try-again").waitFor();
      expect(await page.getByTestId("passcode-message").innerText()).toContain("We could not reach Vallo");
      expect(await page.getByTestId("passcode-message").innerText()).not.toContain("That did not go through");
      await page.getByTestId("passcode-try-again").click();
      await page.waitForFunction(() => (window as unknown as { __verifyCalls: unknown[] }).__verifyCalls.length === 4);
      const calls = await page.evaluate(() => (window as unknown as { __verifyCalls: [string, string][] }).__verifyCalls);
      /* The same code and the same attempt, so the server counts it once. */
      expect(calls[3]).toEqual(calls[0]);
    } finally {
      await close();
    }
  });

  it("opens a page already on the phone with the phone's own check when Vallo cannot be reached", async () => {
    /* WebCrypto needs a secure context, as the app always is: localhost is one. */
    const { page, close } = await mountInBrowser({ entry: entry(["ok", "lost", "lost", "lost", "lost"], true), url: "http://localhost/" });
    try {
      /* First a normal unlock, which keeps the phone's check. */
      await typeCode(page, "4829");
      await page.waitForFunction(() => (window as unknown as { __unlocked?: boolean }).__unlocked === true);
      await page.waitForFunction(() => Boolean(localStorage.getItem("nf_pc_local")));
      expect(await page.evaluate(() => localStorage.getItem("nf_pc_local"))).not.toContain("4829");
    } finally {
      await close();
    }
    /* Then a later lock with no signal: a fresh mount on the same storage is
       not shared across contexts, so the verifier is written first. */
    const second = await mountInBrowser({
      entry: entry(["lost", "lost", "lost"], true),
      url: "http://localhost/",
      init: `
        (async () => {
          const user = "user-1", code = "4829";
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(user + ":" + code), "PBKDF2", false, ["deriveBits"]);
          const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, key, 256);
          const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
          localStorage.setItem("nf_pc_local", JSON.stringify({ v: 1, user, salt: b64(salt), hash: b64(bits), length: 4, at: Date.now(), misses: 0 }));
          window.__seeded = true;
        })();
      `,
    });
    try {
      await second.page.waitForFunction(() => (window as unknown as { __seeded?: boolean }).__seeded === true);
      await typeCode(second.page, "1111");
      await second.page.getByText("That is not your passcode.").waitFor();
      await typeCode(second.page, "4829");
      await second.page.waitForFunction(() => (window as unknown as { __unlocked?: boolean }).__unlocked === true);
    } finally {
      await second.close();
    }
  });
});
