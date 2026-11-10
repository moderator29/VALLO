import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/** THE SUPPORT LEAD'S WRITES: the gate, reviews, policy approval, and handing a ticket over. */
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireCoo: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: guard.requireAdmin }));
vi.mock("@/lib/admin/overview/guard", () => ({ requireCoo: guard.requireCoo }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("@/lib/admin/audit", () => audit);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const A = await import("./actions");
const ID = "11111111-1111-1111-1111-111111111111";
const AGENT = "22222222-2222-2222-2222-222222222222";
const ME = "lead-1";
const QA = { ticketRef: "VAL-9", agentId: AGENT, tone: "4", accuracy: "4", speed: "4", policy: "4", notes: "" };
const asLead = (fake: ReturnType<typeof fakeSupabase>, userClient: unknown = fake.client) => {
  guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: ME }, supabase: fake.client, userClient, isStaff: true });
  guard.requireCoo.mockResolvedValue({ state: "not-admin" });
};

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireCoo.mockReset();
  audit.writeAudit.mockClear();
});

describe("the gate", () => {
  it("refuses every non-staff caller", async () => {
    for (const state of ["signed-out", "not-admin", "step-up", "unconfigured"]) {
      guard.requireAdmin.mockResolvedValue({ state });
      guard.requireCoo.mockResolvedValue({ state: "not-admin" });
      expect((await A.createQaReview(QA)).ok, state).toBe(false);
      expect((await A.assignTicket(ID, AGENT)).ok, state).toBe(false);
    }
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });
});

describe("quality reviews", () => {
  it("reviews a colleague on the support team, and stores a reference and scores only", async () => {
    const fake = fakeSupabase({ staff_grants: { select: { data: { user_id: AGENT }, error: null } }, support_qa_reviews: { insert: { data: { id: ID }, error: null } } });
    asLead(fake);
    expect((await A.createQaReview(QA)).ok).toBe(true);
    const values = fake.of("support_qa_reviews", "insert")[0]?.values as Record<string, unknown>;
    expect(values).toMatchObject({ ticket_ref: "VAL-9", reviewed_agent: AGENT, reviewer_id: ME, tone: 4 });
    expect(Object.keys(values).sort()).toEqual(["accuracy", "notes", "policy", "reviewed_agent", "reviewer_id", "speed", "ticket_ref", "tone"]);
  });
  it("will not review a person outside the support team, nor oneself", async () => {
    const none = fakeSupabase({ staff_grants: { select: { data: null, error: null } } });
    asLead(none);
    expect((await A.createQaReview(QA)).ok).toBe(false);
    const self = fakeSupabase({ staff_grants: { select: { data: { user_id: ME }, error: null } } });
    asLead(self);
    expect((await A.createQaReview({ ...QA, agentId: ME })).ok).toBe(false);
    expect(none.wrote() || self.wrote()).toBe(false);
  });
  it("validates before it reads or writes", async () => {
    const fake = fakeSupabase();
    asLead(fake);
    expect((await A.createQaReview({ ...QA, tone: "9" })).ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("policy notes", () => {
  const note = (over: Record<string, unknown> = {}) => ({ id: ID, status: "draft", created_by: ME, ...over });
  it("creates a draft, edits only a draft, and never approves its own", async () => {
    const fake = fakeSupabase({ support_policy_notes: { insert: { data: { id: ID }, error: null }, select: { data: note(), error: null }, update: { data: [{ id: ID }], error: null } } });
    asLead(fake);
    expect((await A.createPolicyNote({ title: "Deposits", body: "Say this" })).ok).toBe(true);
    expect(fake.of("support_policy_notes", "insert")[0]?.values).toMatchObject({ status: "draft", created_by: ME });
    expect((await A.updatePolicyNote(ID, { title: "Deposits", body: "Say that" })).ok).toBe(true);
    guard.requireAdmin.mockResolvedValue({ state: "admin", user: { id: ME }, supabase: fake.client, isStaff: false });
    expect((await A.approvePolicyNote(ID)).ok).toBe(false);
  });
  it("lets the COO approve a draft someone else wrote, and only once", async () => {
    const fake = fakeSupabase({ support_policy_notes: { select: { data: note({ created_by: "lead" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    guard.requireCoo.mockResolvedValue({ state: "coo", supabase: fake.client, user: { id: "coo-1" }, isSuperAdmin: false });
    expect((await A.approvePolicyNote(ID)).ok).toBe(true);
    const upd = fake.of("support_policy_notes", "update")[0];
    expect(upd?.values).toMatchObject({ status: "approved", approved_by: "coo-1" });
    expect(upd?.filters).toContainEqual(["eq", "status", "draft"]);
    expect((await A.createPolicyNote({ title: "T", body: "b" })).ok).toBe(false);
  });
  it("takes an approved note back only with a reason, and refuses editing an approved one", async () => {
    const fake = fakeSupabase({ support_policy_notes: { select: { data: note({ status: "approved" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asLead(fake);
    expect((await A.updatePolicyNote(ID, { title: "T", body: "b" })).ok).toBe(false);
    expect((await A.withdrawPolicyApproval(ID, "no")).ok).toBe(false);
    expect((await A.withdrawPolicyApproval(ID, "The refund wording changed")).ok).toBe(true);
    expect(fake.of("support_policy_notes", "update")[0]?.values).toMatchObject({ status: "draft", approved_by: null });
  });
  it("retires and restores as inverses", async () => {
    const fake = fakeSupabase({ support_policy_notes: { select: { data: note({ status: "approved" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asLead(fake);
    expect((await A.retirePolicyNote(ID)).ok).toBe(true);
    const back = fakeSupabase({ support_policy_notes: { select: { data: note({ status: "retired" }), error: null }, update: { data: [{ id: ID }], error: null } } });
    asLead(back);
    expect((await A.restorePolicyNote(ID)).ok).toBe(true);
    expect(back.of("support_policy_notes", "update")[0]?.values).toMatchObject({ status: "draft" });
  });
});

describe("assignTicket", () => {
  it("hands a ticket over through the database's own door, with the Lead's own session", async () => {
    const own = fakeSupabase();
    own.client.rpc = vi.fn(async () => ({ data: { status: "ok" }, error: null })) as never;
    const fake = fakeSupabase({ staff_grants: { select: { data: { user_id: AGENT }, error: null } } });
    asLead(fake, own.client);
    expect((await A.assignTicket(ID, AGENT)).ok).toBe(true);
    expect(own.client.rpc).toHaveBeenCalledWith("queue_assign", { p_kind: "ticket", p_item: ID, p_to: AGENT, p_batch: null });
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "support_lead.ticket.assign" }));
  });
  it("says so when somebody holds it, and refuses a colleague outside support", async () => {
    const own = fakeSupabase();
    own.client.rpc = vi.fn(async () => ({ data: { status: "taken" }, error: null })) as never;
    const fake = fakeSupabase({ staff_grants: { select: { data: { user_id: AGENT }, error: null } } });
    asLead(fake, own.client);
    const r = await A.assignTicket(ID, AGENT);
    expect(!r.ok && r.error).toMatch(/Somebody is working/);
    const outside = fakeSupabase({ staff_grants: { select: { data: null, error: null } } });
    asLead(outside, own.client);
    expect((await A.assignTicket(ID, AGENT)).ok).toBe(false);
    expect((await A.assignTicket("nope", AGENT)).ok).toBe(false);
  });
});
