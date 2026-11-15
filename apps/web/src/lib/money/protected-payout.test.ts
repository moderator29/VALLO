/**
 * THE PAYOUT TO THE LISTER (lib/money/protected-payout.ts). Pinned: a payout
 * is recorded only from the partner's own word, only as a step it may take
 * from where the record stands, never over somebody else's write; a failed or
 * returned transfer tells a person; a missed webhook is read back; and until
 * the payout columns exist nothing fails.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call } from "../testing/fake-supabase";
import type { RailResult } from "../payments/provider";
import type { EscrowPayCall } from "../payments/providers/escrowpay/client";
import type { EscrowPayWebhook } from "../payments/providers/escrowpay/webhooks";

const payouts = await import("./protected-payout");
const { payoutStepOk, normalisePayoutWord, normalisePayoutEvent, ESCROWPAY_PAYOUT_EVENTS } = await import("../payments/providers/escrowpay/normaliser");
const { ESCROWPAY_EVENT_TYPES } = await import("../payments/providers/escrowpay/webhooks");

const NOW = Date.parse("2026-11-15T10:00:00Z");
const ROW = {
  id: "arr-1",
  reference: "vallo-pp-1",
  status: "released",
  provider_arrangement_id: "TXN_1",
  payout_status: null as string | null,
  payout_reference: null as string | null,
  release_requested_at: "2026-11-15T09:00:00Z",
  release_confirmed_at: "2026-11-15T09:00:05Z",
  payout_updated_at: null,
};
const CONFIG = { baseUrl: "https://api.example.test", apiKey: "sk_test_x", webhookSecret: null, webhookSecretPrevious: null, environment: "sandbox" as const, payoutPreference: "automatic" as const, startsMoney: true };
const ok = (data: unknown): RailResult<unknown> => ({ ok: true, value: { success: true, message: "ok", data } });

function deps(over: { row?: Record<string, unknown> | null; rows?: Record<string, unknown>[]; select?: { error: { code: string } }; updated?: boolean; answers?: Record<string, RailResult<unknown>> } = {}) {
  const db = fakeSupabase({
    provider_arrangements: {
      select: (call: Call) =>
        over.select ? { data: null, error: over.select.error } : call.filters.some((f) => f[1] === "provider_arrangement_id") ? { data: over.row === undefined ? ROW : over.row } : { data: over.rows ?? [ROW] },
      update: () => ({ data: over.updated === false ? [] : [{ id: "arr-1" }] }),
    },
    provider_arrangement_events: { insert: { data: null } },
  });
  const send = vi.fn(async (_c: unknown, call: EscrowPayCall) => over.answers?.[`${call.method} ${call.path}`] ?? ({ ok: false, kind: "unknown", httpStatus: null, detail: "", retryAfterSeconds: null } as RailResult<unknown>));
  const alert = vi.fn(async () => undefined);
  const d = { db: db.client as never, config: CONFIG, documented: true, send, enabled: async () => true, alert, now: () => NOW };
  const writes = () => db.of("provider_arrangements", "update");
  return { d, db, send, alert, writes };
}

const event = (over: Partial<EscrowPayWebhook> = {}): EscrowPayWebhook => ({
  key: "WHEV_9",
  event: "payout.completed",
  object: "payout",
  objectId: "POT_1",
  transactionId: "TXN_1",
  amountMinor: 17_993_000,
  createdAt: "2026-11-15T09:01:00Z",
  data: { transaction_id: "TXN_1", amount_minor: 17_993_000, fee_minor: 7_000, completed_at: "2026-11-15T09:00:59Z" },
  ...over,
});

describe("the payout's own rules", () => {
  it("maps only payout events from the provider's closed set", () => {
    for (const name of Object.keys(ESCROWPAY_PAYOUT_EVENTS)) expect(ESCROWPAY_EVENT_TYPES).toContain(name);
    expect(normalisePayoutEvent("payout.completed")).toBe("paid");
    expect(normalisePayoutEvent("release.completed")).toBeNull();
    expect(normalisePayoutWord("completed")).toBe("paid");
    expect(normalisePayoutWord("COMPLETED ")).toBe("paid");
    expect(normalisePayoutWord("something_new")).toBeNull();
  });

  it("never steps a paid transfer back to waiting or failed; a failed one may be retried", () => {
    expect(payoutStepOk(null, "processing")).toBe(true);
    expect(payoutStepOk("processing", "paid")).toBe(true);
    expect(payoutStepOk("paid", "processing")).toBe(false);
    expect(payoutStepOk("paid", "failed")).toBe(false);
    expect(payoutStepOk("paid", "reversed")).toBe(true);
    expect(payoutStepOk("failed", "processing")).toBe(true);
    expect(payoutStepOk("failed", "paid")).toBe(true);
    expect(payoutStepOk("paid", "paid")).toBe(false);
  });
});

describe("a payout webhook", () => {
  it("records the transfer as paid, with the partner's id, amount, fee and time, conditional on the state it read", async () => {
    const { d, db, writes, alert } = deps();
    expect(await payouts.applyPayoutWebhook(d, event())).toBe("changed");
    const write = writes()[0]!;
    expect(write.values).toEqual({
      payout_status: "paid",
      payout_updated_at: "2026-11-15T10:00:00.000Z",
      payout_reference: "POT_1",
      payout_amount_minor: 17_993_000,
      payout_fee_minor: 7_000,
      payout_completed_at: "2026-11-15T09:00:59Z",
    });
    expect(write.filters).toContainEqual(["eq", "id", "arr-1"]);
    expect(write.filters).toContainEqual(["is", "payout_status", null]);
    /* On the payment's own trail, for the staff desk. */
    expect(db.of("provider_arrangement_events", "insert")[0]!.values).toMatchObject({ arrangement_id: "arr-1", from_status: "released", to_status: "released", source: "provider_webhook", detail: { payout: "paid", payout_id: "POT_1" } });
    expect(alert).not.toHaveBeenCalled();
  });

  it.each(["payout.failed", "payout.reversed"])("%s is recorded and a person is told", async (name) => {
    const { d, alert } = deps({ row: { ...ROW, payout_status: "processing" } });
    expect(await payouts.applyPayoutWebhook(d, event({ event: name }))).toBe("changed");
    expect(alert).toHaveBeenCalledWith("protected_rail.payout_trouble", expect.objectContaining({ arrangement_id: "arr-1", payout_id: "POT_1" }));
  });

  it("a late 'processing' after the transfer was paid changes nothing", async () => {
    const { d, writes } = deps({ row: { ...ROW, payout_status: "paid" } });
    expect(await payouts.applyPayoutWebhook(d, event({ event: "payout.processing" }))).toBe("refused");
    expect(writes()).toHaveLength(0);
  });

  it("a redelivery of the same step changes nothing", async () => {
    const { d, writes } = deps({ row: { ...ROW, payout_status: "paid" } });
    expect(await payouts.applyPayoutWebhook(d, event())).toBe("same");
    expect(writes()).toHaveLength(0);
  });

  it("a write somebody else made in between wins: nothing is overwritten", async () => {
    const { d, db } = deps({ updated: false });
    expect(await payouts.applyPayoutWebhook(d, event())).toBe("same");
    expect(db.of("provider_arrangement_events", "insert")).toHaveLength(0);
  });

  it("a payout for a transaction Vallo never made, or naming none, records nothing", async () => {
    expect(await payouts.applyPayoutWebhook(deps({ row: null }).d, event())).toBe("unknown_arrangement");
    expect(await payouts.applyPayoutWebhook(deps().d, event({ transactionId: null }))).toBe("unknown_arrangement");
  });

  it("before the payout columns exist, it records nothing and fails nothing", async () => {
    const { d, alert } = deps({ select: { error: { code: "42703" } } });
    expect(await payouts.applyPayoutWebhook(d, event())).toBe("unmapped");
    expect(alert).not.toHaveBeenCalled();
    expect(await payouts.applyPayoutWebhook(deps({ select: { error: { code: "57014" } } }).d, event())).toBe("error");
  });
});

