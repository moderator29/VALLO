/**
 * THE PROTECTED RAIL'S SERVER RULES (lib/money/protected-rail.ts). Each test
 * pins a way the rail could otherwise move or misreport money.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call } from "../testing/fake-supabase";
import type { RailResult } from "../payments/provider";
import type { EscrowPayCall } from "../payments/providers/escrowpay/client";
import type { EscrowPayWebhook } from "../payments/providers/escrowpay/webhooks";

const gate = vi.hoisted(() => ({ answer: "clear" }));
vi.mock("./release-gate", () => ({ releaseGate: async () => gate.answer }));

const rail = await import("./protected-rail");

const AMOUNT = 180_000_00;
const NOW = Date.parse("2026-11-14T10:00:00Z");

const ROW = {
  id: "arr-1",
  agreement_id: "ag-1",
  provider: "escrowpay",
  reference: "vallo-pp-1",
  provider_arrangement_id: "TXN_1",
  amount_minor: AMOUNT,
  buyer_user_id: "payer",
  seller_user_id: "lister",
  status: "protected",
  funding_instructions: null,
  funding_expires_at: null,
};

const CONFIG = {
  baseUrl: "https://api.example.test",
  apiKey: "ep_test_sk_x",
  webhookSecret: "whsec_x",
  webhookSecretPrevious: null,
  environment: "sandbox" as const,
  startsMoney: true,
};

const ok = (data: unknown): RailResult<unknown> => ({ ok: true, value: { success: true, message: "ok", data } });
const fail = (kind: "refused" | "unknown" | "unavailable", httpStatus: number | null = null): RailResult<unknown> => ({ ok: false, kind, httpStatus, detail: "", retryAfterSeconds: null });

/** The provider, as the rail meets it: each path answers from this table. */
function provider(over: Record<string, RailResult<unknown>> = {}) {
  const answers: Record<string, RailResult<unknown>> = {
    "GET /api/v1/parties?external_reference=payer&page_size=5": ok({ items: [{ id: "PAR_payer", status: "active" }] }),
    "GET /api/v1/parties?external_reference=lister&page_size=5": ok({ items: [{ id: "PAR_lister", status: "active" }] }),
    "GET /api/v1/payout-accounts?party_id=PAR_lister&page_size=50": ok({ items: [{ id: "PAC_1", status: "verified", masked_account_number: "******6789" }] }),
    "POST /api/v1/transactions": ok({ id: "TXN_1", status: "draft", version: 1, amount_minor: AMOUNT }),
    "POST /api/v1/transactions/TXN_1/activate": ok({ id: "TXN_1", status: "pending_funding", version: 2 }),
    "POST /api/v1/transactions/TXN_1/payment-accounts": ok({ id: "PA_1", bank_name: "Rubies MFB", account_name: "EscrowPay / Vallo", account_number: "0123456789", expires_at: "2026-11-16T10:00:00Z" }),
    "POST /api/v1/transactions/TXN_1/releases": ok({ id: "REL_1", status: "processing", amount_minor: AMOUNT }),
    "POST /api/v1/transactions/TXN_1/refunds": ok({ id: "RFD_1", status: "processing", amount_minor: AMOUNT }),
    ...over,
  };
  return vi.fn(async (_config: unknown, call: EscrowPayCall) => answers[`${call.method} ${call.path}`] ?? fail("unknown"));
}

function deps(
  over: {
    row?: Record<string, unknown> | null;
    open?: unknown;
    enabled?: boolean;
    documented?: boolean;
    config?: typeof CONFIG | null;
    send?: ReturnType<typeof provider>;
    observe?: string | ((call: Call) => string);
    bank?: unknown[];
  } = {},
) {
  const db = fakeSupabase({
    provider_arrangements: { select: { data: over.row === undefined ? ROW : over.row } },
    deal_agreements: {
      select: { data: { renter_id: "payer", owner_id: "lister", named_payer_id: null, named_payer_by_renter_at: null, named_payer_accepted_at: null, listing_id: "l-1" } },
    },
    bank_accounts: { select: { data: over.bank ?? [{ bank_code: "058", bank_name: "GTBank", account_number: "0123456789", is_default: true }] } },
    provider_arrangement_observe: {
      rpc: (call) => ({ data: typeof over.observe === "function" ? over.observe(call) : (over.observe ?? "changed") }),
    },
    protected_payment_open: { rpc: { data: over.open ?? { status: "ok", id: "arr-1" } } },
    protected_payment_transfer_reported: { rpc: { data: "ok" } },
  });
  const send = over.send ?? provider();
  const alert = vi.fn(async () => undefined);
  const d = {
    db: db.client as never,
    config: over.config === undefined ? CONFIG : over.config,
    documented: over.documented ?? true,
    send,
    enabled: async () => over.enabled ?? true,
    alert,
    now: () => NOW,
  };
  const observed = () => db.of("provider_arrangement_observe", "rpc").map((c) => c.values as Record<string, unknown>);
  const sent = () => send.mock.calls.map((c) => `${c[1].method} ${c[1].path}`);
  return { d, db, send, alert, observed, sent };
}

