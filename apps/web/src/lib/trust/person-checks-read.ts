import "server-only";

import { reportReadFault } from "@/lib/observability/read-error";
import { createClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/env";
import type { PersonCheckFacts } from "./checks";
import { provableDate } from "./proof-strip";

/**
 * THE DATES BEHIND A PERSON'S CHECKS, FOR THEIR PUBLIC PAGE.
 *
 * One read of `public.person_trust_checks(p_user)` (draft in
 * supabase/migrations/pending/person_trust_checks_2026-11-13.sql): when the
 * identity check passed, when the mobile number was confirmed, when the email
 * address was confirmed, when the Community Promise was accepted. Four
 * timestamps and nothing else: the function has
 * no column a number, an address or a document could leave through, and this
 * module keeps only values that parse as dates.
 *
 * FAILS CLOSED, AND SILENTLY. Any failure answers no facts, and no facts draw
 * no lines: the function not existing yet (it is a pending migration), a
 * refused read, a row that is not shaped as expected. An absent check is
 * never a claim, so an unread one must look exactly like one that has not
 * happened.
 */

type Rpc = (fn: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One row of the function, narrowed to dates. Exported for its test. */
export function personFactsFrom(row: unknown): PersonCheckFacts {
  const r = (Array.isArray(row) ? row[0] : row) as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== "object") return {};
  const date = (value: unknown) => provableDate(typeof value === "string" ? value : null);
  const facts: PersonCheckFacts = {};
  const identity = date(r.identity_seen_at);
  if (identity) {
    facts.identitySeenAt = identity;
    facts.identityMethod = "seen";
  }
  const phone = date(r.phone_confirmed_at);
  if (phone) facts.phoneConfirmedAt = phone;
  const email = date(r.email_confirmed_at);
  if (email) facts.emailConfirmedAt = email;
  const promise = date(r.promise_accepted_at);
  if (promise) facts.promiseAcceptedAt = promise;
  return facts;
}

/** The facts, and whether they were read at all. */
export type PersonChecksResult = { read: boolean; facts: PersonCheckFacts };

/**
 * The same read, saying whether it happened. A member's OWN view needs the
 * difference: "you can still add this check" may be said only when the read
 * succeeded and the date is absent, never when the read itself failed.
 */
export async function readPersonChecksResult(userId: string): Promise<PersonChecksResult> {
  if (!UUID.test(userId) || !isSupabaseConfigured()) return { read: false, facts: {} };
  try {
    const supabase = await createClient();
    const rpc = (supabase.rpc as unknown as Rpc).bind(supabase);
    const { data, error } = await rpc("person_trust_checks", { p_user: userId });
    /* A function that is not deployed yet is the expected state and stays
       quiet; any other fault is reported. Either way the read fails closed. */
    await reportReadFault("read.trust.readPersonChecks", error);
    if (error) return { read: false, facts: {} };
    /* No row at all (a member with no public page) is not a read of "nothing done". */
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return { read: false, facts: {} };
    return { read: true, facts: personFactsFrom(row) };
  } catch {
    return { read: false, facts: {} };
  }
}

export async function readPersonChecks(userId: string): Promise<PersonCheckFacts> {
  return (await readPersonChecksResult(userId)).facts;
}
