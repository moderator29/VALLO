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
/* The provider's own fee on that amount, borne by the payer (as the sandbox quoted it). */
const FEE = 2_850_00;
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
  payoutPreference: "automatic" as const,
  startsMoney: true,
};

const ok = (data: unknown): RailResult<unknown> => ({ ok: true, value: { success: true, message: "ok", data } });
const fail = (kind: "refused" | "unknown" | "unavailable", httpStatus: number | null = null): RailResult<unknown> => ({ ok: false, kind, httpStatus, detail: "", retryAfterSeconds: null });

/** The provider, as the rail meets it: each path answers from this table. */
function provider(over: Record<string, RailResult<unknown>> = {}) {
  const answers: Record<string, RailResult<unknown>> = {
    "GET /api/v1/parties?external_reference=payer&page_size=5": ok({ items: [{ id: "PAR_payer", status: "active" }] }),
    "GET /api/v1/parties?external_reference=lister&page_size=5": ok({ items: [{ id: "PAR_lister", status: "active" }] }),
    "GET /api/v1/payout-accounts?party_id=PAR_lister&page_size=50": ok({
      items: [{ id: "PAC_1", status: "verified", bank_code: "000013", account_number: "0123456789", masked_account_number: "******6789", resolved_account_name: "SIMULATED ACCOUNT 6789", payout_eligible: true }],
    }),
    "GET /api/v1/banks": ok({ environment: "test", banks: [{ bank_code: "000013", bank_name: "GTBANK PLC (Simulator)" }, { bank_code: "090175", bank_name: "Rubies MFB" }] }),
    "POST /api/v1/transactions": ok({ id: "TXN_1", status: "draft", version: 1, amount_minor: AMOUNT, funded_minor: 0, released_minor: 0, refunded_minor: 0 }),
    "POST /api/v1/transactions/TXN_1/activate": ok({ id: "TXN_1", status: "pending_funding", version: 2 }),
    "POST /api/v1/transactions/TXN_1/payment-accounts": ok({ id: "PAM_1", status: "active", account_number: "0123456789", bank_code: "090175", expires_at: "2026-11-16T09:45:00+00:00" }),
    "POST /api/v1/transactions/TXN_1/checkout-sessions": ok({
      id: "CSN_1",
      status: "open",
      payment_instructions: { payment_account_id: "PAM_1", account_number: "0123456789", bank_code: "090175", account_name: "VALLO SPACES LTD", amount_minor: AMOUNT + FEE, expires_at: "2026-11-16T09:45:00+00:00" },
    }),
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
    bank_accounts: { select: { data: over.bank ?? [{ bank_code: "058", bank_name: "GTBank", account_number: "0123456789", resolved_account_name: "SIMULATED ACCOUNT 6789", is_default: true }] } },
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
      "POST /api/v1/transactions/TXN_1/checkout-sessions",
      "GET /api/v1/banks",
    ]);
    const create = send.mock.calls[3]![1];
    expect(create.idempotencyKey).toBe("vallo-pp-1:create");
    expect(create.body).toMatchObject({ amount_minor: AMOUNT, external_reference: "vallo-pp-1", payer: { party_id: "PAR_payer" }, beneficiary: { party_id: "PAR_lister" }, payout_account_id: "PAC_1", payout_preference: "automatic", funding_mode: "exact", release_policy: "manual_only" });
    expect(send.mock.calls[4]![1].body).toEqual({ version: 1 });
    expect(send.mock.calls[5]![1].body).toMatchObject({ expected_amount_minor: AMOUNT, type: "transaction_temporary" });
    expect(send.mock.calls[6]![1]).toMatchObject({ idempotencyKey: "vallo-pp-1:checkout:1", body: {} });

    const writes = db.of("provider_arrangements", "update").map((c) => c.values as Record<string, unknown>);
    expect(writes[0]).toEqual({ buyer_customer_id: "PAR_payer", seller_customer_id: "PAR_lister", environment: "sandbox" });
    expect(writes[1]).toEqual({ provider_arrangement_id: "TXN_1" });
    /* The total the payer transfers is the provider's own: the amount plus its fee. */
    expect(writes[2]).toEqual({
      funding_instructions: {
        bank_name: "Rubies MFB",
        bank_code: "090175",
        account_name: "VALLO SPACES LTD",
        account_number: "0123456789",
        amount_minor: AMOUNT + FEE,
        expires_at: "2026-11-16T09:45:00+00:00",
        payment_account_id: "PAM_1",
        checkout_session_id: "CSN_1",
        attempt: 1,
      },
      funding_expires_at: "2026-11-16T09:45:00+00:00",
    });
    expect(observed()).toHaveLength(1);
    /* The provider's own word once the transaction is payable, not the draft it was a moment before. */
    expect(observed()[0]).toMatchObject({ p_to_status: "awaiting_payment", p_source: "provider_response", p_provider_state: "pending_funding", p_provider_arrangement_id: "TXN_1", p_provider_amount_minor: AMOUNT });
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

  it.each([
    ["has no account name", { payment_account_id: "PAM_1", account_number: "0123456789", bank_code: "090175", amount_minor: AMOUNT + FEE }],
    ["asks for less than the amount", { payment_account_id: "PAM_1", account_number: "0123456789", bank_code: "090175", account_name: "VALLO SPACES LTD", amount_minor: AMOUNT - 1 }],
  ])("never stores transfer details when the session %s", async (_name, instructions) => {
    const send = provider({ "POST /api/v1/transactions/TXN_1/checkout-sessions": ok({ id: "CSN_1", payment_instructions: instructions }) });
    const { d, db } = deps({ row: PREPARING, send });
    expect(await rail.openProtectedPayment(d, OPEN)).toMatchObject({ outcome: "unknown" });
    expect(db.of("provider_arrangements", "update").some((c) => "funding_instructions" in (c.values as object))).toBe(false);
  });

  it("names the sandbox's own bank only on a test key; a live account at a bank on no list is never shown", async () => {
    const offList = { "GET /api/v1/banks": ok({ banks: [{ bank_code: "000013", bank_name: "GTBANK PLC" }] }) };
    const sandbox = deps({ row: PREPARING, send: provider(offList) });
    expect(await rail.openProtectedPayment(sandbox.d, OPEN)).toMatchObject({ outcome: "opened" });
    const stored = sandbox.db.of("provider_arrangements", "update").map((c) => c.values as Record<string, Record<string, unknown>>)[2]!;
    expect(stored.funding_instructions!.bank_name).toBe("Test bank (sandbox)");
    const live = deps({ row: PREPARING, send: provider(offList), config: { ...CONFIG, environment: "production" as never } });
    expect(await rail.openProtectedPayment(live.d, OPEN)).toMatchObject({ outcome: "unknown" });
  });

  it("on a live key, a payout account whose holder is not the one Vallo's own enquiry found is never used", async () => {
    const other = [{ bank_code: "058", bank_name: "GTBank", account_number: "0123456789", resolved_account_name: "ADA NGOZI OBI", is_default: true }];
    const made = { "POST /api/v1/payout-accounts": ok({ id: "PAC_2", status: "verified", account_number: "0123456789", resolved_account_name: "SOMEBODY ELSE ENTIRELY", payout_eligible: true }) };
    const { d, db, alert } = deps({ bank: other, send: provider(made), config: { ...CONFIG, environment: "production" as never } });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "refused", reason: "lister_not_ready" });
    expect(alert).toHaveBeenCalledWith("protected_rail.payout_name_mismatch", expect.anything());
    expect(db.of("protected_payment_open", "rpc")).toHaveLength(0);
  });

  it("an account with automatic payout switched off opens nothing, and staff are told what to turn on", async () => {
    const refused: RailResult<unknown> = { ok: false, kind: "refused", httpStatus: 422, detail: '{"detail":{"code":"policy_violation","message":"automatic_payout_disabled"}}', retryAfterSeconds: null, code: "policy_violation" } as never;
    const { d, observed, alert } = deps({ row: PREPARING, send: provider({ "POST /api/v1/transactions": refused }) });
    expect(await rail.openProtectedPayment(d, OPEN)).toEqual({ outcome: "failed", arrangementId: "arr-1" });
    expect(observed()[0]).toMatchObject({ p_to_status: "failed", p_source: "provider_response" });
    expect(alert).toHaveBeenCalledWith("protected_rail.automatic_payout_disabled", expect.anything());
  });

  it("asks for a manual payout only where the deployment is set to it", async () => {
    const { d, send } = deps({ row: PREPARING, config: { ...CONFIG, payoutPreference: "manual" as never } });
    await rail.openProtectedPayment(d, OPEN);
    expect(send.mock.calls[3]![1].body).toMatchObject({ payout_preference: "manual", payout_account_id: "PAC_1" });
  });
});

