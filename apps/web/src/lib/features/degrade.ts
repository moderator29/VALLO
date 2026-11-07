import { isNotDeployed } from "@/lib/observability/read-error";

/**
 * DEGRADE TO NOTHING UNTIL THE SQL IS LIVE (Agent FEATURES' rule).
 *
 * Every feature here ships its SQL as a pending file the founder pastes. Until
 * then its tables, columns and functions are absent, and PostgREST answers
 * with one of these codes. That is the expected state, so it is not reported;
 * any other returned error is a real fault and goes to the crash log through
 * `reportReadFault`, like every read in this tree.
 *
 *   42P01     undefined table          PGRST205  table not in the schema cache
 *   42703     undefined column         PGRST204  column not in the schema cache
 *   42883     undefined function       PGRST202  function not in the schema cache
 *   PGRST200  relationship not found
 */
const NOT_LIVE_CODES = new Set(["42P01", "PGRST205", "42703", "PGRST204", "PGRST200"]);

export function isNotLive(error: unknown): boolean {
  if (isNotDeployed(error)) return true;
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null;
  return typeof code === "string" && NOT_LIVE_CODES.has(code);
}

/**
 * The errors that are real faults, for `reportReadFault(kind, ...faults(a, b))`
 * (written out at each read, so the read-layer guard in
 * `lib/observability/returned-errors.test.ts` sees every error reported).
 */
export function faults(...errors: unknown[]): unknown[] {
  return errors.filter((error) => error !== null && error !== undefined && !isNotLive(error));
}
