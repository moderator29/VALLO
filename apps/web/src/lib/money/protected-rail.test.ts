/**
 * THE PROTECTED RAIL'S SERVER RULES (lib/money/protected-rail.ts). Each test
 * pins a way the rail could otherwise move or misreport money.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";
import type { RailResult } from "../payments/provider";

vi.mock("./provider-arrangements", () => ({ releaseGate: async () => "clear" }));

const rail = await import("./protected-rail");

const ROW = {
  id: "arr-1",
  agreement_id: "ag-1",
  provider: "escrowpay",
  reference: "vallo-pp-1",
  provider_reference: "ep-1",
  amount_minor: 180_000_00,
  buyer_user_id: "payer",
  seller_user_id: "lister",
  status: "protected",
};

const CONFIG = { baseUrl: "https://sandbox.example.test", apiKey: "k", webhookSecret: "s", environment: "sandbox" as const };

function deps(over: { row?: Record<string, unknown> | null; open?: unknown; enabled?: boolean; reachable?: boolean; send?: RailResult<unknown> } = {}) {
  const db = fakeSupabase({
    provider_arrangements: { select: { data: over.row === undefined ? ROW : over.row } },
    provider_arrangement_observe: { rpc: { data: "changed" } },
    protected_payment_open: { rpc: { data: over.open ?? { status: "ok", id: "arr-1" } } },
    protected_payment_transfer_reported: { rpc: { data: "ok" } },
  });
  const send = vi.fn(async () => over.send ?? ({ ok: false, kind: "not_configured", httpStatus: null, detail: "", retryAfterSeconds: null } as RailResult<unknown>));
  const alert = vi.fn(async () => undefined);
  const d = {
    db: db.client as never,
    config: over.reachable === false ? null : CONFIG,
    send,
    enabled: async () => over.enabled ?? false,
    alert,
  };
  return { d, db, send, alert };
}

describe("the rail is shut while undocumented or switched off", () => {
  it("is not reachable today: the client is undocumented", () => {
    const { d } = deps();
    expect(rail.providerReachable(d)).toBe(false);
  });

  it("opens nothing and calls nothing while shut", async () => {
    const { d, db, send } = deps({ enabled: true });
    expect(await rail.openProtectedPayment(d, { agreementId: "ag-1", acceptedVersion: 3, actorUserId: "payer" })).toEqual({
      outcome: "refused",
      reason: "not_configured",
    });
    expect(db.of("protected_payment_open", "rpc")).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("never asks for a release while shut", async () => {
    const { d, db } = deps({ enabled: true });
    expect(await rail.confirmProtectedMilestone(d, { arrangementId: "arr-1", actorUserId: "payer" })).toMatchObject({ outcome: "refused" });
    expect(db.of("provider_arrangement_observe", "rpc")).toHaveLength(0);
  });

  it("reconciles nothing while unreachable", async () => {
    const { d, send } = deps();
    expect(await rail.reconcileProtected(d)).toEqual({ read: 0, moved: 0, skipped: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("'I've made the transfer' only asks to look again", () => {
  it("writes the mark through the database door and never observes a funded state", async () => {
    const { d, db } = deps({ row: { ...ROW, status: "awaiting_payment" } });
    const out = await rail.reportTransfer(d, { arrangementId: "arr-1", actorUserId: "payer" });
    expect(out).toEqual({ outcome: "not_reachable" });
    expect(db.of("protected_payment_transfer_reported", "rpc")[0]?.values).toEqual({ p_arrangement: "arr-1", p_payer: "payer" });
    expect(db.of("provider_arrangement_observe", "rpc")).toHaveLength(0);
  });
});

describe("a dispute is Vallo's own process and moves no money", () => {
  it("either party may open it while the money is held; it records disputed from Vallo with the statement", async () => {
    const { d, db, alert } = deps();
    const out = await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "lister", statement: "The keys were never handed over." });
    expect(out).toEqual({ outcome: "submitted" });
    const call = db.of("provider_arrangement_observe", "rpc")[0]?.values as Record<string, unknown>;
    expect(call).toMatchObject({ p_to_status: "disputed", p_source: "vallo" });
    expect((call.p_detail as Record<string, unknown>).opened_by).toBe("lister");
    expect(alert).toHaveBeenCalled();
  });

  it("a stranger cannot, and an empty statement is refused", async () => {
    const { d } = deps();
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "someone", statement: "x".repeat(20) })).toMatchObject({ outcome: "refused", reason: "not_found" });
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "payer", statement: "short" })).toMatchObject({ reason: "statement_too_short" });
  });

  it("a Payluk row is never touched by this rail", async () => {
    const { d } = deps({ row: { ...ROW, provider: "payluk" } });
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "payer", statement: "x".repeat(20) })).toMatchObject({ reason: "not_found" });
  });
});

describe("the webhook moves only on a word the documentation maps", () => {
  it("an unmapped status moves nothing", async () => {
    const { d, db } = deps();
    expect(await rail.applyProtectedWebhook(d, { key: "k1", providerReference: "ep-1", status: "released" })).toBe("unmapped");
    expect(db.of("provider_arrangement_observe", "rpc")).toHaveLength(0);
  });
});

describe("new transfer details are never invented", () => {
  it("refuses until the provider documents how", async () => {
    const { d } = deps({ row: { ...ROW, status: "awaiting_payment" } });
    expect(await rail.askNewTransferDetails(d, { arrangementId: "arr-1", actorUserId: "payer" })).toMatchObject({ outcome: "refused" });
  });
});
