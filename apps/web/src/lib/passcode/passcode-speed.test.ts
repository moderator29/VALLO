import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE PASSCODE CHECK, FAST AND NEVER STUCK (SPEED, 13 November 2026, the
 * founder: "I have been clicking passcode and it stuck there").
 *
 *   - the two pacing counts are asked together (one round trip, not two);
 *   - `passcode_verify` is given a deadline, and a check the database never
 *     answered comes back as `error` (which the lock asks again under the
 *     same attempt id) instead of holding the request open;
 *   - on the phone, an ask with no answer at all counts as lost after
 *     ATTEMPT_WAIT_MS and is asked again, then said as unreachable.
 */
const s = vi.hoisted(() => ({
  started: [] as string[],
  release: [] as (() => void)[],
  rpcArgs: [] as unknown[],
  signals: [] as AbortSignal[],
  rpcHangs: false,
}));

vi.mock("./state", () => ({
  readPasscodeSession: async () => ({
    state: "signed-in",
    userId: "user-1",
    amr: null,
    supabase: {
      rpc: (fn: string, args: unknown) => {
        s.rpcArgs.push({ fn, args });
        return {
          abortSignal: (signal: AbortSignal) => {
            s.signals.push(signal);
            if (!s.rpcHangs) return Promise.resolve({ data: { status: "ok" }, error: null });
            /* What postgrest-js does with an aborted fetch: an error answer, not a throw. */
            return new Promise((resolve) =>
              signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError: The operation was aborted", code: "" } })),
            );
          },
        };
      },
      auth: { signOut: async () => ({ error: null }) },
    },
  }),
  writeUnlock: async () => true,
  clearUnlock: async () => undefined,
  writeResetIntent: async () => undefined,
  clearResetIntent: async () => undefined,
}));
vi.mock("../security/rate-limit", () => ({
  subjectForUser: (id: string) => `user:${id}`,
  subjectForIp: (ip: string) => `ip:${ip}`,
  ipFromHeaders: () => "203.0.113.9",
  consume: (request: { bucket: string }) => {
    s.started.push(request.bucket);
    return new Promise((resolve) => s.release.push(() => resolve({ allowed: true, degraded: false })));
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));

import { verifyPasscodeAction } from "./actions";
import { ATTEMPT_WAIT_MS, verifyPatiently } from "./patient-verify";

const ATTEMPT = "0b6f3c8e-6a52-4c1e-9d0a-2b7f1e4c5a90";

beforeEach(() => {
  s.started = [];
  s.release = [];
  s.rpcArgs = [];
  s.signals = [];
  s.rpcHangs = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("verifyPasscodeAction", () => {
  it("asks both pacing counts before either has answered", async () => {
    const pending = verifyPasscodeAction("480913", ATTEMPT);
    await vi.waitFor(() => expect(s.started).toEqual(["passcode_verify_user", "passcode_verify_ip"]));
    /* Nothing reached the database's check while the counts were out. */
    expect(s.rpcArgs).toEqual([]);
    s.release.forEach((go) => go());
    expect(await pending).toEqual({ status: "ok" });
    expect(s.rpcArgs).toEqual([{ fn: "passcode_verify", args: { p_code: "480913", p_attempt: ATTEMPT } }]);
    expect(s.signals).toHaveLength(1);
  });

  it("answers a stalled database with a retryable error at the deadline, not a hang", async () => {
    vi.useFakeTimers();
    s.rpcHangs = true;
    let settled: unknown = "pending";
    const pending = verifyPasscodeAction("480913", ATTEMPT).then((r) => (settled = r));
    await vi.waitFor(() => expect(s.release).toHaveLength(2));
    s.release.forEach((go) => go());
    await vi.advanceTimersByTimeAsync(5_900);
    expect(settled).toBe("pending");
    await vi.advanceTimersByTimeAsync(200);
    await pending;
    expect(settled).toEqual({ status: "error" });
  });
});

describe("verifyPatiently on the phone", () => {
  it("counts an ask with no answer as lost, asks again under the same attempt id, then says unreachable", async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const retries: number[] = [];
    const result = verifyPatiently(
      {
        verify: async (_code, attemptId) => {
          asked.push(attemptId);
          return new Promise(() => {});
        },
        isOnline: () => true,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onRetry: (n) => retries.push(n),
        gaps: [100, 100],
        attemptMs: 1_000,
      },
      "480913",
      ATTEMPT,
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(retries).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(retries).toEqual([1]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await result).toEqual({ status: "unreachable" });
    expect(asked).toEqual([ATTEMPT, ATTEMPT, ATTEMPT]);
    expect(retries).toEqual([1, 2]);
  });

  it("takes a real answer that arrives inside the wait", async () => {
    const result = await verifyPatiently(
      { verify: async () => ({ status: "ok" }), isOnline: () => true, sleep: async () => undefined },
      "480913",
      ATTEMPT,
    );
    expect(result).toEqual({ status: "ok" });
  });

  it("waits ten seconds by default, longer than the server's own bound", () => {
    expect(ATTEMPT_WAIT_MS).toBe(10_000);
  });
});
