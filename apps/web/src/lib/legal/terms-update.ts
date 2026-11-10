import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "./versions";

/**
 * WHETHER A MEMBER STILL HAS TO BE SHOWN THE NEW TERMS (founder, 9 November
 * 2026: "show existing members the change once on next sign-in").
 *
 * Owed when the account agreed to the Terms at some earlier version and has no
 * row at today's `TERMS_VERSION`. A new account accepts today's version at sign
 * up, so it never sees the notice; an account with no Terms row at all is the
 * finish-setup step's business, not this one's. Pressing "Got it" writes the
 * current versions with source `reacceptance` (`lib/legal/acceptance.ts`), so
 * the notice shows once and the record says what was shown, beside what was
 * accepted before, which is never rewritten.
 *
 * Any failure answers false: a read error must never block the app.
 */
type TermsRowReader = {
  from: (table: "terms_acceptances") => {
    select: (columns: "version") => {
      eq: (column: "user_id", value: string) => {
        eq: (column: "document", value: "terms") => PromiseLike<{ data: { version: string }[] | null; error: unknown }>;
      };
    };
  };
};

export function updateOwed(versions: readonly string[], current: string = TERMS_VERSION): boolean {
  return versions.length > 0 && !versions.includes(current);
}

export async function termsUpdateOwed(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return false;
    const reader = supabase as unknown as TermsRowReader;
    const { data, error } = await reader.from("terms_acceptances").select("version").eq("user_id", userId).eq("document", "terms");
    if (error || !data) return false;
    return updateOwed(data.map((row) => row.version));
  } catch {
    return false;
  }
}
