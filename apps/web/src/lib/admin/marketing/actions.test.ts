import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * THE MARKETING DESK'S WRITES: the gate, validation before any write, the
 * status moves, ownership, and who may approve. The fake client records the
 * SQL each action issues; there is no real database.
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
const INPUT = {
  name: "December push", objective: "Grow sign-ups", channel: "social", audience: "Renters", startsOn: "2026-12-01", endsOn: "2026-12-31", budget: "250000",
  notes: "", utmBase: "", utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "",
};

function asStaff(fake: ReturnType<typeof fakeSupabase>, over: { isStaff?: boolean } = {}) {
  guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: ME }, supabase: fake.client, isStaff: over.isStaff ?? true });
  guard.requireCoo.mockResolvedValue({ state: "not-admin" });
}
const row = (over: Record<string, unknown> = {}) => ({ id: ID, owner_id: ME, created_by: ME, status: "draft", approval: "none", ...over });

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireCoo.mockReset();
  audit.writeAudit.mockClear();
});

describe("the gate", () => {
  it("refuses every kind of non-staff caller without writing", async () => {
    for (const state of ["signed-out", "not-admin", "step-up", "unconfigured"]) {
      guard.requireAdmin.mockResolvedValue({ state });
      guard.requireCoo.mockResolvedValue({ state: "not-admin" });
      const r = await A.createCampaign(INPUT);
      expect(r.ok, state).toBe(false);
    }
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });

  it("lets the COO in only to approve or send back, never to change a campaign", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ created_by: "someone-else" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.createCampaign(INPUT)).ok).toBe(false);
    expect((await A.setCampaignStatus(ID, "live")).ok).toBe(false);
    expect((await A.logResult({ campaignId: ID, recordedOn: "2026-11-10", metric: "clicks", value: "5", note: "" })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.approveCampaign(ID)).ok).toBe(true);
  });
});

describe("createCampaign", () => {
  it("validates before it writes", async () => {
    const fake = fakeSupabase();
    asStaff(fake);
    const r = await A.createCampaign({ ...INPUT, name: " ", budget: "-1" });
    expect(r.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("inserts a draft owned by the caller, with the budget in kobo, and audits it", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake);
    const r = await A.createCampaign(INPUT);
    expect(r.ok).toBe(true);
    const values = fake.of("marketing_campaigns", "insert")[0]?.values as Record<string, unknown>;
    expect(values).toMatchObject({ status: "draft", approval: "none", owner_id: ME, created_by: ME, budget_kobo: 25_000_000 });
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "marketing.campaign.create", actorId: ME }));
  });

  it("says the tables are not set up yet instead of showing a database error", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { insert: { data: null, error: { code: "42P01" } } } });
    asStaff(fake);
    const r = await A.createCampaign(INPUT);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/not set up/);
  });
});

describe("ownership", () => {
  it("refuses a colleague's campaign, but not for an admin", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ owner_id: "other", created_by: "other" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.updateCampaign(ID, INPUT)).ok).toBe(false);
    expect((await A.submitCampaign(ID)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    expect((await A.updateCampaign(ID, INPUT)).ok).toBe(true);
  });
});

describe("approval", () => {
  it("submits only a draft that was not already sent, and approves into planned", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.submitCampaign(ID)).ok).toBe(true);
    const sub = fake.of("marketing_campaigns", "update")[0];
    expect(sub?.values).toMatchObject({ approval: "submitted" });
    expect(sub?.filters).toContainEqual(["eq", "status", "draft"]);
    expect(sub?.filters).toContainEqual(["in", "approval", ["none", "sent_back"]]);
  });

  it("will not approve what the caller made, and will not approve unless an approver", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ created_by: "admin-1" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    guard.requireCoo.mockResolvedValue({ state: "not-admin" });
    const own = await A.approveCampaign(ID);
    expect(own.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    const plain = fakeSupabase({ marketing_campaigns: { select: { data: row({ created_by: "x" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(plain);
    expect((await A.approveCampaign(ID)).ok).toBe(false);
    expect(plain.wrote()).toBe(false);
  });

  it("approves a submitted campaign made by someone else, once, into planned", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ created_by: "mgr" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    expect((await A.approveCampaign(ID)).ok).toBe(true);
    const upd = fake.of("marketing_campaigns", "update")[0];
    expect(upd?.values).toMatchObject({ approval: "approved", status: "planned", approved_by: "admin-1" });
    expect(upd?.filters).toContainEqual(["eq", "approval", "submitted"]);
  });

  it("needs a real reason to send back, and changes nothing without one", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ created_by: "mgr" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: "admin-1" }, supabase: fake.client, isStaff: false });
    expect((await A.sendBackCampaign(ID, "no")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.sendBackCampaign(ID, "Budget is not agreed yet")).ok).toBe(true);
    expect(fake.of("marketing_campaigns", "update")[0]?.values).toMatchObject({ approval: "sent_back", approval_note: "Budget is not agreed yet" });
  });
});