describe("reading back a missed payout", () => {
  const LIST = "GET /api/v1/payouts?created_from=2026-11-15T08%3A50%3A00.000Z&page_size=100";
  const seen = { id: "POT_7", status: "completed", transaction_id: "TXN_1", amount_minor: 17_993_000, fee_minor: 7_000, completed_at: "2026-11-15T09:01:00Z" };

  it("finds the transfer a release produced among the payouts since, matched on its transaction, and records it", async () => {
    const answers = { [LIST]: ok({ items: [{ ...seen, id: "POT_other", transaction_id: "TXN_9" }, seen] }) };
    const { d, db, send, writes } = deps({ answers });
    expect(await payouts.reconcilePayouts(d)).toEqual({ read: 1, moved: 1, skipped: 0, failed: 0 });
    expect(send.mock.calls[0]![1].path).toBe("/api/v1/payouts?created_from=2026-11-15T08%3A50%3A00.000Z&page_size=100");
    expect(writes()[0]!.values).toMatchObject({ payout_status: "paid", payout_reference: "POT_7", payout_completed_at: "2026-11-15T09:01:00Z" });
    const read = db.of("provider_arrangements", "select")[0]!;
    expect(read.filters).toContainEqual(["eq", "status", "released"]);
    expect(read.filters).toContainEqual(["or", "payout_status.is.null,payout_status.eq.processing", undefined]);
  });

  it("reads a known payout by its own id", async () => {
    const { d, send } = deps({ rows: [{ ...ROW, payout_status: "processing", payout_reference: "POT_7" }], answers: { "GET /api/v1/payouts/POT_7": ok(seen) } });
    expect((await payouts.reconcilePayouts(d)).moved).toBe(1);
    expect(send.mock.calls[0]![1].path).toBe("/api/v1/payouts/POT_7");
  });

  it("no payout yet, or a word Vallo has no meaning for, records nothing", async () => {
    expect(await payouts.reconcilePayouts(deps({ answers: { [LIST]: ok({ items: [] }) } }).d)).toEqual({ read: 1, moved: 0, skipped: 1, failed: 0 });
    expect(await payouts.reconcilePayouts(deps({ answers: { [LIST]: ok({ items: [{ ...seen, status: "on_hold_x" }] }) } }).d)).toMatchObject({ moved: 0, skipped: 1 });
  });

  it("asks the partner nothing while unreachable, and nothing fails before the columns exist", async () => {
    const off = deps();
    expect(await payouts.reconcilePayouts({ ...off.d, documented: false })).toEqual({ read: 0, moved: 0, skipped: 0, failed: 0 });
    expect(off.send).not.toHaveBeenCalled();
    expect(await payouts.reconcilePayouts(deps({ select: { error: { code: "42703" } } }).d)).toEqual({ read: 0, moved: 0, skipped: 0, failed: 0 });
  });
});
