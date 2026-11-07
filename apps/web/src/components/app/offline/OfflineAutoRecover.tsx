"use client";

import { useEffect } from "react";
import { assumeUnreachable, onConnectionBack } from "@/lib/offline/connection";

/**
 * THE OFFLINE SCREEN COMES BACK BY ITSELF, EVEN WHEN THE PHONE LIED (Agent
 * NATIVE, job 3). Renders nothing.
 *
 * `RetryButton` already tries again on the browser's `online` event. On a dead
 * mobile data session the phone never sends one: it reports a signal the whole
 * time. So this tells the shared connection state that Vallo could not be
 * reached (the worker served this screen in place of the page), which starts
 * its small probe on a growing gap (4, 8, 15, then every 30 seconds, never
 * while the screen is hidden), and the first answer from Vallo loads the page
 * that was asked for. At `/offline` itself, Home instead, as RetryButton does.
 */
export function OfflineAutoRecover() {
  useEffect(() => {
    assumeUnreachable();
    return onConnectionBack(() => {
      /* A full load on purpose: the client router cannot fetch a payload for
         a page the worker never kept, and the worker answers a full load. */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (window.location.pathname.replace(/\/+$/, "") === "/offline") window.location.assign("/home");
      else window.location.reload();
    });
  }, []);
  return null;
}
