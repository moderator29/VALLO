"use client";

import { useEffect, useSyncExternalStore } from "react";

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
 * The error boundary's view of the signal: no signal, or a request that died
 * on a weak one. A weak-signal failure tries the segment again by itself once,
 * three seconds later, before it asks the person to.
 */
export function useSignalBoundary(error: unknown, reset: () => void): "offline" | "weak" | null {
  const offline = useOfflineBoundary(reset);
  const weak = !offline && isNetworkError(error);
  useEffect(() => {
    if (!weak) return;
    const key = "nf_weak_retry";
    /* Once a minute per screen, so a page that keeps failing cannot loop. */
    let tried = false;
    try {
      const [path, at] = (sessionStorage.getItem(key) ?? "").split("@");
      tried = path === location.pathname && Date.now() - Number(at || 0) < 60_000;
      sessionStorage.setItem(key, `${location.pathname}@${Date.now()}`);
    } catch {
      /* No storage: one retry per mount. */
    }
    if (tried) return;
    const timer = window.setTimeout(reset, 3_000);
    return () => window.clearTimeout(timer);
  }, [weak, reset]);
  return offline ? "offline" : weak ? "weak" : null;
}
