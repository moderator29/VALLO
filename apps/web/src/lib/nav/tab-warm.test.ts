import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOLD_GIVE_UP_AFTER,
  HOLD_MAX_MS,
  PREFETCH_FRESH_MS,
  WARM_RETRY_MS,
  arrivedAt,
  forgetArrival,
  isFresh,
  mainTabs,
  markWatchingForTests,
  noteArrival,
  resetTabWarmForTests,
  rscPathOf,
  shouldHold,
  tabsToWarm,
  waitForArrival,
} from "./tab-warm";

/*
 * THE MAIN TABS, KEPT READY (the startup track, 13 October 2026). Which tabs
 * are fetched ahead, when a copy counts as fresh (the router's own five
 * minutes), how a route payload is recognised in resource timing, and when a
 * tab tap keeps the current screen up rather than drawing a skeleton.
 */

const ORIGIN = "https://www.vallospaces.com";

beforeEach(() => resetTabWarmForTests());
afterEach(() => {
  vi.useRealTimers();
  resetTabWarmForTests();
});

describe("mainTabs", () => {
  it("is the dock's destinations and Profile, plus Messages, which hides behind More", () => {
    expect(mainTabs("property", true)).toEqual(["/home", "/search", "/messages", "/profile", "/around"]);
    expect(mainTabs("stays", true)).toEqual(["/stays", "/stays/search", "/messages", "/profile", "/around"]);
  });
  it("follows the dock's third slot to Agreements while the social switch is off", () => {
    expect(mainTabs("property", false)).toContain("/agreements");
    expect(mainTabs("property", false)).not.toContain("/around");
  });
});

describe("isFresh", () => {
  it("is the router's own window for a whole prefetch", () => {
    expect(isFresh(undefined, 1_000)).toBe(false);
    expect(isFresh(0, PREFETCH_FRESH_MS - 1)).toBe(true);
    expect(isFresh(0, PREFETCH_FRESH_MS)).toBe(false);
  });
});

describe("tabsToWarm", () => {
  const tabs = mainTabs("property", true);
  const never = () => undefined;

  it("fetches every tab but the one on display when nothing is fresh", () => {
    expect(tabsToWarm(tabs, "/home", 10_000, never, never)).toEqual(["/search", "/messages", "/profile", "/around"]);
  });

  it("skips a fresh copy and a request still on its way", () => {
    const now = 1_000_000;
    const arrived = (p: string) => (p === "/search" ? now - 60_000 : p === "/profile" ? now - PREFETCH_FRESH_MS - 1 : undefined);
    const asked = (p: string) => (p === "/messages" ? now - 2_000 : p === "/around" ? now - WARM_RETRY_MS : undefined);
    expect(tabsToWarm(tabs, "/home", now, arrived, asked)).toEqual(["/profile", "/around"]);
  });
});

describe("rscPathOf", () => {
  it("names the path a route payload was fetched for, keeping its own query", () => {
    expect(rscPathOf(`${ORIGIN}/search?_rsc=abc12`, ORIGIN)).toBe("/search");
    expect(rscPathOf(`${ORIGIN}/search?q=lekki&_rsc=abc12`, ORIGIN)).toBe("/search?q=lekki");
  });
  it("ignores anything that is not a same-origin route payload", () => {
    expect(rscPathOf(`${ORIGIN}/search`, ORIGIN)).toBeNull();
    expect(rscPathOf(`${ORIGIN}/_next/static/chunks/a.js`, ORIGIN)).toBeNull();
    expect(rscPathOf("https://x.supabase.co/rest/v1/listings?_rsc=1", ORIGIN)).toBeNull();
    expect(rscPathOf("::not a url::", "not an origin")).toBeNull();
  });
});

describe("waiting for a copy, and when a tap holds", () => {
  it("never holds where resource timing is not being read", () => {
    expect(shouldHold("/search", Date.now())).toBe(false);
  });

  it("holds only while the copy is not fresh", () => {
    markWatchingForTests();
    const now = Date.now();
    expect(shouldHold("/search", now)).toBe(true);
    noteArrival("/search", now);
    expect(shouldHold("/search", now + 1_000)).toBe(false);
    expect(shouldHold("/search", now + PREFETCH_FRESH_MS)).toBe(true);
    forgetArrival("/search");
    expect(arrivedAt("/search")).toBeUndefined();
    expect(shouldHold("/search", now + 1_000)).toBe(true);
  });

  it("resolves when the copy arrives, and at once for one that already arrived since", async () => {
    const since = Date.now();
    const waiting = waitForArrival("/messages", HOLD_MAX_MS, since);
    noteArrival("/messages", since + 5);
    await expect(waiting).resolves.toBe(true);
    await expect(waitForArrival("/messages", HOLD_MAX_MS, since)).resolves.toBe(true);
  });

  it("gives up after HOLD_MAX_MS, and stops holding after HOLD_GIVE_UP_AFTER such tries in a row", async () => {
    vi.useFakeTimers();
    markWatchingForTests();
    for (let i = 0; i < HOLD_GIVE_UP_AFTER; i += 1) {
      expect(shouldHold("/profile", Date.now())).toBe(true);
      const waiting = waitForArrival("/profile", HOLD_MAX_MS, Date.now());
      await vi.advanceTimersByTimeAsync(HOLD_MAX_MS);
      await expect(waiting).resolves.toBe(false);
    }
    expect(shouldHold("/profile", Date.now())).toBe(false);
    /* A copy arriving again shows the timing works on this link: holding resumes. */
    noteArrival("/home", Date.now());
    expect(shouldHold("/profile", Date.now())).toBe(true);
  });
});

describe("firstInstallWarmPlan", () => {
  it("keeps every main tab but the one on screen, in rail order, each once", async () => {
    const { firstInstallWarmPlan, mainTabs } = await import("./tab-warm");
    expect(firstInstallWarmPlan(mainTabs("property", false), "/home")).toEqual(["/search", "/messages", "/profile", "/agreements"]);
    expect(firstInstallWarmPlan(mainTabs("property", true), "/search?q=lekki")).toEqual(["/home", "/messages", "/profile", "/around"]);
    expect(firstInstallWarmPlan(["/home", "/home", "/messages"], "/elsewhere")).toEqual(["/home", "/messages"]);
  });
});
