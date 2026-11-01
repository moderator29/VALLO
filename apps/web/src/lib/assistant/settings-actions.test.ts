import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const session = vi.hoisted(() => ({ value: null as unknown }));
const locked = vi.hoisted(() => ({ value: null as string | null }));
const limited = vi.hoisted(() => ({ value: true }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/actions/session", () => ({ resolveSession: async () => session.value }));
vi.mock("@/lib/passcode/money", () => ({ passcodeMoneyRefusal: async () => locked.value }));
vi.mock("@/lib/security/rate-limit", () => ({
  consume: async () => (limited.value ? { allowed: true, degraded: false } : { allowed: false, retryAfterSeconds: 60, retryIn: "in about a minute" }),
  subjectForUser: (id: string) => `user:${id}`,
}));
vi.mock("server-only", () => ({}));

import { activateAssistant, deactivateAssistant, setAssistantPermission } from "./settings-actions";

const signedIn = () => ({ state: "signed-in", user: { id: "u1" }, supabase: { rpc } });
const good = {
  acceptTerms: true,
  acceptPrivacy: true,
  agree: true,
  termsVersion: "2026-11-01",
  privacyVersion: "2026-11-01",
  permissions: ["discovery"],
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  session.value = signedIn();
  locked.value = null;
  limited.value = true;
});

describe("activateAssistant", () => {
  it("refuses without any one of the three ticks, and never reaches the database", async () => {
    for (const missing of ["acceptTerms", "acceptPrivacy", "agree"] as const) {
      const r = await activateAssistant({ ...good, [missing]: false });
      expect(r.ok, missing).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a sensitive permission at activation: money access is a separate, later step", async () => {
    const r = await activateAssistant({ ...good, permissions: ["discovery", "transactions"] });
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller", async () => {
    session.value = { state: "signed-out" };
    expect((await activateAssistant(good)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends both acceptances and the versions to the database function", async () => {
    const r = await activateAssistant(good);
    expect(r.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("ai_assistant_activate", {
      p_terms_version: "2026-11-01",
      p_privacy_version: "2026-11-01",
      p_accept_terms: true,
      p_accept_privacy: true,
      p_permissions: ["discovery"],
    });
  });

  it("says why when the database refuses", async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: "version_mismatch" }, error: null });
    const r = await activateAssistant(good);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("updated");
  });

  it("is rate limited", async () => {
    limited.value = false;
    const r = await activateAssistant(good);
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("setAssistantPermission", () => {
  it("grants an ordinary permission straight through", async () => {
    const r = await setAssistantPermission({ permission: "saved_prefs", granted: true });
    expect(r.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("ai_assistant_set_permission", { p_permission: "saved_prefs", p_granted: true });
  });

  it("refuses granting a sensitive permission while the session is locked, and audits it", async () => {
    locked.value = "Unlock Vallo with your passcode first.";
    for (const permission of ["transactions", "wallet_balance", "payment_assist"]) {
      const r = await setAssistantPermission({ permission, granted: true });
      expect(r.ok, permission).toBe(false);
    }
    expect(rpc.mock.calls.every((c) => c[0] === "ai_assistant_audit_write")).toBe(true);
    expect(rpc.mock.calls.some((c) => c[0] === "ai_assistant_set_permission")).toBe(false);
  });

  it("lets a locked session TAKE BACK a sensitive permission: revoking is always allowed", async () => {
    locked.value = "locked";
    const r = await setAssistantPermission({ permission: "transactions", granted: false });
    expect(r.ok).toBe(true);
  });

  it("rejects a permission that does not exist", async () => {
    expect((await setAssistantPermission({ permission: "root", granted: true })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("deactivateAssistant", () => {
  it("calls the database function that revokes everything", async () => {
    expect((await deactivateAssistant()).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("ai_assistant_deactivate", undefined);
  });

  it("reports a database failure instead of pretending it is off", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await deactivateAssistant()).ok).toBe(false);
  });
});
