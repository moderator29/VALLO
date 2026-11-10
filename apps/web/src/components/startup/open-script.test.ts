import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_CAP_MS, OPEN_CSS_CAP_MS, OPEN_FADE_MS, OPEN_MIN_MS, OPEN_MIN_STILL_MS, OPEN_NATIVE_WAIT_MS, OPEN_SCRIPT, OPEN_SESSION_KEY } from "./open-script";

/**
 * THE OPENING SCREEN'S CONTROLLER (10 November 2026). The script is run here
 * against a small fake browser so every branch is a plain assertion; the same
 * script is driven in Chromium by `OpeningScreen.dom.test.tsx`.
 */

type Env = {
  standalone?: boolean;
  navStandalone?: boolean;
  reduced?: boolean;
  motion?: string | null;
  native?: boolean;
  ua?: string;
  warm?: boolean;
  storageThrows?: boolean;
  ready?: boolean;
  guarded?: boolean;
  guardReady?: boolean;
  lockDrawn?: boolean;
};

function run(env: Env = {}) {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const attrs: Record<string, string> = {};
  if (env.native) attrs["data-native"] = "";
  if (env.motion) attrs["data-motion"] = env.motion;
  if (env.guardReady) attrs["data-guard-ready"] = "";
  const listeners: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, string>(env.warm ? [[OPEN_SESSION_KEY, "1"]] : []);
  const root = {
    hasAttribute: (k: string) => k in attrs,
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    setAttribute: (k: string, v: string) => {
      attrs[k] = v;
    },
  };
  const rafs: (() => void)[] = [];
  const W = {
    matchMedia: (q: string) => ({ matches: q.includes("display-mode") ? env.standalone !== false : q.includes("reduced-motion") ? !!env.reduced : false }),
    __nfOpenReady: env.ready ?? false,
    Capacitor: undefined,
  } as Record<string, unknown>;
  const D = {
    documentElement: root,
    readyState: "complete",
    addEventListener: (n: string, f: (e: unknown) => void) => {
      listeners[n] = f;
    },
    querySelector: (s: string) => (s.includes("data-passcode-guarded") ? (env.guarded ? {} : null) : s === ".nf-passcode" ? (env.lockDrawn ? {} : null) : null),
  };
  const sessionStorage = env.storageThrows
    ? {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      }
    : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const fn = new Function("window", "document", "navigator", "sessionStorage", "performance", "setTimeout", "requestAnimationFrame", OPEN_SCRIPT);
  fn(
    W,
    D,
    { standalone: env.navStandalone ?? false, userAgent: env.ua ?? "Mozilla/5.0 iPhone" },
    sessionStorage,
    { now: () => now },
    (f: () => void, ms: number) => timers.push({ at: now + ms, fn: f }),
    (f: () => void) => rafs.push(f),
  );
  const advance = (to: number) => {
    while (true) {
      const next = timers.filter((t) => t.at <= to).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      timers.splice(timers.indexOf(next), 1);
      now = next.at;
      next.fn();
    }
    now = to;
  };
  const begin = () => {
    // the first frame: the animation starts
    while (rafs.length) rafs.shift()!();
  };
  return { attrs, W, advance, begin, listeners, setReady: () => (W.__nfOpenReady = true), setNow: (n: number) => (now = n) };
}

describe("the opening screen's decision", () => {
  it("turns on for an installed app opened cold", () => {
    expect(run().attrs["data-open"]).toBe("on");
    expect(run({ standalone: false, navStandalone: true }).attrs["data-open"]).toBe("on");
  });
  it("stays off in a browser tab, on a warm open and where storage refuses", () => {
    expect(run({ standalone: false }).attrs["data-open"]).toBe("off");
    expect(run({ warm: true }).attrs["data-open"]).toBe("off");
    expect(run({ storageThrows: true }).attrs["data-open"]).toBe("off");
  });
  /*
   * The shell plays the opening too (founder, 10 November 2026), but not while
   * the Capacitor splash still covers it. Before this it was simply "off" on
   * native; now it is unlit until the splash says it is down, which is the
   * whole point: lighting it early is what lost the animation underneath the
   * splash and left a single frame.
   */
  it("on the native shell, waits for the splash before it lights", () => {
    for (const env of [{ native: true }, { ua: "Mozilla/5.0 VALLO-NATIVE" }]) {
      const r = run(env);
      expect(r.attrs["data-open"]).toBeUndefined();
      r.advance(OPEN_NATIVE_WAIT_MS - 100);
      expect(r.attrs["data-open"]).toBeUndefined();
      r.advance(OPEN_NATIVE_WAIT_MS + 100);
      expect(r.attrs["data-open"]).toBe("on");
    }
  });
});

