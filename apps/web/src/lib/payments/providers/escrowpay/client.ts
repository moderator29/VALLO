import "server-only";

import type { RailResult } from "../../provider";
import type { EscrowPayConfig } from "./config";
import { failureFromHttp, notConfigured } from "./errors";

/**
 * THE HTTP CLIENT, with a strict request discipline (one idempotency
 * reference per call, a timeout is unknown, never retried blindly) and
 * nothing invented.
 *
 * `DOCUMENTED` is false until the provider's sandbox documentation confirms
 * the authentication header, the idempotency header and the four endpoint
 * bodies (audit section 10.2, items 2, 5 and 6). While it is false every call
 * answers `not_configured` BEFORE any network request, so no environment
 * variable, however it is set, can make this send money.
 *
 * The endpoint paths below are the four the provider's specification names.
 * TODO(provider-docs): confirm each against the sandbox before use, and
 * whether `:id` is the provider's id or accepts Vallo's reference.
 */
export const DOCUMENTED = false as boolean;

export const ESCROWPAY_PATHS = {
  create: "/v1/escrows",
  read: (id: string) => `/v1/escrows/${encodeURIComponent(id)}`,
  release: (id: string) => `/v1/escrows/${encodeURIComponent(id)}/release`,
  refund: (id: string) => `/v1/escrows/${encodeURIComponent(id)}/refund`,
} as const;

const TIMEOUT_MS = 15_000;

export type EscrowPayCall = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  /** Vallo's own reference, stored before the call, so an unanswered call is read back, never repeated. */
  reference?: string;
};

export async function escrowPayRequest(
  config: EscrowPayConfig | null,
  call: EscrowPayCall,
  fetchImpl: typeof fetch = fetch,
): Promise<RailResult<unknown>> {
  if (!DOCUMENTED) return notConfigured("The provider's API is not documented to Vallo yet; nothing was sent.");
  if (!config) return notConfigured("The provider is not configured in this environment.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${config.baseUrl}${call.path}`, {
      method: call.method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        /* TODO(provider-docs): the authentication header and scheme, and the
           idempotency header if the provider has one. */
      },
      body: call.body ? JSON.stringify(call.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      return failureFromHttp(response.status, text, Number.isFinite(retry) && retry > 0 ? retry : null);
    }
    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return failureFromHttp(response.status, "The answer was not JSON.");
    }
  } catch (error) {
    /* No answer: the request may have moved money. Unknown, never retried here. */
    return failureFromHttp(null, error instanceof Error ? error.message : "No answer.");
  } finally {
    clearTimeout(timer);
  }
}
