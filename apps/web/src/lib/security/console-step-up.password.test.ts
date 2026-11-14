import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";

/*
 * THE STAFF DOOR (the founder's ruling, 14 November 2026): an admin or a
 * staff member opens the console with their own account password, an account
 * with no password with an emailed code, and a super admin never through
 * this door. Every refusal leaves the console shut: no proof row is written.
 */

const SESSION = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  method: "password" as "password" | "email-code",
  passwordOk: false,
  codeOk: false,
  staff: true,
  limit: { allowed: true, degraded: false } as { allowed: boolean; degraded?: boolean },
  asked: [] as unknown[],
  db: null as unknown,
}));

vi.mock("../actions/session", () => ({
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "u1", email: "ada@example.com" },
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: `x.${Buffer.from(JSON.stringify({ session_id: SESSION })).toString("base64url")}.y` } },
        }),
      },
    },
  }),
}));
vi.mock("./rate-limit", () => ({ consume: async () => state.limit, subjectForUser: (id: string) => id }));
vi.mock("../account-deletion/reauthenticate", () => ({
  reauthMethodFor: () => state.method,
  reauthenticate: async (_user: unknown, proof: { password?: string; emailCode?: string }) => {
    state.asked.push(proof);
    return proof.password !== undefined ? state.passwordOk : state.codeOk;
  },
}));
vi.mock("./money-step-up", () => ({
  admin: () => (state.db as { client: unknown }).client,
  ceremonyOrigin: async () => ({ origin: "https://www.vallospaces.com", rpId: "www.vallospaces.com" }),
  isStaffAccount: async () => state.staff,
  listConsoleCredentialIds: async () => [],
  mintChallenge: async () => "challenge-xxxxxxxxxxxxxxxxxxxxxxxx",
  spendEmailCodeMarker: async (_a: unknown, _user: string, proved: () => Promise<boolean>) => proved(),
  takeChallenge: async () => null,
}));

const { confirmConsoleWithPassword } = await import("./console-step-up");

function database(roles: string[] = ["admin"], script: Parameters<typeof fakeSupabase>[0] = {}) {
  const db = fakeSupabase({ user_roles: { select: { data: roles.map((role) => ({ role })) } }, ...script });
  state.db = db;
  return db;
}

beforeEach(() => {
  state.method = "password";
  state.passwordOk = false;
  state.codeOk = false;
  state.staff = true;
  state.limit = { allowed: true, degraded: false };
  state.asked = [];
});

describe("the console's password door", () => {
  it("opens the console for this session on the right password, and says how in the audit log", async () => {
    const db = database(["user", "admin"]);
    state.passwordOk = true;
    const out = await confirmConsoleWithPassword({ password: "correct horse" });
    expect(out.ok).toBe(true);
    const proof = db.of("console_step_ups", "upsert")[0];
    expect(proof?.values).toMatchObject({ user_id: "u1", session_id: SESSION, credential_id: null });
    const expires = Date.parse((proof?.values as { expires_at: string }).expires_at);
    expect(Math.round((expires - Date.now()) / 3_600_000)).toBe(12);
    expect(db.of("audit_log", "insert")[0]?.values).toMatchObject({ actor_id: "u1", action: "console.step_up", metadata: { method: "password" } });
  });

  it("stays shut on a wrong password", async () => {
    const db = database();
    const out = await confirmConsoleWithPassword({ password: "wrong" });
    expect(out).toMatchObject({ ok: false, error: "rejected" });
    expect(db.wrote()).toBe(false);
  });

  it("stays shut on no password at all, without asking the sign-in service", async () => {
    const db = database();
    expect(await confirmConsoleWithPassword({})).toMatchObject({ ok: false, error: "rejected" });
    expect(await confirmConsoleWithPassword({ password: "" })).toMatchObject({ ok: false, error: "rejected" });
    expect(state.asked).toEqual([]);
    expect(db.wrote()).toBe(false);
  });

  it("refuses a super admin, who opens the console with a key, before the password is looked at", async () => {
    const db = database(["admin", "super_admin"]);
    state.passwordOk = true;
    const out = await confirmConsoleWithPassword({ password: "correct horse" });
    expect(out).toMatchObject({ ok: false, error: "key_only" });
    expect(state.asked).toEqual([]);
    expect(db.wrote()).toBe(false);
  });

  it("refuses somebody who is not staff, even with their right password", async () => {
    const db = database(["user"]);
    state.staff = false;
    state.passwordOk = true;
    const out = await confirmConsoleWithPassword({ password: "correct horse" });
    expect(out).toMatchObject({ ok: false, error: "rejected" });
    expect(state.asked).toEqual([]);
    expect(db.wrote()).toBe(false);
  });

  it("stops after too many tries, and when the tries cannot be counted, without checking the password", async () => {
    const db = database();
    state.passwordOk = true;
    state.limit = { allowed: false };
    expect(await confirmConsoleWithPassword({ password: "correct horse" })).toMatchObject({ ok: false, error: "too_many" });
    state.limit = { allowed: true, degraded: true };
    expect(await confirmConsoleWithPassword({ password: "correct horse" })).toMatchObject({ ok: false, error: "failed" });
    expect(state.asked).toEqual([]);
    expect(db.wrote()).toBe(false);
  });

  it("stays shut when the roles cannot be read", async () => {
    const db = database([], { user_roles: { select: { error: { code: "57014" } } } });
    state.passwordOk = true;
    expect(await confirmConsoleWithPassword({ password: "correct horse" })).toMatchObject({ ok: false, error: "failed" });
    expect(db.wrote()).toBe(false);
  });

  it("opens with an emailed code for an account that has no password, and never takes a password from it", async () => {
    const db = database();
    state.method = "email-code";
    state.codeOk = true;
    state.passwordOk = true;
    expect(await confirmConsoleWithPassword({ password: "anything" })).toMatchObject({ ok: false, error: "rejected" });
    expect(db.wrote()).toBe(false);
    const out = await confirmConsoleWithPassword({ code: "123456" });
    expect(out.ok).toBe(true);
    expect(state.asked).toEqual([{ emailCode: "123456" }]);
    expect(db.of("audit_log", "insert")[0]?.values).toMatchObject({ metadata: { method: "email_code" } });
  });

  it("says it failed when the proof row cannot be written", async () => {
    database(["admin"], { console_step_ups: { upsert: { error: { code: "23502" } } } });
    state.passwordOk = true;
    expect(await confirmConsoleWithPassword({ password: "correct horse" })).toMatchObject({ ok: false, error: "failed" });
  });
});