describe("the opening screen's timing", () => {
  it("is visible for at least the minimum even when the page is ready at once", () => {
    const r = run({ ready: true });
    r.begin();
    r.advance(OPEN_MIN_MS - 50);
    expect(r.attrs["data-open"]).toBe("on");
    r.advance(OPEN_MIN_MS + 100);
    expect(r.attrs["data-open"]).toBe("leave");
    r.advance(OPEN_MIN_MS + 100 + OPEN_FADE_MS + 100);
    expect(r.attrs["data-open"]).toBe("off");
  });
  it("waits for hydration, then lifts", () => {
    const r = run({ ready: false });
    r.begin();
    r.advance(OPEN_MIN_MS + 500);
    expect(r.attrs["data-open"]).toBe("on");
    r.setReady();
    r.advance(OPEN_MIN_MS + 700);
    expect(r.attrs["data-open"]).toBe("leave");
  });
  it("does not lift early while the passcode guard has not decided, and lifts once it has or the lock is drawn", () => {
    const wait = run({ ready: true, guarded: true });
    wait.begin();
    wait.advance(OPEN_MIN_MS + 600);
    expect(wait.attrs["data-open"]).toBe("on");
    const decided = run({ ready: true, guarded: true, guardReady: true });
    decided.begin();
    decided.advance(OPEN_MIN_MS + 100);
    expect(decided.attrs["data-open"]).toBe("leave");
    const lock = run({ ready: true, guarded: true, lockDrawn: true });
    lock.begin();
    lock.advance(OPEN_MIN_MS + 100);
    expect(lock.attrs["data-open"]).toBe("leave");
  });
  it("never waits past the cap, whatever is not ready", () => {
    const r = run({ ready: false, guarded: true });
    r.begin();
    r.advance(OPEN_CAP_MS - 100);
    expect(r.attrs["data-open"]).toBe("on");
    r.advance(OPEN_CAP_MS + 100);
    expect(r.attrs["data-open"]).toBe("leave");
  });
  it("uses the shorter still minimum under reduced motion, Calm and Off", () => {
    for (const env of [{ reduced: true }, { motion: "calm" }, { motion: "off" }]) {
      const r = run({ ...env, ready: true });
      r.begin();
      r.advance(OPEN_MIN_STILL_MS - 50);
      expect(r.attrs["data-open"]).toBe("on");
      r.advance(OPEN_MIN_STILL_MS + 100);
      expect(r.attrs["data-open"]).toBe("leave");
    }
  });
  it("starts its clock on the animation's first frame when there is one", () => {
    const r = run({ ready: true });
    r.setNow(500);
    r.listeners["animationstart"]!({ animationName: "nf-open-in" });
    r.advance(500 + OPEN_MIN_MS - 50);
    expect(r.attrs["data-open"]).toBe("on");
    r.advance(500 + OPEN_MIN_MS + 100);
    expect(r.attrs["data-open"]).toBe("leave");
  });
});

describe("the opening screen's budget", () => {
  /* The founder asked for it slower on 10 November 2026: about 3.5 seconds. */
  it("is visible for about 3.5 seconds once ready, and capped near 4,500ms in all", () => {
    expect(OPEN_MIN_MS).toBeGreaterThanOrEqual(3000);
    expect(OPEN_MIN_MS).toBeLessThanOrEqual(3800);
    expect(OPEN_MIN_STILL_MS).toBeGreaterThanOrEqual(900);
    expect(OPEN_CAP_MS).toBeGreaterThan(OPEN_MIN_MS);
    expect(OPEN_CAP_MS + OPEN_FADE_MS).toBeLessThanOrEqual(4600);
  });
  it("has a stylesheet backstop that starts lifting at the same cap", () => {
    const css = readFileSync(join(__dirname, "open.css"), "utf8");
    expect(css).toMatch(new RegExp(`nf-open-cap 300ms [^;]* ${OPEN_CSS_CAP_MS}ms forwards`));
    expect(OPEN_CSS_CAP_MS + 300).toBeLessThanOrEqual(4500);
  });
});
