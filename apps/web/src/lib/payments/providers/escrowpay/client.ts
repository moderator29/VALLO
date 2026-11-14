import "server-only";

import type { RailResult } from "../../provider";
import type { EscrowPayConfig } from "./config";
import { failureFromHttp, notConfigured } from "./errors";

/**
 * THE HTTP CLIENT, with a strict request discipline (one idempotency key per
 * money call, a timeout is unknown, never retried blindly) and nothing
 * invented. Every fact below is the provider's own, from its public OpenAPI
 * document ("EscrowPay Merchant API" 0.1.0) and its API Explorer guide at
 * docs.escrowpay.app:
 *
 *  - one host for both books; every path starts `/api/v1`;
 *  - the key travels in `X-API-Key` (securitySchemes.ApiKeyAuth). Dashboard
 *    tokens are not accepted on this surface;
 *  - every call that creates or changes a transaction, a payment account, a
 *    release or a refund takes an `Idempotency-Key` header;
 *  - amounts are integer kobo (`amount_minor`), as in Vallo;
 *  - success is an envelope `{ success, message, data }`; a refusal is
 *    `{ detail: { code, message } }`.
 *
 * `DOCUMENTED` gates every send. It is true only once the request bodies in
 * `requests.ts` and the readers in `read.ts` have been checked against the
 * provider's sandbox (the OpenAPI types no response), so no environment
 * variable, however it is set, can make this send before then.
 */
export const DOCUMENTED = false as boolean;

const V1 = "/api/v1";
const id = (value: string) => encodeURIComponent(value);

export const ESCROWPAY_PATHS = {
  credentialContext: `${V1}/credential-context`,
  banks: `${V1}/banks`,
  resolveAccount: `${V1}/bank-accounts/resolve`,
  onboardParty: `${V1}/parties/onboard`,
  partiesByReference: (externalReference: string) => `${V1}/parties?external_reference=${id(externalReference)}&page_size=5`,
  party: (partyId: string) => `${V1}/parties/${id(partyId)}`,
  payoutAccounts: `${V1}/payout-accounts`,
  payoutAccountsOf: (partyId: string) => `${V1}/payout-accounts?party_id=${id(partyId)}&page_size=50`,
  create: `${V1}/transactions`,
  byReference: (externalReference: string) => `${V1}/transactions?external_reference=${id(externalReference)}&page_size=5`,
  read: (transactionId: string) => `${V1}/transactions/${id(transactionId)}`,
  activate: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/activate`,
  cancel: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/cancel`,
  extend: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/extend`,
  paymentAccounts: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/payment-accounts`,
  paymentAccountsOf: (transactionId: string) => `${V1}/payment-accounts?transaction_id=${id(transactionId)}&page_size=20`,
  release: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/releases`,
  releasesOf: (transactionId: string) => `${V1}/releases?transaction_id=${id(transactionId)}&page_size=20`,
  refund: (transactionId: string) => `${V1}/transactions/${id(transactionId)}/refunds`,
  refundsOf: (transactionId: string) => `${V1}/refunds?transaction_id=${id(transactionId)}&page_size=20`,
} as const;

const TIMEOUT_MS = 15_000;

export type EscrowPayCall = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  /**
   * The `Idempotency-Key`, built from Vallo's own reference stored BEFORE the
   * call, so a repeat of the same step is the same request to the provider
   * and an unanswered call is read back, never doubled.
   */
  idempotencyKey?: string;
};

export async function escrowPayRequest(
  config: EscrowPayConfig | null,
  call: EscrowPayCall,
  fetchImpl: typeof fetch = fetch,
): Promise<RailResult<unknown>> {
  if (!DOCUMENTED) return notConfigured("The provider's API is not verified against its sandbox yet; nothing was sent.");
  return sendEscrowPay(config, call, fetchImpl);
}

/**
 * The send itself, with no gate. Only `escrowPayRequest` and the sandbox
 * check (`scripts/escrowpay-sandbox.mts`) call it.
 */
export async function sendEscrowPay(
  config: EscrowPayConfig | null,
  call: EscrowPayCall,
  fetchImpl: typeof fetch = fetch,
): Promise<RailResult<unknown>> {
  if (!config) return notConfigured("The provider is not configured in this environment.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { accept: "application/json", "X-API-Key": config.apiKey };
    if (call.body) headers["content-type"] = "application/json";
    if (call.idempotencyKey) headers["Idempotency-Key"] = call.idempotencyKey.slice(0, 200);
    const response = await fetchImpl(`${config.baseUrl}${call.path}`, {
      method: call.method,
      headers,
      body: call.body ? JSON.stringify(call.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    const text = await response.text();
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      return failureFromHttp(response.status, text, Number.isFinite(retry) && retry > 0 ? retry : null);
    }
    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      /* A 2xx that is not JSON may still have moved money: unknown, read back. */
      return failureFromHttp(null, "The answer was not JSON.");
    }
  } catch (error) {
    /* No answer: the request may have moved money. Unknown, never retried here. */
    return failureFromHttp(null, error instanceof Error ? error.message : "No answer.");
  } finally {
    clearTimeout(timer);
  }
}

/** The `data` of the provider's success envelope, or the value itself when it is not wrapped. */
export function envelopeData(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "data" in value) return (value as { data: unknown }).data;
  return value;
}
