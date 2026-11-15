/**
 * THE PROTECTED RAIL AGAINST THE PROVIDER'S SANDBOX, END TO END.
 *
 * Vallo's own server code (`lib/money/protected-rail.ts` and
 * `protected-provider.ts`), unchanged, talking to the real sandbox over the
 * network. Only the database is a stand-in: one arrangement row held in
 * memory, with the same step table the live database enforces.
 *
 * It runs only when a TEST key is handed to it, and is skipped otherwise:
 *
 *   ESCROWPAY_SANDBOX_KEY=sk_test_... npx vitest run src/lib/payments/providers/escrowpay/sandbox.e2e.test.ts
 *
 * A live key is refused by the configuration (the marker here is `sandbox`),
 * so this can never touch real money. The key is read from the environment
 * and is in no file.
 *
 * What it uses that is the sandbox's alone:
 *  - the simulator's identities (`GET /sandbox/identity-fixtures`): the two
 *    people are checked once and found again by their reference on every
 *    later run, because the simulator keeps an identifier for good, and
 *    likewise the lister's bank account, which the provider registers once;
 *  - the test checkout's own "simulate" door, which stands in for the bank
 *    transfer. It is reached from the session's hosted address, exists only
 *    for a test session, and is not part of the Merchant API.
 *
 * `ESCROWPAY_SANDBOX_PAYOUT` picks the payout preference asked for
 * (`automatic` by default, as in production). On an account where the
 * provider has automatic payout switched off, `automatic` is refused at the
 * create, which the first test reports as exactly that.
 */
import { describe, expect, it, vi } from "vitest";
import { stepAllowed, type ArrangementStatus } from "@/lib/money/arrangement-states";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import type { RailResult } from "../../provider";
import type { EscrowPayCall } from "./client";

vi.mock("@/lib/money/release-gate", () => ({ releaseGate: async () => "clear" }));

const KEY = (process.env.ESCROWPAY_SANDBOX_KEY ?? "").trim();
const PAYOUT = (process.env.ESCROWPAY_SANDBOX_PAYOUT ?? "automatic").trim();
const run = KEY ? describe : describe.skip;

const { escrowPayConfig } = await import("./config");
const { sendEscrowPay } = await import("./client");
const { failureCode } = await import("./errors");
const rail = await import("@/lib/money/protected-rail");
const provider = await import("@/lib/money/protected-provider");
const payouts = await import("@/lib/money/protected-payout");

const PAYER = "vallo-e2e-payer";
const LISTER = "vallo-e2e-lister";
const AMOUNT = 180_000_00;

type Row = Record<string, unknown> & { id: string; status: ArrangementStatus; reference: string; provider_arrangement_id: string | null; funding_instructions: Record<string, unknown> | null };

/** One arrangement in memory, behind the same doors the rail uses on the live database. */
function world(name: string) {
  const row: Row = {
    id: `arr-${name}`,
    agreement_id: `ag-${name}`,
    provider: "escrowpay",
    reference: `vallo-pp-e2e${name}${Date.now()}`,
    provider_arrangement_id: null,
    amount_minor: AMOUNT,
    buyer_user_id: PAYER,
    seller_user_id: LISTER,
    status: "preparing",
    funding_instructions: null,
    funding_expires_at: null,
  };
  const journey: string[] = ["preparing"];
  const db = fakeSupabase({
    provider_arrangements: {
      /* A list read (the payout read-back) gets the one row as a list. */
      select: (call) => ({ data: call.filters.some((f) => f[0] === "or") ? [{ ...row }] : { ...row } }),
      update: (call) => {
        Object.assign(row, call.values as object);
        return { data: [{ id: row.id }] };
      },
    },
    provider_arrangement_events: { insert: { data: null } },
    deal_agreements: { select: { data: { renter_id: PAYER, owner_id: LISTER, named_payer_id: null, named_payer_by_renter_at: null, named_payer_accepted_at: null, listing_id: null } } },
    bank_accounts: { select: { data: [{ bank_code: "058", bank_name: "GTBank", account_number: "0123456781", resolved_account_name: "E2E LISTER", is_default: true }] } },
    protected_payment_open: { rpc: () => ({ data: { status: "ok", id: row.id } }) },
    protected_payment_transfer_reported: { rpc: { data: "ok" } },
    /* The live function's rules that matter here: Vallo may only say it asked; a step must be allowed; the amount must be the record's. */
    provider_arrangement_observe: {
      rpc: (call) => {
        const v = call.values as { p_to_status: ArrangementStatus; p_source: string; p_provider_arrangement_id: string | null; p_provider_amount_minor: number | null };
        if (v.p_provider_amount_minor !== null && v.p_provider_amount_minor !== row.amount_minor) return { data: "amount_mismatch" };
        if (v.p_source === "vallo" && !["payment_processing", "release_requested", "refund_requested", "requires_review", "disputed", "unknown"].includes(v.p_to_status)) return { data: "refused" };
        if (row.status === v.p_to_status) return { data: "same" };
        if (!stepAllowed(row.status, v.p_to_status)) return { data: "refused" };
        row.status = v.p_to_status;
        /* The stamp the live trigger writes, which the payout read-back looks from. */
        if (v.p_to_status === "release_requested") row.release_requested_at = new Date().toISOString();
        row.provider_arrangement_id = row.provider_arrangement_id ?? v.p_provider_arrangement_id;
        journey.push(`${v.p_to_status} (${v.p_source})`);
        return { data: "changed" };
      },
    },
  });
  /* The real send, keeping each answer so the test checkout can be found. */
  const answers: { call: EscrowPayCall; result: RailResult<unknown> }[] = [];
  const configured = escrowPayConfig({
    ESCROWPAY_API_BASE_URL: "https://production-business-api.escrowpay.app",
    ESCROWPAY_API_KEY: KEY,
    ESCROWPAY_ENVIRONMENT: "sandbox",
  });
  /* The test alone may ask for the provider's other mode, to run on an account where automatic payout is switched off. */
  const config = configured && PAYOUT === "manual" ? { ...configured, payoutPreference: "manual" as const } : configured;
  const alerts: string[] = [];
  const deps = {
    db: db.client as never,
    config,
    documented: true,
    send: async (c: typeof config, call: EscrowPayCall) => {
      const result = await sendEscrowPay(c, call);
      answers.push({ call, result });
      return result;
    },
    enabled: async () => true,
    alert: async (kind: string) => {
      alerts.push(kind);
    },
    now: Date.now,
  };
  return { row, journey, deps, answers, alerts };
}

