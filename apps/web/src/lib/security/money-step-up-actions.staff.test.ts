import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A STAFF ACCOUNT'S KEYS OPEN THE CONSOLE, so a stolen password must never add
 * or remove one. These pin the rules in `beginEnrol` and
 * `removeMoneyCredential`: a staff account with a key adds another only on a
 * proof made with a key; its first key takes the emailed code AND the
 * password; a key is removed only on a proof made with a key. A member's
 * rules are unchanged.
 */

const state = vi.hoisted(() => ({
  staff: false,
  keys: [] as string[],
  revoked: [] as string[],
  passwordOk: true,
  codeOk: true,
  method: "password" as "password" | "email-code",
  consumed: [] as { digest: string; keyOnly: boolean }[],
  keyStepUpValid: true,
  reauthCalls: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../actions/session", () => ({
  resolveSession: async () => ({ state: "signed-in", user: { id: "u1", email: "ada@example.com" } }),
}));
vi.mock("./rate-limit", () => ({
  consume: async () => ({ allowed: true, degraded: false }),
  subjectForUser: (id: string) => id,
}));
vi.mock("../account-deletion/reauthenticate", () => ({
  reauthMethodFor: () => state.method,
  sendReauthCode: async () => true,
  reauthenticate: async (_u: unknown, proof: { password?: string; emailCode?: string }) => {
    if (proof.password !== undefined) {
      state.reauthCalls.push("password");
      return state.passwordOk;
    }
    state.reauthCalls.push("code");
    return state.codeOk;
  },
}));
vi.mock("./money-step-up", () => ({
  admin: () => ({}),
  ceremonyOrigin: async () => ({ origin: "https://www.vallospaces.com", rpId: "www.vallospaces.com" }),
  isStaffAccount: async () => state.staff,
  listCredentialIds: async () => state.keys,
  listConsoleCredentialIds: async () => state.keys.filter((k) => !state.revoked.includes(k)),
  passwordChangedRecently: async () => false,
  mintChallenge: async () => "challenge-xxxxxxxxxxxxxxxxxxxxxxxx",
  spendEmailCodeMarker: async (_a: unknown, _u: string, proved: () => Promise<boolean>) => proved(),
  intentDigest: (intent: { kind: string; target?: string }) => `${intent.kind}|${intent.target ?? ""}`,
  consumeStepUp: async (_a: unknown, _u: string, _id: string, digest: string, keyOnly = false) => {
    state.consumed.push({ digest, keyOnly });
    return state.keyStepUpValid;
  },
  enrolKey: async () => "ok",
  proveWithAssertion: async () => null,
  recordStepUp: async () => "step",
}));
vi.mock("@/lib/supabase/service", () => ({ getAdminClient: () => null }));

const STEP = "33333333-3333-4333-8333-333333333333";
const KEY = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  Object.assign(state, {
    staff: false,
    keys: [],
    revoked: [],
    passwordOk: true,
    codeOk: true,
    method: "password",
    consumed: [],
    keyStepUpValid: true,
    reauthCalls: [],
  });
});

describe("enrolling a key on a staff account", () => {
  it("refuses the password alone for a staff account's first key", async () => {
    state.staff = true;
    const { beginEnrol } = await import("./money-step-up-actions");
    expect(await beginEnrol({ password: "stolen" })).toEqual({ ok: false, error: "rejected" });
  });

  it("refuses the emailed code without the password when the account has one", async () => {
    state.staff = true;
    const { beginEnrol } = await import("./money-step-up-actions");
    expect(await beginEnrol({ code: "123456" })).toEqual({ ok: false, error: "rejected" });
  });

  it("takes the password AND the emailed code for the first key", async () => {
    state.staff = true;
    const { beginEnrol } = await import("./money-step-up-actions");
    const begun = await beginEnrol({ password: "right", code: "123456" });
    expect(begun).toMatchObject({ ok: true, data: { challenge: expect.any(String) } });
    expect(state.reauthCalls).toEqual(["password", "code"]);
  });

  it("refuses a wrong password even with a right code", async () => {
    state.staff = true;
    state.passwordOk = false;
    const { beginEnrol } = await import("./money-step-up-actions");
    expect(await beginEnrol({ password: "wrong", code: "123456" })).toEqual({ ok: false, error: "rejected" });
  });

  it("with a key already enrolled, refuses the password and the code", async () => {
    state.staff = true;
    state.keys = ["k1"];
    const { beginEnrol } = await import("./money-step-up-actions");
    expect(await beginEnrol({ password: "right", code: "123456" })).toEqual({ ok: false, error: "rejected" });
    expect(state.reauthCalls).toEqual([]);
  });

  it("C14: with every key revoked for the console, enrols a new one on the first-key proof", async () => {
    state.staff = true;
    state.keys = ["lost-phone"];
    state.revoked = ["lost-phone"];
    const { beginEnrol } = await import("./money-step-up-actions");
    const begun = await beginEnrol({ password: "right", code: "123456" });
    expect(begun).toMatchObject({ ok: true, data: { challenge: expect.any(String) } });
    expect(state.reauthCalls).toEqual(["password", "code"]);
    expect(await beginEnrol({ password: "stolen" })).toEqual({ ok: false, error: "rejected" });
  });

  it("C14: a key still usable for the console must vouch, even beside a revoked one", async () => {
    state.staff = true;
    state.keys = ["lost-phone", "laptop"];
    state.revoked = ["lost-phone"];
    const { beginEnrol } = await import("./money-step-up-actions");
    expect(await beginEnrol({ password: "right", code: "123456" })).toEqual({ ok: false, error: "rejected" });
  });

  it("with a key already enrolled, adds another only on a proof made with a key", async () => {
    state.staff = true;
    state.keys = ["k1"];
    const { beginEnrol } = await import("./money-step-up-actions");
    const begun = await beginEnrol({ stepUp: STEP });
    expect(begun).toMatchObject({ ok: true, data: { challenge: expect.any(String) } });
    expect(state.consumed).toEqual([{ digest: "add_lock|", keyOnly: true }]);
    state.keyStepUpValid = false;
    expect(await beginEnrol({ stepUp: STEP })).toEqual({ ok: false, error: "rejected" });
  });

  it("leaves a member's enrolment on the password as before", async () => {
    const { beginEnrol } = await import("./money-step-up-actions");
    const begun = await beginEnrol({ password: "right" });
    expect(begun).toMatchObject({ ok: true, data: { challenge: expect.any(String) } });
  });
});

describe("removing a key", () => {
  it("asks a staff account for a proof made with a key", async () => {
    state.staff = true;
    const { removeMoneyCredential } = await import("./money-step-up-actions");
    state.keyStepUpValid = false;
    expect(await removeMoneyCredential({ id: KEY, stepUp: STEP })).toEqual({ ok: false, error: "rejected" });
    expect(state.consumed).toEqual([{ digest: `remove_lock|${KEY}`, keyOnly: true }]);
  });

  it("lets a member remove one on any fresh proof, as before", async () => {
    state.keyStepUpValid = false;
    const { removeMoneyCredential } = await import("./money-step-up-actions");
    await removeMoneyCredential({ id: KEY, stepUp: STEP });
    expect(state.consumed).toEqual([{ digest: `remove_lock|${KEY}`, keyOnly: false }]);
  });
});
