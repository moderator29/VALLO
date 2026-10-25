/**
 * PERF-SWEEP 6: a deadline on the server client's database and auth calls.
 *
 * The request-scoped server client had no timeout of its own. A PostgREST or
 * GoTrue call that stalled with its socket open held the page's render until
 * the platform stopped the function, and for all of that time the person
 * looked at the route's skeleton, which is the "loading stuck" the founder
 * reported. With a deadline the stalled call fails like any other failed
 * read: supabase-js hands the caller an `{ error }` (or an auth outage), the
 * page draws its own honest failure state or the route's error boundary, and
 * a retry is one tap away.
 *
 * WHAT IS CUT, AND WHAT IS NOT. Only the short request and response calls
 * are cut: `/rest/v1` (tables and RPCs), `/auth/v1` and `/graphql/v1`.
 * Storage uploads and Edge Functions are left alone, because a large photo
 * on a slow line can honestly take longer than any read should.
 *
 * The budget is generous on purpose. In the database's own statistics
 * (pg_stat_statements, 29 September 2026) the slowest app call peaked near
 * two seconds; nothing healthy comes near fifteen, so
 * the deadline only ever fires on a call that was not going to come back.
 * A signal the caller already passed (supabase-js `abortSignal`) is kept:
 * whichever fires first ends the call.
 */
export const SUPABASE_DEADLINE_MS = 15_000;

/** The calls the server client cuts. */
export const SERVER_CUT_PATHS: readonly string[] = ["/rest/v1/", "/auth/v1/", "/graphql/v1"];

/**
 * The proxy's own reads (the finish-setup check and the missing-listing
 * check) both let a request through on any failure, so a shorter deadline
 * there turns a stalled read into a page that opens rather than a tap that
 * does nothing. Auth is NOT cut in the proxy: its token refresh already has
 * its own answer deadline (OPS-05), and aborting a refresh halfway could
 * lose a rotated token.
 */
export const PROXY_DEADLINE_MS = 2_500;
export const PROXY_CUT_PATHS: readonly string[] = ["/rest/v1/"];

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** True for the calls the deadline applies to. Exported for the test. */
export function isDeadlinedCall(input: RequestInfo | URL, paths: readonly string[] = SERVER_CUT_PATHS): boolean {
  let path: string;
  try {
    path = new URL(urlOf(input)).pathname;
  } catch {
    return false;
  }
  return paths.some((prefix) => path.startsWith(prefix) || path === prefix.replace(/\/$/, ""));
}

/**
 * A `fetch` for supabase-js's `global.fetch`. It reads `globalThis.fetch` at
 * call time rather than capturing it, so a test that stubs the global still
 * sees every request.
 */
export function deadlineFetch({
  ms = SUPABASE_DEADLINE_MS,
  paths = SERVER_CUT_PATHS,
}: { ms?: number; paths?: readonly string[] } = {}): typeof fetch {
  return (input, init) => {
    if (!isDeadlinedCall(input, paths)) return globalThis.fetch(input, init);
    const deadline = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return globalThis.fetch(input, { ...init, signal });
  };
}
