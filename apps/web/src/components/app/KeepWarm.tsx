"use client";

import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { isDataSaver } from "@/lib/ui/data-saver";
import { heldByPasscode, seedTabs } from "@/lib/offline/page-cache";
import type { Side } from "@/lib/side.constants";
import {
  REFRESH_AFTER_AWAY_MS,
  arrivedAt,
  forgetArrival,
  mainTabs,
  tabsToWarm,
  watchArrivals,
} from "@/lib/nav/tab-warm";
import { isOffline } from "@/lib/offline/connectivity";

/**
 * THE MAIN TABS FETCHED AHEAD, AND THE SCREEN KEPT CURRENT (13 October 2026,
 * the startup track). Renders nothing. `lib/nav/tab-warm.ts` says why.
 *
 *   - When the browser is idle after a page lands, each main tab whose copy
 *     is not fresh is fetched whole (`router.prefetch`, the same request the
 *     dock's own links make), Messages included, so a tap draws the tab at
 *     once instead of its skeleton. The router joins a request already on its
 *     way and skips a copy it already holds.
 *   - When the app comes back to the foreground, the same, at once, because
 *     every copy may have aged out while it was away; and the screen on
 *     display, if the app was away REFRESH_AFTER_AWAY_MS or more, refreshes
 *     itself in place inside a transition: the last screen stays up while it
 *     refreshes, never a skeleton.
 *   - On the first touch after a copy has aged out (somebody reading one
 *     screen for ten minutes), the same, so the copies are fresh again by the
 *     time the thumb reaches the dock.
 *   - A server action that changes something tells the router, which tells
 *     this (`onInvalidate`), and that tab is fetched again.
 *
 * NEVER UNDER DATA SAVING (`isDataSaver`), the same rule as every other
 * fetch ahead on this platform, and never in development, where the router
 * prefetches nothing either. Behind the passcode lock the screen is not
 * refreshed: unlocking refreshes the route itself.
 */

/* `router.prefetch`'s option for the whole page, typed from `useRouter` itself
   so no internal Next module is imported (as `FilterDrawerPanel` does). */
type PrefetchOptions = NonNullable<Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]>;
const whole = (onInvalidate: () => void) => ({ kind: "full", onInvalidate }) as unknown as PrefetchOptions;

/* How long after the page lands the worker is asked to keep the tabs it lacks. */
const SEED_AFTER_MS = 4_000;

/* The browser's idle moment, or a short delay where there is none (Safari). */
function whenIdle(work: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(work, { timeout: 2_500 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(work, 1_200);
  return () => window.clearTimeout(timer);
}

export function KeepWarm({
  side,
  socialOn,
  current,
  enabled,
}: {
  side: Side;
  /** The `social` switch: off, the dock's third slot is Agreements, not Around. */
  socialOn: boolean;
  /** The screen on display, which is never fetched ahead. */
  current: string;
  /** A signed-in member; a guest's tabs are mostly the sign-in door. */
  enabled: boolean;
}) {
  const router = useRouter();
  const tabs = useMemo(() => mainTabs(side, socialOn), [side, socialOn]);
  /* Read at the moment of warming, so a new screen or a side flip does not
     tear the listeners down and set them up again. */
  const tabsRef = useRef(tabs);
  const currentRef = useRef(current);
  /* The running effect's scheduler, so a new screen can ask for a warm. */
  const scheduleRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    tabsRef.current = tabs;
    currentRef.current = current;
    /* Each new screen lands with its own idle moment to warm in. */
    scheduleRef.current?.();
  }, [tabs, current]);

  /* Only for a member: a guest's tab tap is never held (`shouldHold`). */
  useEffect(() => {
    if (enabled) watchArrivals();
  }, [enabled]);

  /* THE FIRST-INSTALL GAP (fast-start plan item 3). The service worker only keeps
     a page it saw load or was told about, so right after an install (or a new
     worker version, which empties the page caches) it holds nothing to answer
     the next open with. Once the worker controls this page, and a few seconds
     after it landed, the worker is asked to keep the main tabs it lacks. It
     skips any it has, never runs under data saving, and runs once per load. */
  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let seeded = false;
    let timer: number | undefined;
    const seed = () => {
      if (seeded || isDataSaver() || isOffline()) return;
      const paths = tabsRef.current.filter((tab) => tab !== currentRef.current);
      if (seedTabs(paths)) seeded = true;
    };
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(seed, SEED_AFTER_MS);
    };
    later();
    navigator.serviceWorker.addEventListener("controllerchange", later);
    return () => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", later);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== "production") return;
    const requested = new Map<string, number>();
    let cancelIdle: (() => void) | null = null;
    let hiddenAt: number | null = null;

    const warm = () => {
      cancelIdle = null;
      if (isDataSaver()) return;
      const now = Date.now();
      const due = tabsToWarm(tabsRef.current, currentRef.current, now, arrivedAt, (path) => requested.get(path));
      for (const tab of due) {
        requested.set(tab, now);
        router.prefetch(
          tab,
          whole(() => {
            /* Something changed on the server: this copy is stale, fetch it again. */
            forgetArrival(tab);
            requested.delete(tab);
            schedule();
          }),
        );
      }
    };
    const schedule = () => {
      if (cancelIdle) return;
      cancelIdle = whenIdle(warm);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= REFRESH_AFTER_AWAY_MS && !isOffline() && !isDataSaver()) {
        /* A beat later, so the passcode guard's own return check (it locks
           after five minutes away) has drawn the lock first. */
        window.setTimeout(() => {
          if (!heldByPasscode()) startTransition(() => router.refresh());
        }, 300);
      }
      schedule();
    };
    /* A touch after a quiet spell: `schedule` is a no-op while a warm is
       pending, and `tabsToWarm` skips every fresh copy. */
    const onTouch = () => schedule();

    scheduleRef.current = schedule;
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onTouch, { passive: true, capture: true });
    return () => {
      scheduleRef.current = null;
      cancelIdle?.();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onTouch, { capture: true });
    };
  }, [enabled, router]);

  return null;
}
