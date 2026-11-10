import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * THE SMALLER TOOLS' WRITES: the gate per desk, validation before any write,
 * ownership, the approval moves and the single-desk rule for a kind.
 */
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireCoo: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: guard.requireAdmin }));
vi.mock("@/lib/admin/overview/guard", () => ({ requireCoo: guard.requireCoo }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("@/lib/admin/audit", () => audit);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const A = await import("./actions");

const ID = "11111111-1111-1111-1111-111111111111";
const ME = "staff-1";
const BASE = { title: "Domain renewal", body: "Renew at the registrar", dueOn: "2026-12-01", linkUrl: "", subjectUser: "", fields: { category: "domain" } };

/** A staff member who holds only the given scopes. */
function asStaff(fake: ReturnType<typeof fakeSupabase>, scopes: string[]) {
  guard.requireAdmin.mockImplementation(async (scope: string) => (scopes.includes(scope) ? { state: "admin", user: { id: ME }, supabase: fake.client, isStaff: true } : { state: "not-admin" }));
  guard.requireCoo.mockResolvedValue({ state: "not-admin" });
}
const row = (over: Record<string, unknown> = {}) => ({ id: ID, desk: "technical", kind: "reminder", status: "open", owner_id: ME, created_by: ME, ...over });

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireCoo.mockReset();
  audit.writeAudit.mockClear();
});

describe("createEntry", () => {
  it("refuses a kind that is not a tool, and a staff member without that desk's scope", async () => {
    const fake = fakeSupabase();
    asStaff(fake, ["marketing"]);
    expect((await A.createEntry("nonsense", BASE)).ok).toBe(false);
    expect((await A.createEntry("reminder", BASE)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("validates before it writes", async () => {
    const fake = fakeSupabase();
    asStaff(fake, ["technical"]);
    const r = await A.createEntry("reminder", { ...BASE, dueOn: "" });
    expect(r.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("inserts into the kind's own desk with the caller as owner, and audits it", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake, ["technical"]);
    const r = await A.createEntry("reminder", BASE);
    expect(r.ok).toBe(true);
    expect(fake.of("staff_desk_entries", "insert")[0]?.values).toMatchObject({ desk: "technical", kind: "reminder", status: "open", owner_id: ME, created_by: ME, due_on: "2026-12-01" });
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "technical.entry.create", actorId: ME }));
  });

  it("starts an approval kind as a draft", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake, ["support_lead"]);
    expect((await A.createEntry("macro", { ...BASE, dueOn: "", fields: {} })).ok).toBe(true);
    expect(fake.of("staff_desk_entries", "insert")[0]?.values).toMatchObject({ status: "draft", desk: "support_lead" });
  });

  it("says the table is not set up yet instead of a database error", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { insert: { data: null, error: { code: "42P01" } } } });
    asStaff(fake, ["technical"]);
    const r = await A.createEntry("reminder", BASE);
    expect(!r.ok && r.error).toMatch(/not set up/);
  });

  it("checks that a coaching note is about a member of the support team", async () => {
    const fake = fakeSupabase({ staff_grants: { select: { data: null, error: null } }, staff_desk_entries: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake, ["support_lead"]);
    const r = await A.createEntry("coaching_note", { title: "Shorter replies", body: "b", dueOn: "", linkUrl: "", subjectUser: ID, fields: {} });
    expect(r.ok).toBe(false);
    expect(fake.of("staff_desk_entries", "insert")).toHaveLength(0);
  });
});

describe("changing an entry", () => {
  it("refuses a colleague's entry but not for an admin", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: row({ owner_id: "x", created_by: "x" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake, ["technical"]);
    expect((await A.updateEntry(ID, BASE)).ok).toBe(false);
    expect((await A.setEntryDone(ID, true)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    expect((await A.setEntryDone(ID, true)).ok).toBe(true);
  });

  it("marks done guarded on the status it read, and reopens as the inverse", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake, ["technical"]);
    expect((await A.setEntryDone(ID, true)).ok).toBe(true);
    const upd = fake.of("staff_desk_entries", "update")[0];
    expect(upd?.values).toMatchObject({ status: "done" });
    expect(upd?.filters).toContainEqual(["eq", "status", "open"]);
  });

  it("will not mark an approval kind done, and says the entry changed when the guard misses", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: row({ kind: "status_draft", status: "draft" }), error: null } } });
    asStaff(fake, ["technical"]);
    expect((await A.setEntryDone(ID, true)).ok).toBe(false);
    const missed = fakeSupabase({ staff_desk_entries: { select: { data: row(), error: null }, update: { data: [], error: null } } });
    asStaff(missed, ["technical"]);
    const r = await A.setEntryDone(ID, true);
    expect(!r.ok && r.error).toMatch(/changed/);
  });

  it("retires and restores, and will not retire what waits for a decision", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake, ["technical"]);
    expect((await A.retireEntry(ID)).ok).toBe(true);
    const waiting = fakeSupabase({ staff_desk_entries: { select: { data: row({ kind: "status_draft", status: "submitted" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(waiting, ["technical"]);
    expect((await A.retireEntry(ID)).ok).toBe(false);
    const gone = fakeSupabase({ staff_desk_entries: { select: { data: row({ status: "retired" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(gone, ["technical"]);
    expect((await A.restoreEntry(ID)).ok).toBe(true);
    expect(gone.of("staff_desk_entries", "update")[0]?.values).toMatchObject({ status: "open" });
  });
});

describe("approval", () => {
  const draftRow = (over: Record<string, unknown> = {}) => row({ kind: "macro", desk: "support_lead", status: "draft", created_by: "lead", owner_id: "lead", ...over });

  it("submits a draft only, as its maker", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: draftRow({ created_by: ME, owner_id: ME }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake, ["support_lead"]);
    expect((await A.submitEntry(ID)).ok).toBe(true);
    expect(fake.of("staff_desk_entries", "update")[0]?.filters).toContainEqual(["eq", "status", "draft"]);
  });

  it("lets the COO approve what someone else made, once, and never the maker's own", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: draftRow({ status: "submitted" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.approveEntry(ID)).ok).toBe(true);
    expect(fake.of("staff_desk_entries", "update")[0]?.values).toMatchObject({ status: "approved", approved_by: "coo-1" });
    const own = fakeSupabase({ staff_desk_entries: { select: { data: draftRow({ status: "submitted", created_by: "coo-1" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: own.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.approveEntry(ID)).ok).toBe(false);
    expect(own.wrote()).toBe(false);
  });

  it("does not let the COO make or change anything", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: draftRow(), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.submitEntry(ID)).ok).toBe(false);
    expect((await A.createEntry("macro", { title: "T", body: "b", dueOn: "", linkUrl: "", subjectUser: "", fields: {} })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("needs a real reason to send back", async () => {
    const fake = fakeSupabase({ staff_desk_entries: { select: { data: draftRow({ status: "submitted" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    expect((await A.sendBackEntry(ID, "no")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.sendBackEntry(ID, "Please name the policy it follows")).ok).toBe(true);
  });
});
