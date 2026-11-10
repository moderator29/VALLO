"use server";

import { createClient } from "@/lib/supabase/server";
import { ok, type ActionResult } from "@/lib/actions/envelope";
import { recordTermsAcceptance } from "./acceptance";

/**
 * "Got it" on the new-terms notice: records that this member was shown today's
 * Terms and Privacy versions (source `reacceptance`), which is also what stops
 * the notice coming back. The member is read from the session, never from the
 * caller.
 */
export async function acknowledgeTermsUpdate(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Sign in again to continue." };
  await recordTermsAcceptance(userId, "reacceptance");
  return ok(null);
}
