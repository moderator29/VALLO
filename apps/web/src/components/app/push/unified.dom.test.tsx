import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/**
 * THE ONE ASK AND THE ONE SWITCH, IN A REAL CHROMIUM (the founder, 13
 * November 2026).
 *
 * The iOS shell is stood in at its lowest JavaScript boundary: the bridge
 * object Capacitor's native runtime injects (`PluginHeaders`,
 * `nativePromise`, `nativeCallback`), so the real `@capacitor/core` proxy,
 * the real `enrol` and the real `turnOnNotifications` all run. `fetch` to
 * `/api/push/register` answers as the route does, and the server actions are
 * the harness's staged answers. THE REAL iOS PERMISSION DIALOG IS NOT DRIVEN
 * HERE: `requestPermissions` answers what each test sets.
 */

type Win = Window & {
  __settled: string | null;
  __calls?: unknown[][];
  __pluginCalls: string[];
  __registered: { platform?: string; token?: string } | null;
};

function shell(opts: { permission: string; grant?: string; device?: string }): string {
  return `
    window.__pluginCalls = [];
    window.__registered = null;
    window.__settled = null;
    window.__listeners = {};
    window.__perm = ${JSON.stringify(opts.permission)};
    window.__grant = ${JSON.stringify(opts.grant ?? "granted")};
    ${opts.device ? `localStorage.setItem("vallo.push.device.v1", JSON.stringify({ deviceRef: ${JSON.stringify(opts.device)}, endpoint: null }));` : ""}
    window.CapacitorCustomPlatform = { name: "ios" };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
      PluginHeaders: [{ name: "PushNotifications", methods: [
        { name: "checkPermissions", rtype: "promise" },
        { name: "requestPermissions", rtype: "promise" },
        { name: "register", rtype: "promise" },
        { name: "addListener", rtype: "callback" },
        { name: "removeListener", rtype: "promise" },
      ] }],
      nativePromise: async (plugin, method) => {
        window.__pluginCalls.push(method);
        if (method === "checkPermissions") return { receive: window.__perm };
        if (method === "requestPermissions") { window.__perm = window.__grant; return { receive: window.__grant }; }
        if (method === "register") setTimeout(() => window.__listeners.registration && window.__listeners.registration({ value: "apns-token-1" }), 0);
        return undefined;
      },
      nativeCallback: (plugin, method, options, callback) => {
        window.__listeners[options.eventName] = callback;
        return "cb-" + options.eventName;
      },
    };
    window.fetch = async (url, init) => {
      if (String(url).includes("/api/push/register")) {
        window.__registered = JSON.parse(init.body);
        return new Response(JSON.stringify({ ok: true, deviceRef: "a1b2c3d4e5f6" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
  `;
}

const ALL_ON = {
  notifications: {
    savedPriceDrops: true,
    channels: {
      bookings: { push: true },
      messages: { push: true },
      wallet: { push: true },
      listings: { push: true },
      social: { push: true },
      marketing: { push: true },
    },
  },
};

const ASK = `
  import { PushPrompt } from "@/components/app/push/PushPrompt";
  import { experienceSettingsEn } from "@vallo/i18n/en/experience-settings";
  import { mount } from "@/lib/testing/browser-root";
  mount(<PushPrompt copy={experienceSettingsEn.notifications.push} onSettled={(o) => { (window as any).__settled = o; }} />);
`;

const SETTINGS_OK = { updateSettings: "async () => ({ ok: true, data: {} })" };

function calls(page: { evaluate: <T>(fn: () => T) => Promise<T> }, name: string) {
  return page.evaluate(() => ((window as unknown as Win).__calls ?? []).map((c) => c as unknown[])).then((all) =>
    all.filter((c) => c[0] === name).map((c) => c.slice(1)),
  );
}

