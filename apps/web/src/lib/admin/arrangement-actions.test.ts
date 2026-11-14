/**
 * THE DISPUTE DECISION (lib/admin/arrangement-actions.ts). Pinned: the door
 * is finance; a reason is required; the audit line is written BEFORE the
 * instruction and an unwritten line sends nothing; the instruction carries
 * the member of staff's own id; a refusal and an unanswered call are never
 * success.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";

const ME = "11111111-1111-4111-8111-111111111111";
const ARRANGEMENT = "44444444-4444-4444-8444-444444444444";
const REASON = "The lister never handed over the keys, on both statements.";

const state = vi.hoisted(() => ({
  access: null as unknown,
  allowed: true,
  auditOk: true,
  order: [] as string[],
  audits: [] as { action: string; entityId: string | null; detail?: Record<string, unknown> }[],
  refund: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" }) as unknown),
  release: vi.fn(async (_d: unknown, _i: unknown) => ({ outcome: "submitted" }) as unknown),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("./guard", () => ({ requireAdmin: async () => state.access, adminRefusal: () => "not allowed" }));
vi.mock("../security/rate-limit", () => ({ consume: async () => ({ allowed: state.allowed }), subjectForUser: (id: string) => `user:${id}` }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => fakeSupabase().client }));
vi.mock("../alerts", () => ({ recordAlert: async () => ({ ok: true }) }));
vi.mock("./audit", () => ({
  writeAudit: async (_db: unknown, entry: { action: string; entityId: string | null; detail?: Record<string, unknown> }) => {
    state.order.push(`audit:${entry.action}`);
    state.audits.push(entry);
    return state.auditOk;
  },
}));
vi.mock("../money/protected-rail", () => ({
  protectedRailDeps: (db: unknown) => ({ db }),
  instructProtectedRefund: (d: unknown, i: unknown) => {
    state.order.push("refund");
    return state.refund(d, i);
  },
  instructDisputeRelease: (d: unknown, i: unknown) => {
    state.order.push("release");
    return state.release(d, i);
  },
}));

const { decideArrangement } = await import("./arrangement-actions");

beforeEach(() => {
  state.access = { state: "admin", user: { id: ME } };
  state.allowed = true;
  state.auditOk = true;
  state.order = [];
  state.audits = [];
  state.refund.mockClear();
  state.release.mockClear();
});

const refund = { arrangementId: ARRANGEMENT, decision: "refund" as const, reason: REASON };

describe("the door", () => {
  it.each([{ state: "not-admin" }, { state: "step-up" }, { state: "signed-out" }])("refuses %o and instructs nothing", async (access) => {
    state.access = access;
    expect(await decideArrangement(refund)).toEqual({ ok: false, error: "not allowed" });
    expect(state.order).toEqual([]);
  });

  it("slows a run of decisions, and instructs nothing while slowed", async () => {
    state.allowed = false;
    expect((await decideArrangement(refund)).ok).toBe(false);
    expect(state.order).toEqual([]);
  });
});

describe("the decision", () => {
  it("needs a real reason and a real payment", async () => {
    expect((await decideArrangement({ ...refund, reason: "too short" })).ok).toBe(false);
    expect((await decideArrangement({ ...refund, arrangementId: "x" })).ok).toBe(false);
    expect((await decideArrangement({ ...refund, decision: "payout" as never })).ok).toBe(false);
    expect(state.order).toEqual([]);
  });

  it("writes the audit line before the refund instruction, which carries the member of staff's own id and reason", async () => {
    expect(await decideArrangement(refund)).toEqual({ ok: true, data: { submitted: true } });
    expect(state.order).toEqual(["audit:arrangement.refund_instructed", "refund"]);
    expect(state.audits[0]).toMatchObject({ entityId: ARRANGEMENT, detail: { reason: REASON } });
    expect(state.refund.mock.calls[0]?.[1]).toEqual({ arrangementId: ARRANGEMENT, staffUserId: ME, reason: REASON });
    expect(state.release).not.toHaveBeenCalled();
  });

  it("a release to the lister goes through its own instruction and its own audit action", async () => {
    expect(await decideArrangement({ ...refund, decision: "release" })).toEqual({ ok: true, data: { submitted: true } });
    expect(state.order).toEqual(["audit:arrangement.dispute_release_instructed", "release"]);
    expect(state.refund).not.toHaveBeenCalled();
  });

  it("sends nothing when the audit line could not be written", async () => {
    state.auditOk = false;
    expect((await decideArrangement(refund)).ok).toBe(false);
    expect(state.refund).not.toHaveBeenCalled();
  });

  it("a refusal is said, recorded as not sent, and is never success", async () => {
    state.refund.mockResolvedValueOnce({ outcome: "refused", reason: "not_refundable:released" });
    const out = await decideArrangement(refund);
    expect(out.ok).toBe(false);
    expect(out.ok ? "" : out.error).toContain("released");
    expect(state.order).toEqual(["audit:arrangement.refund_instructed", "refund", "audit:arrangement.decision_not_sent"]);
    expect(state.audits[1]).toMatchObject({ detail: { decision: "refund", why: "not_refundable:released" } });
  });

  it("an unanswered instruction is reported as not submitted", async () => {
    state.refund.mockResolvedValueOnce({ outcome: "unknown" });
    expect(await decideArrangement(refund)).toEqual({ ok: true, data: { submitted: false } });
  });
});
