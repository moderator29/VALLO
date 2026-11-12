import "server-only";
import { reportReadError } from "@/lib/observability/read-error";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionClaims } from "../actions/session";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { callLandlordRpc } from "../landlord/rpc";
import { isShareToken, readSafetyShare, type SafetyShareView } from "./safety";

/**
 * V-61 and V-62 reads. Each fails soft: the surfaces that call them draw
 * nothing new, and what was on the page before stays exactly as it was.
 *
 * TWO OF THE THREE ARE NEVER ASKED WITHOUT A SESSION, for the reason
 * `lib/landlord/queries.ts` sets out at length: a statement the caller may
 * not run is refused 42501, and a refused statement ABORTS ITS TRANSACTION.
 * Failing soft hides the refusal from the reader, which is right, but it also
 * hid 1655 of them on the landlord path between 9 and 11 November.
 *
 * Checked against the live database rather than assumed:
 *   my_agent_lookup            granted to `authenticated`, revoked from `anon`
 *   inspection_safety_shares   SELECT granted to `authenticated` on nine
 *                              columns and to `anon` on none, so a signed-out
 *                              select is refused outright rather than
 *                              returning no rows. The column grant is why
 *                              `has_table_privilege` reads false for both
 *                              roles and why db-06, which reads table grants,
 *                              cannot see this table's rule at all.
 *   safety_share_read          granted to `anon` ON PURPOSE and NOT guarded:
 *                              a renter's trusted contact has no account and
 *                              arrives by a token link.
 *
 * Both guarded reads sit on signed-in surfaces today (`/agent/settings` and
 * the plans board), so this is the rule being written down where it belongs
 * rather than a fault being cleared: `crash_reports` holds no `read.doors.*`
 * row. It is the landlord path that proved what happens when it is missing.
 */

async function hasSession(): Promise<boolean> {
  return (await resolveSessionClaims()).state === "signed-in";
}

export type MyAgentLookup = {
  /** The agent's code, VA- and five characters. Null when it could not be read. */
  code: string | null;
  /** The last three digits of the registered business number, or null. */
  hint: string | null;
};

/** The signed-in agent's own code and registered number hint. Null on failure. */
export async function readMyAgentLookup(): Promise<MyAgentLookup | null> {
  if (!isSupabaseConfigured()) return null;
  if (!(await hasSession())) return null;
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "my_agent_lookup", {});
    await reportReadError("read.doors.readMyAgentLookup", error);
    if (error || !data || typeof data !== "object") return null;
    const row = data as { code?: unknown; hint?: unknown };
    return {
      code: typeof row.code === "string" ? row.code : null,
      hint: typeof row.hint === "string" ? row.hint : null,
    };
  } catch {
    return null;
  }
}

/**
 * V-62: the page a renter's trusted contact opens. Open to anybody with the
 * link; the token is checked against its sha256 inside the database, and a
 * malformed one is never sent at all.
 */
export async function readSafetyShareByToken(token: string): Promise<SafetyShareView> {
  if (!isShareToken(token)) return { state: "unknown" };
  if (!isSupabaseConfigured()) return { state: "failed" };
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "safety_share_read", { p_token: token });
    await reportReadError("read.doors.readSafetyShareByToken", error);
    if (error) return { state: "failed" };
    return readSafetyShare(data);
  } catch {
    return { state: "failed" };
  }
}

/**
 * V-62: the caller's shares that are still live (not stopped, not revoked,
 * not past their own expiry), by inspection, with whether they checked in.
 * Row-level security returns only the caller's own. Empty on failure.
 */
export async function readMyLiveSafetyShares(): Promise<Record<string, { checkedIn: boolean; expiresAt: string }>> {
  if (!isSupabaseConfigured()) return {};
  if (!(await hasSession())) return {};
  try {
    const db = (await createClient()) as unknown as SupabaseClient;
    const { data, error } = await db
      .from("inspection_safety_shares")
      .select("inspection_id, checked_in_at, expires_at")
      .is("revoked_at", null)
      .is("stopped_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(100);
    await reportReadError("read.doors.readMyLiveSafetyShares", error);
    if (error || !Array.isArray(data)) return {};
    const out: Record<string, { checkedIn: boolean; expiresAt: string }> = {};
    for (const row of data as { inspection_id?: unknown; checked_in_at?: unknown; expires_at?: unknown }[]) {
      if (typeof row.inspection_id !== "string" || typeof row.expires_at !== "string") continue;
      out[row.inspection_id] = { checkedIn: typeof row.checked_in_at === "string", expiresAt: row.expires_at };
    }
    return out;
  } catch {
    return {};
  }
}
