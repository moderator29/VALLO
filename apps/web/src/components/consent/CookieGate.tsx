"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CookiesCopy } from "./CookieConsent";
import { readConsent } from "@/lib/consent/consent";

const CookieConsent = dynamic(() => import("./CookieConsent"), { ssr: false });

/**
 * FIRST VISIT: the cookie bar, loaded lazily and only when there is no valid
 * choice. The root layout mounts this ONLY when the request carries no current
 * `vallo_consent` cookie, so a returning visitor ships none of it. It waits for
 * the browser to be idle after the page has painted, so it never competes with
 * the first screen (apps/web/perf-budget.json), and it rechecks the cookie in
 * the browser in case another tab already answered.
 */
export function CookieGate({ copy }: { copy: CookiesCopy }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (readConsent()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let timer: number | undefined;
    let idle: number | undefined;
    const open = () => setShow(true);
    const later = () => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(open, { timeout: 4000 });
      else timer = window.setTimeout(open, 2000);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      window.removeEventListener("load", later);
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  if (!show) return null;
  return <CookieConsent copy={copy} start="bar" onDone={() => setShow(false)} />;
}
