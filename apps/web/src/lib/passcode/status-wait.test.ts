import { describe, expect, it, vi } from "vitest";

/**
 * `readPasscodeStatus` with and without a wait (SPEED, 13 November 2026). The
 * Face ID proof asks with a short wait, and a read ended by it is `error`,
 * which never opens anything; the layout's gate asks without one, so a slow
 * moment does not draw the lock for a member who never set a passcode.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("../actions/session", () => ({ resolveSessionClaims: async () => ({ state: "signed-out" }) }));

import { readPasscodeStatus } from "./state";

function client(answer: () => Promise<unknown>) {
  const signals: AbortSignal[] = [];
  const call = Object.assign(answer(), {
    abortSignal: (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError" } })),
      );
    },
  });
  return { signals, supabase: { rpc: () => call } as never };
}

describe("readPasscodeStatus", () => {
  it("is bounded when asked, and an ended read is an error, never unset", async () => {
    const { signals, supabase } = client(() => new Promise(() => {}));
    const started = Date.now();
    expect(await readPasscodeStatus(supabase, { waitMs: 30 })).toEqual({ state: "error" });
    expect(signals).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("puts no extra deadline on the layout's read", async () => {
    const { signals, supabase } = client(async () => ({ data: { state: "unset" }, error: null }));
    expect(await readPasscodeStatus(supabase)).toEqual({ state: "unset" });
    expect(signals).toHaveLength(0);
  });
});
