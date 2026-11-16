import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionClaims } from "@/lib/actions/session";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * WHO IS SEARCHING, AND WHICH CLIENT READS FOR THEM.
 *
 * A signed-in member reads through their OWN session (`resolveSessionClaims`,
 * the token verified locally, no auth round trip), so RLS decides what they
 * see: blocks, private communities, their own records. A visitor reads
 * through a cookie-free anonymous client. Nothing in the member-facing engine
 * reads with the service key.
 */
export type Viewer = {
  signedIn: boolean;
  userId: string | null;
  /** The member's own RLS-bound client, or the anonymous one. */
  db: SupabaseClient | null;
};

let anon: SupabaseClient | null = null;

/** The anonymous, cookie-free client (null when Supabase is not configured). */
export function anonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!anon) {
    anon = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anon;
}

export async function resolveViewer(): Promise<Viewer> {
  if (!isSupabaseConfigured()) return { signedIn: false, userId: null, db: null };
  try {
    const claims = await resolveSessionClaims();
    if (claims.state === "signed-in") {
      return { signedIn: true, userId: claims.userId, db: claims.supabase as unknown as SupabaseClient };
    }
  } catch {
    /* A session that cannot be read is nobody. */
  }
  return { signedIn: false, userId: null, db: anonClient() };
}

/** The same viewer for a test, with no session. */
export const ANONYMOUS: Viewer = { signedIn: false, userId: null, db: null };
