"use client";

import { useEffect } from "react";
import { sampleRateAt } from "@/lib/observability/vitals";
import { keptCopyKind } from "@/lib/offline/page-cache";

/* One stage of the boot trace (`name@ms`, written by the startup scripts), in ms. */
function bootStage(trace: unknown, match: RegExp): number | undefined {
  if (!Array.isArray(trace)) return undefined;
  for (const item of trace) {
    if (typeof item !== "string") continue;
    const at = item.lastIndexOf("@");
    if (at < 1 || !match.test(item.slice(0, at))) continue;
    const ms = Number(item.slice(at + 1));
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  return undefined;
}

/**
 * FIELD SPEED, FROM THE PHONE IN THE PERSON'S HAND. V-80.
 *
 * One page view in ten measures itself with the browser's own
 * PerformanceObserver (no library): Largest Contentful Paint, Cumulative
 * Layout Shift, Interaction to Next Paint (the slowest interaction seen),
 * First Contentful Paint and Time to First Byte, plus the kilobytes the page
 * could measure. When the page is hidden it sends one beacon to `/api/vitals`
 * with the path (the server reduces it to a template), the connection class
 * and Save-Data. Nothing identifies the person. Renders nothing.
 *
 * COLD START (fast-start plan item 1, 31 October 2026). The sample also says
 * whether this was the first load of the session (`cold`: the startup gate
 * writes `window.__nfCold`), how the document reached the screen
 * (`startKind`: the network, or the phone's own copy, instant, frugal or
 * kept), and two boot figures from the startup trace: BOOT_HIDE (the native
 * splash's hide answered) and BOOT_OPEN (the opening done or skipped). They
 * are measured from the page's own start, so the native process launch before
 * the page exists is NOT in them: that part is only a device stopwatch.
 */
export function VitalsReporter() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    /* A cold start (the first load of a session) always reports: it is the rare,
       slow case the plan needs numbers for, and one in ten would leave too few. */
    const cold = (window as unknown as { __nfCold?: number }).__nfCold === 1;
    if (!cold && Math.random() >= sampleRateAt(Date.now())) return;
    const metrics: Record<string, number> = {};
    const observers: PerformanceObserver[] = [];
    const observe = (type: string, onEntry: (entry: PerformanceEntry) => void) => {
      try {
        const po = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
        po.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(po);
      } catch {
        /* This browser does not report that metric. */
      }
    };
    observe("largest-contentful-paint", (e) => (metrics.LCP = e.startTime));
    observe("layout-shift", (e) => {
      const shift = e as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      if (!shift.hadRecentInput) metrics.CLS = (metrics.CLS ?? 0) + (shift.value ?? 0);
    });
    observe("event", (e) => (metrics.INP = Math.max(metrics.INP ?? 0, e.duration)));
    observe("paint", (e) => {
      if (e.name === "first-contentful-paint") metrics.FCP = e.startTime;
    });

    let sent = false;
    const send = () => {
      if (sent || document.visibilityState !== "hidden") return;
      sent = true;
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav) metrics.TTFB = nav.responseStart;
        const trace = (window as unknown as { __nfBoot?: unknown }).__nfBoot;
        const hide = bootStage(trace, /^hide:answered:/);
        if (hide !== undefined) metrics.BOOT_HIDE = hide;
        const open = bootStage(trace, /^opening:(done|skipped|settled)$/);
        if (open !== undefined) metrics.BOOT_OPEN = open;
        const bytes = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).reduce(
          (sum, r) => sum + (r.transferSize ?? 0),
          nav?.transferSize ?? 0,
        );
        const link = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
        const body = JSON.stringify({
          path: window.location.pathname,
          metrics,
          effectiveType: link?.effectiveType,
          saveData: link?.saveData === true || document.documentElement.dataset.saveData === "on",
          transferKb: bytes / 1024,
          cold,
          startKind: keptCopyKind() ?? "network",
        });
        navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "application/json" }));
      } catch {
        /* One sample lost. */
      }
    };
    document.addEventListener("visibilitychange", send);
    return () => {
      document.removeEventListener("visibilitychange", send);
      observers.forEach((po) => po.disconnect());
    };
  }, []);
  return null;
}
