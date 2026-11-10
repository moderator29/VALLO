import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  requireAdminResult: null as unknown,
  staffAccess: null as unknown,
}));

vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async () => state.requireAdminResult,
  readStaffAccess: async () => state.staffAccess,
  ADMIN_FORBIDDEN_MESSAGE: "forbidden",
  ADMIN_SIGNED_OUT_MESSAGE: "signed out",
  ADMIN_STEP_UP_MESSAGE: "step up",
  ADMIN_UNCONFIGURED_MESSAGE: "unconfigured",
}));

const { requireCoo } = await import("./guard");

const ME = "11111111-1111-4111-8111-111111111111";
const ALL_COO_SCOPES = ["listing_approval", "moderation", "support", "agreements", "operations"];

describe("requireCoo", () => {
  it("passes a non-admin state straight through", async () => {
    state.requireAdminResult = { state: "signed-out" };
    expect(await requireCoo()).toEqual({ state: "signed-out" });
  });

  it("admits a super admin outright, with no scope check at all", async () => {
    state.requireAdminResult = { state: "admin", supabase: {}, userClient: {}, user: { id: ME }, isAdmin: true, isSuperAdmin: true, isStaff: false };
    const out = await requireCoo();
    expect(out.state).toBe("coo");
    if (out.state === "coo") expect(out.isSuperAdmin).toBe(true);
  });

  it("admits a staff member holding every one of the COO's five scopes", async () => {
    state.requireAdminResult = { state: "admin", supabase: {}, userClient: {}, user: { id: ME }, isAdmin: true, isSuperAdmin: false, isStaff: true };
    state.staffAccess = { isAdmin: false, isSuperAdmin: false, scopes: ALL_COO_SCOPES, position: "coo", handbookVersion: "1", handbookAcknowledged: true, consoleVerified: true };
    const out = await requireCoo();
    expect(out.state).toBe("coo");
    if (out.state === "coo") expect(out.isSuperAdmin).toBe(false);
  });

  it("refuses a staff member missing even one of the five scopes", async () => {
    state.requireAdminResult = { state: "admin", supabase: {}, userClient: {}, user: { id: ME }, isAdmin: true, isSuperAdmin: false, isStaff: true };
    state.staffAccess = { isAdmin: false, isSuperAdmin: false, scopes: ["listing_approval", "moderation", "support", "agreements"], position: "trust_safety_lead", handbookVersion: "1", handbookAcknowledged: true, consoleVerified: true };
    expect(await requireCoo()).toEqual({ state: "not-admin" });
  });

  it("refuses when readStaffAccess cannot answer at all", async () => {
    state.requireAdminResult = { state: "admin", supabase: {}, userClient: {}, user: { id: ME }, isAdmin: true, isSuperAdmin: false, isStaff: true };
    state.staffAccess = null;
    expect(await requireCoo()).toEqual({ state: "not-admin" });
  });
});
