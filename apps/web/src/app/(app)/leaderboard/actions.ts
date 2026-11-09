"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWriteSession, NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE } from "@/lib/actions/session";
import { fail, ok, type ActionResult } from "@/lib/actions/envelope";

/**
 * The leaderboard opt-out (D76): hide or show the member, or one business
 * they own. The database function checks ownership; this only forwards the
 * member's own session. A "use server" module exports async functions only.
 */
export async function setLeaderboardHidden(hidden: boolean, businessId?: string): Promise<ActionResult<null>> {
  const session = await resolveWriteSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  const db = session.supabase as unknown as SupabaseClient;
  const { error } = await db.rpc("leaderboard_set_hidden", {
    p_hidden: hidden === true,
    p_business: typeof businessId === "string" && businessId ? businessId : null,
  });
  if (error) return fail("Could not update your leaderboard visibility. Try again.");
  revalidatePath("/leaderboard");
  return ok(null);
}
