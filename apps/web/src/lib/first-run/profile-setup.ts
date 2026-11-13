import "server-only";

import { cookies } from "next/headers";
import { reportReadError } from "@/lib/observability/read-error";
import { createClient } from "@/lib/supabase/server";
import {
  SETUP_SHOWN_COOKIE,
  SETUP_SKIP_COOKIE,
  readSkipCookie,
  setupDecision,
  type SetupStep,
} from "./profile-setup-core";

export type ProfileSetupOwed = { steps: SetupStep[]; userId: string };

/**
 * WHETHER THIS MEMBER IS SHOWN THE PHOTO SHEET NOW. Null for a
 * signed-out visitor, for a member with nothing missing, for one inside the
 * quiet window and for one already shown the sheet this session. Any failed
 * read answers null: a first-run ask must never get in the way of the app, but
 * a returned error is reported before it is answered.
 */
export async function profileSetupOwed(): Promise<ProfileSetupOwed | null> {
  try {
    const jar = await cookies();
    const skippedAt = readSkipCookie(jar.get(SETUP_SKIP_COOKIE)?.value);
    const shownThisSession = jar.get(SETUP_SHOWN_COOKIE)?.value === "1";
    /* Cheapest refusals first: no database read for a session already asked. */
    if (shownThisSession) return null;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    await reportReadError("read.first-run.profile-setup", error);
    if (error || !data) return null;

    const decision = setupDecision({
      needPhoto: !data.avatar_url,
      skippedAt,
      shownThisSession,
      now: Date.now(),
    });
    if (!decision.show) return null;
    return { steps: decision.steps, userId };
  } catch (error) {
    await reportReadError("read.first-run.profile-setup", error);
    return null;
  }
}
