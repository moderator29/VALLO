import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FACE ID IN ONE ROUND TRIP EACH WAY (SPEED, 13 November 2026).
 *
 * begin:  the key list and the new challenge are asked together, and the
 *         caller is identified from the verified token (no GoTrue trip).
 * finish: the pacing count, the passcode's state, the key and the challenge
 *         are all asked before any of them has answered; the key's counter
 *         is written after the response, never on the way to it; and an
 *         answer that disagrees (the wrong purpose) still refuses.
 * off:    turning the lock off keeps the GoTrue check.
 */
const SESSION = "11111111-2222-3333-4444-555555555555";
const digest = (purpose: string) => createHash("sha256").update(`${purpose}:${SESSION}`).digest("hex");
const token = `x.${Buffer.from(JSON.stringify({ session_id: SESSION })).toString("base64url")}.y`;

const s = vi.hoisted(() => ({
  started: [] as string[],
  gates: [] as (() => void)[],
  hold: false,
  boundTo: "",
  getUser: 0,
  updates: [] as unknown[],
  later: [] as (() => unknown)[],
  unlocked: [] as string[],
}));

/** A database answer that waits for the test when `s.hold` is set. */
function answer<T>(name: string, value: T): Promise<T> {
  s.started.push(name);
  if (!s.hold) return Promise.resolve(value);
  return new Promise((resolve) => s.gates.push(() => resolve(value)));
}

vi.mock("next/server", () => ({ after: (work: () => unknown) => void s.later.push(work) }));
vi.mock("../actions/session", () => ({
  resolveSession: async () => {
    s.getUser += 1;
    return {
      state: "signed-in",
      user: { id: "user-1" },
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } },
    };
  },
  resolveSessionClaims: async () => ({
    state: "signed-in",
    userId: "user-1",
    supabase: { auth: { getClaims: async () => ({ data: { claims: { sub: "user-1", session_id: SESSION } }, error: null }) } },
  }),
}));
vi.mock("../supabase/service", () => ({ isServiceConfigured: () => true }));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => answer("key", { data: { id: "k1", public_key_spki: "AA", alg: -7, sign_count: 0 } }) }) }),
      }),
      update: (values: unknown) => ({
        eq: async () => {
          s.updates.push(values);
          return {};
        },
      }),
    }),
  }),
}));
vi.mock("../security/rate-limit", () => ({
  consume: () => answer("count", { allowed: true, degraded: false }),
  subjectForUser: (id: string) => id,
}));
vi.mock("../security/money-step-up", () => ({
  ceremonyOrigin: async () => ({ origin: "https://www.vallospaces.com", rpId: "www.vallospaces.com" }),
  listCredentialIds: () => answer("list", ["cred"]),
  mintChallenge: () => answer("mint", "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA"),
  takeChallenge: () => answer("take", s.boundTo),
}));
vi.mock("../security/webauthn", () => ({ b64urlToBuffer: () => Buffer.alloc(1), verifyAssertion: () => ({ ok: true, signCount: 7 }) }));
vi.mock("./state", () => ({
  readPasscodeStatus: () => answer("status", { state: "set", length: 6, failedCount: 0, lockedUntil: null }),
  writeUnlock: async (u: string) => {
    s.unlocked.push(u);
    return true;
  },
}));
vi.mock("./turn-off", () => ({ turnPasscodeOff: async () => true }));

import { beginPasskeyUnlock, finishPasscodeOffWithKey, finishPasskeyUnlock } from "./passkey-unlock";

const proof = {
  challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA",
  credentialId: "AQIDBAUGBwgJCgsMDQ4PEA",
  clientDataJSON: "abcdefghijkl",
  authenticatorData: "abcdefghijkl",
  signature: "abcdefghijkl",
};

beforeEach(() => {
  s.started = [];
  s.gates = [];
  s.hold = false;
  s.boundTo = digest("passcode-unlock");
  s.getUser = 0;
  s.updates = [];
  s.later = [];
  s.unlocked = [];
});

describe("beginPasskeyUnlock", () => {
  it("asks for the key list and the challenge together, with no GoTrue trip", async () => {
    s.hold = true;
    const pending = beginPasskeyUnlock();
    await vi.waitFor(() => expect(s.started.sort()).toEqual(["list", "mint"]));
    s.gates.forEach((go) => go());
    expect((await pending).state).toBe("ready");
    expect(s.getUser).toBe(0);
  });
});

describe("finishPasskeyUnlock", () => {
  it("asks all four database questions before any has answered", async () => {
    s.hold = true;
    const pending = finishPasskeyUnlock(proof);
    await vi.waitFor(() => expect([...s.started].sort()).toEqual(["count", "key", "status", "take"]));
    s.gates.forEach((go) => go());
    expect(await pending).toEqual({ ok: true, data: null });
    expect(s.unlocked).toEqual(["user-1"]);
    expect(s.getUser).toBe(0);
  });

  it("writes the key's counter after the response, not before it", async () => {
    expect(await finishPasskeyUnlock(proof)).toEqual({ ok: true, data: null });
    expect(s.updates).toEqual([]);
    expect(s.later).toHaveLength(1);
    await s.later[0]!();
    expect(s.updates).toEqual([expect.objectContaining({ sign_count: 7 })]);
  });

  it("still refuses a proof made for another purpose, and writes nothing", async () => {
    s.boundTo = digest("passcode-off");
    expect((await finishPasskeyUnlock(proof)).ok).toBe(false);
    expect(s.unlocked).toEqual([]);
    expect(s.later).toEqual([]);
  });
});

describe("turning the lock off with Face ID", () => {
  it("keeps the GoTrue check", async () => {
    s.boundTo = digest("passcode-off");
    expect(await finishPasscodeOffWithKey(proof)).toEqual({ ok: true, data: null });
    expect(s.getUser).toBe(1);
  });
});
