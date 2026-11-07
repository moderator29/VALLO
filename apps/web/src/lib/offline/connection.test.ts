import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTION_BACK_EVENT,
  RECONNECTED_MS,
  assumeUnreachable,
  classify,
  getConnection,
  isRecovery,
  noteNetworkFailure,
  noteNetworkSuccess,
  noteRequestTiming,
  onConnectionBack,
  probeNow,
  resetConnectionForTests,
  subscribeConnection,
  type ConnectionSignals,
} from "./connection";

const calm: ConnectionSignals = { online: true, probeMisses: 0, failures: 0, flaps: 0, timings: [] };

describe("the five connection states", () => {
  it("tells connected, slow, unstable and offline apart", () => {
    expect(classify(calm)).toBe("connected");
    expect(classify({ ...calm, online: false })).toBe("offline");
    expect(classify({ ...calm, probeMisses: 2 })).toBe("offline");
    expect(classify({ ...calm, failures: 3 })).toBe("unstable");
    expect(classify({ ...calm, flaps: 3 })).toBe("unstable");
    expect(classify({ ...calm, effectiveType: "2g" })).toBe("slow");
    expect(classify({ ...calm, rtt: 2000 })).toBe("slow");
    expect(classify({ ...calm, downlink: 0.2 })).toBe("slow");
    expect(classify({ ...calm, timings: [3000, 2800, 4000] })).toBe("slow");
    /* Two slow requests are not yet a slow connection, and data saver is a choice, not a speed. */
    expect(classify({ ...calm, timings: [3000, 3000] })).toBe("connected");
    expect(classify({ ...calm, effectiveType: "4g" })).toBe("connected");
  });

  it("only an outage ending is a recovery", () => {
    expect(isRecovery("offline", "connected")).toBe(true);
    expect(isRecovery("unstable", "slow")).toBe(true);
    expect(isRecovery("slow", "connected")).toBe(false);
    expect(isRecovery("connected", "connected")).toBe(false);
    expect(isRecovery("offline", "unstable")).toBe(false);
  });
});

describe("the shared store", () => {
  let win: EventTarget & { location: { origin: string } };
  let nav: { onLine: boolean };
  beforeEach(() => {
    vi.useFakeTimers();
    win = Object.assign(new EventTarget(), { location: { origin: "https://www.vallospaces.com" } });
    nav = { onLine: true };
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("location", win.location);
  });
  afterEach(() => {
    resetConnectionForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("three lost requests in a minute is unstable; the next answer is a reconnect, then it settles", () => {
    const seen: string[] = [];
    subscribeConnection(() => seen.push(getConnection()));
    let back = 0;
    win.addEventListener(CONNECTION_BACK_EVENT, () => (back += 1));
    noteNetworkFailure();
    noteNetworkFailure();
    expect(getConnection()).toBe("connected");
    noteNetworkFailure();
    expect(getConnection()).toBe("unstable");
    noteNetworkSuccess();
    expect(getConnection()).toBe("reconnected");
    expect(back).toBe(1);
    vi.advanceTimersByTime(RECONNECTED_MS + 10);
    expect(getConnection()).toBe("connected");
    expect(seen).toEqual(["unstable", "reconnected", "connected"]);
  });

  it("the phone's own offline and online, and a slow run of requests", () => {
    subscribeConnection(() => {});
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(getConnection()).toBe("offline");
    nav.onLine = true;
    win.dispatchEvent(new Event("online"));
    expect(getConnection()).toBe("reconnected");
    vi.advanceTimersByTime(RECONNECTED_MS + 10);
    for (const ms of [3200, 2900, 3500]) noteRequestTiming(ms);
    expect(getConnection()).toBe("slow");
  });

  it("a page that knows Vallo was unreachable probes on a gap and recovers on the first answer", async () => {
    const answered = vi.fn(async () => new Response(null, { status: 405 }));
    vi.stubGlobal("fetch", answered);
    const back = vi.fn();
    onConnectionBack(back);
    assumeUnreachable();
    expect(getConnection()).toBe("offline");
    await vi.advanceTimersByTimeAsync(4_100);
    expect(answered).toHaveBeenCalledTimes(1);
    const [url, init] = answered.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^\/api\/client-error\?probe=\d+$/);
    expect(init.method).toBe("HEAD");
    expect(back).toHaveBeenCalledTimes(1);
    expect(getConnection()).toBe("reconnected");
  });

  it("a probe that cannot connect says so and never throws", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await probeNow(down)).toBe(false);
  });
});