const OPEN = { agreementId: "ag-1", acceptedVersion: 3, actorUserId: "payer" };
const PREPARING = { ...ROW, status: "preparing", provider_arrangement_id: null };

describe("the rail is shut while unverified, unconfigured, switched off, or on a test key in production", () => {
  it.each([
    ["unverified", { documented: false }, "not_configured"],
    ["unconfigured", { config: null }, "not_configured"],
    ["switched off", { enabled: false }, "switched_off"],
    ["a test key on the production deployment", { config: { ...CONFIG, startsMoney: false } }, "switched_off"],
  ] as const)("opens nothing and calls nothing while %s", async (_name, over, reason) => {
    const { d, db, send } = deps(over as never);
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "refused", reason });
    expect(db.of("protected_payment_open", "rpc")).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("never asks for a release while shut", async () => {
    const { d, send, observed } = deps({ enabled: false });
    expect(await rail.confirmProtectedMilestone(d, { arrangementId: "arr-1", actorUserId: "payer" })).toMatchObject({ outcome: "refused" });
    expect(observed()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("reconciles nothing while unreachable", async () => {
    const { d, send } = deps({ documented: false });
    expect(await rail.reconcileProtected(d)).toEqual({ read: 0, moved: 0, skipped: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("opening a protected payment", () => {
  it("makes the transaction, activates it, issues transfer details, and waits for payment on the provider's answer", async () => {
    const { d, db, send, observed, sent } = deps({ row: PREPARING });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "opened", arrangementId: "arr-1", status: "awaiting_payment" });
    expect(sent()).toEqual([
      "GET /api/v1/parties?external_reference=payer&page_size=5",
      "GET /api/v1/parties?external_reference=lister&page_size=5",
      "GET /api/v1/payout-accounts?party_id=PAR_lister&page_size=50",
      "POST /api/v1/transactions",
      "POST /api/v1/transactions/TXN_1/activate",
      "POST /api/v1/transactions/TXN_1/payment-accounts",
    ]);
    const create = send.mock.calls[3]![1];
    expect(create.idempotencyKey).toBe("vallo-pp-1:create");
    expect(create.body).toMatchObject({ amount_minor: AMOUNT, external_reference: "vallo-pp-1", payer: { party_id: "PAR_payer" }, beneficiary: { party_id: "PAR_lister" }, payout_account_id: "PAC_1", funding_mode: "exact", release_policy: "manual_only" });
    expect(send.mock.calls[4]![1].body).toEqual({ version: 1 });
    expect(send.mock.calls[5]![1].body).toMatchObject({ expected_amount_minor: AMOUNT, type: "transaction_temporary" });

    const writes = db.of("provider_arrangements", "update").map((c) => c.values as Record<string, unknown>);
    expect(writes[0]).toEqual({ buyer_customer_id: "PAR_payer", seller_customer_id: "PAR_lister", environment: "sandbox" });
    expect(writes[1]).toEqual({ provider_arrangement_id: "TXN_1" });
    expect(writes[2]).toMatchObject({
      funding_instructions: { bank_name: "Rubies MFB", account_name: "EscrowPay / Vallo", account_number: "0123456789", attempt: 1 },
      funding_expires_at: "2026-11-16T10:00:00Z",
    });
    expect(observed()).toHaveLength(1);
    expect(observed()[0]).toMatchObject({ p_to_status: "awaiting_payment", p_source: "provider_response", p_provider_arrangement_id: "TXN_1", p_provider_amount_minor: AMOUNT });
  });

  it("opens nothing for a payer the provider does not know: the identity check comes first", async () => {
    const send = provider({ "GET /api/v1/parties?external_reference=payer&page_size=5": ok({ items: [] }) });
    const { d, db } = deps({ send });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "refused", reason: "payer_identity_required" });
    expect(db.of("protected_payment_open", "rpc")).toHaveLength(0);
  });

  it("opens nothing when the lister could not be paid out", async () => {
    const unknownLister = provider({ "GET /api/v1/parties?external_reference=lister&page_size=5": ok({ items: [] }) });
    expect(await rail.openProtectedPayment(deps({ send: unknownLister }).d, OPEN)).toEqual({ outcome: "refused", reason: "lister_not_ready" });
    const noBank = deps({ bank: [], send: provider({ "GET /api/v1/payout-accounts?party_id=PAR_lister&page_size=50": ok({ items: [] }) }) });
    expect(await rail.openProtectedPayment(noBank.d, OPEN)).toEqual({ outcome: "refused", reason: "lister_not_ready" });
    expect(noBank.db.of("protected_payment_open", "rpc")).toHaveLength(0);
  });

  it("a stranger to the agreement opens nothing", async () => {
    const { d, send } = deps();
    expect(await rail.openProtectedPayment(d, { ...OPEN, actorUserId: "someone" })).toEqual({ outcome: "refused", reason: "not_found" });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns the live arrangement instead of making a second one", async () => {
    const { d, sent } = deps({ open: { status: "exists", id: "arr-9" } });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "existing", arrangementId: "arr-9" });
    expect(sent()).not.toContain("POST /api/v1/transactions");
  });

  it("passes on the database's refusal and asks the provider for nothing", async () => {
    const { d, sent } = deps({ open: { status: "category_not_approved" } });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "refused", reason: "category_not_approved" });
    expect(sent()).not.toContain("POST /api/v1/transactions");
  });

  it("a refusal by the provider closes the row as failed, on the provider's word", async () => {
    const { d, observed } = deps({ row: PREPARING, send: provider({ "POST /api/v1/transactions": fail("refused", 422) }) });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "failed", arrangementId: "arr-1" });
    expect(observed()[0]).toMatchObject({ p_to_status: "failed", p_source: "provider_response" });
  });

  it("no answer to the create is unknown, alerted, and never repeated", async () => {
    const send = provider({ "POST /api/v1/transactions": fail("unknown") });
    const { d, observed, alert, sent } = deps({ row: PREPARING, send });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "unknown", arrangementId: "arr-1" });
    expect(observed()[0]).toMatchObject({ p_to_status: "unknown", p_source: "vallo" });
    expect(alert).toHaveBeenCalledWith("protected_rail.create_unknown", expect.anything());
    expect(sent().filter((c) => c === "POST /api/v1/transactions")).toHaveLength(1);
  });

  it("a transaction made but not yet payable keeps the provider's id and is left for the read-back", async () => {
    const send = provider({ "POST /api/v1/transactions/TXN_1/payment-accounts": fail("unavailable", 503) });
    const { d, db, observed } = deps({ row: PREPARING, send });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "unknown", arrangementId: "arr-1" });
    expect(db.of("provider_arrangements", "update").map((c) => c.values)).toContainEqual({ provider_arrangement_id: "TXN_1" });
    expect(observed()[0]).toMatchObject({ p_to_status: "unknown", p_provider_arrangement_id: "TXN_1" });
  });

  it("never stores transfer details it could not read in full", async () => {
    const send = provider({ "POST /api/v1/transactions/TXN_1/payment-accounts": ok({ id: "PA_1", bank_name: "Rubies MFB", account_number: "****6789" }) });
    const { d, db } = deps({ row: PREPARING, send });
    expect(await rail.openProtectedPayment(d, OPEN)).toMatchObject({ outcome: "unknown" });
    expect(db.of("provider_arrangements", "update").some((c) => "funding_instructions" in (c.values as object))).toBe(false);
  });
});

