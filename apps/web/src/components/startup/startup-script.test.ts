import { describe, expect, it } from "vitest";
import { RETURNING_WITHIN_MS, STARTUP_GATE_SCRIPT } from "./startup-script";

/**
 * THE GATE, decided before paint (D68c). Whether this load plays the opening,
 * and whether it is the full one or the brief one. The frame-by-frame
 * behaviour is `StartupOpening.dom.test.tsx`; these are the rules.
 */

type Storage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

function memory(seed: Record<string, string> = {}, refuse = false): Storage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      if (refuse) throw new Error("QuotaExceededError");
      data[k] = v;
    },
  };
}

function gate({
  path = "/home",
  root = {} as Record<string, string>,
  session = memory(),
  local = memory(),
  reduced = false,
} = {}): Record<string, string | undefined> {
  const dataset: Record<string, string | undefined> = { ...root };
  const documentElement = { dataset, style: { setProperty() {}, removeProperty() {} } };
  const document = {
    documentElement,
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll: () => [],
    getAnimations: () => [],
  };
  const window = { matchMedia: () => ({ matches: reduced }) };
  new Function(
    "window",
    "document",
    "sessionStorage",
    "localStorage",
    "location",
    "setTimeout",
    "clearTimeout",
    "getComputedStyle",
    STARTUP_GATE_SCRIPT,
  )(window, document, session, local, { pathname: path }, () => 0, () => {}, () => ({ getPropertyValue: () => "" }));
  return dataset;
}

describe("the opening's gate", () => {
  it("plays the full opening on the first open of the day, on the app's own pages", () => {
    const d = gate();
    expect(d.splash).toBe("on");
    expect(d.opening).toBe("full");
  });

  it("plays the brief one when the last open was recent, and the full one when it was not", () => {
    const recent = memory({ nf_entered: String(Date.now() - 60_000) });
    expect(gate({ local: recent }).opening).toBe("brief");
    const old = memory({ nf_entered: String(Date.now() - RETURNING_WITHIN_MS - 60_000) });
    expect(gate({ local: old }).opening).toBe("full");
  });

  it("remembers this open for the next one", () => {
    const local = memory();
    gate({ local });
    expect(Number(local.data.nf_entered)).toBeGreaterThan(Date.now() - 5000);
  });

  it("plays once per session, and not at all where the session mark cannot be written", () => {
    expect(gate({ session: memory({ nf_entered: "1" }) }).splash).toBeUndefined();
    expect(gate({ session: memory({}, true) }).splash).toBeUndefined();
  });

  it("gives reduced motion, Calm, Off, the splash switch and data saver one settled frame", () => {
    expect(gate({ reduced: true }).splash).toBeUndefined();
    expect(gate({ root: { motion: "calm" } }).splash).toBeUndefined();
    expect(gate({ root: { motion: "off" } }).splash).toBeUndefined();
    expect(gate({ root: { motionSplash: "off" } }).splash).toBeUndefined();
    expect(gate({ root: { saveData: "on" } }).splash).toBeUndefined();
  });

  it("never plays on the console, the auth callback, the API, offline, /open or a shared link", () => {
    for (const path of ["/admin", "/auth/callback", "/api/x", "/offline", "/open", "/s/abc", "/r/abc"]) {
      expect(gate({ path }).splash, path).toBeUndefined();
    }
    expect(gate({ path: "/welcome" }).splash).toBe("on");
  });
});

describe("item 14: the app and a kept page always open briefly", () => {
  it("forces the brief opening in the shell and on a page the phone kept", async () => {
    const { STARTUP_GATE_SCRIPT } = await import("./startup-script");
    const { KEPT_MARK_ATTRIBUTE } = await import("@/lib/offline/page-cache");
    expect(STARTUP_GATE_SCRIPT).toContain("/VALLO-NATIVE/.test(navigator.userAgent)");
    expect(STARTUP_GATE_SCRIPT).toContain(`d.hasAttribute('${KEPT_MARK_ATTRIBUTE}')`);
  });
});
