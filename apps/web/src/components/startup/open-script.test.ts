import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_HARD_GRACE_MS, OPEN_AFTER_NATIVE_MS,
  OPEN_NATIVE_METHOD,
  OPEN_NATIVE_PAGE_METHOD, OPEN_NATIVE_PLUGIN, OPEN_CAP_MS, OPEN_CSS_CAP_MS, OPEN_FADE_MS, OPEN_MIN_MS, OPEN_MIN_STILL_MS, OPEN_NATIVE_WAIT_MS, OPEN_SCRIPT, OPEN_SESSION_KEY } from "./open-script";

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
  /** `window.Capacitor.PluginHeaders`, as the native bridge injects it at document start. */
  pluginHeaders?: { name: string; methods: { name: string }[] }[];
};

function run(env: Env = {}) {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const attrs: Record<string, string> = {};
  if (env.native) attrs["data-native"] = "";
  if (env.motion) attrs["data-motion"] = env.motion;
  if (env.guardReady) attrs["data-guard-ready"] = "";
  const listeners: Record<string, (e: unknown) => void> = {};
  const windowListeners: Record<string, (e: unknown) => void> = {};
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
    Capacitor: env.pluginHeaders ? { PluginHeaders: env.pluginHeaders } : undefined,
    addEventListener: (n: string, f: (e: unknown) => void) => {
      windowListeners[n] = f;
    },
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
  /* The splash's own signal, arriving whenever the test says. */
  const relight = () => windowListeners["nf:splash-down"]?.({});
  return { attrs, W, advance, begin, listeners, relight, setReady: () => (W.__nfOpenReady = true), setNow: (n: number) => (now = n) };
}

