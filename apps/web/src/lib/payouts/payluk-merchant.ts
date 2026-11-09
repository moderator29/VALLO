/**
 * VALLO'S OWN PAYLUK MERCHANT WALLET: the one documented read, and the one
 * undocumented write, named as such.
 *
 * Every fact here is from docs/payments/payluk-source/ and
 * docs/payments/PAYLUK_LIVE_DOCS_FINDINGS.md, nothing invented:
 *  - Hosts: `https://staging.api.payluk.ng` for `sk_test_` keys,
 *    `https://api.payluk.ng` for `sk_live_` keys (findings, introduction.md).
 *  - `Authorization: Bearer <key>`; merchant-account routes must NOT carry a
 *    `customer-id` header (authentication.txt).
 *  - `GET /v1/merchant/balance` returns `id, mainBalance, escrowBalance,
 *    currency, createdAt, updatedAt` inside the `{status, message, data}`
 *    envelope (findings, wallet fields row).
 *  - Amounts are NAIRA in the major unit, decimals for kobo, never kobo
 *    (concepts_fees-and-settlement.txt).
 *  - 10 requests per minute per key; read `RateLimit: limit=10, remaining=N,
 *    reset=S` and back off before a 429 (authentication.txt).
 *  - NO route withdraws the merchant wallet (findings section 7 item 6)
 *    (there is no route for it; the Payluk commission sweep that would have
 *    called it was removed as dead code on 9 November 2026).
 *
 * Pure apart from `fetch`, which is injected, so every branch is a unit test.
 */

export type PaylukEnvironment = "staging" | "production";

export type PaylukMerchantConfig = { key: string; baseUrl: string; environment: PaylukEnvironment };

/**
 * The key and its host, or null when Payluk is off. The key's prefix decides
 * the host, so a test key can never reach production (Payluk refuses that
 * with 403 anyway). `PAYLUK_SECRET_KEY` is the name Payluk's own docs use;
 * `PAYLUK_TEST_SECRET_KEY` is the staging name in SESSION-2-RESPONSE.md.
 *
 * The live key is used in production only. On a Vercel deployment that is
 * not production (`VERCEL_ENV` preview or development) the live key is
 * ignored even if it is present, so a preview can never move real money;
 * it uses the test key or nothing. Off Vercel (`VERCEL_ENV` unset) the key's
 * prefix decides, as before.
 */
export function paylukMerchantConfig(env: Readonly<Record<string, string | undefined>>): PaylukMerchantConfig | null {
  const live = (env.PAYLUK_SECRET_KEY ?? "").trim();
  const test = (env.PAYLUK_TEST_SECRET_KEY ?? "").trim();
  const vercelEnv = (env.VERCEL_ENV ?? "").trim();
  const liveAllowed = vercelEnv === "" || vercelEnv === "production";
  if (liveAllowed && live.startsWith("sk_live_")) return { key: live, baseUrl: "https://api.payluk.ng", environment: "production" };
  if (test.startsWith("sk_test_")) return { key: test, baseUrl: "https://staging.api.payluk.ng", environment: "staging" };
  return null;
}

/** Naira as Payluk writes it (major unit, up to two decimals) to kobo, without floating point. */
export function nairaToKobo(value: unknown): number | null {
  /* A number is read by its own decimal text, never rounded: more than two
     decimals (or exponent notation) is not a naira amount and is refused. */
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : typeof value === "string" ? value.trim() : "";
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const kobo = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** `RateLimit: limit=10, remaining=3, reset=41` -> 3. Null when absent or unreadable. */
export function rateLimitRemaining(header: string | null): number | null {
  if (!header) return null;
  const m = /remaining\s*=\s*(\d+)/i.exec(header);
  return m ? Number(m[1]) : null;
}

export type MerchantBalance = {
  mainMinor: number;
  escrowMinor: number;
  currency: string;
  rateLimitRemaining: number | null;
};

export type PaylukFailure = { failed: true; code: string; detail: string; rateLimitRemaining: number | null };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

/** GET /v1/merchant/balance. A failure carries the HTTP status as its code; its message never reaches a member. */
export async function readMerchantBalance(config: PaylukMerchantConfig, fetchImpl: FetchLike): Promise<MerchantBalance | PaylukFailure> {
  let res;
  try {
    res = await fetchImpl(`${config.baseUrl}/v1/merchant/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { failed: true, code: "network", detail: "No answer from Payluk (network or timeout).", rateLimitRemaining: null };
  }
  const remaining = rateLimitRemaining(res.headers.get("RateLimit"));
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const envelope = (body ?? {}) as { message?: unknown; data?: unknown };
  if (res.status !== 200) {
    const message = typeof envelope.message === "string" ? envelope.message.slice(0, 200) : "";
    return { failed: true, code: `http_${res.status}`, detail: message, rateLimitRemaining: remaining };
  }
  const data = (envelope.data ?? {}) as Record<string, unknown>;
  const main = nairaToKobo(data.mainBalance);
  const escrow = nairaToKobo(data.escrowBalance);
  if (main === null || escrow === null) {
    return { failed: true, code: "unreadable", detail: "Balance fields missing or not naira.", rateLimitRemaining: remaining };
  }
  return { mainMinor: main, escrowMinor: escrow, currency: typeof data.currency === "string" ? data.currency : "", rateLimitRemaining: remaining };
}
