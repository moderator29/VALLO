"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isOffline } from "./connectivity";

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
    () => isOffline(),
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
    let wasOffline = isOffline();
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