describe.skipIf(!hasBrowser && !process.env.CI)("the one ask, at the end of first run", () => {
  it("is one screen with one primary button and a quiet Not now, and Not now goes on and writes nothing", async () => {
    const { page, close } = await mountInBrowser({ entry: ASK, actions: SETTINGS_OK, init: shell({ permission: "prompt" }) });
    try {
      const ask = page.locator("[data-push-prompt]");
      await ask.waitFor({ timeout: 15000 });
      expect(await ask.getByRole("button").count()).toBe(2);
      expect(await ask.getByRole("button", { name: "Turn on notifications" }).count()).toBe(1);
      expect(await ask.getByRole("button", { name: "Not now" }).count()).toBe(1);
      await ask.getByRole("button", { name: "Not now" }).click();
      await page.waitForFunction(() => (window as unknown as Win).__settled === "declined");
      expect(await calls(page, "updateSettings")).toEqual([]);
      expect(await page.evaluate(() => (window as unknown as Win).__pluginCalls)).not.toContain("requestPermissions");
      expect(await ask.count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("Turn on asks the system, registers this device and turns every topic on in one write", async () => {
    const { page, close } = await mountInBrowser({ entry: ASK, actions: SETTINGS_OK, init: shell({ permission: "prompt" }) });
    try {
      await page.getByRole("button", { name: "Turn on notifications" }).click();
      await page.waitForFunction(() => (window as unknown as Win).__settled === "enrolled");
      expect(await page.evaluate(() => (window as unknown as Win).__pluginCalls)).toContain("requestPermissions");
      expect(await page.evaluate(() => (window as unknown as Win).__registered)).toMatchObject({
        platform: "ios",
        token: "apns-token-1",
      });
      expect(await calls(page, "updateSettings")).toEqual([[ALL_ON]]);
      await page.getByTestId("banner-push-on").waitFor({ timeout: 15000 });
    } finally {
      await close();
    }
  });

  it("a refusal of the system prompt goes on into the app and writes nothing", async () => {
    const { page, close } = await mountInBrowser({
      entry: ASK,
      actions: SETTINGS_OK,
      init: shell({ permission: "prompt", grant: "denied" }),
    });
    try {
      await page.getByRole("button", { name: "Turn on notifications" }).click();
      await page.waitForFunction(() => (window as unknown as Win).__settled === "declined");
      expect(await calls(page, "updateSettings")).toEqual([]);
      expect(await page.evaluate(() => (window as unknown as Win).__registered)).toBeNull();
    } finally {
      await close();
    }
  });

  it("is never shown again on a device that said Not now, or that already refused", async () => {
    for (const init of [
      shell({ permission: "prompt" }) +
        `localStorage.setItem("vallo.push.prompt", JSON.stringify({ declinedAt: 1, declines: 1, systemAsked: false }));`,
      shell({ permission: "denied" }),
    ]) {
      const { page, close } = await mountInBrowser({ entry: ASK, actions: SETTINGS_OK, init });
      try {
        await page.waitForFunction(() => (window as unknown as Win).__settled !== null);
        expect(await page.evaluate(() => (window as unknown as Win).__settled)).toBe("unavailable");
        expect(await page.locator("[data-push-prompt]").count()).toBe(0);
        expect(await page.evaluate(() => (window as unknown as Win).__pluginCalls)).not.toContain("requestPermissions");
      } finally {
        await close();
      }
    }
  });

  it("settles at once where push does not exist (a desktop browser without the shell), so first run never traps", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { PushPrompt } from "@/components/app/push/PushPrompt";
        import { experienceSettingsEn } from "@vallo/i18n/en/experience-settings";
        import { mount } from "@/lib/testing/browser-root";
        (window as any).__settled = null;
        delete (window as any).PushManager;
        mount(<PushPrompt copy={experienceSettingsEn.notifications.push} onSettled={(o) => { (window as any).__settled = o; }} />);
      `,
    });
    try {
      await page.waitForFunction(() => (window as unknown as Win).__settled !== null);
      expect(await page.evaluate(() => (window as unknown as Win).__settled)).toBe("unavailable");
    } finally {
      await close();
    }
  });
});

function master(devices: string): string {
  return `
    import { PushSetting } from "@/components/app/push/PushSetting";
    import { experienceSettingsEn } from "@vallo/i18n/en/experience-settings";
    import { mount } from "@/lib/testing/browser-root";
    mount(<PushSetting copy={experienceSettingsEn.notifications.push} devices={${devices}} />);
  `;
}

describe.skipIf(!hasBrowser && !process.env.CI)("the master switch on Settings > Notifications", () => {
  it("on: asks the system, registers this device, turns every topic on in one write and reads on", async () => {
    const { page, close } = await mountInBrowser({
      entry: master("[]"),
      actions: SETTINGS_OK,
      init: shell({ permission: "prompt" }),
    });
    try {
      const sw = page.getByRole("switch", { name: "Notifications" });
      await sw.waitFor({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('[data-testid="push-master"]')?.hasAttribute("disabled") === false);
      expect(await sw.getAttribute("aria-checked")).toBe("false");
      await sw.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="push-master"]')?.getAttribute("aria-checked") === "true",
      );
      expect(await page.evaluate(() => (window as unknown as Win).__pluginCalls)).toContain("requestPermissions");
      expect(await page.evaluate(() => (window as unknown as Win).__registered)).toMatchObject({ platform: "ios" });
      expect(await calls(page, "updateSettings")).toEqual([[ALL_ON]]);
    } finally {
      await close();
    }
  });

  it("off: retires this device and reads off", async () => {
    const { page, close } = await mountInBrowser({
      entry: master(`[{ id: "00000000-0000-4000-8000-00000000d001", ref: "a1b2c3d4e5f6" }]`),
      actions: { revokeThisPushDevice: "async () => ({ ok: true, data: { revoked: 1 } })" },
      init: shell({ permission: "granted", device: "a1b2c3d4e5f6" }),
    });
    try {
      await page.waitForFunction(
        () => document.querySelector('[data-testid="push-master"]')?.getAttribute("aria-checked") === "true",
      );
      await page.getByRole("switch", { name: "Notifications" }).click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="push-master"]')?.getAttribute("aria-checked") === "false",
      );
      expect(await calls(page, "revokeThisPushDevice")).toEqual([[{ deviceRef: "a1b2c3d4e5f6" }]]);
      expect(await page.evaluate(() => localStorage.getItem("vallo.push.device.v1"))).toBeNull();
      expect(await page.evaluate(() => (window as unknown as Win).__pluginCalls)).not.toContain("requestPermissions");
    } finally {
      await close();
    }
  });

  it("refused: one line to allow Vallo in the phone's Settings, and a button that opens them", async () => {
    const { page, close } = await mountInBrowser({ entry: master("[]"), init: shell({ permission: "denied" }) });
    try {
      await page.locator('[data-push-setting="denied"]').waitFor({ timeout: 15000 });
      expect(await page.getByText("Allow Vallo in your phone's Settings").count()).toBe(1);
      expect(await page.getByRole("button", { name: "Open Settings" }).count()).toBe(1);
      expect(await page.getByRole("switch", { name: "Notifications" }).isDisabled()).toBe(true);
    } finally {
      await close();
    }
  });
});