describe("reading back", () => {
  it("a status word Vallo has no meaning for moves nothing", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "some_new_word", version: 4, amount_minor: AMOUNT }) });
    const { d, observed } = deps({ send });
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "read", status: "protected", moved: false });
    expect(observed()).toHaveLength(0);
  });

  it.each([
    ["funded", "awaiting_payment", "protected"],
    ["released", "release_requested", "released"],
    ["refunded", "refund_requested", "refunded"],
    ["cancelled", "awaiting_payment", "cancelled"],
  ])("the provider's word %s moves a %s payment to %s, with its amount for the database to check", async (word, from, to) => {
    const whole = { funded_minor: AMOUNT, released_minor: word === "released" ? AMOUNT : 0, refunded_minor: word === "refunded" ? AMOUNT : 0 };
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: word, version: 4, amount_minor: AMOUNT, ...whole }) });
    const { d, observed } = deps({ row: { ...ROW, status: from, funding_instructions: { attempt: 1 } }, send });
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "read", status: to, moved: true });
    expect(observed()[0]).toMatchObject({ p_to_status: to, p_source: "provider_readback", p_provider_amount_minor: AMOUNT, p_provider_arrangement_id: "TXN_1" });
  });

  it.each(["release_requested", "refund_requested", "disputed", "requires_review"])("on a %s payment, the provider saying 'still held' undoes nothing and writes nothing", async (status) => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "funded", version: 3, amount_minor: AMOUNT, funded_minor: AMOUNT }) });
    const { d, observed } = deps({ row: { ...ROW, status }, send });
    expect(await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "read", status, moved: false });
    expect(observed()).toHaveLength(0);
  });

  it("a part released or refunded is never read as the whole", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "released", version: 4, amount_minor: AMOUNT, funded_minor: AMOUNT, released_minor: AMOUNT - 100 }) });
    const { d, observed } = deps({ row: { ...ROW, status: "release_requested" }, send });
    await rail.refreshProtectedPayment(d, { arrangementId: "arr-1", actorUserId: "payer" });
    expect(observed()[0]).toMatchObject({ p_to_status: "requires_review" });
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
    expect(sent()).toEqual([
      "GET /api/v1/transactions/TXN_1",
      "POST /api/v1/transactions/TXN_1/activate",
      "POST /api/v1/transactions/TXN_1/payment-accounts",
      "POST /api/v1/transactions/TXN_1/checkout-sessions",
      "GET /api/v1/banks",
    ]);
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

  it("a late or repeated 'funded' for a payment already disputed changes nothing", async () => {
    const { d, observed } = deps({ row: { ...ROW, status: "disputed" } });
    expect(await rail.applyProtectedWebhook(d, event({}))).toBe("same");
    expect(observed()).toHaveLength(0);
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

  it("extend the deadline and issue a second set under a new request, never the first again", async () => {
    const send = provider({
      "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "pending_funding", version: 2, amount_minor: AMOUNT }),
      "POST /api/v1/transactions/TXN_1/extend": ok({ id: "TXN_1", status: "pending_funding", version: 3, amount_minor: AMOUNT }),
    });
    const { d, db, sent } = deps({ row: EXPIRED, send });
    expect(await rail.askNewTransferDetails(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "submitted" });
    expect(sent()).toEqual([
      "GET /api/v1/transactions/TXN_1",
      "POST /api/v1/transactions/TXN_1/extend",
      "POST /api/v1/transactions/TXN_1/payment-accounts",
      "POST /api/v1/transactions/TXN_1/checkout-sessions",
      "GET /api/v1/banks",
    ]);
    expect(send.mock.calls[1]![1]).toMatchObject({ idempotencyKey: "vallo-pp-1:extend:2", body: { version: 2 } });
    expect(send.mock.calls[2]![1].idempotencyKey).toBe("vallo-pp-1:account:2");
    expect(send.mock.calls[3]![1].idempotencyKey).toBe("vallo-pp-1:checkout:2");
    const stored = db.of("provider_arrangements", "update").map((c) => c.values as Record<string, Record<string, unknown>>)[0]!;
    expect(stored.funding_instructions!.attempt).toBe(2);
  });

  it("never reissue for a transaction whose state the provider has not confirmed as waiting", async () => {
    const send = provider({ "GET /api/v1/transactions/TXN_1": ok({ id: "TXN_1", status: "some_new_word", version: 3 }) });
    const { d, sent } = deps({ row: EXPIRED, send });
    expect(await rail.askNewTransferDetails(d, { arrangementId: "arr-1", actorUserId: "payer" })).toEqual({ outcome: "refused", reason: "closed_at_provider" });
    expect(sent()).toEqual(["GET /api/v1/transactions/TXN_1"]);
  });
});
