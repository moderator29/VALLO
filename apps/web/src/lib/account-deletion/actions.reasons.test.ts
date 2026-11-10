import { beforeEach, describe, expect, it, vi } from "vitest";

/** The deletion actions write the reason and flip the restored flag, and never fail on it. */
const h = vi.hoisted(() => ({
  record: vi.fn(async () => true),
  restored: vi.fn(async () => true),
  rpc: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../actions/setup-exempt", () => ({ setupExempt: (fn: () => unknown) => fn() }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "x",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "u1", email: null, created_at: "2026-01-01T00:00:00Z" },
    supabase: { rpc: async () => ({}), auth: { signOut: async () => ({}) } },
  }),
}));
vi.mock("../email/client", () => ({ bestEffortEmail: async () => undefined, sendMessage: async () => undefined }));
vi.mock("../security/rate-limit", () => ({
  consume: async () => ({ allowed: true }),
  ipFromHeaders: () => "1.1.1.1",
  subjectForIp: () => "ip",
  subjectForUser: () => "user",
}));
vi.mock("../push/revoke", () => ({ revokeTokens: async () => undefined }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { updateUserById: async () => ({}) } } }) }));
vi.mock("../supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("./audit", () => ({ writeDeletionAudit: async () => undefined }));
vi.mock("./reauthenticate", () => ({ reauthenticate: async () => true, sendReauthCode: async () => true }));
vi.mock("./reasons", () => ({ recordDeletionReason: h.record, markReasonRestored: h.restored }));
vi.mock("./rpc", async (original) => ({ ...(await original<typeof import("./rpc")>()), callDeletionRpc: h.rpc }));

process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
const { startDeletion, cancelDeletion, restoreWithCode } = await import("./actions");

beforeEach(() => {
  h.record.mockClear();
  h.restored.mockClear();
  h.rpc.mockReset();
});

describe("a deletion request records its reason", () => {
  it("writes the reason and note at the moment of the request", async () => {
    h.rpc.mockResolvedValue({ ok: true, data: { scheduled: true, request_id: "r1", purge_after: "2026-12-10T00:00:00Z" } });
    const result = await startDeletion({ confirmPhrase: "DELETE MY ACCOUNT", password: "pw", reason: "privacy", reasonNote: "too many ads" });
    expect(result.ok).toBe(true);
    expect(h.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "u1", reason: "privacy", note: "too many ads" }));
  });

  it("records nothing when the request was refused", async () => {
    h.rpc.mockResolvedValue({ ok: true, data: { scheduled: false, reason: "blocked", blockers: {} } });
    const result = await startDeletion({ confirmPhrase: "DELETE MY ACCOUNT", password: "pw", reason: "privacy" });
    expect(result.ok).toBe(false);
    expect(h.record).not.toHaveBeenCalled();
  });

  it("still deletes when the reason cannot be written", async () => {
    h.record.mockResolvedValueOnce(false);
    h.rpc.mockResolvedValue({ ok: true, data: { scheduled: true, request_id: "r1", purge_after: "2026-12-10T00:00:00Z" } });
    expect((await startDeletion({ confirmPhrase: "DELETE MY ACCOUNT", password: "pw" })).ok).toBe(true);
  });

  it("refuses a note over 500 characters before anything is touched", async () => {
    const result = await startDeletion({ confirmPhrase: "DELETE MY ACCOUNT", password: "pw", reasonNote: "x".repeat(501) });
    expect(result.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("restoring flips the restored flag", () => {
  it("from a session", async () => {
    h.rpc.mockResolvedValue({ ok: true, data: { cancelled: true } });
    expect((await cancelDeletion()).ok).toBe(true);
    expect(h.restored).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("with the emailed code", async () => {
    h.rpc.mockResolvedValue({ ok: true, data: { cancelled: true, user_id: "u9" } });
    const code = (await import("./restore-code")).newRestoreCode();
    expect((await restoreWithCode({ restoreCode: code })).ok).toBe(true);
    expect(h.restored).toHaveBeenCalledWith(expect.anything(), "u9");
  });

  it("does not flip it when nothing was cancelled", async () => {
    h.rpc.mockResolvedValue({ ok: true, data: { cancelled: false } });
    expect((await cancelDeletion()).ok).toBe(false);
    expect(h.restored).not.toHaveBeenCalled();
  });
});
