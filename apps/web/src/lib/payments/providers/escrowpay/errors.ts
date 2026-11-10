import type { RailFailure, RailFailureKind } from "../../provider";

/**
 * A provider answer, or the lack of one, in Vallo's words (`RailFailureKind`).
 * Only the HTTP level is written: TODO(provider-docs) the provider's own error
 * codes, mapped onto these kinds once they are documented.
 *
 * The rule that matters: no answer at all (a timeout, a dropped connection)
 * is `unknown`, because the request may have moved money. It is never retried
 * blindly; it is resolved by reading the provider back.
 */
export function failureFromHttp(httpStatus: number | null, detail: string, retryAfterSeconds: number | null = null): RailFailure {
  let kind: RailFailureKind;
  if (httpStatus === null) kind = "unknown";
  else if (httpStatus === 401 || httpStatus === 403) kind = "not_configured";
  else if (httpStatus === 404) kind = "not_found";
  else if (httpStatus === 429) kind = "rate_limited";
  else if (httpStatus === 400 || httpStatus === 409 || httpStatus === 422) kind = "refused";
  else if (httpStatus >= 500) kind = "unavailable";
  else kind = "unreadable";
  return { ok: false, kind, httpStatus, detail: detail.slice(0, 500), retryAfterSeconds };
}

export function notConfigured(detail: string): RailFailure {
  return { ok: false, kind: "not_configured", httpStatus: null, detail, retryAfterSeconds: null };
}
