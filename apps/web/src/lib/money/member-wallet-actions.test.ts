import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RailResult } from "../payments/provider";

/*
 * THE PREVENTIONS (Part B phases 8 and 10; founder sections 14, 28, 31, 46),
 * each one a test: double submission, replay, insufficient funds, a name that
 * changed, a self-send, a blocked recipient, an UNKNOWN that is never sent
 * twice, and a refusal that moved nothing. The database is an in-memory
 * stand-in whose status writer follows the same transition table as
 * `funds_movement_observe` (supabase/migrations/20261007150611_b6_member_money_rail.sql).
 */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

const ALLOWED: Record<string, string[]> = {
  preparing: ["awaiting_confirmation", "awaiting_payment", "processing", "unknown", "failed", "cancelled"],
  awaiting_confirmation: ["processing", "unknown", "failed", "cancelled", "completed"],
  awaiting_payment: ["processing", "unknown", "completed", "failed", "cancelled"],
  processing: ["completed", "failed", "reversed", "unknown", "under_review", "awaiting_confirmation", "awaiting_payment"],
  unknown: ["awaiting_confirmation", "processing", "completed", "failed", "reversed", "cancelled", "under_review"],
  under_review: ["completed", "failed", "reversed"],
  completed: ["reversed", "under_review"],
  failed: ["under_review"],
};

