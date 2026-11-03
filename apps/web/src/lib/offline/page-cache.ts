/**
 * THE PAGE'S SIDE OF THE KEPT PAGES (8 October 2026). `public/sw.js` keeps
 * every page a member opens so it opens again with no signal; this module is
 * the three things a page says to it, and the one thing it asks.
 *
 *   - `announceVisit`  a tap inside the app is a data fetch, not a page load,
 *                      so the worker never sees the page. The page tells it
 *                      the address, and the worker keeps a copy in the
 *                      background (never under Save-Data or on 2g; the worker
 *                      decides, and the server says whose page it is).
 *   - `forgetKeptPages` sign-out. Every kept page is deleted from here AND
 *                      the worker is told, so a shared phone never opens the
 *                      previous account's screens. Either hand alone is
 *                      enough; both run because a sign-out is the one moment
 *                      that must not depend on a worker being awake.
 *   - `keptCopyKind`   whether this document came from the phone rather than
 *                      the network, and which way: at once ("instant", the
 *                      network refreshing it behind) or because the network
 *                      failed or dawdled ("kept"). The worker marks it with a
 *                      Server-Timing entry and a `data-vallo-kept` attribute.
 *   - `onFreshCopy`    the worker found the network after all and kept a
 *                      fresh copy: the page refreshes itself in place.
 *
 * Every function is a no-op where there is no worker (a browser without one,
 * a private window, the development server), and none of them throws.
 */

/** Every page cache the worker writes is named with this prefix. */
export const PAGE_CACHE_PREFIX = "vallo-pages-";

/** The Server-Timing name the worker puts on a page it answered from the phone. */
export const KEPT_TIMING_NAME = "vallo-kept";

type WorkerMessage = { type: "vallo:visited"; path: string } | { type: "vallo:forget" };

function post(message: WorkerMessage): void {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.controller?.postMessage(message);
  } catch {
    /* No worker controls this page. */
  }
}

/** Tell the worker this page was opened, so it keeps a copy for offline. */
export function announceVisit(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//")) return;
  post({ type: "vallo:visited", path });
}

/** Sign-out: delete every kept page, here and in the worker. */
export async function forgetKeptPages(): Promise<void> {
  post({ type: "vallo:forget" });
  try {
    if (typeof caches === "undefined") return;
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PAGE_CACHE_PREFIX)).map((name) => caches.delete(name)));
  } catch {
    /* Storage refused: the worker's own hand still runs. */
  }
}

/**
 * The attribute the worker writes on a kept copy's `<html>` (13 October
 * 2026), so the page knows it is the phone's copy even where Server-Timing
 * cannot be read (Safari before 16.4), and before any script has run: the
 * passcode stylesheet keys off it (`app/css/passcode.css`).
 */
export const KEPT_MARK_ATTRIBUTE = "data-vallo-kept";

/**
 * How this document reached the screen, when it came from the phone:
 *
 *   - "instant": answered at once while the network refreshes it behind the
 *     screen. Nothing is wrong, so nothing is said; the page refreshes itself
 *     in place as soon as it runs (`ConnectionLine`).
 *   - "kept": answered because the network failed or was too slow to wait
 *     for. The connection line says so.
 *
 * Null for a document the network answered.
 */
/**
 * "instant" a whole, recent copy shown at once; "instant-light" the same on
 * Save-Data or 2G, which waits for the network's copy before refreshing;
 * "kept" the network was too slow and the copy was shown after the wait.
 */
export type KeptCopyKind = "instant" | "instant-light" | "kept";

export function keptCopyKind(): KeptCopyKind | null {
  try {
    if (typeof performance !== "undefined" && typeof performance.getEntriesByType === "function") {
      const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      const timing = (entry?.serverTiming ?? []).find((item) => item.name === KEPT_TIMING_NAME);
      if (timing) {
        if (timing.description === "instant") return "instant";
        if (timing.description === "instant-light") return "instant-light";
        return "kept";
      }
    }
  } catch {
    /* Fall through to the mark. */
  }
  try {
    /* No timing to read: the mark alone says it is the phone's copy, and
       which way it came is unknown, so it is treated as the slow answer. */
    if (typeof document !== "undefined" && document.documentElement.hasAttribute(KEPT_MARK_ATTRIBUTE)) return "kept";
  } catch {
    /* No document. */
  }
  return null;
}

/** Whether this document was answered from the phone rather than the network. */
export function servedFromKeptCopy(): boolean {
  return keptCopyKind() !== null;
}

/**
 * Whether the passcode guard is holding the page behind its lock right now
 * (`PasscodeGuard` marks its wrapper `data-passcode-guarded` and makes it
 * inert while locked). A refresh then waits: unlocking re-renders the route
 * from the server anyway, and a refresh under the lock could swap the lock
 * screen out from under a half-typed code.
 */
export function heldByPasscode(): boolean {
  try {
    if (typeof document === "undefined") return false;
    const guarded = document.querySelector("[data-passcode-guarded]");
    if (!guarded) return false;
    if (guarded.hasAttribute("inert")) return true;
    /* About to lock: a guard on a tab that was never unlocked locks in its
       first effect, and that lock may not be on the page yet when this is
       asked (the same mark `lib/passcode/tab.ts` reads). */
    return window.sessionStorage.getItem(PASSCODE_TAB_KEY) !== "1";
  } catch {
    return false;
  }
}

/* `TAB_KEY` in `lib/passcode/tab.ts`, the guard's "this tab was unlocked". */
const PASSCODE_TAB_KEY = "vallo.passcode.tab";

/** Call `listener` when the worker has kept a fresh copy of the page on screen. Returns the unsubscribe. */
export function onFreshCopy(listener: () => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => undefined;
  const handle = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; path?: unknown } | null;
    if (!data || data.type !== "vallo:page-fresh") return;
    if (typeof data.path === "string" && data.path !== window.location.pathname) return;
    listener();
  };
  try {
    navigator.serviceWorker.addEventListener("message", handle);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      navigator.serviceWorker.removeEventListener("message", handle);
    } catch {
      /* Already gone. */
    }
  };
}
