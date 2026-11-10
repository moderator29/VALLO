import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/** THE CONTENT DESK'S WRITES: the gate, validation, the approval moves, ownership and the publish link. */
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
const INPUT = { kind: "guide", title: "How deposits work", summary: "s", body: "text", plannedFor: "2026-12-01", linkUrl: "" };
const row = (over: Record<string, unknown> = {}) => ({ id: ID, kind: "guide", owner_id: ME, created_by: ME, status: "draft", ...over });
const asStaff = (fake: ReturnType<typeof fakeSupabase>) => {
  guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: ME }, supabase: fake.client, isStaff: true });
  guard.requireCoo.mockResolvedValue({ state: "not-admin" });
};
const asAdmin = (fake: ReturnType<typeof fakeSupabase>) => guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireCoo.mockReset();
  audit.writeAudit.mockClear();
});

describe("the gate", () => {
  it("refuses every non-staff caller without writing", async () => {
    for (const state of ["signed-out", "not-admin", "step-up", "unconfigured"]) {
      guard.requireAdmin.mockResolvedValue({ state });
      guard.requireCoo.mockResolvedValue({ state: "not-admin" });
      expect((await A.createItem(INPUT)).ok, state).toBe(false);
    }
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });
  it("lets the COO approve but not write", async () => {
    const fake = fakeSupabase({ content_items: { select: { data: row({ status: "in_review", created_by: "w" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.createItem(INPUT)).ok).toBe(false);
    expect((await A.submitItem(ID)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.approveItem(ID)).ok).toBe(true);
  });
});

describe("writing", () => {
  it("validates, then inserts a draft owned by the caller", async () => {
    const fake = fakeSupabase({ content_items: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake);
    expect((await A.createItem({ ...INPUT, title: " " })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.createItem(INPUT)).ok).toBe(true);
    expect(fake.of("content_items", "insert")[0]?.values).toMatchObject({ status: "draft", owner_id: ME, created_by: ME, planned_for: "2026-12-01" });
  });
  it("edits only a draft, and only your own unless an admin", async () => {
    const other = fakeSupabase({ content_items: { select: { data: row({ owner_id: "x", created_by: "x" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(other);
    expect((await A.updateItem(ID, INPUT)).ok).toBe(false);
    const inReview = fakeSupabase({ content_items: { select: { data: row({ status: "in_review" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(inReview);
    expect((await A.updateItem(ID, INPUT)).ok).toBe(false);
    asAdmin(other);
    expect((await A.updateItem(ID, INPUT)).ok).toBe(true);
  });
});

describe("approval and publishing", () => {
  it("submits a draft guarded on its status", async () => {
    const fake = fakeSupabase({ content_items: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.submitItem(ID)).ok).toBe(true);
    expect(fake.of("content_items", "update")[0]?.filters).toContainEqual(["eq", "status", "draft"]);
  });
  it("never lets the writer approve, and needs a reason to send back", async () => {
    const fake = fakeSupabase({ content_items: { select: { data: row({ status: "in_review", created_by: "admin-1" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asAdmin(fake);
    guard.requireCoo.mockResolvedValue({ state: "not-admin" });
    expect((await A.approveItem(ID)).ok).toBe(false);
    expect((await A.sendBackItem(ID, "no")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });
  it("publishes only an approved item and needs the live link for a guide", async () => {
    const fake = fakeSupabase({ content_items: { select: { data: row({ status: "approved" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.markPublished(ID, { url: "", publishedAt: "" })).ok).toBe(false);
    expect((await A.markPublished(ID, { url: "not a link", publishedAt: "" })).ok).toBe(false);
    expect((await A.markPublished(ID, { url: "https://vallospaces.com/help/deposits", publishedAt: "" })).ok).toBe(true);
    expect(fake.of("content_items", "update")[0]?.values).toMatchObject({ status: "published", published_url: "https://vallospaces.com/help/deposits" });
    const draft = fakeSupabase({ content_items: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(draft);
    expect((await A.markPublished(ID, { url: "https://vallospaces.com", publishedAt: "" })).ok).toBe(false);
  });
  it("retires and restores as inverses", async () => {
    const fake = fakeSupabase({ content_items: { select: { data: row({ status: "published" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.retireItem(ID)).ok).toBe(true);
    const back = fakeSupabase({ content_items: { select: { data: row({ status: "retired" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(back);
    expect((await A.restoreRetiredItem(ID)).ok).toBe(true);
    expect(back.of("content_items", "update")[0]?.values).toMatchObject({ status: "draft", approver_id: null });
  });
});