describe("the opening screen's decision", () => {
  it("turns on for an installed app opened cold", () => {
    expect(run().attrs["data-open"]).toBe("on");
    expect(run({ standalone: false, navStandalone: true }).attrs["data-open"]).toBe("on");
  });
  /*
   * THE WEBSITE PLAYS IT TOO (the founder, 11 November 2026: "same as on
   * website too"). This read `expect(run({ standalone: false })).toBe("off")`:
   * a browser tab was refused the opening before it could draw a frame, which
   * is why the site showed none. A cold tab lights like any other surface now.
   */
  it("turns on for a browser tab opened cold", () => {
    expect(run({ standalone: false }).attrs["data-open"]).toBe("on");
  });
  it("stays off on a warm open and where storage refuses", () => {
    /* Both of these would replay the opening on every page view, which is the
       one thing it must never do. */
    expect(run({ warm: true }).attrs["data-open"]).toBe("off");
    expect(run({ standalone: false, warm: true }).attrs["data-open"]).toBe("off");
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

/*
 * THIS LAYER IS THE OPENING IN THE APP TOO (the founder, 14 November 2026). A
 * 1.0.2 binary draws its own opening (`LaunchMark`) and registers
 * `ValloShell.handoff`. On 13 November this layer was switched off there; the
 * founder wants this one and not the binary's, so it plays there again, and
 * never before the binary's own mark has landed. A later binary that draws
 * nothing says so with `ValloShell.pageOpens`, and has no such wait.
 */
describe("the opening inside the app", () => {
  const SPLASH = { name: "SplashScreen", methods: [{ name: "hide" }, { name: "show" }] };
  const SHELL_102 = { name: OPEN_NATIVE_PLUGIN, methods: [{ name: "setPrivacyCover" }, { name: OPEN_NATIVE_METHOD }, { name: "takeCrashReport" }] };
  const SHELL_NEXT = { name: OPEN_NATIVE_PLUGIN, methods: [{ name: OPEN_NATIVE_METHOD }, { name: OPEN_NATIVE_PAGE_METHOD }] };

  it("plays in a binary that draws its own opening, once the splash is down and that mark has landed", () => {
    for (const env of [{ native: true }, { ua: "Mozilla/5.0 VALLO-NATIVE" }]) {
      const r = run({ ...env, pluginHeaders: [SPLASH, SHELL_102] });
      expect(r.attrs["data-open"]).toBeUndefined();
      /* The splash comes down early: the layer still waits for the binary's mark. */
      r.setNow(600);
      r.relight();
      expect(r.attrs["data-open"]).toBeUndefined();
      r.advance(OPEN_AFTER_NATIVE_MS - 1);
      expect(r.attrs["data-open"]).toBeUndefined();
      r.advance(OPEN_AFTER_NATIVE_MS);
      expect(r.attrs["data-open"]).toBe("on");
    }
  });

  it("plays at once when the splash comes down after the binary's mark has already landed", () => {
    const r = run({ native: true, pluginHeaders: [SPLASH, SHELL_102] });
    r.setNow(OPEN_AFTER_NATIVE_MS + 800);
    r.relight();
    expect(r.attrs["data-open"]).toBe("on");
  });

  it("is never lost in such a binary when the splash never says it is down", () => {
    const r = run({ native: true, pluginHeaders: [SPLASH, SHELL_102] });
    r.advance(OPEN_NATIVE_WAIT_MS + 100);
    expect(r.attrs["data-open"]).toBe("on");
  });

  it("has no wait in a binary that draws no opening of its own", () => {
    const r = run({ native: true, pluginHeaders: [SPLASH, SHELL_NEXT] });
    r.setNow(300);
    r.relight();
    expect(r.attrs["data-open"]).toBe("on");
  });

  it("still plays, after the splash, in an older binary with no opening of its own", () => {
    for (const headers of [[SPLASH], [SPLASH, { name: OPEN_NATIVE_PLUGIN, methods: [{ name: "setPrivacyCover" }] }], []]) {
      const r = run({ native: true, pluginHeaders: headers });
      expect(r.attrs["data-open"]).toBeUndefined();
      r.advance(OPEN_NATIVE_WAIT_MS + 100);
      expect(r.attrs["data-open"]).toBe("on");
    }
  });

  it("ignores the headers on the website: a browser tab is not the shell, whatever a page script defines", () => {
    const r = run({ standalone: false, pluginHeaders: [SHELL_102] });
    expect(r.attrs["data-open"]).toBe("on");
  });
});

/*
 * A TOUCH ENDS IT (13 November 2026). The layer took every tap for its whole
 * hold, 3.5 to 4.2 seconds, while its own comment said a tap was not
 * swallowed. The first touch or key now starts the crossfade at once.
 */
describe("a touch or a key during the opening", () => {
  it("starts the crossfade at once, long before the minimum, and the layer is gone after the fade", () => {
    for (const kind of ["pointerdown", "keydown"]) {
      const r = run({ ready: false });
      r.begin();
      r.advance(400);
      expect(r.attrs["data-open"]).toBe("on");
      r.listeners[kind]!({});
      expect(r.attrs["data-open"]).toBe("leave");
      r.advance(400 + OPEN_FADE_MS + 60);
      expect(r.attrs["data-open"]).toBe("off");
    }
  });
  it("does nothing while the opening is not showing (a warm open, or a shell still waiting for its splash)", () => {
    const warm = run({ warm: true });
    expect(warm.listeners.pointerdown).toBeUndefined();
    const waiting = run({ native: true });
    waiting.listeners.pointerdown!({});
    expect(waiting.attrs["data-open"]).toBeUndefined();
  });
});

/*
 * NEVER LIT AFTER IT HAS GONE (13 November 2026, measured by Agent FEEL on
 * production with the shell's user agent and no splash signal: the hold ran
 * from DOMContentLoaded although nothing was shown, "left", and then the 6s
 * fallback lit the layer again over the page, where it stayed and took taps).
 */
describe("an older shell's opening, timed from when it is shown", () => {
  it("does not run its clock, or leave, before it is lit", () => {
    const r = run({ native: true, ready: true });
    r.begin();
    r.advance(OPEN_CAP_MS + 500);
    expect(r.attrs["data-open"]).toBeUndefined();
  });
  it("lit by the fallback, it then holds for the minimum from that moment, leaves, and never comes back", () => {
    const r = run({ native: true, ready: true });
    r.begin();
    r.advance(OPEN_NATIVE_WAIT_MS + 10);
    expect(r.attrs["data-open"]).toBe("on");
    r.begin();
    r.advance(OPEN_NATIVE_WAIT_MS + OPEN_MIN_MS - 100);
    expect(r.attrs["data-open"]).toBe("on");
    r.advance(OPEN_NATIVE_WAIT_MS + OPEN_MIN_MS + 100);
    expect(r.attrs["data-open"]).toBe("leave");
    r.advance(OPEN_NATIVE_WAIT_MS + OPEN_MIN_MS + OPEN_FADE_MS + 200);
    expect(r.attrs["data-open"]).toBe("off");
    /* A late splash signal, or any other light, changes nothing now. */
    r.W.__nfSplashDown = true;
    r.relight();
    r.advance(OPEN_NATIVE_WAIT_MS * 3);
    expect(r.attrs["data-open"]).toBe("off");
  });
  it("a late splash signal after a touch sent it away does not bring it back either", () => {
    const r = run({ native: true, ready: false });
    r.advance(OPEN_NATIVE_WAIT_MS + 10);
    expect(r.attrs["data-open"]).toBe("on");
    r.listeners.pointerdown!({});
    r.advance(OPEN_NATIVE_WAIT_MS + OPEN_FADE_MS + 200);
    expect(r.attrs["data-open"]).toBe("off");
    r.relight();
    expect(r.attrs["data-open"]).toBe("off");
  });
});

/*
 * NO FRAME, STILL GONE (13 November 2026, Agent HUNTER: WebKit with the
 * shell's user agent and no bridge, the layer on top 25s after load). The hold
 * starts on a frame; a hidden or background web view paints none. A plain
 * timer from the moment the layer is lit sends it away regardless.
 */
describe("a lit layer whose clock never starts", () => {
  it("leaves by the cap plus a short grace even when no frame ever arrives, on the website and in an older shell", () => {
    for (const env of [{}, { native: true }]) {
      const r = run({ ...env, ready: false });
      /* No begin(): no animation frame is ever delivered. */
      if (env.native) r.advance(OPEN_NATIVE_WAIT_MS + 10);
      expect(r.attrs["data-open"]).toBe("on");
      const litAt = env.native ? OPEN_NATIVE_WAIT_MS + 10 : 0;
      r.advance(litAt + OPEN_CAP_MS + OPEN_HARD_GRACE_MS - 50);
      expect(r.attrs["data-open"]).toBe("on");
      r.advance(litAt + OPEN_CAP_MS + OPEN_HARD_GRACE_MS + 50);
      expect(r.attrs["data-open"]).toBe("leave");
      r.advance(litAt + OPEN_CAP_MS + OPEN_HARD_GRACE_MS + OPEN_FADE_MS + 200);
      expect(r.attrs["data-open"]).toBe("off");
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
  /*
   * The founder asked for it slower on 10 November 2026 (about 3.5 seconds),
   * then on 13 November 2026 said yes to 2.4 seconds: the drawing finishes at
   * 1,780ms, so it is still seen whole, and the extra 1.1 seconds of a
   * motionless lockup went on every cold open of the website.
   */
  it("is visible for about 2.4 seconds once ready, long enough for the whole drawing, and capped near 3,500ms in all", () => {
    expect(OPEN_MIN_MS).toBeGreaterThanOrEqual(1260 + 520 + 400);
    expect(OPEN_MIN_MS).toBeLessThanOrEqual(2600);
    expect(OPEN_MIN_STILL_MS).toBeGreaterThanOrEqual(900);
    expect(OPEN_CAP_MS).toBeGreaterThan(OPEN_MIN_MS);
    expect(OPEN_CAP_MS + OPEN_FADE_MS).toBeLessThanOrEqual(3600);
  });
  it("has a stylesheet backstop that starts lifting at the same cap", () => {
    const css = readFileSync(join(__dirname, "open.css"), "utf8");
    expect(css).toMatch(new RegExp(`nf-open-cap 300ms [^;]* ${OPEN_CSS_CAP_MS}ms forwards`));
    expect(OPEN_CSS_CAP_MS + 300).toBeLessThanOrEqual(3500);
  });
});
