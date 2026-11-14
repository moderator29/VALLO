import type { RailFailure, RailFailureKind } from "../../provider";

/**
 * A provider answer, or the lack of one, in Vallo's words (`RailFailureKind`).
 *
 * The rule that matters: no answer at all (a timeout, a dropped connection)
 * is `unknown`, because the request may have moved money. It is never retried
 * blindly; it is resolved by reading the provider back.
 *
 * The provider's own error body is `{"detail": {"code", "message"}}`, or for
 * a body that failed validation `{"detail": [{"loc", "msg", "type"}]}` (seen
 * on the Merchant API itself, and in its OpenAPI as HTTPValidationError).
 * The code is kept on the failure so a caller can tell one refusal from
 * another (`identity_verification_failed` from `date_of_birth_required`).
 */
export type EscrowPayFailure = RailFailure & { code: string | null };

export function escrowPayErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; code?: unknown };
    const detail = parsed.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const code = (detail as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) return code.trim().slice(0, 80);
    }
    if (Array.isArray(detail)) return "validation_error";
    if (typeof parsed.code === "string" && parsed.code.trim()) return parsed.code.trim().slice(0, 80);
    return null;
  } catch {
    return null;
  }
}

export function failureFromHttp(httpStatus: number | null, detail: string, retryAfterSeconds: number | null = null): EscrowPayFailure {
  let kind: RailFailureKind;
  if (httpStatus === null) kind = "unknown";
  else if (httpStatus === 401 || httpStatus === 403) kind = "not_configured";
  else if (httpStatus === 404) kind = "not_found";
  else if (httpStatus === 429) kind = "rate_limited";
  else if (httpStatus === 400 || httpStatus === 409 || httpStatus === 422) kind = "refused";
  else if (httpStatus >= 500) kind = "unavailable";
  else kind = "unreadable";
  return { ok: false, kind, httpStatus, detail: detail.slice(0, 500), retryAfterSeconds, code: httpStatus === null ? null : escrowPayErrorCode(detail) };
}

export function notConfigured(detail: string): EscrowPayFailure {
  return { ok: false, kind: "not_configured", httpStatus: null, detail, retryAfterSeconds: null, code: null };
}

/** The provider's code on a failure, when it gave one. */
export function failureCode(failure: RailFailure): string | null {
  const code = (failure as Partial<EscrowPayFailure>).code;
  return typeof code === "string" ? code : null;
}