describe("reading back", () => {
  it("a status word Vallo has no meaning for moves nothing", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "some_new_word", version: 4, amount_minor: AMOUNT }) });
    const { d, observed } = deps({ send });
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "read", status: "protected", moved: false });
    expect(observed()).toHaveLength(0);
  });

  it("finds a transaction whose create was never answered by Vallo's own reference, and keeps its id", async () => {
    const send = provider({
      "GET /api/v1/transactions?external_reference=vallo-pp-1&page_size=5": ok({ items: [{ id: "TXN_7", status: "some_new_word", external_reference: "vallo-pp-1" }] }),
    });
    const { d, db } = deps({ row: { ...ROW, status: "unknown", provider_arrangement_id: null }, send });
    await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "lister" });
    expect(db.of("provider_arrangements", "update").map((c) => c.values)).toContainEqual({ provider_arrangement_id: "TXN_7" });
  });

  it("finishes an open that stopped half way: activates the draft and issues the details", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "draft", version: 1, amount_minor: AMOUNT }) });
    const { d, observed, sent } = deps({ row: { ...ROW, status: "unknown" }, send });
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "read", status: "awaiting_payment", moved: true });
    expect(sent()).toEqual(["GET /api/v1/transactions/TXN_1", "POST /api/v1/transactions/TXN_1/activate", "POST /api/v1/transactions/TXN_1/payment-accounts"]);
    expect(observed()[0]).toMatchObject({ p_to_status: "awaiting_payment", p_source: "provider_readback" });
  });

  it("a stranger reads nothing", async () => {
    const { d, send } = deps();
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "someone" })).toEqual({ outcome: "refused", reason: "not_found" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("'I've made the transfer' only asks to look again", () => {
  it("writes the mark through the database door and never observes a funded state", async () => {
    const { d, db, observed } = deps({ row: { ...ROW, status: "awaiting_payment" }, documented: false });
    const out = await rail.reportTransfer(d, { arrangementId: "arr-1", actorUserId: "payer" });
    expect(out).toEqual({ outcome: "not_reachable" });
    expect(db.of("protected_payment_transfer_reported", "rpc")[0]?.values).toEqual({ p_arrangement: "arr-1", p_payer: "payer" });
    expect(observed()).toHaveLength(0);
  });
});

describe("the release", () => {
  it("the payer's confirmation instructs the whole amount, once, and records only that Vallo asked", async () => {
    const { d, send, observed } = deps();
    expect(await rail.confirmProtectedMilestone(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "submitted" });
    expect(observed()).toHaveLength(1);
    expect(observed()[0]).toMatchObject({ p_to_status: "release_requested", p_source: "vallo" });
    const call = send.mock.calls[0]![1];
    expect(call.path).toBe("/api/v1/transactions/TXN_1/releases");
    expect(call.idempotencyKey).toBe("vallo-pp-1:release");
    expect(call.body).toMatchObject({ amount_minor: AMOUNT });
  });

  it("only the payer may confirm, only while the money is held, and never while a person or the chargeback rule holds it", async () => {
    expect(await rail.confirmProtectedMilestone(deps().d, { arrangementId: "arr-1", actorUserId: "lister" })).toMatchObject({ reason: "not_found" });
    expect(await rail.confirmProtectedMilestone(deps({ row: { ...ROW, status: "awaiting_payment" } }).d, { arrangementId: "arr-1", actorUserId: "payer" })).toMatchObject({ reason: "not_releasable:awaiting_payment" });
    gate.answer = "paused";
    const held = deps();
    expect(await rail.confirmProtectedMilestone(held.d, { arrangementId: "arr-1", actorUserId: "payer" })).toMatchObject({ reason: "release_paused" });
    expect(held.send).not.toHaveBeenCalled();
    gate.answer = "clear";
  });

  it("a refusal by the provider puts the record back to held; no answer is unknown and alerted", async () => {
    const refused = deps({ send: provider({ "POST /api/v1/transactions/TXN_1/releases": fail("refused", 409) }) });
    expect(await rail.confirmProtectedMilestone(refused.d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "refused", reason: "refused" });
    expect(refused.observed().map((o) => o.p_to_status)).toEqual(["release_requested", "protected"]);
    const silent = deps({ send: provider({ "POST /api/v1/transactions/TXN_1/releases": fail("unknown") }) });
    expect(await rail.confirmProtectedMilestone(silent.d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "unknown" });
    expect(silent.observed().map((o) => o.p_to_status)).toEqual(["release_requested"]);
    expect(silent.alert).toHaveBeenCalledWith("protected_rail.release_unknown", expect.anything());
  });
});

describe("staff instructions", () => {
  const REFUND = { arrangementId: "arr-1", staffUserId: "staff-1", reason: "The handover never took place." };

  it("a refund returns the whole amount from the bank's hold and records only that Vallo asked", async () => {
    const { d, send, observed } = deps({ row: { ...ROW, status: "disputed" } });
    expect(await rail.instructProtectedRefund(d, REFUND)).toEqual({ outcome: "submitted" });
    expect(observed()[0]).toMatchObject({ p_to_status: "refund_requested", p_source: "vallo" });
    expect((observed()[0]!.p_detail as Record<string, unknown>).instructed_by).toBe("staff-1");
    expect(send.mock.calls[0]![1]).toMatchObject({ path: "/api/v1/transactions/TXN_1/refunds", idempotencyKey: "vallo-pp-1:refund" });
    expect(send.mock.calls[0]![1].body).toMatchObject({ amount_minor: AMOUNT, source: "escrow_held" });
  });

  it("a refund is not stopped by the member switch, and is stopped on a test key in production", async () => {
    expect(await rail.instructProtectedRefund(deps({ enabled: false }).d, REFUND)).toEqual({ outcome: "submitted" });
    expect(await rail.instructProtectedRefund(deps({ config: { ...CONFIG, startsMoney: false } }).d, REFUND)).toMatchObject({ outcome: "refused" });
  });

  it("refunds only money that is held, with a reason, and puts the record back when the provider refuses", async () => {
    expect(await rail.instructProtectedRefund(deps({ row: { ...ROW, status: "released" } }).d, REFUND)).toMatchObject({ reason: "not_refundable:released" });
    expect(await rail.instructProtectedRefund(deps().d, { ...REFUND, reason: "no" })).toMatchObject({ reason: "reason_too_short" });
    const refused = deps({ row: { ...ROW, status: "disputed" }, send: provider({ "POST /api/v1/transactions/TXN_1/refunds": fail("refused", 409) }) });
    expect(await rail.instructProtectedRefund(refused.d, REFUND)).toEqual({ outcome: "refused", reason: "refused" });
    expect(refused.observed().map((o) => o.p_to_status)).toEqual(["refund_requested", "disputed"]);
  });

  it("a dispute release is audited, alerted, and leaves the record disputed until the provider reports", async () => {
    const { d, db, observed, alert, send } = deps({ row: { ...ROW, status: "disputed" } });
    expect(await rail.instructDisputeRelease(d, { ...REFUND, reason: "The lister's evidence shows the keys were handed over." })).toEqual({ outcome: "submitted" });
    expect(observed()).toHaveLength(0);
    expect(db.of("provider_arrangement_events", "insert")).toHaveLength(1);
    expect(alert).toHaveBeenCalledWith("protected_rail.dispute_release_instructed", expect.anything());
    expect(send.mock.calls[0]![1].path).toBe("/api/v1/transactions/TXN_1/releases");
    expect(await rail.instructDisputeRelease(deps().d, { ...REFUND, reason: "x".repeat(20) })).toMatchObject({ reason: "not_releasable:protected" });
  });
});

describe("a dispute is Vallo's own process and moves no money", () => {
  it("either party may open it while the money is held; it records disputed from Vallo with the statement", async () => {
    const { d, observed, alert, send } = deps();
    const out = await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "lister", statement: "The keys were never handed over." });
    expect(out).toEqual({ outcome: "submitted" });
    expect(observed()[0]).toMatchObject({ p_to_status: "disputed", p_source: "vallo" });
    expect((observed()[0]!.p_detail as Record<string, unknown>).opened_by).toBe("lister");
    expect(alert).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("a stranger cannot, and an empty statement is refused", async () => {
    const { d } = deps();
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "someone", statement: "x".repeat(20) })).toMatchObject({ outcome: "refused", reason: "not_found" });
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "payer", statement: "short" })).toMatchObject({ reason: "statement_too_short" });
  });

  it("a row of another provider is never touched by this rail", async () => {
    const { d } = deps({ row: { ...ROW, provider: "another" } });
    expect(await rail.raiseProtectedDispute(d, { arrangementId: "arr-1", actorUserId: "payer", statement: "x".repeat(20) })).toMatchObject({ reason: "not_found" });
  });
});

