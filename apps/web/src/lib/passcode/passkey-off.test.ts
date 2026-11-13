import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FACE ID TURNS THE PASSCODE OFF ONLY WITH A PROOF MADE FOR THAT (13 November
 * 2026). The proof is the unlock's own server-verified ceremony, with its
 * challenge bound to "passcode-off:<session>" instead of
 * "passcode-unlock:<session>", so a proof made to unlock can never remove the
 * lock, and a proof made to remove it never writes an unlock.
 */
const SESSION = "11111111-2222-3333-4444-555555555555";
const digest = (purpose: string) => createHash("sha256").update(`${purpose}:${SESSION}`).digest("hex");
const token = `x.${Buffer.from(JSON.stringify({ session_id: SESSION })).toString("base64url")}.y`;

const s = vi.hoisted(() => ({
  minted: [] as (string | null)[],
  boundTo: "" as string,
  turnedOff: [] as string[],
  unlocked: [] as string[],
}));

vi.mock("../actions/session", () => ({
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "user-1" },
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } },
  }),
  /* SPEED: the unlock identifies the caller from the verified token. */
  resolveSessionClaims: async () => ({
    state: "signed-in",
    userId: "user-1",
    supabase: { auth: { getClaims: async () => ({ data: { claims: { sub: "user-1", session_id: SESSION } }, error: null }) } },
  }),
}));
const fakeAdmin = vi.hoisted(() => ({
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "k1", public_key_spki: "AA", alg: -7, sign_count: 0 } }) }) }) }),
    update: () => ({ eq: async () => ({}) }),
  }),
}));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => fakeAdmin }));
vi.mock("../supabase/service", () => ({ isServiceConfigured: () => true }));
vi.mock("../security/rate-limit", () => ({ consume: async () => ({ allowed: true }), subjectForUser: (id: string) => id }));
vi.mock("../security/money-step-up", () => ({
  ceremonyOrigin: async () => ({ origin: "https://www.vallospaces.com", rpId: "www.vallospaces.com" }),
  listCredentialIds: async () => ["cred"],
  mintChallenge: async (_a: unknown, _u: string, _p: string, d: string | null) => {
    s.minted.push(d);
    return "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA";
  },
  takeChallenge: async () => s.boundTo,
}));
vi.mock("../security/webauthn", () => ({ b64urlToBuffer: () => Buffer.alloc(1), verifyAssertion: () => ({ ok: true, signCount: 1 }) }));
vi.mock("./state", () => ({
  readPasscodeStatus: async () => ({ state: "set", length: 6, failedCount: 0, lockedUntil: null }),
  writeUnlock: async (u: string) => {
    s.unlocked.push(u);
    return true;
  },
}));
vi.mock("./turn-off", () => ({
  turnPasscodeOff: async (u: string) => {
    s.turnedOff.push(u);
    return true;
  },
}));

import { beginPasskeyUnlock, finishPasscodeOffWithKey, finishPasskeyUnlock } from "./passkey-unlock";

const proof = { challenge: "Y2hhbGxlbmdlLWNoYWxsZW5nZS0xMjM0NTY3OA", credentialId: "AQIDBAUGBwgJCgsMDQ4PEA", clientDataJSON: "abcdefghijkl", authenticatorData: "abcdefghijkl", signature: "abcdefghijkl" };

beforeEach(() => {
  s.minted = [];
  s.turnedOff = [];
  s.unlocked = [];
});

describe("a Face ID proof to turn the passcode off", () => {
  it("is minted bound to turning it off, and the unlock's stays bound to unlocking", async () => {
    await beginPasskeyUnlock("off");
    await beginPasskeyUnlock();
    expect(s.minted).toEqual([digest("passcode-off"), digest("passcode-unlock")]);
  });

  it("turns the lock off, and writes no unlock", async () => {
    s.boundTo = digest("passcode-off");
    expect(await finishPasscodeOffWithKey(proof)).toEqual({ ok: true, data: null });
    expect(s.turnedOff).toEqual(["user-1"]);
    expect(s.unlocked).toEqual([]);
  });

  it("an unlock proof cannot turn it off, and an off proof cannot unlock", async () => {
    s.boundTo = digest("passcode-unlock");
    expect((await finishPasscodeOffWithKey(proof)).ok).toBe(false);
    expect(s.turnedOff).toEqual([]);
    s.boundTo = digest("passcode-off");
    expect((await finishPasskeyUnlock(proof)).ok).toBe(false);
    expect(s.unlocked).toEqual([]);
  });
});
