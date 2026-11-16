import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PROVING A PASSWORD MUST NOT LEAVE A SESSION BEHIND.
 *
 * Checking a password means signing in with it, and that sign-in opens a real
 * session. Measured on live on 14 November 2026: 146 sessions with the user
 * agent `node`, 133 of them untouched for over thirty days, left by money
 * step-ups, console entries and deletion checks. These tests pin the three
 * rules of the fix: the session is closed, it is closed with `local` scope so
 * the person is not signed out everywhere, and a logout that fails never
 * turns a correct password into a refusal.
 */

const signOutCalls: unknown[] = [];
let signInResult: { data: { user: { id: string } | null }; error: unknown } = {
  data: { user: { id: "u1" } },
  error: null,
};
let verifyResult: { data: { user: { id: string } | null }; error: unknown } = {
  data: { user: { id: "u1" } },
  error: null,
};
let signOutThrows = false;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async () => signInResult,
      verifyOtp: async () => verifyResult,
      signInWithOtp: async () => ({ error: null }),
      signOut: async (options: unknown) => {
        signOutCalls.push(options);
        if (signOutThrows) throw new Error("logout unreachable");
        return { error: null };
      },
    },
  }),
}));

vi.mock("../supabase/env", () => ({
  requireSupabasePublicEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon" }),
}));

import { reauthenticate } from "./reauthenticate";

const user = { id: "u1", email: "person@example.com", identities: [{ provider: "email" }] } as never;

describe("reauthenticate closes the session its proof opened", () => {
  beforeEach(() => {
    signOutCalls.length = 0;
    signOutThrows = false;
    signInResult = { data: { user: { id: "u1" } }, error: null };
    verifyResult = { data: { user: { id: "u1" } }, error: null };
  });

  it("signs out after a correct password, with local scope only", async () => {
    expect(await reauthenticate(user, { password: "right" })).toBe(true);
    expect(signOutCalls).toEqual([{ scope: "local" }]);
  });

  it("signs out after a correct email code too", async () => {
    expect(await reauthenticate(user, { emailCode: "123456" })).toBe(true);
    expect(signOutCalls).toEqual([{ scope: "local" }]);
  });

  it("never uses the global scope, which would sign the person out everywhere", async () => {
    await reauthenticate(user, { password: "right" });
    for (const call of signOutCalls) {
      expect((call as { scope?: string }).scope).toBe("local");
    }
  });

  it("a logout that fails does not turn a correct password into a refusal", async () => {
    signOutThrows = true;
    expect(await reauthenticate(user, { password: "right" })).toBe(true);
  });

  it("a wrong password is still refused, and opens nothing to close", async () => {
    signInResult = { data: { user: null }, error: { message: "bad" } };
    expect(await reauthenticate(user, { password: "wrong" })).toBe(false);
    expect(signOutCalls).toEqual([]);
  });

  it("a password proving a DIFFERENT account is refused, and that session is still closed", async () => {
    signInResult = { data: { user: { id: "someone-else" } }, error: null };
    expect(await reauthenticate(user, { password: "right-for-another" })).toBe(false);
    expect(signOutCalls).toEqual([{ scope: "local" }]);
  });
});