function query(table: string) {
  const rows = () => (db.tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const api = {
    select: () => api,
    eq: (k: string, v: unknown) => {
      filters.push((r) => r[k] === v);
      if (patch) for (const r of rows().filter((x) => filters.every((f) => f(x)))) Object.assign(r, patch);
      return api;
    },
    in: (k: string, vs: unknown[]) => {
      filters.push((r) => vs.includes(r[k]));
      return api;
    },
    not: () => api,
    order: () => api,
    limit: async () => ({ data: rows().filter((r) => filters.every((f) => f(r))), error: null }),
    maybeSingle: async () => ({ data: rows().find((r) => filters.every((f) => f(r))) ?? null, error: null }),
    insert: async (row: Row) => {
      if (rows().some((r) => r.reference === row.reference || (row.client_key && r.client_key === row.client_key && r.user_id === row.user_id))) {
        return { error: { message: "duplicate key" } };
      }
      rows().push({ status: "preparing", status_source: "vallo", status_observed_at: new Date().toISOString(), provider_fee_minor: null, vallo_fee_minor: 0, vat_minor: 0, currency: "NGN", provider_metadata: {}, created_at: new Date().toISOString(), ...row });
      return { error: null };
    },
    update: (p: Row) => {
      patch = p;
      return api;
    },
    upsert: async (row: Row) => {
      const existing = rows().find((r) => r.user_id === row.user_id && r.provider === row.provider);
      if (existing) Object.assign(existing, row);
      else rows().push({ ...row });
      return { error: null };
    },
  };
  return api;
}

const fakeDb = {
  from: (t: string) => query(t),
  rpc: async (_name: string, a: Record<string, unknown>) => {
    const m = (db.tables.funds_movements ?? []).find((r) => r.reference === a.p_reference);
    if (!m) return { data: "not_found", error: null };
    if (m.status === a.p_to_status) return { data: "same", error: null };
    if (!(ALLOWED[m.status as string] ?? []).includes(a.p_to_status as string)) return { data: "refused", error: null };
    if ((a.p_to_status === "completed" || a.p_to_status === "reversed") && a.p_source === "vallo") return { data: null, error: { message: "check_violation" } };
    Object.assign(m, { status: a.p_to_status, status_source: a.p_source, ...(a.p_provider_fee_minor !== null ? { provider_fee_minor: a.p_provider_fee_minor } : {}) });
    return { data: "changed", error: null };
  },
};

const ok = <T,>(value: T): RailResult<T> => ({ ok: true, value });
const provider = {
  readBalance: vi.fn(),
  resolveAccount: vi.fn(),
  stageIntent: vi.fn(),
  submitIntent: vi.fn(),
  readCustomer: vi.fn(),
  findMovement: vi.fn(),
  listBanks: vi.fn(),
  findCustomer: vi.fn(),
  createCustomer: vi.fn(),
};

vi.mock("../actions/session", () => ({ resolveSession: async () => ({ state: "signed-in", user: { id: "user-a", email: "a@example.com" } }) }));
vi.mock("../payments/providers", () => ({ memberWalletRailLive: async () => "live" }));
vi.mock("../security/money-limits", () => ({ guardMoney: async () => ({ allowed: true, degraded: false }) }));
vi.mock("./audit", () => ({ recordMoneyAudit: async () => undefined }));
vi.mock("../observability/read-error", () => ({ reportReadFault: async () => undefined }));
vi.mock("./member-wallet", async (importOriginal) => {
  const real = await importOriginal<typeof import("./member-wallet")>();
  return { ...real, adminDb: () => fakeDb, walletProvider: () => provider };
});

const actions = await import("./member-wallet-actions");
const { REFUSAL } = await import("./balance-copy");
const { WALLET_PROVIDER_KEY } = await import("./member-wallet");

const KEY = "11111111-1111-4111-8111-111111111111";
const withdraw = (over: Record<string, unknown> = {}) =>
  actions.prepareWithdrawal({ clientKey: KEY, bankCode: "058", bankName: "Test Bank", accountNumber: "0123456789", shownAccountName: "ADA EZE", amount: "5000", ...over });

beforeEach(() => {
  db.tables = {
    financial_provider_accounts: [
      { user_id: "user-a", provider: WALLET_PROVIDER_KEY, provider_customer_id: "cust-a", status: "ACTIVE" },
      { user_id: "user-b", provider: WALLET_PROVIDER_KEY, provider_customer_id: "cust-b", status: "ACTIVE" },
    ],
    profiles: [
      { id: "user-a", first_name: "Ada", surname: "Eze", phone: "08011111111" },
      { id: "user-b", first_name: "Bola", surname: "Ade", phone: "08022222222" },
    ],
  };
  for (const fn of Object.values(provider)) fn.mockReset();
  provider.readBalance.mockResolvedValue(ok({ providerBalanceId: "w", availableMinor: 1_000_000, protectedMinor: 0, currency: "NGN", providerUpdatedAt: null }));
  provider.resolveAccount.mockResolvedValue(ok({ accountName: "ADA  EZE", accountNumber: "0123456789", bankCode: "058" }));
  provider.stageIntent.mockImplementation(async (_c: string, input: { reference: string; amountMinor: number }) =>
    ok({ providerId: "intent-1", reference: input.reference, amountMinor: input.amountMinor, feeMinor: 5_000, status: "pending", hosted: null }),
  );
  provider.submitIntent.mockImplementation(async (_c: string, input: { reference: string }) =>
    ok({ providerId: "intent-1", reference: input.reference, amountMinor: 500_000, feeMinor: 5_000, status: "pending", hosted: null }),
  );
  provider.readCustomer.mockResolvedValue(ok({ customerId: "cust-b", status: "active", phone: "08022222222", displayName: "Bola Ade", canWithdraw: true, canBuy: true, canSell: true, blocked: false }));
});

describe("withdrawal preparation", () => {
  it("refuses below 1,000 naira before touching the provider", async () => {
    expect(await withdraw({ amount: "999" })).toEqual({ ok: false, error: REFUSAL.belowWithdrawalMinimum });
    expect(provider.resolveAccount).not.toHaveBeenCalled();
  });

  it("refuses more than Available before anything is staged", async () => {
    expect(await withdraw({ amount: "20000" })).toEqual({ ok: false, error: REFUSAL.insufficient });
    expect(provider.stageIntent).not.toHaveBeenCalled();
  });

  it("refuses when the bank's name is not the one the member was shown", async () => {
    provider.resolveAccount.mockResolvedValue(ok({ accountName: "SOMEONE ELSE", accountNumber: "0123456789", bankCode: "058" }));
    expect(await withdraw()).toEqual({ ok: false, error: REFUSAL.accountChanged });
    expect(provider.stageIntent).not.toHaveBeenCalled();
  });

  it("stages once, reads the provider's fee back, and a double tap gets the same quote", async () => {
    const first = await withdraw();
    expect(first.ok && first.data.breakdown).toEqual({ amountMinor: 500_000, providerFeeMinor: 5_000, valloFeeMinor: 0, vatMinor: 0, totalDebitedMinor: 505_000, receivedMinor: 500_000 });
    const again = await withdraw();
    expect(again.ok && first.ok && again.data.movementId).toBe(first.ok && first.data.movementId);
    expect(provider.stageIntent).toHaveBeenCalledTimes(1);
    expect(db.tables.funds_movements).toHaveLength(1);
    expect(JSON.stringify(db.tables.funds_movements![0]!.counterparty)).not.toContain("0123456789");
  });

  it("cancels when the fee takes the total past Available", async () => {
    provider.readBalance.mockResolvedValue(ok({ providerBalanceId: "w", availableMinor: 502_000, protectedMinor: 0, currency: "NGN", providerUpdatedAt: null }));
    expect(await withdraw()).toEqual({ ok: false, error: REFUSAL.insufficientWithFee });
    expect(db.tables.funds_movements![0]!.status).toBe("cancelled");
  });
});

describe("confirming a movement", () => {
  async function staged() {
    const q = await withdraw();
    if (!q.ok) throw new Error(q.error);
    return q.data.movementId;
  }

  it("submits once however many times it is confirmed, and is processing, never completed", async () => {
    const id = await staged();
    const one = await actions.confirmBalanceMovement({ movementId: id });
    const two = await actions.confirmBalanceMovement({ movementId: id });
    expect(provider.submitIntent).toHaveBeenCalledTimes(1);
    expect(one.ok && one.data.movement.status).toBe("processing");
    expect(two.ok && two.data.message).toBe(REFUSAL.alreadySent);
  });

  it("an answer that never came is UNKNOWN and is not sent again", async () => {
    const id = await staged();
    provider.submitIntent.mockResolvedValue({ ok: false, kind: "unknown", httpStatus: null, detail: "", retryAfterSeconds: null });
    const r = await actions.confirmBalanceMovement({ movementId: id });
    expect(r.ok && r.data.movement.status).toBe("unknown");
    expect(r.ok && r.data.message).toBe(REFUSAL.submittedUnknown);
    await actions.confirmBalanceMovement({ movementId: id });
    expect(provider.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("a request held back for the rate limit moved nothing and can be confirmed again", async () => {
    const id = await staged();
    provider.submitIntent.mockResolvedValueOnce({ ok: false, kind: "rate_limited", httpStatus: null, detail: "", retryAfterSeconds: 30 });
    const held = await actions.confirmBalanceMovement({ movementId: id });
    expect(held.ok && held.data.movement.status).toBe("awaiting_confirmation");
    const sent = await actions.confirmBalanceMovement({ movementId: id });
    expect(sent.ok && sent.data.movement.status).toBe("processing");
  });

  it("asks for a code when the provider wants one, then sends with it", async () => {
    const id = await staged();
    provider.submitIntent.mockResolvedValueOnce({ ok: false, kind: "refused", httpStatus: 400, detail: "OTP is required", retryAfterSeconds: null });
    const asked = await actions.confirmBalanceMovement({ movementId: id });
    expect(asked.ok && asked.data.needsOtp).toBe(true);
    await actions.confirmBalanceMovement({ movementId: id, otp: "123456" });
    expect(provider.submitIntent).toHaveBeenLastCalledWith("cust-a", expect.objectContaining({ otp: "123456" }));
  });
});

describe("sending to a member", () => {
  const send = (over: Record<string, unknown> = {}) =>
    actions.prepareSend({ clientKey: "22222222-2222-4222-8222-222222222222", phone: "0802 222 2222", amount: "2000", ...over });

  it("refuses the member's own number", async () => {
    expect(await send({ phone: "+234 801 111 1111" })).toEqual({ ok: false, error: REFUSAL.selfSend });
  });

  it("refuses a recipient the provider has blocked, before staging", async () => {
    provider.readCustomer.mockResolvedValue(ok({ customerId: "cust-b", status: "active", phone: "08022222222", displayName: "Bola Ade", canWithdraw: true, canBuy: true, canSell: true, blocked: true }));
    expect(await send()).toEqual({ ok: false, error: REFUSAL.recipientOnHold });
    expect(provider.stageIntent).not.toHaveBeenCalled();
  });

  it("refuses an unknown number and a number with no open balance", async () => {
    expect(await send({ phone: "08099999999" })).toEqual({ ok: false, error: REFUSAL.noRecipient });
    db.tables.financial_provider_accounts![1]!.status = "PENDING";
    expect(await send()).toEqual({ ok: false, error: REFUSAL.noRecipient });
  });

  it("names the recipient as the provider stores them and shows only first name and initial", async () => {
    const q = await send({ note: "rent share" });
    expect(q.ok && q.data.destination.title).toBe("Bola A.");
    expect(provider.stageIntent).toHaveBeenCalledWith("cust-a", expect.objectContaining({ type: "wallet_transfer", recipient: { phone: "08022222222", name: "Bola Ade", narration: "rent share" } }));
  });
});
