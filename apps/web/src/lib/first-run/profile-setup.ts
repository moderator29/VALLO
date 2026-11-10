import "server-only";

import { cookies } from "next/headers";
import { reportReadError } from "@/lib/observability/read-error";
import { createClient } from "@/lib/supabase/server";
import { readFirstRunSeen } from "./store";
import {
  NAME_CONFIRMED_FEATURE,
  SETUP_SHOWN_COOKIE,
  SETUP_SKIP_COOKIE,
  readSkipCookie,
  setupDecision,
  type SetupStep,
} from "./profile-setup-core";

export type ProfileSetupOwed = { steps: SetupStep[]; fullName: string; userId: string };

/**
 * WHETHER THIS MEMBER IS SHOWN THE NAME AND PHOTO SHEETS NOW. Null for a
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
      .select("first_name, surname, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    await reportReadError("read.first-run.profile-setup", error);
    if (error || !data) return null;

    const nameSeen = await readFirstRunSeen(NAME_CONFIRMED_FEATURE);
    const decision = setupDecision({
      /* "unknown" (the store could not answer) is not "unseen": no ask. */
      needName: nameSeen === "unseen",
      needPhoto: !data.avatar_url,
      skippedAt,
      shownThisSession,
      now: Date.now(),
    });
    if (!decision.show) return null;
    const fullName = [data.first_name, data.surname].filter(Boolean).join(" ").trim() || (data.display_name ?? "").trim();
    return { steps: decision.steps, fullName, userId };
  } catch (error) {
    await reportReadError("read.first-run.profile-setup", error);
    return null;
  }
}
