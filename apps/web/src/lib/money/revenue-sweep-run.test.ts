import { describe, expect, it, vi } from "vitest";
import type { EscrowPayCall } from "../payments/providers/escrowpay/client";
import type { RailResult } from "../payments/provider";
import { runRevenueSweep, SWEEP_CURRENCY, type SweepDeps } from "./revenue-sweep-run";
import { SWEEP_CEILING_MINOR, SWEEP_FLOOR_MINOR } from "./revenue-sweep";

const CONFIG = {
  baseUrl: "https://api.example.test",
  apiKey: "sk_test_x",
  webhookSecret: "whsec_x",
  webhookSecretPrevious: null,
  environment: "sandbox" as const,
  payoutPreference: "automatic" as const,
  startsMoney: true,
};

const BALANCE = 2_000_000_00;

const ok = (data: unknown): RailResult<unknown> => ({ ok: true, value: { success: true, message: "ok", data } });
const fail = (kind: "refused" | "unknown" | "unavailable", httpStatus: number | null = null): RailResult<unknown> => ({ ok: false, kind, httpStatus, detail: "", retryAfterSeconds: null });

function provider(over: Record<string, RailResult<unknown>> = {}) {
  const answers: Record<string, RailResult<unknown>> = {
    "GET /api/v1/wallets?currency=NGN&page_size=20": ok({ items: [{ id: "WAL_1", currency: "NGN", status: "active" }] }),
    "GET /api/v1/wallets/WAL_1/balances": ok({ items: [{ currency: "NGN", available_minor: BALANCE }] }),
    "POST /api/v1/wallets/WAL_1/payouts": ok({ id: "POT_1", status: "completed", amount_minor: BALANCE }),
    ...over,
  };
  return vi.fn(async (_config: unknown, call: EscrowPayCall) => answers[`${call.method} ${call.path}`] ?? fail("unknown"));
}

type RpcCall = { fn: string; args: Record<string, unknown> };

/** A database that answers the three sweep functions and records every call. */
function db(over: { state?: unknown; open?: unknown; missing?: boolean } = {}) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (over.missing) return Promise.resolve({ data: null, error: { code: "42883", message: "function does not exist" } });
      if (fn === "revenue_sweep_state") return Promise.resolve({ data: over.state ?? { unsettled: false, open: null, last: null }, error: null });
      if (fn === "revenue_sweep_open") return Promise.resolve({ data: over.open ?? { status: "ok", id: "11111111-1111-4111-8111-111111111111" }, error: null });
      return Promise.resolve({ data: { status: "ok" }, error: null });
    },
  };
  return { client, calls, settles: () => calls.filter((c) => c.fn === "revenue_sweep_settle") };
}

function deps(over: { send?: ReturnType<typeof provider>; store?: ReturnType<typeof db>; destination?: string | null; on?: boolean; config?: typeof CONFIG | null } = {}) {
  const store = over.store ?? db();
  const send = over.send ?? provider();
  const alert = vi.fn(async () => undefined);
  const d: SweepDeps = {
    db: store.client as never,
    config: over.config === undefined ? CONFIG : over.config,
    documented: true,
    send,
    enabled: async () => true,
    alert,
    now: () => 1_763_200_000_000,
    destination: over.destination === undefined ? "PAC_vallo" : over.destination,
    sweepOn: async () => over.on ?? true,
  };
  return { d, send, store, alert, paths: () => send.mock.calls.map((c) => `${c[1].method} ${c[1].path}`) };
}

