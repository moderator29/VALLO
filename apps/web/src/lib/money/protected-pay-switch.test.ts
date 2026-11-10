import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const db = vi.hoisted(() => ({ rows: [] as { key: string; enabled: boolean }[], error: false, configured: true }));
vi.mock("../supabase/env", () => ({ isSupabaseConfigured: () => db.configured }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        in: async () => (db.error ? { data: null, error: { message: "boom" } } : { data: db.rows, error: null }),
      }),
    }),
  }),
}));

const mod = await import("./protected-pay-switch");

describe("protected-pay switch", () => {
  beforeEach(() => {
    db.rows = [];
    db.error = false;
    db.configured = true;
  });
  afterEach(() => {
    delete process.env[mod.PROTECTED_PAY_KILL_ENV];
    delete process.env[mod.LEGACY_PROTECTED_PAY_KILL_ENV];
  });

  it("fails closed when both rows are missing", async () => {
    expect(await mod.protectedPaySwitchOn()).toBe(false);
  });

  it("fails closed on a failed read and when the database is not configured", async () => {
    db.rows = [{ key: mod.PROTECTED_PAY_FLAG, enabled: true }];
    db.error = true;
    expect(await mod.protectedPaySwitchOn()).toBe(false);
    db.error = false;
    db.configured = false;
    expect(await mod.protectedPaySwitchOn()).toBe(false);
  });

  it("reads the new key first", async () => {
    db.rows = [
      { key: mod.PROTECTED_PAY_FLAG, enabled: false },
      { key: mod.LEGACY_PROTECTED_PAY_FLAG, enabled: true },
    ];
    expect(await mod.protectedPaySwitchOn()).toBe(false);
    db.rows = [{ key: mod.PROTECTED_PAY_FLAG, enabled: true }];
    expect(await mod.protectedPaySwitchOn()).toBe(true);
  });

  it("falls back to the old key only while the new row does not exist", async () => {
    db.rows = [{ key: mod.LEGACY_PROTECTED_PAY_FLAG, enabled: true }];
    expect(await mod.protectedPaySwitchOn()).toBe(true);
    db.rows = [{ key: mod.LEGACY_PROTECTED_PAY_FLAG, enabled: false }];
    expect(await mod.protectedPaySwitchOn()).toBe(false);
  });

  it("either environment stop switches it off with no database", async () => {
    db.rows = [{ key: mod.PROTECTED_PAY_FLAG, enabled: true }];
    process.env[mod.PROTECTED_PAY_KILL_ENV] = "1";
    expect(await mod.protectedPaySwitchOn()).toBe(false);
    delete process.env[mod.PROTECTED_PAY_KILL_ENV];
    process.env[mod.LEGACY_PROTECTED_PAY_KILL_ENV] = "1";
    expect(await mod.protectedPaySwitchOn()).toBe(false);
  });
});
