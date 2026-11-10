/**
 * VALLO ERROR LANGUAGE (D50). A provider's code and message stay in the
 * server log and the audit view; a member sees a Vallo error code and a
 * sentence that claims nothing about money it cannot know.
 *
 * Built from the documented codes only: plain HTTP status codes (400, 401,
 * 403, 404, 410, 429, 500, 503) and Paystack's own. The sentences
 * are operational, and deliberately never say "nothing was charged": after
 * a timeout that is not known (a timeout is unknown, not a failure).
 */

export type ValloErrorCode =
  | "busy_try_shortly"
  | "service_unavailable"
  | "not_set_up"
  | "request_refused"
  | "outcome_unknown";

export type ValloError = {
  code: ValloErrorCode;
  /** Safe for a member. */
  message: string;
  /** Whether trying again later is sensible. A money-moving call is never retried blindly. */
  retryable: boolean;
};

const MESSAGES: Record<ValloErrorCode, string> = {
  busy_try_shortly: "Payments are busy right now. Please try again in a minute.",
  service_unavailable: "Our payment partner is not answering right now. Please try again shortly.",
  not_set_up: "This payment option is not available yet.",
  request_refused: "This request could not be completed. Please check the details and try again, or contact support.",
  outcome_unknown:
    "We could not confirm what happened. Do not pay again: we are checking with our payment partner and will update this page.",
};

export type ProviderErrorInput = {
  /** HTTP status, or null when no answer came back (network, timeout). */
  httpStatus: number | null;
};

/** Map a provider failure onto Vallo's language. The provider's own text is never an input. */
export function valloErrorFor(input: ProviderErrorInput): ValloError {
  const s = input.httpStatus;
  let code: ValloErrorCode;
  if (s === null) code = "outcome_unknown";
  else if (s === 429) code = "busy_try_shortly";
  else if (s === 503 || s === 502 || s === 504 || s === 500) code = "service_unavailable";
  else if (s === 401 || s === 403 || s === 410) code = "not_set_up";
  else if (s >= 400 && s < 500) code = "request_refused";
  else code = "outcome_unknown";
  return { code, message: MESSAGES[code], retryable: code === "busy_try_shortly" || code === "service_unavailable" };
}
