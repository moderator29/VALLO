import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { deadlineFetch } from "./deadline-fetch";
import { requireSupabasePublicEnv, serviceRoleKey } from "./env";

/**
 * Service-role Supabase client. Bypasses Row Level Security.
 *
 * For privileged server work only: confirming a booking and writing the ledger,
 * processing a Paystack webhook, an admin approving an agent or listing. Never
 * import this from anything that runs in the browser. It does not read auth
 * cookies and never persists a session, because it is not acting as a user; the
 * caller is responsible for having already authorised the action.
 *
 * `deadlineMs` (SPEED, 13 November 2026): a caller in front of a person's tap
 * (the Face ID unlock) asks for a client whose `/rest/v1` and `/auth/v1` calls
 * end after that many milliseconds, so a stalled database answers as an error
 * the screen can offer again, instead of holding a spinner. Left out, nothing
 * changes for the webhooks, crons and ledgers that use this client today.
 */
export function createAdminClient(options: { deadlineMs?: number } = {}) {
  const { url } = requireSupabasePublicEnv();
  return createSupabaseClient<Database>(url, serviceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(options.deadlineMs ? { global: { fetch: deadlineFetch({ ms: options.deadlineMs }) } } : {}),
  });
}
