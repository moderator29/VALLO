import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ConversationPref } from "./conversation-prefs";

/**
 * The member's pins and mutes, under their own RLS (own rows only).
 *
 * `open: false` when the read fails, which is what a database without the
 * `conversation_prefs` table answers before its migration is applied: the
 * inbox then offers no Pin and no Mute, rather than controls that cannot
 * work.
 */
export async function loadConversationPrefs(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ open: boolean; byId: Record<string, ConversationPref> }> {
  try {
    const { data, error } = await supabase
      .from("conversation_prefs")
      .select("conversation_id, pinned_at, muted_until")
      .eq("user_id", userId)
      .limit(500);
    if (error) return { open: false, byId: {} };
    const byId: Record<string, ConversationPref> = {};
    for (const row of data ?? []) byId[row.conversation_id] = { pinnedAt: row.pinned_at, mutedUntil: row.muted_until };
    return { open: true, byId };
  } catch {
    return { open: false, byId: {} };
  }
}
