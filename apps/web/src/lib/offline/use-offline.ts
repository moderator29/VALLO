"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { tapFailedOffline } from "./tap-failed";

/**
 * WHETHER THE PHONE KNOWS IT HAS NO SIGNAL (13 October 2026, the layout and
 * loading audit: "make offline states calm and consistent").
 *
 * `navigator.onLine` is optimistic, true behind a captive portal, so this
 * only answers "offline" when the browser is sure, the same rule
 * `ConnectionLine` follows. The server render and the hydration pass read as
 * online, so nothing offline is ever painted into the first HTML.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine === false,
    () => false,
  );
}

/**
 * For an error boundary: while the phone is offline the boundary speaks calmly
 * about the connection instead of about a fault, and the moment the signal
 * returns it retries the segment ONCE by itself (`reset`), so a person who
 * walked into a tunnel is not left holding a screen that needs a tap.
 */
export function useOfflineBoundary(reset: () => void): boolean {
  const offline = useOffline();
  useEffect(() => {
    /* Listens for the whole life of the boundary and remembers whether it saw
       the signal go, rather than attaching when the render flips: React's own
       subscription is ahead of this one in the queue and may have torn the
       listener down before the event reaches it. */
    let wasOffline = navigator.onLine === false;
    const gone = () => {
      wasOffline = true;
    };
    const back = () => {
      if (!wasOffline) return;
      wasOffline = false;
      reset();
    };
    window.addEventListener("offline", gone);
    window.addEventListener("online", back);
    return () => {
      window.removeEventListener("offline", gone);
      window.removeEventListener("online", back);
    };
  }, [reset]);
  return offline;
}

/**
 * WAS THIS A WEAK SIGNAL RATHER THAN A FAULT? (2 November 2026)
 *
 * On a poor connection `navigator.onLine` stays true while requests fail:
 * a server action whose request never landed throws "Failed to fetch"
 * (Chrome), "Load failed" (Safari), "NetworkError" (Firefox), and Next's own
 * words when the action's answer was cut off; a code chunk that could not
 * load throws ChunkLoadError. Those reached the error screen as a fault with
 * a reference to quote to support. They are a signal problem, and the
 * screen now says so, the way it already did for no signal at all.
 *
 * REACT'S OWN WORDS ARE MINIFIED IN PRODUCTION (13 November 2026). When a weak
 * signal cuts a navigation's answer part way, React's reader throws
 * "Connection closed." in development and "Minified React error #412" in the
 * production build (checked in next/dist/compiled/react-server-dom-turbopack:
 * the production client throws formatProdErrorMessage(412) at the very place
 * the development client throws "Connection closed."). Only the first was
 * matched, so on the live app this, the commonest weak-signal failure of all,
 * drew the fault screen with a "C-" reference: the founder's screenshot,
 * reproduced on production by cutting one navigation's answer at a third.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  const message = String((error as { message?: unknown }).message ?? "");
  if (name === "ChunkLoadError" || name === "AbortError" || name === "TimeoutError") return true;
  return /failed to fetch|load failed|networkerror|network error|network request failed|fetch failed|the network connection was lost|an unexpected response was received from the server|connection (closed|reset)|loading chunk \S+ failed|failed to load chunk|importing a module script failed|error loading dynamically imported module|err_internet_disconnected|err_network_changed|err_connection_reset|timed out|minified react error #412\b/i.test(
    message,
  );
}

/**
 * A PIECE OF THE APP'S OWN CODE THAT DID NOT ARRIVE (13 November 2026). A
 * chunk the browser could not fetch on a weak signal is remembered as failed
 * by the module loader, so drawing the screen again asks for the same failed
 * promise and fails again. Only a fresh load of the page fetches it anew.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  const message = String((error as { message?: unknown }).message ?? "");
  return name === "ChunkLoadError" || /loading chunk \S+ failed|failed to load chunk|importing a module script failed|error loading dynamically imported module|failed to fetch dynamically imported module/i.test(message);
}

/**
 * The error boundary's view of the signal (3 November 2026, the founder: an
 * error page for a weak signal is a website's answer, not an app's; and 13
 * November 2026, his screenshot inside the app on a weak signal: "This screen
 * did not load", a reference to quote, and nothing else).
 *
 * A SLOW OR BRIEFLY FAILED REQUEST IS NOT A FAULT. So:
 *
 *   "retrying"  a request died on a weak signal: the boundary keeps the page's
 *               shape on screen (`SignalHold`, a skeleton) and draws the screen
 *               again by itself, after SIGNAL_RETRY_GAPS_MS (0.8s, 2.5s, 6s,
 *               12s): about 21 seconds in all. From the second try the hold
 *               says, in one calm line, that it is still loading on a weak
 *               connection, with a Try again. A piece of the app's own code
 *               that did not arrive is fetched by ONE fresh load of the page
 *               instead (a drawn-again screen would fail on the same remembered
 *               failure), at most once a minute per address.
 *   "weak"      the tries ran out: the calm weak-signal screen, which tries
 *               again by itself when the signal returns. Never the fault screen.
 *   "offline"   no signal at all: the calm offline screen, as before.
 *   null        a real fault: the error screen, as before.
 *
 * The count lives in sessionStorage, per address, because each failed try
 * mounts the boundary afresh; it starts over after two quiet minutes.
 */
