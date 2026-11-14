/**
 * THE PROTECTED RAIL'S WEBHOOK, THROUGH THE ROUTE ITSELF: a delivery signed
 * the way the provider signs (its "Webhooks" guide), posted to the handler,
 * with only the database, the alert log and the failure counter stood in.
 * The signature check, the envelope, the event mapping and the rail's own
 * `applyProtectedWebhook` are the real ones.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call } from "@/lib/testing/fake-supabase";

const state = vi.hoisted(() => ({
  db: null as unknown,
  alerts: [] as { kind: string; detail?: Record<string, unknown> }[],
  failuresAllowed: true,
}));

vi.mock("@/lib/money/member-wallet", () => ({ adminDb: () => state.db }));
vi.mock("@/lib/alerts", () => ({
  recordAlert: async (alert: { kind: string; detail?: Record<string, unknown> }) => {
    state.alerts.push(alert);
    return { ok: true };
  },
}));
vi.mock("@/lib/security/money-limits", () => ({
  ROUTE_FAILURE_LIMITS: { webhookBadSignature: {} },
  countRouteFailure: async () => (state.failuresAllowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 }),
}));
vi.mock("@/lib/flags/read", () => ({ flagIsOn: async () => false }));

const { POST } = await import("./route");

const SECRET = "whsec_route_test";
const AMOUNT = 180_000_00;
const ROW = {
  id: "arr-1",
  agreement_id: "ag-1",
  provider: "escrowpay",
  reference: "vallo-pp-1",
  provider_arrangement_id: "TXN_1",
  amount_minor: AMOUNT,
  buyer_user_id: "payer",
  seller_user_id: "lister",
  status: "awaiting_payment",
  funding_instructions: null,
  funding_expires_at: null,
};

function event(over: Record<string, unknown> = {}) {
  return {
    id: "WHEV_1",
    type: "transaction.funded",
    api_version: "2026-07-24",
    created_at: "2026-11-14T10:00:00Z",
    object: "transaction",
    object_id: "TXN_1",
    data: { amount_minor: AMOUNT },
    ...over,
  };
}

function deliver(body: unknown, options: { secret?: string; at?: number; header?: string | null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const t = options.at ?? Math.floor(Date.now() / 1000);
  const signature = `t=${t},v1=${createHmac("sha256", options.secret ?? SECRET).update(`${t}.${raw}`).digest("hex")}`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const header = options.header === undefined ? signature : options.header;
  if (header !== null) headers["EscrowPay-Signature"] = header;
  return POST(new Request("https://www.vallospaces.com/api/escrowpay/webhook", { method: "POST", headers, body: raw }));
}

/** The store, with the unique (provider, event key) the live table enforces. */
function store(over: { row?: Record<string, unknown> | null; observe?: string } = {}) {
  const seen = new Map<string, { id: number; processing_status: string; retry_count: number }>();
  let nextId = 1;
  const db = fakeSupabase({
    provider_webhook_events: {
      insert: (call: Call) => {
        const v = call.values as { event_key: string };
        if (seen.has(v.event_key)) return { data: null, error: { code: "23505" } };
        const id = nextId++;
        seen.set(v.event_key, { id, processing_status: "received", retry_count: 0 });
        return { data: { id } };
      },
      select: (call: Call) => {
        const key = call.filters.find((f) => f[1] === "event_key")?.[2] as string;
        return { data: seen.get(key) ?? null };
      },
      update: (call: Call) => {
        const id = call.filters.find((f) => f[1] === "id")?.[2];
        for (const entry of seen.values()) if (entry.id === id) Object.assign(entry, call.values as object);
        return { data: null };
      },
    },
    provider_arrangements: { select: { data: over.row === undefined ? ROW : over.row } },
    provider_arrangement_observe: { rpc: { data: over.observe ?? "changed" } },
  });
  state.db = db.client;
  return { db, seen };
}

const observed = (db: ReturnType<typeof fakeSupabase>) => db.of("provider_arrangement_observe", "rpc").map((c) => c.values as Record<string, unknown>);

beforeEach(() => {
  state.alerts = [];
  state.failuresAllowed = true;
  process.env.ESCROWPAY_API_BASE_URL = "https://api.example.test";
  process.env.ESCROWPAY_API_KEY = "sk_test_route";
  process.env.ESCROWPAY_ENVIRONMENT = "sandbox";
  process.env.ESCROWPAY_WEBHOOK_SECRET = SECRET;
  delete process.env.ESCROWPAY_WEBHOOK_SECRET_PREVIOUS;
  delete process.env.VERCEL_ENV;
});

