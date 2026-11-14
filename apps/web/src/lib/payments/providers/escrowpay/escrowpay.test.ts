/**
 * THE PROTECTED PAYMENT ADAPTER: each test pins one of the provider's own
 * documented facts, or one way the adapter could otherwise move or misreport
 * money.
 */
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARRANGEMENT_STATUSES } from "@/lib/money/arrangement-states";

const flag = vi.hoisted(() => ({ on: false as boolean | "throws" }));
vi.mock("../../../flags/read", () => ({
  flagIsOn: async () => {
    if (flag.on === "throws") return false; // flagIsOn itself fails closed on a failed read
    return flag.on;
  },
}));

const { escrowPayConfig } = await import("./config");
const { DOCUMENTED, ESCROWPAY_PATHS, envelopeData, escrowPayRequest, sendEscrowPay } = await import("./client");
const { escrowPayErrorCode, failureCode, failureFromHttp } = await import("./errors");
const { ESCROWPAY_EVENT_STATES, ESCROWPAY_STATUS_WORDS, normaliseEscrowPayEvent, normaliseEscrowPayStatus } = await import("./normaliser");
const { ESCROWPAY_EVENT_TYPES, parseEscrowPayWebhook, verifyEscrowPaySignature } = await import("./webhooks");
const read = await import("./read");
const requests = await import("./requests");

const SANDBOX = {
  ESCROWPAY_API_BASE_URL: "https://api.example.test/",
  ESCROWPAY_API_KEY: "ep_test_sk_abc",
  ESCROWPAY_WEBHOOK_SECRET: "whsec_test",
  ESCROWPAY_ENVIRONMENT: "sandbox",
};
const LIVE = { ...SANDBOX, ESCROWPAY_API_KEY: "ep_live_sk_abc", ESCROWPAY_ENVIRONMENT: "production" };

describe("configuration", () => {
  it("is null with nothing set, and never supplies a base URL of its own", () => {
    expect(escrowPayConfig({})).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: " " })).toBeNull();
  });

  it("reads a sandbox configuration, and takes a pasted /api/v1 and trailing slash off the host", () => {
    const expected = {
      baseUrl: "https://api.example.test",
      apiKey: "ep_test_sk_abc",
      webhookSecret: "whsec_test",
      webhookSecretPrevious: null,
      environment: "sandbox",
      payoutPreference: "automatic",
      startsMoney: true,
    };
    expect(escrowPayConfig(SANDBOX)).toEqual(expected);
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "https://api.example.test/api/v1/" })).toEqual(expected);
  });

  it("refuses plain http, credentials in the URL, and a missing or unknown environment marker", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "http://api.example.test" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "https://u:p@api.example.test" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_ENVIRONMENT: "" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_ENVIRONMENT: "live" })).toBeNull();
  });

  it("reads the key prefixes the dashboard really issues, and the ones the guide writes", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: "sk_test_0000.abc" })?.environment).toBe("sandbox");
    expect(escrowPayConfig({ ...LIVE, ESCROWPAY_API_KEY: "sk_live_0000.abc", VERCEL_ENV: "production" })?.environment).toBe("production");
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: "sk_live_0000.abc" })).toBeNull();
  });

  it("pays out automatically unless the deployment says manual, and refuses any other word", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_PAYOUT_PREFERENCE: "manual" })?.payoutPreference).toBe("manual");
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_PAYOUT_PREFERENCE: " Automatic " })?.payoutPreference).toBe("automatic");
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_PAYOUT_PREFERENCE: "retain_in_wallet" })).toBeNull();
  });

  it("refuses a key whose book is not the one the marker names", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: "ep_live_sk_abc" })).toBeNull();
    expect(escrowPayConfig({ ...LIVE, ESCROWPAY_API_KEY: "ep_test_sk_abc", VERCEL_ENV: "production" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: "some-other-key" })).toBeNull();
  });

  it("uses production credentials only on a production deployment", () => {
    expect(escrowPayConfig({ ...LIVE, VERCEL_ENV: "preview" })).toBeNull();
    expect(escrowPayConfig({ ...LIVE, VERCEL_ENV: "development" })).toBeNull();
    expect(escrowPayConfig({ ...LIVE, VERCEL_ENV: "production" })).toMatchObject({ environment: "production", startsMoney: true });
  });

  it("a test key on the production deployment may record and read, and starts nothing", () => {
    expect(escrowPayConfig({ ...SANDBOX, VERCEL_ENV: "production" })).toMatchObject({ environment: "sandbox", startsMoney: false });
    expect(escrowPayConfig({ ...SANDBOX, VERCEL_ENV: "preview" })?.startsMoney).toBe(true);
  });

  it("carries the previous signing secret only when one is set", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_WEBHOOK_SECRET_PREVIOUS: "whsec_old" })?.webhookSecretPrevious).toBe("whsec_old");
  });
});

