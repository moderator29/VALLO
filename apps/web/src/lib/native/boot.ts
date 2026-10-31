"use client";

import { looksNative } from "./platform";
import { bootMark } from "./boot-trace";

/**
 * The one entry point into everything native.
 *
 * `NativeRuntime` in `components/app/` mounts this once from the root layout
 * and nothing else in the application calls it. One entry point is not tidiness
 * for its own sake: it is the only way to be certain that the guard below is
 * asked before any plugin is touched, and that every listener started has a
 * teardown that runs.
 *
 * THE WEBSITE MUST NOT CHANGE AT ALL. The same bundle serves vallospaces.com in a
 * phone browser and the shell on a device, and a visitor to the website pays
 * for exactly one thing here: the handful of bytes in `platform.ts`, which
 * reads a global and imports nothing. Every plugin, and every module that
 * imports one, is behind a dynamic import that a browser never requests, so
 * the Capacitor packages are not in the main bundle, are not evaluated, and
 * register nothing on the window.
 *
 * TWO GUARDS, DELIBERATELY. `looksNative()` reads the injected bridge without
 * importing anything, which is what keeps the website free. Then, once the
 * native chunk has arrived, the real `Capacitor.isNativePlatform()` is asked
 * again before a single listener is bound. The cost of a second check is one
 * function call on a phone; the cost of being wrong in the other direction is
 * a website with a hijacked click handler.
 *
 * ORDER MATTERS, AND ONLY FOR ONE OF THEM. The splash is started first, on its
 * own, before anything that could fail. It is the only piece here whose
 * absence traps somebody on a screen they cannot leave, so it must not be
 * waiting behind a plugin that is slow to answer or a chunk that never
 * arrives. Everything after it is an enhancement to a running application.
 *
 * FAILURE IS SILENT AND PARTIAL, NEVER TOTAL. Each feature is started inside
 * its own try, so a plugin missing from a particular build (a shell compiled
 * without the keyboard plugin, say) costs exactly that feature and leaves the
 * other four running. There is nothing useful to tell the person about it: a
 * status bar that did not repaint is not something they can act on.
 */

export type NativeRuntimeHandlers = {
  /**
   * Walk one step back through the application's own history.
   *
   * Passed in rather than reached for, because the Next router is a React
   * context and this module is not a component. The component that mounts this
   * owns the router and hands the one capability the runtime needs.
   */
  goBack: () => void;
  /** V-53: the Android notification channel's name, in the reader's words. */
  notificationChannelName?: string;
};

const NOOP = (): void => {};

/**
 * The bridge's own escape hatch, armed before anything is imported.
 *
 * `startSplash()` below (via `./splash`) is reached only after two sequential
 * dynamic imports -- `@capacitor/core`, then the module itself -- each a
 * network fetch for a separate JS chunk. On a slow or interrupted connection
 * that fetch can simply never settle. If it never settles, `startSplash()` is
 * never called, and ITS OWN failsafe (`FAILSAFE_MS` in `splash.ts`) is never
 * armed either: nothing is left running that could ever hide the splash.
 * That is indistinguishable, to the person holding the phone, from the app
 * being broken, and no amount of waiting fixes it.
 *
 * `window.Capacitor.nativePromise` is injected by the native bridge itself
 * before any of this file's code runs, so calling it needs no import and no
 * network fetch of our own -- the same primitive `native-shell/shell.js` calls
 * for the same reason when the live origin cannot be reached at all, and the
 * one the startup's inline script (`components/startup/startup-script.ts`)
 * calls on the document's first parse, which is what normally takes the
 * splash down. Two and a half seconds (it was seven, and with the old
 * frame-gated hides that was the founder's "up to eight seconds"): longer
 * than `FAILSAFE_MS`, so the ordinary path's own failsafe still wins first;
 * this one only matters for the chunk that never arrives.
 */
export const BRIDGE_FAILSAFE_MS = 2_500;

function hideSplashViaBridge(): void {
  bootMark("bridge-failsafe:fired");
  try {
    const cap = (window as unknown as { Capacitor?: { nativePromise?: (...args: unknown[]) => unknown } }).Capacitor;
    const pending = cap?.nativePromise?.("SplashScreen", "hide", { fadeOutDuration: 200 });
    if (pending && typeof (pending as Promise<unknown>).then === "function") {
      (pending as Promise<unknown>).then(null, () => {});
    }
  } catch {
    /* Nothing left to try. */
  }
}

