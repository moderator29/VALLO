/**
 * THE CONNECTION, AS ONE SHARED ANSWER (Agent NATIVE, job 3; founder's brief
 * section 4: "Vallo should understand the difference between fully connected,
 * slow, unstable, temporarily disconnected and reconnected").
 *
 *   connected    requests land in good time
 *   slow         the phone reports a poor link (2G, a long round trip, a thin
 *                downlink), or this page's own requests are taking long
 *   unstable     requests keep failing while the phone claims a signal
 *                (three in a minute), or the signal keeps dropping and coming back
 *   offline      the phone says so, or two probes in a row could not reach
 *                Vallo at all (a dead data session that still reads "online")
 *   reconnected  the moment after offline or unstable ends; it settles to
 *                connected or slow by itself after `RECONNECTED_MS`
 *
 * THREE SOURCES, NONE OF THEM TRUSTED ALONE. `navigator.onLine` (optimistic:
 * true behind a captive portal or a dead bundle), the Network Information API
 * where the browser has it (Chromium, so Android's web view; WebKit has none),
 * and the real timing of this page's own same-origin requests
 * (`PerformanceObserver`, resource entries) plus the failures the app reports
 * (`noteNetworkFailure`, from `tapFailedOffline` and the signal boundary).
 *
 * THE PROBE. While unstable or "offline by probe", a tiny same-origin request
 * (`HEAD /api/client-error`: no body, no database, never kept by the worker,
 * and any answer at all, even a 405, means Vallo is reachable) is sent on a
 * growing gap. The first answer ends the outage. Nothing is probed while the
 * page is hidden, and nothing at all on a healthy connection.
 *
 * WHAT LISTENS. `useConnection()` (use-connection.ts) for screens; `onConnectionBack()` for work
 * that should run when the signal returns. On reconnect the window also hears
 * `CONNECTION_BACK_EVENT`, so the outbox, the connection line and the offline
 * screen can recover even when the browser never fired `online` (the case the
 * phone lied about).
 *
 * React-free, so the send paths (`send-or-keep.ts`) can report into it from
 * anywhere. Client only: the server render and hydration read "connected", so nothing
 * about the connection is ever painted into the first HTML.
 */

export type ConnectionState = "connected" | "slow" | "unstable" | "offline" | "reconnected";

export const CONNECTION_BACK_EVENT = "vallo:connection-back";

/** How long "reconnected" is said before it settles. Matches ConnectionLine's "back". */
export const RECONNECTED_MS = 2_200;
/** A request slower than this to its first byte counts towards "slow". */
export const SLOW_REQUEST_MS = 2_500;
/** The window failures and drops are counted in. */
export const UNSTABLE_WINDOW_MS = 60_000;
export const UNSTABLE_FAILURES = 3;
export const UNSTABLE_FLAPS = 3;
/** The probe's gaps, growing, and its own timeout. */
export const PROBE_GAPS_MS: readonly number[] = [4_000, 8_000, 15_000, 30_000];
const PROBE_TIMEOUT_MS = 6_000;
const PROBE_URL = "/api/client-error";
const TIMING_SAMPLES = 5;

export type ConnectionSignals = {
  /** `navigator.onLine`. */
  online: boolean;
  /** Probes in a row that could not reach Vallo. */
  probeMisses: number;
  /** Network failures reported in the last `UNSTABLE_WINDOW_MS`. */
  failures: number;
  /** Offline-to-online drops in the last `UNSTABLE_WINDOW_MS`. */
  flaps: number;
  /** The Network Information API, where present. */
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  /** Time to first byte of the last few same-origin requests, ms. */
  timings: readonly number[];
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The steady state the signals describe ("reconnected" is a moment, decided by the store). */
export function classify(s: ConnectionSignals): Exclude<ConnectionState, "reconnected"> {
  if (!s.online || s.probeMisses >= 2) return "offline";
  if (s.failures >= UNSTABLE_FAILURES || s.flaps >= UNSTABLE_FLAPS) return "unstable";
  const type = s.effectiveType ?? "";
  if (type === "slow-2g" || type === "2g") return "slow";
  if ((s.rtt ?? 0) > 1_500 || (s.downlink ?? 10) < 0.4) return "slow";
  if (s.timings.length >= 3 && median(s.timings) > SLOW_REQUEST_MS) return "slow";
  return "connected";
}

/** Whether going from `was` to `now` is a recovery worth saying. */
export function isRecovery(was: ConnectionState, now: Exclude<ConnectionState, "reconnected">): boolean {
  return (was === "offline" || was === "unstable") && (now === "connected" || now === "slow");
}

/* ------------------------------------------------------------- the store */

type NetInfo = { effectiveType?: string; rtt?: number; downlink?: number; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };

let state: ConnectionState = "connected";
let failures: number[] = [];
let flaps: number[] = [];
let timings: number[] = [];
let probeMisses = 0;
let probeStep = 0;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let stopWatch: (() => void) | null = null;
const listeners = new Set<() => void>();
const backListeners = new Set<() => void>();

function netInfo(): NetInfo | undefined {
  try {
    return (navigator as Navigator & { connection?: NetInfo }).connection;
  } catch {
    return undefined;
  }
}

function prune(now: number): void {
  failures = failures.filter((t) => now - t < UNSTABLE_WINDOW_MS);
  flaps = flaps.filter((t) => now - t < UNSTABLE_WINDOW_MS);
}

function signals(now: number): ConnectionSignals {
  prune(now);
  const c = netInfo();
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
    probeMisses,
    failures: failures.length,
    flaps: flaps.length,
    effectiveType: c?.effectiveType,
    rtt: c?.rtt,
    downlink: c?.downlink,
    timings,
  };
}