describe("the webhook", () => {
  const event = (over: Partial<EscrowPayWebhook>): EscrowPayWebhook => ({
    key: "WHEV_1",
    event: "transaction.funded",
    object: "transaction",
    objectId: "TXN_1",
    transactionId: "TXN_1",
    amountMinor: AMOUNT,
    createdAt: null,
    data: {},
    ...over,
  });

  it("records funded from the provider's event, with its amount for the database to check", async () => {
    const { d, db, observed } = deps({ row: { ...ROW, status: "awaiting_payment" } });
    expect(await rail.applyProtectedWebhook(d, event({}))).toBe("changed");
    expect(db.of("provider_arrangements", "select")[0]?.filters).toContainEqual(["eq", "provider_arrangement_id", "TXN_1"]);
    expect(observed()[0]).toMatchObject({ p_to_status: "protected", p_source: "provider_webhook", p_provider_event_key: "WHEV_1", p_provider_amount_minor: AMOUNT, p_provider_arrangement_id: "TXN_1" });
  });

  it.each([
    ["release.completed", "released"],
    ["refund.completed", "refunded"],
    ["transaction.expired", "cancelled"],
    ["transaction.partially_funded", "requires_review"],
  ])("%s is recorded as %s", async (name, state) => {
    const { d, observed } = deps();
    await rail.applyProtectedWebhook(d, event({ event: name, object: name.split(".")[0]!, objectId: "X_1" }));
    expect(observed()[0]).toMatchObject({ p_to_status: state, p_provider_amount_minor: null });
  });

  it("a release or refund of less than the whole goes to a person, never recorded as the whole", async () => {
    const { d, observed, alert } = deps({ row: { ...ROW, status: "release_requested" } });
    await rail.applyProtectedWebhook(d, event({ event: "release.completed", object: "release", objectId: "REL_1", amountMinor: AMOUNT - 1 }));
    expect(observed()[0]).toMatchObject({ p_to_status: "requires_review" });
    expect(alert).toHaveBeenCalledWith("protected_rail.partial_settlement", expect.anything());
  });

  it("an event Vallo does not act on moves nothing and reads nothing", async () => {
    const { d, db, observed } = deps();
    expect(await rail.applyProtectedWebhook(d, event({ event: "payout.completed", object: "payout" }))).toBe("unmapped");
    expect(await rail.applyProtectedWebhook(d, event({ event: "something.new" }))).toBe("unmapped");
    expect(db.calls).toHaveLength(0);
    expect(observed()).toHaveLength(0);
  });

  it("an event for a transaction Vallo never made is acknowledged and moves nothing", async () => {
    const { d, observed } = deps({ row: null });
    expect(await rail.applyProtectedWebhook(d, event({}))).toBe("unknown_arrangement");
    expect(await rail.applyProtectedWebhook(d, event({ transactionId: null }))).toBe("unknown_arrangement");
    expect(observed()).toHaveLength(0);
  });

  it("a failed payout to the lister's bank alerts a person and moves nothing", async () => {
    const { d, observed, alert } = deps({ row: { ...ROW, status: "released" } });
    expect(await rail.applyProtectedWebhook(d, event({ event: "payout.failed", object: "payout", objectId: "PAY_1" }))).toBe("unmapped");
    expect(alert).toHaveBeenCalledWith("protected_rail.payout_trouble", expect.objectContaining({ event: "payout.failed" }));
    expect(observed()).toHaveLength(0);
  });
});

describe("new transfer details", () => {
  const EXPIRED = { ...ROW, status: "awaiting_payment", funding_instructions: { attempt: 1 }, funding_expires_at: "2026-11-14T09:00:00Z" };

  it("are refused while the first ones are still good, and to anyone but the payer", async () => {
    const live = deps({ row: { ...EXPIRED, funding_expires_at: "2026-11-14T11:00:00Z" } });
    expect(await rail.askNewTransferDetails(live.d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "refused", reason: "not_expired" });
    expect(live.send).not.toHaveBeenCalled();
    expect(await rail.askNewTransferDetails(deps({ row: EXPIRED }).d, { arrangementId: "arr-1", actorUserId: "lister" })).toMatchObject({ reason: "not_found" });
  });

  it("never reissue for a transaction whose state the provider has not confirmed as waiting", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "some_new_word", version: 3 }) });
    const { d, sent } = deps({ row: EXPIRED, send });
    expect(await rail.askNewTransferDetails(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "refused", reason: "closed_at_provider" });
    expect(sent()).toEqual(["GET /api/v1/transactions/TXN_1"]);
  });
});