/** The bank transfer, played by the test checkout's own simulator for the session the rail opened. */
async function transfer(w: ReturnType<typeof world>): Promise<void> {
  const session = [...w.answers].reverse().find((a) => a.call.path.endsWith("/checkout-sessions") && a.result.ok);
  const data = session && session.result.ok ? (session.result.value as { data: { hosted_url: string } }).data : null;
  expect(data?.hosted_url, "the rail opened a checkout session").toBeTruthy();
  const hosted = new URL(data!.hosted_url);
  const token = hosted.pathname.split("/").filter(Boolean).pop()!;
  const response = await fetch(`${hosted.origin}/api/checkout/${encodeURIComponent(token)}/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ outcome: "success", amount_minor: w.row.funding_instructions!.amount_minor, currency: "NGN" }),
  });
  expect(response.status, "the test checkout took the simulated transfer").toBe(200);
}

/** Both people known to the provider: checked the first time this ever runs, found by reference after. */
async function people(w: ReturnType<typeof world>) {
  const payer = await provider.onboardMember(w.deps, { userId: PAYER, kind: "nin", identifier: "12345678904", dateOfBirth: "1990-01-15", email: "e2e-payer@example.com", name: "E2E Payer", phone: null });
  const lister = await provider.onboardMember(w.deps, { userId: LISTER, kind: "bvn", identifier: "22222222224", dateOfBirth: "1990-01-15", email: "e2e-lister@example.com", name: "E2E Lister", phone: null });
  expect(payer.state).toBe("verified");
  expect(lister.state).toBe("verified");
}

const actor = (w: ReturnType<typeof world>, who: string) => ({ arrangementId: w.row.id, actorUserId: who });

run("the protected rail against the provider's sandbox", () => {
  it("the key is a test key, and the configuration says sandbox", async () => {
    const w = world("ctx");
    expect(w.deps.config?.environment).toBe("sandbox");
    const context = await sendEscrowPay(w.deps.config, { method: "GET", path: "/api/v1/credential-context" });
    expect(context.ok).toBe(true);
    expect((context as { value: { data: { environment: string } } }).value.data.environment).toBe("test");
  });

  it("a wrong date of birth is not a match, and makes no party", async () => {
    const w = world("dob");
    const out = await provider.onboardMember(w.deps, { userId: `vallo-e2e-nobody-${Date.now()}`, kind: "nin", identifier: "12345678906", dateOfBirth: "1991-02-02", email: "e2e-nobody@example.com", name: null, phone: null });
    expect(out).toEqual({ state: "not_matched" });
  });

  it("opens, is funded by transfer, is released on the payer's confirmation", async () => {
    const w = world("rel");
    await people(w);
    const opened = await rail.openProtectedPayment(w.deps, { agreementId: String(w.row.agreement_id), acceptedVersion: 1, actorUserId: PAYER });
    if (opened.outcome === "failed" && w.alerts.includes("protected_rail.automatic_payout_disabled")) {
      throw new Error("The provider refused the transaction: automatic payout is switched off on this account. Turn it on in the provider's dashboard, or run with ESCROWPAY_SANDBOX_PAYOUT=manual.");
    }
    expect(opened).toEqual({ outcome: "opened", arrangementId: w.row.id, status: "awaiting_payment" });
    expect(w.row.provider_arrangement_id).toMatch(/^TXN_/);
    /* The transfer details the payer will see: a bank, a name, a number, and a total of at least the amount. */
    const details = w.row.funding_instructions!;
    expect(details.bank_name).toBeTruthy();
    expect(details.account_name).toBeTruthy();
    expect(String(details.account_number)).toMatch(/^[0-9A-Za-z]{6,32}$/);
    expect(Number(details.amount_minor)).toBeGreaterThanOrEqual(AMOUNT);
    expect(w.row.funding_expires_at).toBeTruthy();

    /* Before any money: a read-back moves nothing, and a release is refused. */
    expect(await rail.refreshProtectedPayment(w.deps, actor(w, PAYER))).toEqual({ outcome: "read", status: "awaiting_payment", moved: false });
    expect(await rail.confirmProtectedMilestone(w.deps, actor(w, PAYER))).toMatchObject({ outcome: "refused" });

    await transfer(w);
    /* "I've made the transfer": only the provider's word records it held. */
    expect(await rail.reportTransfer(w.deps, actor(w, PAYER))).toEqual({ outcome: "read", status: "protected", moved: true });

    /* The lister cannot release it; the payer can, once. */
    expect(await rail.confirmProtectedMilestone(w.deps, actor(w, LISTER))).toMatchObject({ outcome: "refused" });
    expect(await rail.confirmProtectedMilestone(w.deps, actor(w, PAYER))).toEqual({ outcome: "submitted" });
    expect(w.row.status).toBe("release_requested");
    expect(await rail.refreshProtectedPayment(w.deps, actor(w, LISTER))).toEqual({ outcome: "read", status: "released", moved: true });

    expect(w.journey).toEqual(["preparing", "awaiting_payment (provider_response)", "protected (provider_readback)", "release_requested (vallo)", "released (provider_readback)"]);

    /* Automatic payout: the partner sends the released money straight on to
       the lister's bank, and Vallo records it from the partner's own word. */
    if (PAYOUT !== "manual") {
      let paid = false;
      for (let i = 0; i < 6 && !paid; i += 1) {
        await payouts.reconcilePayouts(w.deps, 3);
        paid = w.row.payout_status === "paid";
        if (!paid) await new Promise((r) => setTimeout(r, 2_000));
      }
      expect(w.row.payout_status, "the transfer to the lister's bank completed").toBe("paid");
      expect(String(w.row.payout_reference)).toMatch(/^POT_/);
      expect(Number(w.row.payout_amount_minor)).toBeGreaterThan(0);
      expect(w.row.payout_completed_at).toBeTruthy();
    }
    expect(w.alerts).toEqual([]);
  }, 120_000);

  it("opens, is funded, is disputed, and is refunded on staff's instruction", async () => {
    const w = world("ref");
    await people(w);
    const opened = await rail.openProtectedPayment(w.deps, { agreementId: String(w.row.agreement_id), acceptedVersion: 1, actorUserId: PAYER });
    expect(opened.outcome).toBe("opened");
    await transfer(w);
    expect(await rail.refreshProtectedPayment(w.deps, actor(w, PAYER))).toEqual({ outcome: "read", status: "protected", moved: true });

    expect(await rail.raiseProtectedDispute(w.deps, { ...actor(w, PAYER), statement: "The keys were never handed over." })).toEqual({ outcome: "submitted" });
    /* A dispute moves no money: the provider still holds all of it. */
    expect(await rail.confirmProtectedMilestone(w.deps, actor(w, PAYER))).toMatchObject({ outcome: "refused" });
    expect(await rail.instructProtectedRefund(w.deps, { arrangementId: w.row.id, staffUserId: "staff-e2e", reason: "The handover never took place." })).toEqual({ outcome: "submitted" });
    expect(await rail.refreshProtectedPayment(w.deps, actor(w, PAYER))).toEqual({ outcome: "read", status: "refunded", moved: true });

    expect(w.journey).toEqual(["preparing", "awaiting_payment (provider_response)", "protected (provider_readback)", "disputed (vallo)", "refund_requested (vallo)", "refunded (provider_readback)"]);
  }, 120_000);

  it("the same step asked twice is one request to the provider", async () => {
    const w = world("idem");
    await people(w);
    expect((await rail.openProtectedPayment(w.deps, { agreementId: String(w.row.agreement_id), acceptedVersion: 1, actorUserId: PAYER })).outcome).toBe("opened");
    const create = w.answers.find((a) => a.call.path === "/api/v1/transactions" && a.call.method === "POST")!;
    const again = await sendEscrowPay(w.deps.config, create.call);
    expect(again.ok).toBe(true);
    const id = (r: RailResult<unknown>) => (r.ok ? (r.value as { data: { id: string } }).data.id : null);
    expect(id(again)).toBe(id(create.result));
    /* And the same key with a different amount is refused, never a second transaction. */
    const changed = await sendEscrowPay(w.deps.config, { ...create.call, body: { ...create.call.body, amount_minor: AMOUNT + 100 } });
    expect(changed.ok).toBe(false);
    expect(changed.ok ? null : failureCode(changed)).toBe("idempotency_conflict");
  }, 120_000);
});
