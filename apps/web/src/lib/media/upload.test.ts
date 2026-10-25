import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "./upload";

describe("withTimeout", () => {
  it("rejects when the work never settles", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => {}), 1000);
    const caught = pending.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await caught).toBe("timeout");
    vi.useRealTimers();
  });
  it("passes the value through when the work settles in time", async () => {
    expect(await withTimeout(Promise.resolve(7), 1000)).toBe(7);
  });
});
