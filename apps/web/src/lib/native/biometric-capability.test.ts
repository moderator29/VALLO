import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideBiometric, forgetBiometricReading, readBiometric } from "./biometric-capability";
import { platformLockAvailable } from "@/lib/security/webauthn-client";

/**
 * ONE ANSWER TO "CAN THIS DEVICE ASK FOR FACE ID?" (13 November 2026, the
 * founder inside the iPhone app: "This browser cannot reach this device's Face
 * ID or fingerprint. The Vallo app and most phone browsers can.").
 *
 * Every screen (the lock, its setup offer, Settings Passcode, the unlock key,
 * the money lock and its enrolment) asks `platformLockAvailable()`, which now
 * asks this. The bridge is mocked in both states: no Capacitor (the website),
 * and Capacitor answering "ios" or "android" (the apps).
 */

type Win = Record<string, unknown>;
let win: Win;
const marks: string[] = [];

function install(opts: { bridge?: "ios" | "android"; pkc?: boolean; platformSays?: boolean | "throws" }) {
  win = {
    __nfMark: (stage: string) => marks.push(stage),
  };
  if (opts.bridge) win.Capacitor = { isNativePlatform: () => true, getPlatform: () => opts.bridge };
  if (opts.pkc !== false) {
    win.PublicKeyCredential = Object.assign(function PublicKeyCredential() {}, {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => {
        if (opts.platformSays === "throws") throw new Error("not allowed");
        return opts.platformSays ?? false;
      },
    });
  }
  vi.stubGlobal("window", win);
  forgetBiometricReading();
}

beforeEach(() => {
  marks.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetBiometricReading();
});

describe("the decision, browser passed in", () => {
  it("is the browser's own answer on the website", async () => {
    expect((await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => true, surface: "web" })).available).toBe(true);
    expect((await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => false, surface: "web" })).available).toBe(false);
    expect((await decideBiometric({ hasPublicKeyCredential: false, askPlatform: async () => true, surface: "web" })).available).toBe(false);
  });
  it("in the iPhone app, lets the ceremony decide when WebKit says no but WebAuthn is there", async () => {
    const r = await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => false, surface: "ios-app" });
    expect(r).toEqual({ available: true, surface: "ios-app", webauthn: true, platformAnswer: false });
  });
  it("in the iPhone app with no WebAuthn at all, says no", async () => {
    expect((await decideBiometric({ hasPublicKeyCredential: false, askPlatform: async () => true, surface: "ios-app" })).available).toBe(false);
  });
  it("in the Android app, keeps the web view's own answer (MainActivity turns WebAuthn on there, and it answers for itself)", async () => {
    expect((await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => false, surface: "android-app" })).available).toBe(false);
    expect((await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => true, surface: "android-app" })).available).toBe(true);
  });
  it("a question that throws is a no, never an exception", async () => {
    const r = await decideBiometric({ hasPublicKeyCredential: true, askPlatform: async () => { throw new Error("x"); }, surface: "web" });
    expect(r.available).toBe(false);
  });
});

describe("the page's answer, with the Capacitor bridge mocked", () => {
  it("no bridge (the website): the browser's answer, and every screen gets the same one", async () => {
    install({ platformSays: false });
    expect(await readBiometric()).toMatchObject({ surface: "web", available: false });
    expect(await platformLockAvailable()).toBe(false);
    install({ platformSays: true });
    expect(await platformLockAvailable()).toBe(true);
  });
  it("the iPhone app's bridge: WebKit's no is not believed, so Settings offers the set-up instead of 'This browser cannot'", async () => {
    install({ bridge: "ios", platformSays: false });
    expect(await readBiometric()).toMatchObject({ surface: "ios-app", available: true, platformAnswer: false });
    expect(await platformLockAvailable()).toBe(true);
    expect(marks).toContain("bio:ios-app:webauthn=1:platform=0:offer=1");
  });
  it("the iPhone app's bridge with no WebAuthn in the web view: no, and the trace says why", async () => {
    install({ bridge: "ios", pkc: false });
    expect(await platformLockAvailable()).toBe(false);
    expect(marks).toContain("bio:ios-app:webauthn=0:platform=-:offer=0");
  });
  it("the Android app's bridge: the web view's own answer", async () => {
    install({ bridge: "android", platformSays: false });
    expect(await platformLockAvailable()).toBe(false);
    install({ bridge: "android", platformSays: "throws" });
    expect(await platformLockAvailable()).toBe(false);
  });
  it("is asked once per page", async () => {
    install({ platformSays: true });
    const ask = vi.spyOn(win.PublicKeyCredential as { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean> }, "isUserVerifyingPlatformAuthenticatorAvailable");
    await platformLockAvailable();
    await platformLockAvailable();
    await readBiometric();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
