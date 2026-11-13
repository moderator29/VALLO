import { describe, expect, it, vi } from "vitest";
import { CHUNK_GRACE_MS, CHUNK_RELOAD_KEY, STARTUP_NATIVE_SCRIPT } from "./startup-script";

/**
 * A SCRIPT FILE OF OURS THAT DID NOT ARRIVE (13 November 2026, the founder on a
 * weak signal: "This screen did not load"). Measured on production with the
 * first request for three of the page's script files dropped: without this the
 * page never became interactive (hydrated: false after 9s); with it the page
 * loaded itself once and came alive (hydrated: true). Adding the same script
 * again was measured too and did not wake the page, so the answer is ONE
 * controlled reload, guarded so it can never loop: once a minute per address,
 * which also carries a page whose file a deploy replaced onto the new build
 * once and then stops.
 *
 * The retry piece of the head script is run here against a small fake window.
 */
const RETRY = STARTUP_NATIVE_SCRIPT.slice(STARTUP_NATIVE_SCRIPT.lastIndexOf("(function(){try{var W=window,D=document,armed=0;"));

function page(opts: { store: Map<string, string>; now: number; path?: string; hydrated?: boolean }) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const timers: (() => void)[] = [];
  const reload = vi.fn();
  const W: Record<string, unknown> = {
    __nfOpenReady: opts.hydrated ?? false,
    addEventListener: (n: string, f: (e: unknown) => void) => (listeners[n] ??= []).push(f),
  };
  const D = { readyState: "complete" };
  const sessionStorage = { getItem: (k: string) => opts.store.get(k) ?? null, setItem: (k: string, v: string) => void opts.store.set(k, v) };
  const location = { pathname: opts.path ?? "/home", reload };
  new Function("window", "document", "sessionStorage", "location", "setTimeout", "Date", RETRY)(
    W,
    D,
    sessionStorage,
    location,
    (f: () => void, ms: number) => {
      expect(ms).toBe(CHUNK_GRACE_MS);
      timers.push(f);
    },
    { now: () => opts.now },
  );
  const fail = (src: string, tagName = "SCRIPT") => listeners.error?.forEach((f) => f({ target: { tagName, src } }));
  const settle = () => timers.splice(0).forEach((f) => f());
  return { W, fail, settle, reload };
}

const CHUNK = "https://www.vallospaces.com/_next/static/immutable/chunks/3gw4krc1jurw9.js";

describe("a script file of ours that failed to download", () => {
  it("loads the page again once, after the grace, when the page has not come alive", () => {
    const store = new Map<string, string>();
    const p = page({ store, now: 1_000_000 });
    p.fail(CHUNK);
    p.fail(CHUNK.replace("3gw4", "9zzz"));
    expect(p.reload).not.toHaveBeenCalled();
    p.settle();
    expect(p.reload).toHaveBeenCalledTimes(1);
    expect(store.get(CHUNK_RELOAD_KEY)).toBe("/home@1000000");
  });

  it("does nothing when the page came alive anyway", () => {
    const p = page({ store: new Map(), now: 1_000_000, hydrated: true });
    p.fail(CHUNK);
    p.settle();
    expect(p.reload).not.toHaveBeenCalled();
  });

  it("never loops: the reloaded page failing again inside the minute stays put, and may reload once more after it", () => {
    const store = new Map<string, string>();
    const first = page({ store, now: 1_000_000 });
    first.fail(CHUNK);
    first.settle();
    expect(first.reload).toHaveBeenCalledTimes(1);

    /* The reload landed, and a file is still missing (a deploy replaced it, or the signal is still bad). */
    const second = page({ store, now: 1_000_000 + 30_000 });
    second.fail(CHUNK);
    second.settle();
    expect(second.reload).not.toHaveBeenCalled();

    const later = page({ store, now: 1_000_000 + 61_000 });
    later.fail(CHUNK);
    later.settle();
    expect(later.reload).toHaveBeenCalledTimes(1);
  });

  it("a guard for another address does not stop this one", () => {
    const store = new Map<string, string>([[CHUNK_RELOAD_KEY, "/search@1000000"]]);
    const p = page({ store, now: 1_000_010, path: "/home" });
    p.fail(CHUNK);
    p.settle();
    expect(p.reload).toHaveBeenCalledTimes(1);
  });

  it("ignores everything that is not one of our script files", () => {
    const p = page({ store: new Map(), now: 1_000_000 });
    p.fail("https://maps.example.com/tiles.js");
    p.fail(CHUNK, "IMG");
    p.fail("https://www.vallospaces.com/_next/static/media/photo.webp", "IMG");
    p.settle();
    expect(p.reload).not.toHaveBeenCalled();
  });

  it("creates nothing on the page: no element, no markup, only a flag and a reload", () => {
    expect(RETRY).not.toMatch(/createElement|innerHTML|appendChild|<img/);
  });
});
