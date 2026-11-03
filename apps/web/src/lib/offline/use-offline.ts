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
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  const message = String((error as { message?: unknown }).message ?? "");
  if (name === "ChunkLoadError" || name === "AbortError" || name === "TimeoutError") return true;
  return /failed to fetch|load failed|networkerror|network error|network request failed|fetch failed|the network connection was lost|an unexpected response was received from the server|connection (closed|reset)|loading chunk \S+ failed|err_internet_disconnected|err_network_changed|timed out/i.test(
    message,
  );
}

/**
 * The error boundary's view of the signal (3 November 2026, the founder: an
 * error page for a weak signal is a website's answer, not an app's).
 *
 *   "retrying"  a request died on a weak signal: no page at all. The short
 *               line at the bottom says it could not connect, and the screen
 *               is drawn again at once (the boundary renders nothing for that
 *               moment). Once a minute per screen, so it cannot loop.
 *   "weak"      it failed again inside that minute: the calm weak-signal
 *               screen, which tries again by itself when the signal returns.
 *   "offline"   no signal at all: the calm offline screen, as before.
 *   null        a real fault: the error screen, as before.
 */
export function useSignalBoundary(error: unknown, reset: () => void): "offline" | "weak" | "retrying" | null {
  const offline = useOfflineBoundary(reset);
  const weak = !offline && isNetworkError(error);
  const [retrying] = useState(() => {
    if (!weak || typeof window === "undefined") return false;
    try {
      const [path, at] = (sessionStorage.getItem(WEAK_KEY) ?? "").split("@");
      if (path === location.pathname && Date.now() - Number(at || 0) < 60_000) return false;
      sessionStorage.setItem(WEAK_KEY, `${location.pathname}@${Date.now()}`);
    } catch {
      /* No storage: retry this once. */
    }
    return true;
  });
  useEffect(() => {
    if (!retrying) return;
    tapFailedOffline(error);
    reset();
  }, [retrying, error, reset]);
  if (offline) return "offline";
  if (retrying) return "retrying";
  return weak ? "weak" : null;
}

const WEAK_KEY = "nf_weak_retry";
