import type { Side } from "@/lib/side.constants";

/**
 * THE MAIN TABS, KEPT READY (13 October 2026, the startup track).
 *
 * The founder: screens show a loading state on navigation when they should
 * appear at once, above all after the app has been away for twenty minutes.
 * The cause, in Next's own code (`client/components/links.js`): a visible
 * `<Link prefetch>` is fetched whole when it enters the viewport and again
 * only when the router's tree changes or a server action invalidates the
 * cache. Nothing fetches it again when the copy simply grows old, and the
 * router refuses a whole prefetch older than `staleTimes.static` (five
 * minutes, `next.config.ts`). So after twenty minutes away every tab tap went
 * to the server and drew its skeleton. Messages lives behind the dock's More
 * button, so it was never visible and never fetched ahead at all, and on a
 * thread or a listing there is no dock to fetch anything.
 *
 * `KeepWarm` (components/app) fetches the main tabs whole when the browser is
 * idle after a page lands, again when the app comes back to the foreground,
 * and again on the first touch after a copy has gone stale. `HoldTabLink`
 * keeps the current screen up for a moment when a tab is tapped whose copy is
 * still on its way, instead of swapping to a skeleton for it.
 *
 * Whether a tab's copy is fresh is read from the browser's own resource
 * timing: the router fetches a route's payload with an `_rsc` query, and the
 * moment that fetch completes is when the copy exists. Nothing here reaches
 * into Next's internal caches.
 */

/** How long Next serves a whole prefetch (`staleTimes.static` in next.config.ts). */
export const PREFETCH_FRESH_MS = 300_000;

/** Away (the app hidden) at least this long, the screen on display refreshes itself in place on return. */
export const REFRESH_AFTER_AWAY_MS = 120_000;

/** One warm request per tab while it is in flight, at most this often. */
export const WARM_RETRY_MS = 15_000;

/** The longest a tab tap keeps the current screen up waiting for the tab's copy. */
export const HOLD_MAX_MS = 1_000;

/** After this many holds in a row that ran out without the copy arriving, holding stops for the session. */
export const HOLD_GIVE_UP_AFTER = 3;

/**
 * The main tabs for a side, in the order they are fetched: the dock's three
 * destinations and Profile, plus Messages, which lives behind the More button
 * and is otherwise never fetched ahead. The third dock slot is Around, or
 * Agreements while the `social` switch is off (`MobileTabBar`).
 */
export function mainTabs(side: Side, socialOn: boolean): string[] {
  const feed = socialOn ? "/around" : "/agreements";
  return side === "stays"
    ? ["/stays", "/stays/search", "/messages", "/profile", feed]
    : ["/home", "/search", "/messages", "/profile", feed];
}

/** Whether a path's copy arrived within the router's fresh window. */
export function isFresh(arrivedAt: number | undefined, now: number): boolean {
  return arrivedAt !== undefined && now - arrivedAt < PREFETCH_FRESH_MS;
}

/**
 * The tabs worth fetching now: not the screen on display, not one whose copy
 * is still fresh, and not one already asked for within WARM_RETRY_MS (its
 * request is still on its way, and the router would only join it).
 */
export function tabsToWarm(
  tabs: readonly string[],
  current: string,
  now: number,
  arrivedAt: (path: string) => number | undefined,
  requestedAt: (path: string) => number | undefined,
): string[] {
  return tabs.filter((tab) => {
    if (tab === current) return false;
    if (isFresh(arrivedAt(tab), now)) return false;
    const asked = requestedAt(tab);
    return asked === undefined || now - asked >= WARM_RETRY_MS;
  });
}

/**
 * The path a resource timing entry fetched a route payload for, or null when
 * it is not one: same origin, carrying the router's `_rsc` query. The query
 * is dropped and the rest kept, so `/search?q=lekki` stays its own path.
 */
export function rscPathOf(name: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(name, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.searchParams.has("_rsc")) return null;
  url.searchParams.delete("_rsc");
  const search = url.searchParams.toString();
  return url.pathname + (search ? `?${search}` : "");
}

/* ------------------------------------------------------- the arrivals */

const arrivals = new Map<string, number>();
const waiters = new Map<string, Set<() => void>>();
let watching = false;
let consecutiveTimeouts = 0;