export function startNativeRuntime(handlers: NativeRuntimeHandlers): () => void {
  if (typeof window === "undefined") return NOOP;
  if (!looksNative()) return NOOP;

  let stopped = false;
  const teardowns: Array<() => void> = [];
  bootMark("runtime:start");
  const bridgeFailsafe = window.setTimeout(hideSplashViaBridge, BRIDGE_FAILSAFE_MS);
  teardowns.push(() => window.clearTimeout(bridgeFailsafe));

  /*
   * Collect a teardown, or run it immediately if the runtime was already torn
   * down while this feature was still starting. Everything below is async, so
   * a fast unmount (React's development double invoke is the common one) can
   * genuinely land between the await and the assignment.
   */
  const collect = (teardown: () => void): void => {
    if (stopped) teardown();
    else teardowns.push(teardown);
  };

  void (async () => {
    const { Capacitor } = await import("@capacitor/core");
    bootMark(Capacitor.isNativePlatform() ? "runtime:core-loaded" : "runtime:core-not-native");
    if (!Capacitor.isNativePlatform() || stopped) return;

    /* V-11: mark the document as the shell, so the marketing header and
       footer are hidden by CSS even on a page the server did not recognise
       as the shell's (`app/css/site.css`). Set after the authoritative
       check, so a website can never be marked. */
    document.documentElement.dataset.shell = "native";

    /* First, and alone. See the note above about the splash. */
    try {
      const { startSplash } = await import("./splash");
      bootMark("runtime:splash-module-loaded");
      collect(startSplash());
    } catch {
      bootMark("runtime:splash-module-failed");
      /* If this failed the splash is still up, and the failsafe inside it
         never got the chance to arm. Nothing here can improve on that. */
    }

    try {
      const { startStatusBar } = await import("./status-bar");
      collect(startStatusBar());
    } catch {
      /* The bar keeps the colour the config gave it at launch. */
    }

    try {
      const { startKeyboard } = await import("./keyboard");
      collect(await startKeyboard());
    } catch {
      /* `resize: "native"` in the config still does the heavy lifting. */
    }

    try {
      const { startBackButton } = await import("./back-button");
      collect(await startBackButton(handlers.goBack));
    } catch {
      /* Android's back button falls back to doing nothing, which is the
         behaviour of an unhandled web view. */
    }

    try {
      const { startExternalLinks } = await import("./external-links");
      collect(startExternalLinks());
    } catch {
      /* Capacitor's own navigation delegate still refuses to load a foreign
         origin in the shell, so payments and OAuth leave to the full browser
         application instead of an in-app tab. */
    }

    try {
      /* Android's web view has no navigator.share; supply it from the plugin
         so every share control opens the system sheet, not the clipboard. */
      const { startShareBridge } = await import("./share-bridge");
      collect(await startShareBridge());
    } catch {
      /* The share controls fall back to copying the link, as on the web. */
    }

    try {
      /* V-53: a tap on a native notification opens the screen it names. */
      const { startPushTaps } = await import("./push-taps");
      collect(await startPushTaps(handlers.notificationChannelName ?? "Vallo"));
    } catch {
      /* A tap opens the app where it was, which is what it did before. */
    }

    try {
      /* F-14 and F-15: read the real notification permission without asking,
         and re-register a device enrolled before, so a rotated token is not
         left stale. Never prompts; nothing runs for a device never enrolled. */
      const { refreshNativeRegistration } = await import("@/components/app/push/enrol");
      if (!stopped) void refreshNativeRegistration();
    } catch {
      /* The token stays as it was; the provider's "gone" still retires it. */
    }

    try {
      /* True connectivity from the operating system, not the browser's guess. */
      const { startNetworkStatus } = await import("./network");
      collect(await startNetworkStatus());
    } catch {
      /* The browser's own online and offline events stay in charge. */
    }

    try {
      const { startDeepLinks } = await import("./deep-links");
      collect(await startDeepLinks());
    } catch {
      /* A returning universal link opens as an ordinary page instead of being
         handed to the running application. */
    }
  })();

  return () => {
    stopped = true;
    /* Last started, first torn down, so nothing is removed out from under
       something that was still relying on it. */
    while (teardowns.length > 0) {
      teardowns.pop()?.();
    }
  };
}
