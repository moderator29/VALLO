import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSession } from "@/lib/actions/session";

import { defaultPreferences, preferencesFromRows, type NoticePreferences } from "./model";

/**
 * The reminder switches as the signed-in person has set them.
 *
 * DEGRADES TO NOTHING. Until `features_a5_a6_notices.sql` is live the table
 * does not exist, the read fails, and this says `live: false`: the screen
 * then states that none of these reminders are running on the account, which
 * is true, because without the SQL nothing sends them.
 */
export type ReminderSettingsState =
  | { state: "signed-out" }
  | { state: "signed-in"; live: boolean; preferences: NoticePreferences };

export async function readReminderSettings(): Promise<ReminderSettingsState> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  const db = session.supabase as unknown as SupabaseClient;
  try {
    const { data, error } = await db
      .from("notice_preferences")
      .select("topic, enabled")
      .eq("user_id", session.user.id);
    if (error) return { state: "signed-in", live: false, preferences: defaultPreferences() };
    return {
      state: "signed-in",
      live: true,
      preferences: preferencesFromRows(data as { topic?: unknown; enabled?: unknown }[] | null),
    };
  } catch {
    return { state: "signed-in", live: false, preferences: defaultPreferences() };
  }
}
