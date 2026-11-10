import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../testing/fake-supabase";

const ME = "11111111-1111-4111-8111-111111111111";
const ESCALATION = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({ requireAdminResult: null as unknown, requireCooResult: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../audit", () => ({ writeAudit: async () => true }));
let adminClientDb: ReturnType<typeof fakeSupabase>;
vi.mock("../../supabase/admin", () => ({ createAdminClient: () => adminClientDb.client }));
vi.mock("../guard", () => ({
  requireAdmin: async () => state.requireAdminResult,
  adminRefusal: () => "Your access does not allow this.",
}));
vi.mock("./guard", () => ({
  requireCoo: async () => state.requireCooResult,
  cooRefusal: () => "Your access does not allow this.",
}));

const { raiseEscalation, resolveEscalation, recommendStaffAccess } = await import("./actions");

beforeEach(() => {
  adminClientDb = fakeSupabase({ coo_escalations: { insert: { data: { id: ESCALATION } } } });
  state.requireAdminResult = { state: "admin", supabase: adminClientDb.client, userClient: adminClientDb.client, user: { id: ME }, isAdmin: true, isSuperAdmin: false, isStaff: false };
  state.requireCooResult = { state: "coo", supabase: fakeSupabase().client, userClient: fakeSupabase().client, user: { id: ME }, isSuperAdmin: false };
});

describe("raiseEscalation", () => {
  it("refuses a caller requireAdmin does not let through", async () => {
    state.requireAdminResult = { state: "not-admin" };
    const out = await raiseEscalation({ sourceDesk: "support", subject: "Angry refund", detail: "Needs a call" });
    expect(out.ok).toBe(false);
  });

  it("validates the source desk and required fields", async () => {
    const out = await raiseEscalation({ sourceDesk: "not_a_desk", subject: "", detail: "" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.fieldErrors?.sourceDesk).toBeTruthy();
      expect(out.fieldErrors?.subject).toBeTruthy();
      expect(out.fieldErrors?.detail).toBeTruthy();
    }
  });

  it("inserts an open escalation raised by the caller, through the service client", async () => {
    const out = await raiseEscalation({ sourceDesk: "support", subject: "Angry refund", detail: "Needs a call" });
    expect(out.ok).toBe(true);
    const insert = adminClientDb.of("coo_escalations", "insert")[0];
    expect(insert?.values).toMatchObject({ raised_by: ME, source_desk: "support", status: "open" });
  });
});

describe("resolveEscalation", () => {
  it("refuses a caller who is not a full-bundle COO or super admin", async () => {
    state.requireCooResult = { state: "not-admin" };
    const out = await resolveEscalation({ id: ESCALATION, status: "resolved" });
    expect(out.ok).toBe(false);
  });

  it("stamps resolved_by and resolved_at on resolve", async () => {
    const db = fakeSupabase({ coo_escalations: { update: { data: [{ id: ESCALATION }] } } });
    state.requireCooResult = { state: "coo", supabase: db.client, userClient: db.client, user: { id: ME }, isSuperAdmin: false };
    const out = await resolveEscalation({ id: ESCALATION, status: "resolved", note: "Sorted with the team lead." });
    expect(out.ok).toBe(true);
    const update = db.of("coo_escalations", "update")[0];
    expect(update?.values).toMatchObject({ status: "resolved", resolved_by: ME, resolution_note: "Sorted with the team lead." });
  });

  it("says so when the escalation cannot be found", async () => {
    const db = fakeSupabase({ coo_escalations: { update: { data: [] } } });
    state.requireCooResult = { state: "coo", supabase: db.client, userClient: db.client, user: { id: ME }, isSuperAdmin: false };
    const out = await resolveEscalation({ id: ESCALATION, status: "resolved" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("Could not find");
  });
});

describe("recommendStaffAccess", () => {
  it("writes a note only, never a grant, through the caller's own COO access", async () => {
    const db = fakeSupabase({ staff_access_recommendations: { insert: { data: { id: "rec-1" } } } });
    state.requireCooResult = { state: "coo", supabase: db.client, userClient: db.client, user: { id: ME }, isSuperAdmin: false };
    const out = await recommendStaffAccess({ aboutName: "Chidi", recommendedPositionOrScope: "Support", reason: "Covering nights" });
    expect(out.ok).toBe(true);
    const insert = db.of("staff_access_recommendations", "insert")[0];
    expect(insert?.values).toMatchObject({ recommended_by: ME, about_name: "Chidi", status: "open" });
  });

  it("requires every field", async () => {
    const out = await recommendStaffAccess({ aboutName: "", recommendedPositionOrScope: "", reason: "" });
    expect(out.ok).toBe(false);
  });
});
