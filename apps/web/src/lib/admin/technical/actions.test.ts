import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/** THE INCIDENT LOG'S WRITES: the gate, the secret check, status moves and the resolution summary. */
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireCoo: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: guard.requireAdmin }));
vi.mock("@/lib/admin/overview/guard", () => ({ requireCoo: guard.requireCoo }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("@/lib/admin/audit", () => audit);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const A = await import("./actions");
const ID = "11111111-1111-1111-1111-111111111111";
const asStaff = (fake: ReturnType<typeof fakeSupabase>) => {
  guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "tech-1" }, supabase: fake.client, isStaff: true });
  guard.requireCoo.mockResolvedValue({ state: "not-admin" });
};

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireCoo.mockReset();
  audit.writeAudit.mockClear();
});

describe("the gate", () => {
  it("refuses every non-staff caller, and lets the COO read but not write", async () => {
    for (const state of ["signed-out", "not-admin", "step-up", "unconfigured"]) {
      guard.requireAdmin.mockResolvedValue({ state });
      guard.requireCoo.mockResolvedValue({ state: "not-admin" });
      expect((await A.declareIncident({ title: "x", severity: "sev3", summary: "" })).ok, state).toBe(false);
    }
    const fake = fakeSupabase();
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.declareIncident({ title: "x", severity: "sev3", summary: "" })).ok).toBe(false);
    expect((await A.reopenIncident(ID)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });
});

describe("declareIncident", () => {
  it("refuses a summary that holds a key before writing anything", async () => {
    const fake = fakeSupabase();
    asStaff(fake);
    const r = await A.declareIncident({ title: "Bookings slow", severity: "sev2", summary: `key ${["sk", "live_abcdef1234567890"].join("_")} was in the log` });
    expect(r.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });
  it("inserts an open incident and audits it", async () => {
    const fake = fakeSupabase({ tech_incidents: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake);
    expect((await A.declareIncident({ title: "Bookings slow", severity: "sev2", summary: "since 8am" })).ok).toBe(true);
    expect(fake.of("tech_incidents", "insert")[0]?.values).toMatchObject({ status: "open", severity: "sev2", created_by: "tech-1" });
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "technical.incident.declare" }));
  });
  it("says the tables are not set up", async () => {
    const fake = fakeSupabase({ tech_incidents: { insert: { data: null, error: { code: "42P01" } } } });
    asStaff(fake);
    const r = await A.declareIncident({ title: "x", severity: "sev3", summary: "" });
    expect(!r.ok && r.error).toMatch(/not set up/);
  });
});

describe("updates and resolution", () => {
  it("posts an update and moves the status guarded on the one it read", async () => {
    const fake = fakeSupabase({ tech_incidents: { select: { data: { id: ID, status: "open" }, error: null }, update: { data: [{ id: ID }], error: null } }, tech_incident_updates: { insert: { data: null, error: null } } });
    asStaff(fake);
    expect((await A.postIncidentUpdate(ID, "Looking at the database", "investigating")).ok).toBe(true);
    expect(fake.of("tech_incidents", "update")[0]?.filters).toContainEqual(["eq", "status", "open"]);
    expect(fake.of("tech_incident_updates", "insert")[0]?.values).toMatchObject({ status_after: "investigating", author_id: "tech-1" });
  });
  it("will not resolve through an update, and refuses a secret or an empty line", async () => {
    const fake = fakeSupabase({ tech_incidents: { select: { data: { id: ID, status: "open" }, error: null } } });
    asStaff(fake);
    expect((await A.postIncidentUpdate(ID, "done", "resolved")).ok).toBe(false);
    expect((await A.postIncidentUpdate(ID, "  ", "")).ok).toBe(false);
    expect((await A.postIncidentUpdate(ID, "password: hunter2hunter2", "")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });
  it("takes no update on a resolved incident", async () => {
    const fake = fakeSupabase({ tech_incidents: { select: { data: { id: ID, status: "resolved" }, error: null } } });
    asStaff(fake);
    expect((await A.postIncidentUpdate(ID, "more", "")).ok).toBe(false);
  });
  it("resolves only with a written summary, and reopens as the inverse", async () => {
    const fake = fakeSupabase({ tech_incidents: { select: { data: { id: ID, status: "investigating" }, error: null }, update: { data: [{ id: ID }], error: null } }, tech_incident_updates: { insert: { data: null, error: null } } });
    asStaff(fake);
    expect((await A.resolveIncidentWith(ID, "short")).ok).toBe(false);
    expect((await A.resolveIncidentWith(ID, "A database index was missing; it was added and bookings recovered.")).ok).toBe(true);
    expect(fake.of("tech_incidents", "update")[0]?.values).toMatchObject({ status: "resolved", resolution_summary: expect.stringContaining("index") });
    expect((await A.reopenIncident(ID)).ok).toBe(true);
    expect(fake.of("tech_incidents", "update")[1]?.values).toMatchObject({ status: "investigating", resolved_at: null, resolution_summary: null });
    expect(fake.of("tech_incidents", "update")[1]?.filters).toContainEqual(["eq", "status", "resolved"]);
  });
});
