import "server-only";

import { rememberSuccess } from "@/lib/ui/success-cookie";
import { setupStillOwed } from "./finish-setup-server";
import { isFirstCodeSignIn, type ConfirmedStamps } from "./first-sign-in";

type SetupClient = Parameters<typeof setupStillOwed>[0];

/**
 * After a code sign-in succeeded: "Welcome to Vallo" on the next screen, by
 * the one-shot cookie (lib/ui/success-cookie.ts), when this code confirmed
 * the address or number for the first time (`isFirstCodeSignIn`). An account
 * that still owes the finish-setup step gets nothing here: that step sets
 * the same moment when it is done, so it is never said twice or too early.
 *
 * Any other code sign-in earns "Signed in. Welcome back." the same way.
 *
 * Best effort. The sign-in has already happened, and nothing here can undo
 * it or stop the redirect that follows.
 */
export async function rememberFirstCodeSignIn(
  supabase: unknown,
  user: (ConfirmedStamps & { id: string; app_metadata?: Record<string, unknown> | null }) | null | undefined,
  via: "email" | "phone",
): Promise<void> {
  if (!user) return;
  try {
    /* A returning member signing in with a code is greeted the way a
       password sign-in is: "Signed in. Welcome back." (founder, 7 November
       2026, "THE BANNER EVERYWHERE"; it was silent). No extra read for it. */
    if (!isFirstCodeSignIn(user, via)) {
      await rememberSuccess("signed-in");
      return;
    }
    if (await setupStillOwed(supabase as SetupClient, user)) return;
    await rememberSuccess("account-created");
  } catch {
    /* The moment is a nicety; the sign-in stands. */
  }
}
