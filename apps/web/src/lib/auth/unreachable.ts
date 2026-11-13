/**
 * WAS THIS AUTH ERROR THE PERSON'S, OR OURS? (SPEED, 13 November 2026.)
 *
 * A code check that timed out used to say "that code is not right", and a
 * sign-in that could not reach the database said the generic refusal. Both
 * sent the person to retype something that was never wrong. An error is
 * "unreachable" when no answer about the credentials came back at all:
 *
 *   - supabase-js's `AuthRetryableFetchError` (status 0): the request never
 *     got an answer, including a deadline from `deadlineFetch` ending it;
 *   - any 5xx: GoTrue answered, but its database did not (a statement
 *     timeout, 57014, comes back as a 500 or 504).
 *
 * A 4xx is always an answer about what was typed and is never "unreachable".
 * Pure, so the rule is a unit test.
 */
export function isUnreachableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status, message } = error as { name?: unknown; status?: unknown; message?: unknown };
  if (name === "AuthRetryableFetchError") return true;
  if (typeof status === "number") {
    if (status === 0 || status >= 500) return true;
    if (status >= 400) return false;
  }
  return typeof message === "string" && /fetch failed|aborted|timed? ?out|timeout|network|econn|socket/i.test(message);
}