function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* One listener's fault is its own. */
    }
  }
}

function announceBack(): void {
  for (const l of backListeners) {
    try {
      l();
    } catch {
      /* As above. */
    }
  }
  try {
    window.dispatchEvent(new Event(CONNECTION_BACK_EVENT));
  } catch {
    /* No window: nothing listens. */
  }
}

function recompute(): void {
  const next = classify(signals(Date.now()));
  const was = state;
  if (isRecovery(was, next)) {
    state = "reconnected";
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      state = classify(signals(Date.now()));
      emit();
    }, RECONNECTED_MS);
    emit();
    announceBack();
  } else if (was === "reconnected" && (next === "connected" || next === "slow")) {
    /* Still inside the moment: let it run out. */
  } else if (next !== was) {
    state = next;
    emit();
  }
  scheduleProbe();
}

/* ------------------------------------------------------------- the probe */

function wantsProbe(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  return state === "unstable" || (state === "offline" && navigator.onLine !== false);
}

function scheduleProbe(): void {
  if (!started) return;
  if (!wantsProbe()) {
    if (probeTimer) clearTimeout(probeTimer);
    probeTimer = undefined;
    probeStep = 0;
    return;
  }
  if (probeTimer) return;
  const gap = PROBE_GAPS_MS[Math.min(probeStep, PROBE_GAPS_MS.length - 1)]!;
  probeTimer = setTimeout(() => {
    probeTimer = undefined;
    probeStep += 1;
    void probeNow();
  }, gap);
}

/** Ask Vallo once whether it can be reached. True on any answer at all. */
export async function probeNow(send: typeof fetch = fetch): Promise<boolean> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timeout = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS);
  try {
    await send(`${PROBE_URL}?probe=${Date.now()}`, { method: "HEAD", cache: "no-store", credentials: "omit", signal: controller?.signal });
    noteNetworkSuccess();
    return true;
  } catch {
    probeMisses += 1;
    recompute();
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------------------------------------------------------- the reports */

/** A request died on the network (not a server "no"). */
export function noteNetworkFailure(now: number = Date.now()): void {
  failures.push(now);
  if (failures.length > 20) failures = failures.slice(-20);
  if (started) recompute();
}

/** A request reached Vallo: any outage is over. */
export function noteNetworkSuccess(): void {
  probeMisses = 0;
  failures = [];
  probeStep = 0;
  if (started) recompute();
}

/** One request's time to first byte, ms. */
export function noteRequestTiming(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  timings = [...timings, ms].slice(-TIMING_SAMPLES);
  if (started) recompute();
}

/**
 * The page already knows Vallo could not be reached (the worker served the
 * offline screen in place of the page asked for), whatever the phone's flag
 * says: start from "offline" and let the probe find the way back.
 */
export function assumeUnreachable(): void {
  probeMisses = Math.max(probeMisses, 2);
  ensureStarted();
  recompute();
}

/* ------------------------------------------------------------- the watch */

function startWatch(): () => void {
  const onOnline = () => {
    flaps.push(Date.now());
    probeMisses = 0;
    recompute();
  };
  const onOffline = () => recompute();
  const onVisible = () => {
    if (document.visibilityState === "visible") recompute();
  };
  const c = netInfo();
  const onNet = () => recompute();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  c?.addEventListener?.("change", onNet);

  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (entry.initiatorType !== "fetch" && entry.initiatorType !== "xmlhttprequest") continue;
        if (!entry.name.startsWith(location.origin) || entry.name.includes("probe=")) continue;
        /* A served answer from the worker's cache has no network time to read. */
        if (entry.responseStart <= 0 || entry.requestStart <= 0) continue;
        timings = [...timings, entry.responseStart - entry.requestStart].slice(-TIMING_SAMPLES);
        probeMisses = 0;
      }
      recompute();
    });
    observer.observe({ type: "resource", buffered: false });
  } catch {
    observer = null;
  }

  recompute();
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    c?.removeEventListener?.("change", onNet);
    observer?.disconnect();
  };
}

function ensureStarted(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  stopWatch = startWatch();
}

/** The current answer. "connected" until the watch has started. */
export function getConnection(): ConnectionState {
  return state;
}

export function subscribeConnection(listener: () => void): () => void {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Run `listener` each time the connection comes back after an outage. Returns the stop. */
export function onConnectionBack(listener: () => void): () => void {
  ensureStarted();
  backListeners.add(listener);
  return () => {
    backListeners.delete(listener);
  };
}

/** For tests: forget everything. */
export function resetConnectionForTests(): void {
  stopWatch?.();
  stopWatch = null;
  started = false;
  state = "connected";
  failures = [];
  flaps = [];
  timings = [];
  probeMisses = 0;
  probeStep = 0;
  if (probeTimer) clearTimeout(probeTimer);
  if (settleTimer) clearTimeout(settleTimer);
  probeTimer = undefined;
  settleTimer = undefined;
  listeners.clear();
  backListeners.clear();
}
