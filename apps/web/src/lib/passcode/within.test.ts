import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_ANSWER, withinMs } from "./within";

/** The lock's bounded wait (SPEED, 13 November 2026). */
afterEach(() => {
  vi.useRealTimers();
});

describe("withinMs", () => {
  it("gives the answer when it comes in time", async () => {
    expect(await withinMs(Promise.resolve("ok"), 1_000)).toBe("ok");
  });

  it("gives NO_ANSWER at the deadline when the work never answers", async () => {
    vi.useFakeTimers();
    let got: unknown = "pending";
    const waiting = withinMs(new Promise(() => {}), 1_000).then((value) => (got = value));
    await vi.advanceTimersByTimeAsync(999);
    expect(got).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(got).toBe(NO_ANSWER);
  });

  it("drops a failure that arrives after the deadline, without an unhandled rejection", async () => {
    vi.useFakeTimers();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    let fail: (reason: unknown) => void = () => undefined;
    const late = new Promise((_, reject) => (fail = reject));
    const waiting = withinMs(late, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await waiting).toBe(NO_ANSWER);
    fail(new Error("too late"));
    await vi.advanceTimersByTimeAsync(10);
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("clears its timer when the answer comes first", async () => {
    vi.useFakeTimers();
    await withinMs(Promise.resolve(1), 60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
