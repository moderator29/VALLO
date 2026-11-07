"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { decideBack, performBack } from "@/lib/nav/use-back";
import { settlePausedBack } from "@/lib/nav/paused-back";
import { startNativeRuntime } from "@/lib/native/boot";

/**
 * Mounts the native runtime. Renders nothing.
 *
 * Modelled on `ServiceWorkerRegistrar`, which sits beside it in the root
 * layout and solves the same shape of problem: a capability that belongs to
 * the whole application, has no UI of its own, and must be started exactly
 * once from a place every route passes through.
 *
 * It exists as a component for one reason that could not be solved inside
 * `lib/native/`: the hardware back button has to know where it is, and both the
 * current path and the Next router are React context. So this component holds
 * them and hands the runtime the single capability it cannot reach for itself.
 * Everything else the runtime does is plain DOM and plugin work and stays out
 * of React entirely.
 *
 * ON THE WEB THIS IS A NO-OP AND COSTS NOTHING. `startNativeRuntime` returns
 * immediately unless the Capacitor bridge is present, and every plugin is
 * behind a dynamic import that a browser never requests. Mounting it in the
 * root layout therefore changes nothing at all about the website, which is the
 * condition of it being allowed there. Nothing Capacitor is imported HERE for
 * exactly that reason, which is also why the decision to close the application
 * lives in `lib/native/back-button.ts` and not in this file.
 *
 * WHY ANDROID IS THE WORST PLACE FOR THE OLD BUG.
 *
 * This handler used to be `if (canGoBackInApp()) router.back();`. On a screen
 * reached by a redirect, a sign-in bounce or a push notification's deep link,
 * the previous entry is not the parent, so the hardware button walked sideways
 * into whatever the machinery had done. And when the answer was NO,
 * `startBackButton` closed the application - so a person who opened a message
 * from a notification and pressed back had the shell vanish rather than land in
 * their inbox. Both halves are gone: the hierarchy decides where back goes, and
 * only a declared ROOT may close the shell.
 */
/** A second hardware press on the same screen within this window is dropped
    (the same guard `useBack` gives the drawn control). */
const SETTLE_MS = 800;

export function NativeRuntime() {
  const router = useRouter();
  /* Read at press time, never captured: the runtime starts once, and a path
     captured at render would be stale for a press that lands mid-navigation. */
  const pressedAt = useRef<{ path: string; at: number } | null>(null);

  useEffect(
    () =>
      startNativeRuntime({
        /*
         * The same decision every other back control on this platform takes,
         * from the same map, with `surface: "android"` so that a root is an
         * exit rather than a fallback. `startBackButton` asks `isAppRoot()`
         * and exits before it calls this, so `performBack` never sees `exit`.
         */
        goBack: () => {
          const path = window.location.pathname || "/";
          const now = Date.now();
          const last = pressedAt.current;
          if (last && last.path === path && now - last.at < SETTLE_MS) return;
          pressedAt.current = { path, at: now };
          /* A paused social screen (`PausedBack`) marks <html> with the home of
             the side; the hardware button then takes the same rule as the drawn
             one: the ordinary decision, never landing on another paused screen. */
          const pausedHome = document.documentElement.dataset.socialPaused;
          performBack(
            pausedHome ? settlePausedBack(decideBack(path, pausedHome, "android"), pausedHome) : decideBack(path, "/home", "android"),
            router,
          );
        },
        /* Grade 1 (P0.5): coming back after a minute or more shows today. */
        refresh: () => router.refresh(),
      }),
    /* NOT keyed on the pathname: re-running tore the whole runtime down and
       re-registered the listener on every navigation, and a press inside that
       async gap fell through to the web view's own back (or closed the app). */
    [router],
  );

  return null;
}
