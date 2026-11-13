"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { reportReadFault } from "@/lib/observability/read-error";
import { COMMUNITY_PROMISE_VERSION } from "./promise";
import { provableDate } from "./proof-strip";

/**
 * ACCEPTING THE COMMUNITY PROMISE, AND READING WHETHER I HAVE.
 *
 * Both answer for the member in the session and nobody else: neither takes an
 * account as an argument, and the database function behind the write reads
 * `auth.uid()` itself (`accept_community_promise`, draft in
 * supabase/migrations/pending/person_trust_checks_2026-11-13.sql). A member
 * can therefore accept only for themselves, from their own session.
 *
 * FAILS CLOSED AND SAYS SO. Until the migration is applied the read answers
 * "unavailable" (the control is then not drawn at all) and the write answers
 * a plain failure, never a success: an acceptance that was not recorded must
 * never read as one that was.
 */

export type PromiseState =
  | { state: "signed-out" }
  /** The record cannot be read (the migration is not applied, or the read failed). */
  | { state: "unavailable" }
  | { state: "open" }
  | { state: "accepted"; at: string };

type Rpc = (fn: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;
type Table = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

export async function readMyPromise(): Promise<PromiseState> {
  if (!isSupabaseConfigured()) return { state: "unavailable" };
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return { state: "signed-out" };
    const { data, error } = await (supabase as unknown as Table)
      .from("community_promise_acceptances")
      .select("accepted_at, promise_version")
      .eq("user_id", me)
      .maybeSingle();
    await reportReadFault("read.trust.readMyPromise", error);
    if (error) return { state: "unavailable" };
    const row = data as { accepted_at?: unknown; promise_version?: unknown } | null;
    const at = provableDate(typeof row?.accepted_at === "string" ? row.accepted_at : null);
    /* An acceptance of older words is not an acceptance of these. */
    if (!at || row?.promise_version !== COMMUNITY_PROMISE_VERSION) return { state: "open" };
    return { state: "accepted", at };
  } catch {
    return { state: "unavailable" };
  }
}

export type AcceptResult = { ok: true; at: string } | { ok: false; reason: "signed-out" | "failed" };

export async function acceptCommunityPromise(): Promise<AcceptResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" };
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return { ok: false, reason: "signed-out" };
    const rpc = (supabase.rpc as unknown as Rpc).bind(supabase);
    const { data, error } = await rpc("accept_community_promise", { p_version: COMMUNITY_PROMISE_VERSION });
    const at = provableDate(typeof data === "string" ? data : null);
    if (error || !at) return { ok: false, reason: "failed" };
    return { ok: true, at };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
