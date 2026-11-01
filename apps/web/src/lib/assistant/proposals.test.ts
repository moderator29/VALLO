import { describe, expect, it } from "vitest";
import { createProposal, decideProposal, readOwnProposal, recordProposalResult, refusalWords, retryProposal } from "./proposals";

type Call = { fn: string; args?: Record<string, unknown> };
const client = (answers: Record<string, unknown>, calls: Call[] = []) => ({
  calls,
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    calls.push({ fn, ...(args ? { args } : {}) });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return { data: a, error: null };
  },
});

describe("createProposal", () => {
  it("returns the id and the hash the database computed", async () => {
    const c = client({ ai_proposal_create: { ok: true, id: "p1", payload_hash: "h".repeat(64), expires_at: "2026-11-01T11:00:00Z" } });
    await expect(createProposal(c, "viewing_request", { listing_id: "l1" })).resolves.toEqual({
      ok: true,
      id: "p1",
      payloadHash: "h".repeat(64),
      expiresAt: "2026-11-01T11:00:00Z",
    });
    expect(c.calls[0]).toEqual({ fn: "ai_proposal_create", args: { p_kind: "viewing_request", p_payload: { listing_id: "l1" } } });
  });

  it("carries the database's refusal and never throws", async () => {
    await expect(createProposal(client({ ai_proposal_create: { ok: false, reason: "not_granted" } }), "payment_review", {})).resolves.toEqual({ ok: false, reason: "not_granted" });
    await expect(createProposal(client({ ai_proposal_create: new Error("down") }), "payment_review", {})).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(createProposal(client({ ai_proposal_create: { ok: false, reason: "made_up" } }), "payment_review", {})).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("decideProposal", () => {
  it("returns the stored payload on a confirm, from the database and not from the browser", async () => {
    const c = client({ ai_proposal_decide: { ok: true, decision: "confirm", kind: "save_listing", payload: { listing_id: "l1" } } });
    await expect(decideProposal(c, "p1", "confirm", "h")).resolves.toEqual({ ok: true, decision: "confirm", kind: "save_listing", payload: { listing_id: "l1" } });
  });

  it.each(["expired", "revoked", "hash_mismatch", "already_decided", "not_found"] as const)("passes %s through as a refusal", async (reason) => {
    await expect(decideProposal(client({ ai_proposal_decide: { ok: false, reason } }), "p1", "confirm", "h")).resolves.toEqual({ ok: false, reason });
  });

  it("answers a cancel with no payload", async () => {
    const out = await decideProposal(client({ ai_proposal_decide: { ok: true, decision: "cancel", kind: "viewing_request" } }), "p1", "cancel", "h");
    expect(out).toEqual({ ok: true, decision: "cancel", kind: "viewing_request" });
  });
});

describe("results, retries and reads", () => {
  it("records a result once and retries only as a new proposal", async () => {
    const c = client({ ai_proposal_result: { ok: true }, ai_proposal_retry: { ok: true, id: "p2", payload_hash: "x".repeat(64) } });
    await recordProposalResult(c, "p1", { ok: false });
    expect(c.calls[0]?.fn).toBe("ai_proposal_result");
    const again = await retryProposal(c, "p1");
    expect(again).toMatchObject({ ok: true, id: "p2" });
    await expect(retryProposal(client({ ai_proposal_retry: { ok: false, reason: "not_retryable" } }), "p1")).resolves.toEqual({ ok: false, reason: "not_retryable" });
  });

  it("reads only the member's own proposal and fails closed", async () => {
    const own = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "p1", kind: "payment_review", status: "pending", payload: { booking_id: "b" }, result: null }, error: null }) }) }) }) };
    await expect(readOwnProposal(own, "p1")).resolves.toMatchObject({ kind: "payment_review", payload: { booking_id: "b" } });
    const broken = { from: () => { throw new Error("down"); } };
    await expect(readOwnProposal(broken, "p1")).resolves.toBeNull();
  });

  it("says one plain sentence per refusal, none with an em dash", () => {
    for (const r of ["expired", "revoked", "not_granted", "already_decided", "hash_mismatch", "not_found", "unavailable"] as const) {
      expect(refusalWords(r).length).toBeGreaterThan(10);
      expect(refusalWords(r)).not.toContain("—");
    }
  });
});