describe("the client", () => {
  it("is verified against the sandbox, and still sends nothing without a configuration", async () => {
    expect(DOCUMENTED).toBe(true);
    const fetchImpl = vi.fn();
    expect(await escrowPayRequest(null, { method: "GET", path: ESCROWPAY_PATHS.banks }, fetchImpl as unknown as typeof fetch)).toMatchObject({ ok: false, kind: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends nothing without a configuration", async () => {
    const fetchImpl = vi.fn();
    expect(await sendEscrowPay(null, { method: "GET", path: ESCROWPAY_PATHS.banks }, fetchImpl as unknown as typeof fetch)).toMatchObject({ kind: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the key in X-API-Key and the idempotency key in Idempotency-Key, to the /api/v1 path", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, message: "ok", data: { id: "TXN_1" } }), { status: 201 }));
    const out = await sendEscrowPay(
      escrowPayConfig(SANDBOX),
      { method: "POST", path: ESCROWPAY_PATHS.create, body: { amount_minor: 100 }, idempotencyKey: "vallo-pp-1:create" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out).toEqual({ ok: true, value: { success: true, message: "ok", data: { id: "TXN_1" } } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/transactions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "X-API-Key": "ep_test_sk_abc", "Idempotency-Key": "vallo-pp-1:create", "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ amount_minor: 100 }));
  });

  it("reads no answer, and a 2xx that is not JSON, as unknown: the call may have moved money", async () => {
    const dropped = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    expect(await sendEscrowPay(escrowPayConfig(SANDBOX), { method: "POST", path: ESCROWPAY_PATHS.create, body: {} }, dropped as unknown as typeof fetch)).toMatchObject({ ok: false, kind: "unknown" });
    const html = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await sendEscrowPay(escrowPayConfig(SANDBOX), { method: "GET", path: ESCROWPAY_PATHS.banks }, html as unknown as typeof fetch)).toMatchObject({ ok: false, kind: "unknown" });
  });

  it("keeps the provider's own code on a refusal", async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ detail: { code: "identity_verification_failed", message: "No match." } }), { status: 422 }));
    const out = await sendEscrowPay(escrowPayConfig(SANDBOX), { method: "POST", path: ESCROWPAY_PATHS.onboardParty, body: {} }, refused as unknown as typeof fetch);
    expect(out).toMatchObject({ ok: false, kind: "refused", httpStatus: 422 });
    expect(out.ok ? null : failureCode(out)).toBe("identity_verification_failed");
  });

  it("encodes an id into the path rather than letting it change the route", () => {
    expect(ESCROWPAY_PATHS.release("a/../b")).toBe("/api/v1/transactions/a%2F..%2Fb/releases");
    expect(ESCROWPAY_PATHS.partiesByReference("u&status=x")).toBe("/api/v1/parties?external_reference=u%26status%3Dx&page_size=5");
  });

  it("unwraps the success envelope and leaves a bare value alone", () => {
    expect(envelopeData({ success: true, message: "ok", data: { id: 1 } })).toEqual({ id: 1 });
    expect(envelopeData([1])).toEqual([1]);
  });
});

describe("errors", () => {
  it("treats no answer as unknown, never as a failure that is safe to repeat", () => {
    expect(failureFromHttp(null, "timeout").kind).toBe("unknown");
  });

  it.each([
    [401, "not_configured"],
    [403, "not_configured"],
    [404, "not_found"],
    [409, "refused"],
    [422, "refused"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [302, "unreadable"],
  ] as const)("HTTP %i is %s", (status, kind) => {
    expect(failureFromHttp(status, "x").kind).toBe(kind);
  });

  it("reads the provider's two error bodies, and nothing from anything else", () => {
    expect(escrowPayErrorCode(JSON.stringify({ detail: { code: "invalid_credential", message: "x" } }))).toBe("invalid_credential");
    expect(escrowPayErrorCode(JSON.stringify({ detail: [{ loc: ["body", "x"], msg: "required", type: "missing" }] }))).toBe("validation_error");
    expect(escrowPayErrorCode("<html>")).toBeNull();
    expect(escrowPayErrorCode(JSON.stringify({ detail: "Not Found" }))).toBeNull();
  });
});

describe("the requests Vallo sends", () => {
  it("asks for an exact, manual, automatically paid out transaction named by Vallo's reference", () => {
    const call = requests.createTransactionCall({
      reference: "vallo-pp-1",
      amountMinor: 180_000_00,
      payerPartyId: "PAR_a",
      beneficiaryPartyId: "PAR_b",
      payoutAccountId: "PAC_b",
      payoutPreference: "automatic",
      fundingDeadline: "2026-11-16T10:00:00.000Z",
      description: "d",
      metadata: {},
    });
    expect(call).toMatchObject({ method: "POST", path: "/api/v1/transactions", idempotencyKey: "vallo-pp-1:create" });
    expect(call.body).toMatchObject({
      type: "standard",
      amount_minor: 180_000_00,
      currency: "NGN",
      funding_mode: "exact",
      payer: { party_id: "PAR_a" },
      beneficiary: { party_id: "PAR_b" },
      release_policy: "manual_only",
      refund_policy: "manual_only",
      payout_preference: "automatic",
      payout_account_id: "PAC_b",
      external_reference: "vallo-pp-1",
    });
  });

  it("gives every money step its own idempotency key, and new details a new one", () => {
    const base = { reference: "vallo-pp-1", transactionId: "TXN_1" };
    expect(requests.activateTransactionCall({ ...base, version: 1 }).idempotencyKey).toBe("vallo-pp-1:activate");
    expect(requests.releaseCall({ ...base, amountMinor: 5 }).idempotencyKey).toBe("vallo-pp-1:release");
    expect(requests.refundCall({ ...base, amountMinor: 5, reason: "r" }).idempotencyKey).toBe("vallo-pp-1:refund");
    const first = requests.paymentAccountCall({ ...base, amountMinor: 5, expiresAt: "x", attempt: 1 });
    const second = requests.paymentAccountCall({ ...base, amountMinor: 5, expiresAt: "x", attempt: 2 });
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });

  it("refunds from the bank's hold, the whole amount it is given", () => {
    expect(requests.refundCall({ reference: "r", transactionId: "TXN_1", amountMinor: 700, reason: "The deal fell through." }).body).toMatchObject({ amount_minor: 700, source: "escrow_held" });
  });

  it("sends an identity check with consent and Vallo's own id as the reference", () => {
    const call = requests.onboardPartyCall({ kind: "nin", identifier: "12345678901", dateOfBirth: "1990-01-31", email: "a@b.co", userId: "user-1", name: "A B", phone: null, consentReference: "c" });
    expect(call.path).toBe("/api/v1/parties/onboard");
    expect(call.body).toMatchObject({ type: "nin", identifier: "12345678901", date_of_birth: "1990-01-31", consent: true, external_reference: "user-1", email: "a@b.co" });
    expect(call.idempotencyKey).toBeUndefined();
  });
});

describe("the provider's answers", () => {
  it("reads a transaction only by the provider's own id, and its numbers only as whole kobo", () => {
    expect(read.readTransaction({ success: true, message: "", data: { id: "TXN_1", status: "Draft", version: 1, amount_minor: 500, funded_minor: 0 } })).toEqual({
      id: "TXN_1",
      status: "draft",
      version: 1,
      amountMinor: 500,
      fundedMinor: 0,
      releasedMinor: null,
      refundedMinor: null,
      externalReference: null,
    });
    expect(read.readTransaction({ data: { id: "abc", status: "funded" } })).toBeNull();
    expect(read.readTransaction({ data: { id: "TXN_1", amount_minor: "500" } })?.amountMinor).toBeNull();
    expect(read.readTransaction(null)).toBeNull();
  });

  /* The checkout session exactly as the sandbox answered it on 14 November 2026 (ids shortened). */
  const SESSION = {
    success: true,
    message: "Checkout session created.",
    data: {
      id: "CSN_1dd4",
      transaction_id: "TXN_7749",
      status: "open",
      amount_minor: 18_000_000,
      hosted_url: "https://business.example.test/checkout/tok",
      payment_instructions: {
        payment_account_id: "PAM_01f2",
        account_number: "9b9e9059a0",
        masked_account_number: "****59a0",
        bank_code: "000",
        account_name: "VALLO SPACES LTD",
        amount_minor: 18_285_000,
        currency: "NGN",
        expires_at: "2026-11-16T20:16:05+00:00",
        provider: "simulator",
      },
    },
  };

  it("reads the transfer details from a checkout session: the account, its name, and the total with the fee", () => {
    expect(read.readPaymentInstructions(SESSION, true)).toEqual({
      checkoutSessionId: "CSN_1dd4",
      paymentAccountId: "PAM_01f2",
      bankCode: "000",
      accountName: "VALLO SPACES LTD",
      accountNumber: "9b9e9059a0",
      amountMinor: 18_285_000,
      expiresAt: "2026-11-16T20:16:05+00:00",
    });
  });

  it("takes only a numeric account number from a live session, and nothing from a session missing a part", () => {
    expect(read.readPaymentInstructions(SESSION, false)).toBeNull();
    const live = { data: { ...SESSION.data, payment_instructions: { ...SESSION.data.payment_instructions, account_number: "0123456789" } } };
    expect(read.readPaymentInstructions(live, false)?.accountNumber).toBe("0123456789");
    for (const missing of ["account_name", "bank_code", "amount_minor", "payment_account_id"]) {
      const pi = { ...SESSION.data.payment_instructions, [missing]: null };
      expect(read.readPaymentInstructions({ data: { ...SESSION.data, payment_instructions: pi } }, true)).toBeNull();
    }
    expect(read.readPaymentInstructions({ data: { id: "CSN_1" } }, true)).toBeNull();
  });

  it("reads a payment account's id, the bank list, a payout account and the fee estimate as the sandbox gives them", () => {
    expect(read.readPaymentAccountId({ data: { id: "PAM_01f2", status: "active" } })).toBe("PAM_01f2");
    expect(read.readPaymentAccountId({ data: { id: "nope" } })).toBeNull();
    expect(read.readBanks({ data: { environment: "test", banks: [{ bank_code: "000013", bank_name: "GTBANK PLC (Simulator)" }, { bank_code: "" }] } })).toEqual([{ code: "000013", name: "GTBANK PLC (Simulator)" }]);
    expect(
      read.readPayoutAccount({ data: { id: "PAC_3028", status: "verified", bank_code: "000013", account_number: "0123456789", masked_account_number: "******6789", resolved_account_name: "ADA OBI", payout_eligible: true } }),
    ).toEqual({ id: "PAC_3028", status: "verified", bankCode: "000013", accountTail: "6789", accountName: "ADA OBI", payoutEligible: true });
    expect(read.readFeeEstimate({ data: { amount_minor: 285_000, fee_type: "escrow_service", payer: "payer" } })).toEqual({ feeMinor: 285_000, payer: "payer" });
    expect(read.readFeeEstimate({ data: { amount_minor: 285_000, payer: "someone" } })).toBeNull();
  });

  it("finds a member's party in a list, and reads the onboarding result the OpenAPI types", () => {
    expect(read.readPartyList({ data: { items: [{ id: "PAR_1", status: "active" }, { id: "nope" }] } })).toEqual([{ id: "PAR_1", status: "active", payoutEligible: null }]);
    expect(
      read.readOnboarded({ data: { status: "ok", party: { id: "PAR_9", status: "active" }, identity: { id: "IDN_1", masked_identifier: "*******8901", verification_details: { full_name: "ADA OBI" } } } }),
    ).toEqual({ party: { id: "PAR_9", status: "active", payoutEligible: null }, maskedIdentifier: "*******8901", verifiedName: "ADA OBI" });
    expect(read.readOnboarded({ data: { status: "ok", party: null } })).toBeNull();
  });
});

describe("status words and events", () => {
  it("maps the transaction status words the sandbox showed, and leaves a draft unmapped", () => {
    expect(normaliseEscrowPayStatus("pending_funding")).toBe("awaiting_payment");
    expect(normaliseEscrowPayStatus("funded")).toBe("protected");
    expect(normaliseEscrowPayStatus("released")).toBe("released");
    expect(normaliseEscrowPayStatus("refunded")).toBe("refunded");
    expect(normaliseEscrowPayStatus("cancelled")).toBe("cancelled");
    expect(normaliseEscrowPayStatus("draft")).toBeNull();
    expect(normaliseEscrowPayStatus("completed")).toBeNull();
  });

  it("never turns an unknown word into funded or released", () => {
    for (const word of ["RELEASED!", "held", "success", "paid", "in_progress", "", null, 7]) {
      expect(normaliseEscrowPayStatus(word)).toBeNull();
      expect(normaliseEscrowPayEvent(word)).toBeNull();
    }
  });

  it("only ever names a state Vallo has, and never the historical split", () => {
    for (const state of [...Object.values(ESCROWPAY_STATUS_WORDS), ...Object.values(ESCROWPAY_EVENT_STATES)]) {
      expect(ARRANGEMENT_STATUSES).toContain(state);
      expect(state).not.toBe("split");
    }
  });

  it("maps only events from the provider's closed set", () => {
    for (const event of Object.keys(ESCROWPAY_EVENT_STATES)) expect(ESCROWPAY_EVENT_TYPES).toContain(event);
  });

  it("funded, released and refunded each come from exactly one event", () => {
    const from = (state: string) => Object.entries(ESCROWPAY_EVENT_STATES).filter(([, s]) => s === state).map(([e]) => e);
    expect(from("protected")).toEqual(["transaction.funded"]);
    expect(from("released")).toEqual(["release.completed"]);
    expect(from("refunded")).toEqual(["refund.completed"]);
  });

  it("a payout or a wallet event moves no arrangement", () => {
    for (const event of ["payout.completed", "wallet.credited", "transaction.created", "charge.succeeded", "release.created"]) {
      expect(normaliseEscrowPayEvent(event)).toBeNull();
    }
  });
});

describe("webhooks", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "WHEV_1", type: "transaction.funded", api_version: "2026-07-24", created_at: "2026-07-24T04:00:00Z", object: "transaction", object_id: "TXN_1", data: { amount_minor: 500 } });
  const sign = (t: number, raw = body, key = secret) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${raw}`).digest("hex")}`;
  const now = 1_800_000_000;

  it("accepts the provider's signature over the timestamp, a dot and the raw body", () => {
    expect(verifyEscrowPaySignature(body, sign(now), secret, now)).toBe(true);
    expect(verifyEscrowPaySignature(body, sign(now - 299), [secret], now)).toBe(true);
  });

  it("refuses a missing header, a missing secret, another secret, a changed body and a malformed header", () => {
    expect(verifyEscrowPaySignature(body, null, secret, now)).toBe(false);
    expect(verifyEscrowPaySignature(body, sign(now), null, now)).toBe(false);
    expect(verifyEscrowPaySignature(body, sign(now), [null, ""], now)).toBe(false);
    expect(verifyEscrowPaySignature(body, sign(now, body, "whsec_other"), secret, now)).toBe(false);
    expect(verifyEscrowPaySignature(`${body} `, sign(now), secret, now)).toBe(false);
    expect(verifyEscrowPaySignature(body, "v1=abc", secret, now)).toBe(false);
    expect(verifyEscrowPaySignature(body, `t=${now},v1=zz`, secret, now)).toBe(false);
  });

  it("refuses a delivery signed more than five minutes from now, either way", () => {
    expect(verifyEscrowPaySignature(body, sign(now - 301), secret, now)).toBe(false);
    expect(verifyEscrowPaySignature(body, sign(now + 301), secret, now)).toBe(false);
  });

  it("accepts the previous secret during a rotation", () => {
    expect(verifyEscrowPaySignature(body, sign(now, body, "whsec_old"), [secret, "whsec_old"], now)).toBe(true);
  });

  it("reads the documented envelope: the event id is the key, a transaction event is about itself", () => {
    expect(parseEscrowPayWebhook(JSON.parse(body))).toMatchObject({ key: "WHEV_1", event: "transaction.funded", object: "transaction", objectId: "TXN_1", transactionId: "TXN_1", amountMinor: 500 });
    expect(
      parseEscrowPayWebhook({ id: "WHEV_2", type: "release.completed", object: "release", object_id: "REL_1", data: { transaction_id: "TXN_1", amount_minor: 500 } }),
    ).toMatchObject({ transactionId: "TXN_1", objectId: "REL_1" });
    expect(parseEscrowPayWebhook({ id: "WHEV_3", type: "payout.completed", object: "payout", object_id: "PAY_1", data: {} })?.transactionId).toBeNull();
  });

  it("reads nothing from a body that is not the envelope", () => {
    expect(parseEscrowPayWebhook({ event: "escrow.released", data: { id: "x", status: "released" } })).toBeNull();
    expect(parseEscrowPayWebhook({ id: "WHEV_1", type: "transaction.funded" })).toBeNull();
    expect(parseEscrowPayWebhook([])).toBeNull();
    expect(parseEscrowPayWebhook(null)).toBeNull();
  });
});

