import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TURNING THE PASSCODE OFF, ON THE SERVER (13 November 2026, the founder:
 * "same as Face ID, build it end to end"). Supabase is mocked: what is checked
 * is that only a right code (counted and paced exactly as the lock counts it)
 * removes the lock, that the removal deletes the member's own row with the
 * service client and clears this browser's unlock and reset cookies, that the
 * platform keys the money lock uses are left alone, and that a turned-off
 * passcode cannot be enforced by a stale unlock cookie.
 */
const s = vi.hoisted(() => ({
  signedIn: true,
  rpc: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  wrote: [] as string[],
  deletes: [] as { table: string; eq: [string, string] }[],
  inserts: [] as { table: string; row: unknown }[],
  deleteError: null as null | { message: string },
}));

vi.mock("./state", () => ({
  readPasscodeSession: async () =>
    s.signedIn ? { state: "signed-in", userId: "user-1", amr: null, supabase: { rpc: s.rpc, auth: { signOut: s.signOut } } } : { state: "signed-out" },
  writeUnlock: async (userId: string) => {
    s.wrote.push(`unlock:${userId}`);
    return true;
  },
  clearUnlock: async () => {
    s.wrote.push("clear-unlock");
  },
  writeResetIntent: async () => undefined,
  clearResetIntent: async () => {
    s.wrote.push("clear-reset-intent");
  },
}));
vi.mock("../security/money-step-up", () => ({
  admin: () => ({
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, value: string) => {
          s.deletes.push({ table, eq: [column, value] });
          return { error: s.deleteError };
        },
      }),
      insert: async (row: unknown) => {
        s.inserts.push({ table, row });
        return { error: null };
      },
    }),
  }),
}));
vi.mock("../security/rate-limit", () => ({
  subjectForUser: (id: string) => `user:${id}`,
  subjectForIp: (ip: string) => `ip:${ip}`,
  ipFromHeaders: () => "203.0.113.9",
  consume: async () => ({ allowed: true, degraded: false }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("server-only", () => ({}));

import { turnOffPasscodeAction } from "./actions";
import { decideGate } from "./decide";

beforeEach(() => {
  s.signedIn = true;
  s.rpc.mockReset();
  s.signOut.mockClear();
  s.wrote = [];
  s.deletes = [];
  s.inserts = [];
  s.deleteError = null;
});

describe("turnOffPasscodeAction", () => {
  it("a right code removes the member's own lock row, clears this browser's cookies, and writes no unlock", async () => {
    s.rpc.mockResolvedValue({ data: { status: "ok", length: 6 }, error: null });
    expect(await turnOffPasscodeAction("480913")).toEqual({ ok: true });
    expect(s.rpc).toHaveBeenCalledWith("passcode_verify", { p_code: "480913" });
    expect(s.deletes).toEqual([{ table: "member_passcodes", eq: ["user_id", "user-1"] }]);
    expect(s.wrote).toEqual(["clear-unlock", "clear-reset-intent"]);
    expect(s.inserts).toEqual([{ table: "audit_log", row: { actor_id: "user-1", action: "passcode.off", entity_type: "user", entity_id: "user-1", metadata: { proof: "code" } } }]);
  });

  it("leaves the platform keys alone: the money lock still uses them", async () => {
    s.rpc.mockResolvedValue({ data: { status: "ok", length: 6 }, error: null });
    await turnOffPasscodeAction("480913");
    expect(s.deletes.map((d) => d.table)).not.toContain("money_credentials");
  });

  it("a wrong code is counted as the lock counts it and removes nothing", async () => {
    s.rpc.mockResolvedValue({ data: { status: "wrong", failed_count: 3 }, error: null });
    expect(await turnOffPasscodeAction("999990")).toEqual({ ok: false, reason: "wrong", attempt: { status: "wrong", beforeCooldown: 2, beforeSignOut: 7 } });
    expect(s.deletes).toEqual([]);
    expect(s.wrote).toEqual([]);
  });

  it("never sends a malformed code, and never turns anything off for one", async () => {
    expect((await turnOffPasscodeAction("12a456")).ok).toBe(false);
    expect((await turnOffPasscodeAction("")).ok).toBe(false);
    expect(s.rpc).not.toHaveBeenCalled();
    expect(s.deletes).toEqual([]);
  });

  it("the tenth wrong try ends the session, as at the lock, and removes nothing", async () => {
    s.rpc.mockResolvedValue({ data: { status: "reset_required", failed_count: 10 }, error: null });
    expect(await turnOffPasscodeAction("999990")).toEqual({ ok: false, reason: "locked-out" });
    expect(s.signOut).toHaveBeenCalled();
    expect(s.deletes).toEqual([]);
  });

  it("refuses a signed-out caller, and says when there is nothing to turn off", async () => {
    s.signedIn = false;
    expect(await turnOffPasscodeAction("480913")).toEqual({ ok: false, reason: "signed-out" });
    s.signedIn = true;
    s.rpc.mockResolvedValue({ data: { status: "unset" }, error: null });
    expect(await turnOffPasscodeAction("480913")).toEqual({ ok: false, reason: "not-set" });
    expect(s.deletes).toEqual([]);
  });

  it("a failed removal is reported, not claimed", async () => {
    s.rpc.mockResolvedValue({ data: { status: "ok", length: 6 }, error: null });
    s.deleteError = { message: "boom" };
    expect(await turnOffPasscodeAction("480913")).toEqual({ ok: false, reason: "error" });
  });
});

describe("after it is off", () => {
  it("a stale unlock cookie cannot enforce anything: with no passcode the gate shows the page", () => {
    for (const unlockCookieValid of [true, false]) {
      expect(decideGate({ signedIn: true, status: { state: "unset" }, unlockCookieValid, freshUnlock: false, freshReset: false, resetIntent: false })).toEqual({ kind: "unset" });
    }
  });
});