export const SIGNAL_RETRY_GAPS_MS = [800, 2_500, 6_000, 12_000] as const;
const RELOAD_KEY = "nf_chunk_reload";
const RETRY_WINDOW_MS = 120_000;

export type SignalHoldState = { view: "offline" | "weak" | "retrying" | null; tries: number };

type Tries = { path: string; first: number; count: number; last?: number };

function readTries(path: string, now: number): Tries {
  try {
    const raw = JSON.parse(sessionStorage.getItem(WEAK_KEY) ?? "null") as Partial<Tries> | null;
    if (raw && raw.path === path && typeof raw.first === "number" && now - raw.first < RETRY_WINDOW_MS && typeof raw.count === "number") {
      return { path, first: raw.first, count: raw.count, ...(typeof raw.last === "number" ? { last: raw.last } : {}) };
    }
  } catch {
    /* Unreadable: start over. */
  }
  return { path, first: now, count: 0 };
}

function writeTries(tries: Tries): void {
  try {
    sessionStorage.setItem(WEAK_KEY, JSON.stringify(tries));
  } catch {
    /* No storage: the tries are not counted across mounts, so the ceiling is the gaps' length per mount. */
  }
}

/** One fresh page load for a chunk that did not arrive, at most once a minute per address. */
function reloadOnceForChunk(): boolean {
  try {
    const [path, at] = (sessionStorage.getItem(RELOAD_KEY) ?? "").split("@");
    if (path === location.pathname && Date.now() - Number(at || 0) < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, `${location.pathname}@${Date.now()}`);
  } catch {
    return false;
  }
  location.reload();
  return true;
}

export function useSignalHold(error: unknown, reset: () => void): SignalHoldState {
  const offline = useOfflineBoundary(reset);
  const network = !offline && isNetworkError(error);
  /* Decided once per failure: which try this is, and whether any are left.
     Remembered against the error object, because React may run a state
     initializer twice for one mount (a render it threw away), and a try must
     be counted once. */
  const [plan] = useState<Plan>(() => {
    if (!network || typeof window === "undefined") return { tries: 0, gap: null, reload: false };
    const known = error && typeof error === "object" ? planned.get(error) : undefined;
    if (known) return known;
    const made = planFor(error);
    if (error && typeof error === "object") planned.set(error, made);
    return made;
  });
  useEffect(() => {
    if (plan.gap === null) return;
    tapFailedOffline(error);
    const timer = window.setTimeout(reset, plan.gap);
    return () => window.clearTimeout(timer);
  }, [plan, error, reset]);
  if (offline) return { view: "offline", tries: 0 };
  if (plan.reload || plan.gap !== null) return { view: "retrying", tries: plan.tries };
  return { view: network ? "weak" : null, tries: plan.tries };
}

type Plan = { tries: number; gap: number | null; reload: boolean };
const planned = new WeakMap<object, Plan>();

/* React draws a failing screen a second time before it hands the error to the
   boundary, and may throw that boundary render away and draw it again with
   the second error: one failure, two boundary mounts. Mounts this close
   together are the same try. */
const SAME_TRY_MS = 400;

function planFor(error: unknown): Plan {
  if (isChunkLoadError(error) && reloadOnceForChunk()) return { tries: 0, gap: null, reload: true };
  const now = Date.now();
  const tries = readTries(location.pathname, now);
  if (tries.count > 0 && tries.last !== undefined && now - tries.last < SAME_TRY_MS) {
    const count = tries.count - 1;
    return { tries: count, gap: count < SIGNAL_RETRY_GAPS_MS.length ? SIGNAL_RETRY_GAPS_MS[count]! : null, reload: false };
  }
  if (tries.count >= SIGNAL_RETRY_GAPS_MS.length) return { tries: tries.count, gap: null, reload: false };
  const gap = SIGNAL_RETRY_GAPS_MS[tries.count]!;
  writeTries({ ...tries, count: tries.count + 1, last: now });
  return { tries: tries.count, gap, reload: false };
}

/** The older shape, for the boundaries that only need the view. */
export function useSignalBoundary(error: unknown, reset: () => void): "offline" | "weak" | "retrying" | null {
  return useSignalHold(error, reset).view;
}

const WEAK_KEY = "nf_weak_retry";