describe("the switch", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.PAYMENTS_KILL_ESCROWPAY;
  });

  it("is off unless the founder's flag is on, and the kill switch beats the flag", async () => {
    flag.on = false;
    expect(await (await import("./switch")).escrowPayEnabled()).toBe(false);
    flag.on = "throws";
    expect(await (await import("./switch")).escrowPayEnabled()).toBe(false);
    flag.on = true;
    vi.resetModules();
    expect(await (await import("./switch")).escrowPayEnabled()).toBe(true);
    process.env.PAYMENTS_KILL_ESCROWPAY = "1";
    vi.resetModules();
    expect(await (await import("./switch")).escrowPayEnabled()).toBe(false);
  });
});

/* Since 10 November 2026 the server's rail and its webhook reach the adapter,
   and nothing else may: no page, no client component, no other money path. */
const ALLOWED_IMPORTERS = new Set([
  "lib/money/protected-rail.ts",
  "lib/money/protected-rail.test.ts",
  /* The rail's door to the provider: the dependencies, the parties, the payout account (server-only). */
  "lib/money/protected-provider.ts",
  "lib/money/protected-provider.test.ts",
  "lib/money/protected-identity-actions.ts",
  "lib/money/protected-start.ts",
  /* The server read and actions behind the screens (server-only). */
  "lib/money/protected-read.ts",
  "lib/money/protected-actions.ts",
  "app/api/escrowpay/webhook/route.ts",
  /* The staff provider check reads whether its settings are present (no network). */
  "lib/admin/provider-checks.ts",
]);

describe("only the rail's server entry points reach the adapter", () => {
  it("is imported by nothing else", () => {
    const SRC = join(__dirname, "..", "..", "..", "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) {
          if (name.name !== "node_modules" && !full.endsWith(join("providers", "escrowpay"))) walk(full);
        } else if (/\.(ts|tsx)$/.test(name.name) && /from ["'][^"']*providers\/escrowpay/.test(readFileSync(full, "utf8"))) {
          hits.push(full.slice(SRC.length + 1));
        }
      }
    };
    walk(SRC);
    expect(hits.filter((h) => !ALLOWED_IMPORTERS.has(h.split("\\").join("/")))).toEqual([]);
  });
});
