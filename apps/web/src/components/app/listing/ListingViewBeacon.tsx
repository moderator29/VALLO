"use client";

import { useEffect } from "react";

/**
 * LISTING VIEWS: THE CLIENT SIGNAL (founder, 13 November 2026). Draws nothing.
 *
 * A view is counted only when a real browser has had the page ON SCREEN for a
 * second: a prefetch, a background tab, a prerender and a crawler that does
 * not run scripts never get here, and a browser driven by automation
 * (`navigator.webdriver`) does not send. The timer pauses while the tab is
 * hidden and starts again when it comes back. One beacon per page view; the
 * database keeps one view per person per listing per day, so a reload or a
 * second visit the same day changes nothing.
 *
 * `sendBeacon` hands the request to the browser and returns at once, so it
 * never competes with the page; `fetch` with keepalive is the fallback.
 * Nothing is stored on the device.
 */
export const VIEW_DWELL_MS = 1_000;

export function ListingViewBeacon({
  listingId,
  endpoint = "/api/listing-view",
  dwellMs = VIEW_DWELL_MS,
}: {
  listingId: string;
  endpoint?: string;
  dwellMs?: number;
}) {
  useEffect(() => {
    if (typeof document === "undefined" || typeof navigator === "undefined") return;
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const doc = document as Document & { prerendering?: boolean };

    const send = () => {
      if (sent) return;
      sent = true;
      const body = JSON.stringify({ id: listingId });
      try {
        if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) {
          void fetch(endpoint, {
            method: "POST",
            body,
            keepalive: true,
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
          }).catch(() => undefined);
        }
      } catch {
        /* A count is never worth an error for the reader. */
      }
    };
    const disarm = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const arm = () => {
      if (sent || timer !== undefined || doc.prerendering || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState === "visible") send();
      }, dwellMs);
    };
    const onChange = () => (document.visibilityState === "visible" && !doc.prerendering ? arm() : disarm());

    arm();
    document.addEventListener("visibilitychange", onChange);
    document.addEventListener("prerenderingchange", onChange);
    return () => {
      disarm();
      document.removeEventListener("visibilitychange", onChange);
      document.removeEventListener("prerenderingchange", onChange);
    };
  }, [listingId, endpoint, dwellMs]);
  return null;
}