describe("moving Vallo's own earnings to the bank", () => {
  it("reads the wallet, opens one sweep and sends the whole balance to Vallo's own account", async () => {
    const w = deps();
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "sent", amountMinor: BALANCE, payoutId: "POT_1" });
    expect(w.paths()).toEqual([
      "GET /api/v1/wallets?currency=NGN&page_size=20",
      "GET /api/v1/wallets/WAL_1/balances",
      "POST /api/v1/wallets/WAL_1/payouts",
    ]);
    const payout = w.send.mock.calls[2]![1];
    expect(payout.body).toEqual({ amount_minor: BALANCE, payout_account_id: "PAC_vallo", reason: expect.stringContaining("Vallo") });
    /* The key is the sweep's own id, so a retry is the same request. */
    expect(payout.idempotencyKey).toBe("vallo-sweep:11111111-1111-4111-8111-111111111111");
    expect(w.store.settles()[0]!.args).toMatchObject({ p_status: "sent", p_provider_payout_id: "POT_1" });
  });

  it("asks the partner nothing at all while the switch is off or no destination is set", async () => {
    const off = deps({ on: false });
    expect(await runRevenueSweep(off.d)).toEqual({ kind: "held", hold: "switched_off" });
    expect(off.paths()).toEqual([]);

    const nowhere = deps({ destination: null });
    expect(await runRevenueSweep(nowhere.d)).toEqual({ kind: "held", hold: "no_destination" });
    expect(nowhere.paths()).toEqual([]);
  });

  it("does nothing, cleanly, until the sweep SQL has been run", async () => {
    const w = deps({ store: db({ missing: true }) });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "not_set_up" });
    expect(w.paths()).toEqual([]);
  });

  it("does nothing with no partner key", async () => {
    expect(await runRevenueSweep(deps({ config: null }).d)).toEqual({ kind: "no_partner_key" });
  });

  it("waits below the floor and opens nothing", async () => {
    const small = provider({ "GET /api/v1/wallets/WAL_1/balances": ok({ items: [{ currency: "NGN", available_minor: SWEEP_FLOOR_MINOR - 1 }] }) });
    const w = deps({ send: small });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "held", hold: "below_floor" });
    expect(w.store.calls.some((c) => c.fn === "revenue_sweep_open")).toBe(false);
  });

  it("refuses a balance it cannot read, tells somebody, and sends nothing", async () => {
    for (const answer of [
      ok({ items: [{ currency: "NGN", pending_minor: 500_000 }] }),
      ok({ items: [{ currency: "USD", available_minor: BALANCE }] }),
      ok({ items: [{ currency: "NGN", available_minor: BALANCE }, { currency: "NGN", available_minor: 7 }] }),
      fail("unavailable", 503),
    ]) {
      const w = deps({ send: provider({ "GET /api/v1/wallets/WAL_1/balances": answer }) });
      expect(await runRevenueSweep(w.d)).toEqual({ kind: "held", hold: "balance_unreadable" });
      expect(w.paths()).not.toContain("POST /api/v1/wallets/WAL_1/payouts");
      expect(w.alert).toHaveBeenCalled();
    }
  });

  it("stops on a balance far larger than Vallo's share could be, rather than moving it", async () => {
    const huge = provider({ "GET /api/v1/wallets/WAL_1/balances": ok({ items: [{ currency: "NGN", available_minor: SWEEP_CEILING_MINOR + 1 }] }) });
    const w = deps({ send: huge });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "held", hold: "too_large" });
    expect(w.alert).toHaveBeenCalledWith("revenue_sweep.too_large", expect.anything());
  });

  it("will not pick between two wallets in one currency", async () => {
    const two = provider({ "GET /api/v1/wallets?currency=NGN&page_size=20": ok({ items: [{ id: "WAL_1", currency: "NGN" }, { id: "WAL_2", currency: "NGN" }] }) });
    const w = deps({ send: two });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "held", hold: "balance_unreadable" });
  });

  it("finishes an open sweep first, with the same key, instead of reading a new balance", async () => {
    const store = db({ state: { unsettled: true, open: { id: "22222222-2222-4222-8222-222222222222", amount_minor: 500_00, wallet_id: "WAL_1" } } });
    const w = deps({ store });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "sent", amountMinor: 500_00, payoutId: "POT_1" });
    /* No balance read: the open sweep is the only thing this run does. */
    expect(w.paths()).toEqual(["POST /api/v1/wallets/WAL_1/payouts"]);
    expect(w.send.mock.calls[0]![1].idempotencyKey).toBe("vallo-sweep:22222222-2222-4222-8222-222222222222");
    expect(w.store.calls.some((c) => c.fn === "revenue_sweep_open")).toBe(false);
  });

  it("finishes an open sweep even with the switch off, because that money may already have left", async () => {
    const store = db({ state: { unsettled: true, open: { id: "33333333-3333-4333-8333-333333333333", amount_minor: 900_00, wallet_id: "WAL_1" } } });
    const w = deps({ store, on: false });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "sent", amountMinor: 900_00, payoutId: "POT_1" });
  });

  it("records a refusal as failed, so the balance is simply tried again next run", async () => {
    const refused = provider({ "POST /api/v1/wallets/WAL_1/payouts": fail("refused", 422) });
    const w = deps({ send: refused });
    expect(await runRevenueSweep(w.d)).toMatchObject({ kind: "failed", amountMinor: BALANCE });
    expect(w.store.settles()[0]!.args).toMatchObject({ p_status: "failed" });
  });

  it("records an unreadable answer as unknown and tells somebody, never as failed", async () => {
    const lost = provider({ "POST /api/v1/wallets/WAL_1/payouts": fail("unknown") });
    const w = deps({ send: lost });
    expect(await runRevenueSweep(w.d)).toMatchObject({ kind: "unknown", amountMinor: BALANCE });
    expect(w.store.settles()[0]!.args).toMatchObject({ p_status: "unknown" });
    expect(w.alert).toHaveBeenCalledWith("revenue_sweep.unknown", expect.anything());
  });

  it("leaves a payout still on its way open, to be read back next run", async () => {
    const slow = provider({ "POST /api/v1/wallets/WAL_1/payouts": ok({ id: "POT_2", status: "processing", amount_minor: BALANCE }) });
    const w = deps({ send: slow });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "still_sending", amountMinor: BALANCE });
    expect(w.store.settles()[0]!.args).toMatchObject({ p_status: "unknown", p_provider_payout_id: "POT_2" });
  });

  it("does nothing when another run already holds the open sweep", async () => {
    const w = deps({ store: db({ open: { status: "already_open" } }) });
    expect(await runRevenueSweep(w.d)).toEqual({ kind: "held", hold: "waiting_on_earlier_sweep" });
    expect(w.paths()).not.toContain("POST /api/v1/wallets/WAL_1/payouts");
  });

  it("asks the partner only about the currency Vallo is paid in", async () => {
    expect(SWEEP_CURRENCY).toBe("NGN");
    const w = deps();
    await runRevenueSweep(w.d);
    expect(w.paths()[0]).toContain("currency=NGN");
  });
});
