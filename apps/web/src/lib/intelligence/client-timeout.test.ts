import { afterEach, describe, expect, it, vi } from "vitest";
import { INTEL_FETCH_TIMEOUT_MS, IntelFetchError, fetchDiscover, fetchSearch } from "./client";

/**
 * A READ THAT NEVER ANSWERS ENDS (16 November 2026). On a dead connection a
 * request can stay open for minutes, and VALLO Intelligence's skeleton waited
 * with it. Past `INTEL_FETCH_TIMEOUT_MS` it is a failure the screen shows
 * (with Retry), never an AbortError, which the screen ignores as "a newer
 * search replaced this one". The caller's own abort still is one.
 */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  );
}

describe("VALLO Intelligence's reads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a read that never answers fails after the timeout, as a failure the screen shows", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const read = fetchDiscover();
    const caught = read.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(INTEL_FETCH_TIMEOUT_MS + 1);
    const error = await caught;
    expect(error).toBeInstanceOf(IntelFetchError);
    expect((error as { name?: string }).name).not.toBe("AbortError");
  });

  it("the caller's own abort stays an AbortError, and clears the timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const read = fetchSearch({ q: "lekki", tab: "all", filters: {}, drop: [] }, undefined, controller.signal).catch((error: unknown) => error);
    controller.abort();
    const error = await read;
    expect((error as { name?: string }).name).toBe("AbortError");
    expect(vi.getTimerCount()).toBe(0);
  });
});