/** When the copy of `path` last arrived, or undefined. */
export function arrivedAt(path: string): number | undefined {
  return arrivals.get(path);
}

/** A copy of `path` arrived (exported for the tests; the observer calls it). */
export function noteArrival(path: string, at: number): void {
  arrivals.set(path, at);
  consecutiveTimeouts = 0;
  const pending = waiters.get(path);
  if (pending) for (const wake of [...pending]) wake();
}

/** The router said this path's copy may be stale (a server action changed something). */
export function forgetArrival(path: string): void {
  arrivals.delete(path);
}

/**
 * Start listening for route payloads arriving, once per page. Buffered, so
 * the ones that arrived before this ran are counted too. Silent where the
 * browser offers no resource timing: then nothing is ever held.
 */
export function watchArrivals(): void {
  if (watching || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  try {
    if (!(PerformanceObserver.supportedEntryTypes ?? []).includes("resource")) return;
    const origin = window.location.origin;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (entry.initiatorType !== "fetch") continue;
        const status = (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus;
        if (typeof status === "number" && status !== 0 && (status < 200 || status >= 400)) continue;
        const path = rscPathOf(entry.name, origin);
        if (path) noteArrival(path, Date.now());
      }
    });
    observer.observe({ type: "resource", buffered: true });
    watching = true;
  } catch {
    watching = false;
  }
}

/**
 * Resolves true when a copy of `path` arrives, false after `maxMs`. A copy
 * that already arrived after `since` counts at once.
 */
export function waitForArrival(path: string, maxMs: number, since: number): Promise<boolean> {
  const already = arrivals.get(path);
  if (already !== undefined && already >= since) return Promise.resolve(true);
  return new Promise((resolve) => {
    let set = waiters.get(path);
    if (!set) {
      set = new Set();
      waiters.set(path, set);
    }
    const bucket = set;
    const finish = (arrived: boolean) => {
      clearTimeout(timer);
      bucket.delete(wake);
      if (bucket.size === 0) waiters.delete(path);
      if (!arrived) consecutiveTimeouts += 1;
      resolve(arrived);
    };
    const wake = () => finish(true);
    bucket.add(wake);
    /* Assigned before either caller of `finish` can run. */
    const timer = setTimeout(() => finish(false), maxMs);
  });
}

/**
 * Whether a tap on `path` should keep the current screen up until the tab's
 * copy arrives: only where resource timing is being read, only while its copy
 * is not fresh, and not once holding has run out HOLD_GIVE_UP_AFTER times in a
 * row (a link too slow for a hold to help, or a browser whose timing we cannot
 * read: the tap then navigates at once, as it always did).
 */
export function shouldHold(path: string, now: number): boolean {
  if (!watching) return false;
  if (consecutiveTimeouts >= HOLD_GIVE_UP_AFTER) return false;
  return !isFresh(arrivals.get(path), now);
}

/** Test-only: forget everything this module has seen. */
export function resetTabWarmForTests(): void {
  arrivals.clear();
  waiters.clear();
  watching = false;
  consecutiveTimeouts = 0;
}

/** Test-only: pretend resource timing is being read. */
export function markWatchingForTests(): void {
  watching = true;
}

/** The gap between first-install warms, so they never queue in front of the screen's own fetches. */
export const FIRST_INSTALL_WARM_GAP_MS = 1_500;

/**
 * WHICH TABS THE WORKER SHOULD KEEP RIGHT AFTER IT FIRST TAKES CONTROL
 * (item 3 of docs/OFFLINE_AND_FAST_START_PLAN.md, 2 November 2026).
 *
 * On a fresh install the worker has kept nothing, so the first open of every
 * other tab waits on the network, and a phone that loses signal after the
 * first screen has only that screen. The main tabs other than the one on
 * screen, in rail order, each once; the worker fetches and keeps each as a
 * document (`vallo:visited`), under the viewer the server names.
 */
export function firstInstallWarmPlan(tabs: readonly string[], current: string): string[] {
  const here = current.split("?")[0] ?? current;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tab of tabs) {
    if (tab === here || seen.has(tab)) continue;
    seen.add(tab);
    out.push(tab);
  }
  return out.slice(0, 4);
}
