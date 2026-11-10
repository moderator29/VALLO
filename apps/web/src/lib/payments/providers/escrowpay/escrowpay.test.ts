/**
 * THE PROTECTED PAYMENT ADAPTER IS BUILT SWITCHED OFF, AND FAILS CLOSED.
 * Each test pins one way it could otherwise move money before the provider's
 * documentation and the founder's switch say it may.
 */
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
const { DOCUMENTED, ESCROWPAY_PATHS, escrowPayRequest } = await import("./client");
const { failureFromHttp } = await import("./errors");
const { ESCROWPAY_STATUS_WORDS, normaliseEscrowPayStatus } = await import("./normaliser");
const { parseEscrowPayWebhook, verifyEscrowPaySignature } = await import("./webhooks");

const SANDBOX = {
  ESCROWPAY_API_BASE_URL: "https://sandbox.example.test/",
  ESCROWPAY_API_KEY: "test-key",
  ESCROWPAY_WEBHOOK_SECRET: "test-secret",
  ESCROWPAY_ENVIRONMENT: "sandbox",
};

describe("configuration", () => {
  it("is null with nothing set, and never supplies a base URL of its own", () => {
    expect(escrowPayConfig({})).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_KEY: " " })).toBeNull();
  });

  it("reads a sandbox configuration and trims the trailing slash", () => {
    expect(escrowPayConfig(SANDBOX)).toEqual({
      baseUrl: "https://sandbox.example.test",
      apiKey: "test-key",
      webhookSecret: "test-secret",
      environment: "sandbox",
    });
  });

  it("refuses plain http, credentials in the URL, and a missing or unknown environment marker", () => {
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "http://sandbox.example.test" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_API_BASE_URL: "https://u:p@sandbox.example.test" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_ENVIRONMENT: "" })).toBeNull();
    expect(escrowPayConfig({ ...SANDBOX, ESCROWPAY_ENVIRONMENT: "live" })).toBeNull();
  });

  it("uses production credentials only on a production deployment", () => {
    const production = { ...SANDBOX, ESCROWPAY_ENVIRONMENT: "production" };
    expect(escrowPayConfig({ ...production, VERCEL_ENV: "preview" })).toBeNull();
    expect(escrowPayConfig({ ...production, VERCEL_ENV: "development" })).toBeNull();
    expect(escrowPayConfig({ ...production, VERCEL_ENV: "production" })?.environment).toBe("production");
  });
});

describe("the client sends nothing until the API is documented", () => {
  it("is not documented today", () => {
    expect(DOCUMENTED).toBe(false);
  });

  it("answers not_configured before any network call, even fully configured", async () => {
    const fetchImpl = vi.fn();
    const out = await escrowPayRequest(escrowPayConfig(SANDBOX), { method: "POST", path: ESCROWPAY_PATHS.create, body: { amount: 1 } }, fetchImpl as unknown as typeof fetch);
    expect(out).toMatchObject({ ok: false, kind: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("encodes an id into the path rather than letting it change the route", () => {
    expect(ESCROWPAY_PATHS.release("a/../b")).toBe("/v1/escrows/a%2F..%2Fb/release");
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
});

describe("status words", () => {
  it("maps no provider word until the vocabulary is documented", () => {
    expect(Object.keys(ESCROWPAY_STATUS_WORDS)).toEqual([]);
  });

  it("never turns an unknown word into funded or released", () => {
    for (const word of ["released", "RELEASED", "funded", "held", "completed", "success", "paid", "", null, 7]) {
      expect(normaliseEscrowPayStatus(word)).toBeNull();
    }
  });

  it("only ever names a state Vallo has", () => {
    for (const state of Object.values(ESCROWPAY_STATUS_WORDS)) expect(ARRANGEMENT_STATUSES).toContain(state);
  });
});

describe("webhooks", () => {
  it("refuse every delivery while the signature scheme is undocumented", () => {
    expect(verifyEscrowPaySignature("{}", "anything", "test-secret")).toBe(false);
    expect(verifyEscrowPaySignature("{}", null, null)).toBe(false);
    expect(parseEscrowPayWebhook({ event: "escrow.released", data: { id: "x", status: "released" } })).toBeNull();
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
  /* The server read and actions behind the screens (server-only). */
  "lib/money/protected-read.ts",
  "lib/money/protected-actions.ts",
  "app/api/escrowpay/webhook/route.ts",
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
