import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Marking somebody internal by address looks the address up through the
 * service role. The door is asked first, so the action cannot tell a
 * stranger whether an address has an account.
 */
const lookups = vi.hoisted(() => ({ count: 0 }));
const door = vi.hoisted(() => ({ value: { state: "not-admin" } as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../supabase/service", () => ({
  findUserByEmail: async () => {
    lookups.count += 1;
    return null;
  },
}));
vi.mock("./guard", () => ({
  requireAdmin: async () => door.value,
  adminRefusal: () => "refused",
}));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "nc",
  SIGNED_OUT_MESSAGE: "so",
  resolveSession: async () => ({ state: "signed-out" }),
}));

const { markInternalByEmail } = await import("./key-roster-actions");

beforeEach(() => {
  lookups.count = 0;
});

describe("marking an account internal by address", () => {
  it("refuses a caller who is not staff before any lookup", async () => {
    door.value = { state: "not-admin" };
    expect(await markInternalByEmail({ email: "someone@example.com" })).toEqual({ ok: false, error: "refused" });
    expect(lookups.count).toBe(0);
  });

  it("refuses an admin who is not a super admin before any lookup", async () => {
    door.value = { state: "admin", isSuperAdmin: false };
    const result = await markInternalByEmail({ email: "someone@example.com" });
    expect(result.ok).toBe(false);
    expect(lookups.count).toBe(0);
  });

  it("looks the address up for a super admin (control)", async () => {
    door.value = { state: "admin", isSuperAdmin: true };
    const result = await markInternalByEmail({ email: "someone@example.com" });
    expect(result.ok).toBe(false);
    expect(lookups.count).toBe(1);
  });
});
