import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "../supabase/env";

/**
 * Proving it is still you, immediately before the account is deactivated.
 *
 * WHY A DETACHED CLIENT. Verifying a password means asking GoTrue to sign in,
 * and the request-bound client in `lib/supabase/server.ts` writes its session
 * to the cookie store. Re-authenticating through that client would rotate the
 * live session as a side effect of a check. So this file builds its own client
 * over the public anon key with `persistSession: false` and
 * `autoRefreshToken: false`: it can ask GoTrue the question and it cannot
 * touch the caller's cookies, whatever the answer is.
 *
 * TWO METHODS, BECAUSE THERE ARE TWO KINDS OF ACCOUNT. Somebody who signed up
 * with an address and a password re-types the password. Somebody who signed in
 * with Google or Apple has never set one, and asking them for a password they
 * do not have would be the dead end this whole piece of work exists to remove,
 * so they get a one-time code at the address on the account instead.
 *
 * NOTHING HERE IS LOGGED. Not the address, not the password, not the code, not
 * the outcome keyed to a person. The caller records only that
 * re-authentication succeeded or failed, against an opaque uuid.
 */

/** Which proof this account can offer. */
export type ReauthMethod = "password" | "email-code";

/**
 * A person has a password when `auth.identities` carries an email identity.
 * Everyone else signed in with a provider and has never chosen one.
 */
export function reauthMethodFor(user: User): ReauthMethod {
  const identities = user.identities ?? [];
  const hasEmailIdentity = identities.some((identity) => identity.provider === "email");
  return hasEmailIdentity && (user.email ?? "").length > 0 ? "password" : "email-code";
}

function detachedClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Send the one-time code to the address on the account. Never to an address from a client. */
export async function sendReauthCode(user: User): Promise<boolean> {
  const email = user.email ?? "";
  if (email.length === 0) return false;
  try {
    const { error } = await detachedClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * True only when the proof checks out AND it belongs to this very account.
 *
 * The identity check at the end is not decoration. Both branches below ask
 * GoTrue to establish a session, and a session for SOMEBODY ELSE would be a
 * perfectly valid answer to the wrong question. Comparing the returned user id
 * with the caller's is what makes this a re-authentication rather than an
 * authentication.
 */
export async function reauthenticate(
  user: User,
  proof: { password?: string; emailCode?: string },
): Promise<boolean> {
  const email = user.email ?? "";
  if (email.length === 0) return false;

  try {
    const client = detachedClient();

    if ((proof.password ?? "").length > 0) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: proof.password ?? "",
      });
      if (error || !data.user) return false;
      const proved = data.user.id === user.id;
      await endProofSession(client);
      return proved;
    }

    const code = (proof.emailCode ?? "").trim();
    if (code.length === 0) return false;
    const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) return false;
    const proved = data.user.id === user.id;
    await endProofSession(client);
    return proved;
  } catch {
    return false;
  }
}

/**
 * THE PROOF'S OWN SESSION IS CLOSED BEHIND IT (14 November 2026).
 *
 * Checking a password means signing in with it: there is no other way to ask
 * the auth service "is this the right password". That sign-in opens a real
 * session, and this module never closed it, so every money step-up, every
 * console entry and every account-deletion check left one open for ever.
 * MEASURED ON LIVE on 14 November: 146 sessions with the user agent `node`,
 * 133 of them untouched for over thirty days, inside a total of 720 sessions
 * that have never expired, for 22 people.
 *
 * A session that nobody can use and nobody closes is still a credential
 * sitting in a table, and the count only ever grows.
 *
 * `scope: "local"` is deliberate and the only safe choice: it revokes THIS
 * session and no other. The default, `global`, would revoke every session the
 * person has, so proving your password to release a payout would sign you out
 * of your phone, your laptop and the app you are standing in.
 *
 * It never changes the verdict. The password was right or it was not before
 * this runs, and a logout that fails (the service briefly unreachable) must
 * not turn a correct password into a refusal.
 */
async function endProofSession(client: ReturnType<typeof detachedClient>): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    /* The proof stands. A session left behind is tidied by the auth service's
       own expiry once a time-box is set (see docs/DB_NOTES.md). */
  }
}
