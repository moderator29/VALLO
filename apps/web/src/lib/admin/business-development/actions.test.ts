import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../testing/fake-supabase";

const ME = "11111111-1111-4111-8111-111111111111";
const PROSPECT = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({ access: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../audit", () => ({ writeAudit: async () => true }));
vi.mock("../../supabase/admin", () => ({ createAdminClient: () => fakeSupabase().client }));
vi.mock("../guard", () => ({
  requireAdmin: async () => state.access,
  adminRefusal: () => "Your access does not allow this.",
}));

const { addProspect, changeStage, setNextFollowUp, linkListing, logActivity } = await import("./actions");

let db: ReturnType<typeof fakeSupabase>;

function admin(script: Parameters<typeof fakeSupabase>[0] = {}) {
  db = fakeSupabase(script);
  state.access = { state: "admin", supabase: db.client, userClient: db.client, user: { id: ME }, isAdmin: true, isSuperAdmin: false, isStaff: true };
}

beforeEach(() => {
  admin();
});

describe("addProspect", () => {
  it("refuses a caller requireAdmin does not let through", async () => {
    state.access = { state: "not-admin" };
    const out = await addProspect({ contactName: "Ada", businessName: "Ada Lets", category: "landlord", email: "ada@example.com" });
    expect(out.ok).toBe(false);
    expect(db.wrote()).toBe(false);
  });

  it("requires a contact route", async () => {
    const out = await addProspect({ contactName: "Ada", businessName: "Ada Lets", category: "landlord" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.fieldErrors?.email).toBeTruthy();
    expect(db.wrote()).toBe(false);
  });

  it("inserts a new prospect at stage new, assigned to the caller", async () => {
    admin({ bd_prospects: { insert: { data: { id: PROSPECT } } } });
    const out = await addProspect({ contactName: "Ada", businessName: "Ada Lets", category: "landlord", email: "ada@example.com" });
    expect(out.ok).toBe(true);
    const insert = db.of("bd_prospects", "insert")[0];
    expect(insert?.values).toMatchObject({ stage: "new", created_by: ME, assigned_to: ME, business_name: "Ada Lets" });
  });

  it("answers honestly when the table does not exist yet", async () => {
    admin({ bd_prospects: { insert: { error: { code: "42P01" } } } });
    const out = await addProspect({ contactName: "Ada", businessName: "Ada Lets", category: "landlord", email: "ada@example.com" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("not set up");
  });
});

describe("changeStage", () => {
  it("logs a stage_change activity row and stamps onboarded_at on 'onboarded'", async () => {
    admin({ bd_prospects: { update: { data: [{ id: PROSPECT, stage: "onboarded" }] } } });
    const out = await changeStage({ prospectId: PROSPECT, stage: "onboarded" });
    expect(out.ok).toBe(true);
    const update = db.of("bd_prospects", "update")[0];
    expect(update?.values).toMatchObject({ stage: "onboarded" });
    expect(typeof (update?.values as Record<string, unknown>).onboarded_at).toBe("string");
    expect(db.of("bd_prospect_activity", "insert")).toHaveLength(1);
  });

  it("refuses an unknown stage", async () => {
    const out = await changeStage({ prospectId: PROSPECT, stage: "won" });
    expect(out.ok).toBe(false);
  });

  it("says so when the prospect cannot be found", async () => {
    admin({ bd_prospects: { update: { data: [] } } });
    const out = await changeStage({ prospectId: PROSPECT, stage: "contacted" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("Could not find");
  });
});

describe("logActivity", () => {
  it("requires an outcome for a contact", async () => {
    const out = await logActivity({ prospectId: PROSPECT, kind: "contact", body: "Called them" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.fieldErrors?.outcome).toBeTruthy();
  });

  it("logs a contact with its outcome and moves a new prospect to contacted", async () => {
    const out = await logActivity({ prospectId: PROSPECT, kind: "contact", body: "Called them", outcome: "Interested" });
    expect(out.ok).toBe(true);
    const insert = db.of("bd_prospect_activity", "insert")[0];
    expect(insert?.values).toMatchObject({ kind: "contact", outcome: "Interested" });
    const update = db.of("bd_prospects", "update")[0];
    expect(update?.values).toMatchObject({ stage: "contacted" });
  });

  it("logs a follow-up with no outcome required", async () => {
    const out = await logActivity({ prospectId: PROSPECT, kind: "follow_up", body: "Checked in" });
    expect(out.ok).toBe(true);
    const insert = db.of("bd_prospect_activity", "insert")[0];
    expect(insert?.values).toMatchObject({ kind: "follow_up", outcome: null });
  });
});

describe("linkListing and setNextFollowUp", () => {
  it("links a real listing id to a prospect, separate from onboarding", async () => {
    admin({ bd_prospects: { update: { data: [{ id: PROSPECT }] } } });
    const listingId = "33333333-3333-4333-8333-333333333333";
    const out = await linkListing({ prospectId: PROSPECT, listingId });
    expect(out.ok).toBe(true);
    expect(db.of("bd_prospects", "update")[0]?.values).toMatchObject({ listing_id: listingId });
  });

  it("refuses a listing id that is not a uuid", async () => {
    const out = await linkListing({ prospectId: PROSPECT, listingId: "not-a-uuid" });
    expect(out.ok).toBe(false);
  });

  it("sets and clears the next follow-up date", async () => {
    admin({ bd_prospects: { update: { data: [{ id: PROSPECT }] } } });
    const out = await setNextFollowUp({ prospectId: PROSPECT, date: "2026-12-01" });
    expect(out.ok).toBe(true);
    expect(db.of("bd_prospects", "update")[0]?.values).toMatchObject({ next_follow_up_at: "2026-12-01" });
  });
});