describe("status moves", () => {
  it("refuses live until the campaign is approved, and refuses a move the table does not allow", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ status: "planned", approval: "none" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.setCampaignStatus(ID, "live")).ok).toBe(false);
    expect((await A.setCampaignStatus(ID, "ended")).ok).toBe(false);
    expect((await A.setCampaignStatus(ID, "draft")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("takes an approved planned campaign live, guarded on the status it read", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ status: "planned", approval: "approved" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.setCampaignStatus(ID, "live")).ok).toBe(true);
    const upd = fake.of("marketing_campaigns", "update")[0];
    expect(upd?.values).toEqual({ status: "live" });
    expect(upd?.filters).toContainEqual(["eq", "status", "planned"]);
  });

  it("restores only a cancelled campaign, as a draft that needs approval again", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row({ status: "cancelled" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.restoreCancelledCampaign(ID)).ok).toBe(true);
    const upd = fake.of("marketing_campaigns", "update")[0];
    expect(upd?.values).toMatchObject({ status: "draft", approval: "none", approved_by: null });
    expect(upd?.filters).toContainEqual(["eq", "status", "cancelled"]);
  });
});

describe("logging results", () => {
  const base = { campaignId: ID, recordedOn: "2026-11-10", metric: "clicks", value: "120", note: "from the platform" };
  it("validates the metric, the date and the number before writing", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row(), error: null } } });
    asStaff(fake);
    for (const bad of [{ metric: "vibes" }, { recordedOn: "10/11/2026" }, { value: "-4" }, { value: "lots" }, { campaignId: "nope" }]) {
      expect((await A.logResult({ ...base, ...bad })).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(fake.wrote()).toBe(false);
  });

  it("stores spend typed in naira as kobo", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row(), error: null } }, marketing_campaign_results: { insert: { data: { id: ID }, error: null } } });
    asStaff(fake);
    expect((await A.logResult({ ...base, metric: "spend_kobo", value: "15,000.50" })).ok).toBe(true);
    expect(fake.of("marketing_campaign_results", "insert")[0]?.values).toMatchObject({ metric: "spend_kobo", value: 1_500_050, recorded_by: ME });
  });

  it("voids a number instead of deleting it, and can put it back", async () => {
    const fake = fakeSupabase({ marketing_campaign_results: { update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.voidResult(ID)).ok).toBe(true);
    expect(fake.of("marketing_campaign_results", "delete")).toEqual([]);
    expect(fake.of("marketing_campaign_results", "update")[0]?.values).toMatchObject({ voided_by: ME });
    expect((await A.unvoidResult(ID)).ok).toBe(true);
    expect(fake.of("marketing_campaign_results", "update")[1]?.values).toEqual({ voided_at: null, voided_by: null });
  });
});

describe("tracked-link tags", () => {
  it("refuses tags the builder refuses and saves the normalised ones", async () => {
    const fake = fakeSupabase({ marketing_campaigns: { select: { data: row(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asStaff(fake);
    expect((await A.saveCampaignUtm(ID, { base: "nope", source: "a", medium: "b", campaign: "c", content: "", term: "" })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect((await A.saveCampaignUtm(ID, { base: "https://vallo.ng", source: "Instagram", medium: "social", campaign: "Dec Push", content: "", term: "" })).ok).toBe(true);
    expect(fake.of("marketing_campaigns", "update")[0]?.values).toMatchObject({ utm_source: "instagram", utm_campaign: "dec-push", utm_content: null });
  });
});