describe("a signed delivery", () => {
  it("is stored raw first, then records the payment as held, on the provider's word", async () => {
    const { db } = store();
    const response = await deliver(event());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "changed" });
    const stored = db.of("provider_webhook_events", "insert")[0]!.values as Record<string, unknown>;
    expect(stored).toMatchObject({ provider: "escrowpay", event_key: "WHEV_1", event_type: "transaction.funded", environment: "sandbox", signature_valid: true });
    expect(observed(db)[0]).toMatchObject({ p_arrangement: "arr-1", p_to_status: "protected", p_source: "provider_webhook", p_provider_event_key: "WHEV_1", p_provider_amount_minor: AMOUNT });
    /* The order: the raw event is written before anything is observed. */
    const order = db.calls.map((c) => `${c.table}.${c.op}`);
    expect(order.indexOf("provider_webhook_events.insert")).toBeLessThan(order.indexOf("provider_arrangement_observe.rpc"));
    expect(db.of("provider_webhook_events", "update").at(-1)!.values).toMatchObject({ processing_status: "processed" });
  });

  it("a redelivery of the same event is acknowledged and changes nothing", async () => {
    const { db } = store();
    await deliver(event());
    const again = await deliver(event());
    expect(await again.json()).toEqual({ received: true, duplicate: true });
    expect(observed(db)).toHaveLength(1);
  });

  it("is accepted under the previous signing secret during a rotation", async () => {
    const { db } = store();
    process.env.ESCROWPAY_WEBHOOK_SECRET_PREVIOUS = "whsec_old";
    expect((await deliver(event(), { secret: "whsec_old" })).status).toBe(200);
    expect(observed(db)).toHaveLength(1);
  });

  it("works on a production deployment holding a test key: recording is never stopped", async () => {
    const { db } = store();
    process.env.VERCEL_ENV = "production";
    expect((await deliver(event())).status).toBe(200);
    expect(observed(db)).toHaveLength(1);
  });

  it.each([
    ["release.completed", { object: "release", object_id: "RLS_1", data: { transaction_id: "TXN_1", amount_minor: AMOUNT } }, "released"],
    ["refund.completed", { object: "refund", object_id: "RFD_1", data: { transaction_id: "TXN_1", amount_minor: AMOUNT } }, "refunded"],
    ["transaction.expired", {}, "cancelled"],
  ])("%s is recorded as %s", async (type, over, to) => {
    const { db } = store({ row: { ...ROW, status: "release_requested" } });
    await deliver(event({ id: `WHEV_${type}`, type, ...over }));
    expect(observed(db)[0]).toMatchObject({ p_to_status: to });
  });

  it("an event Vallo does not act on is stored, acknowledged, and moves nothing", async () => {
    const { db } = store();
    const response = await deliver(event({ id: "WHEV_2", type: "wallet.credited", object: "wallet", object_id: "WLT_1", data: {} }));
    expect(await response.json()).toEqual({ received: true, outcome: "unmapped" });
    expect(db.of("provider_webhook_events", "insert")).toHaveLength(1);
    expect(observed(db)).toHaveLength(0);
    expect(db.of("provider_webhook_events", "update").at(-1)!.values).toMatchObject({ processing_status: "ignored" });
  });

  it("an event for a transaction Vallo never made is stored and moves nothing", async () => {
    const { db } = store({ row: null });
    const response = await deliver(event({ object_id: "TXN_other" }));
    expect(await response.json()).toEqual({ received: true, outcome: "unknown_arrangement" });
    expect(observed(db)).toHaveLength(0);
  });

  it("a signed body that is not the envelope is stored as malformed and acted on not at all", async () => {
    const { db } = store();
    const response = await deliver({ hello: "world" });
    expect(await response.json()).toEqual({ received: true, ignored: "malformed" });
    expect((db.of("provider_webhook_events", "insert")[0]!.values as Record<string, unknown>).event_type).toBe("malformed");
    expect(observed(db)).toHaveLength(0);
  });

  it("a database refusal of the step is answered 200 and recorded, never retried into success", async () => {
    const { db } = store({ observe: "refused" });
    const response = await deliver(event());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "refused" });
    expect(db.of("provider_webhook_events", "update").at(-1)!.values).toMatchObject({ processing_status: "processed", error: "refused" });
  });
});

describe("a delivery that is not the provider's", () => {
  it.each([
    ["no signature header", { header: null }],
    ["another secret", { secret: "whsec_someone_else" }],
    ["a signature older than five minutes", { at: Math.floor(Date.now() / 1000) - 301 }],
    ["a malformed header", { header: "v1=abc" }],
  ])("%s is refused with 401, alerted, and nothing is written", async (_name, options) => {
    const { db } = store();
    const response = await deliver(event(), options);
    expect(response.status).toBe(401);
    expect(db.calls).toHaveLength(0);
    expect(state.alerts.map((a) => a.kind)).toEqual(["webhook.escrowpay.signature_invalid"]);
  });

  it("a body changed after signing is refused", async () => {
    const { db } = store();
    const raw = JSON.stringify(event());
    const t = Math.floor(Date.now() / 1000);
    const signature = `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex")}`;
    const tampered = raw.replace(String(AMOUNT), String(AMOUNT + 1));
    const response = await POST(new Request("https://www.vallospaces.com/api/escrowpay/webhook", { method: "POST", headers: { "EscrowPay-Signature": signature }, body: tampered }));
    expect(response.status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it("a spray of bad signatures is slowed with 429", async () => {
    store();
    state.failuresAllowed = false;
    const response = await deliver(event(), { secret: "whsec_someone_else" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("answers 503 and reads nothing while the rail is not configured, or has no signing secret", async () => {
    const { db } = store();
    delete process.env.ESCROWPAY_WEBHOOK_SECRET;
    expect((await deliver(event())).status).toBe(503);
    process.env.ESCROWPAY_WEBHOOK_SECRET = SECRET;
    delete process.env.ESCROWPAY_API_KEY;
    expect((await deliver(event())).status).toBe(503);
    expect(db.calls).toHaveLength(0);
  });
});
