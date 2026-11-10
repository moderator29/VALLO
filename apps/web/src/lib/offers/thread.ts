import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

/**
 * The conversation about an offer, read in place for the Deal Room. One read
 * under the member's own RLS client (a stranger gets nothing), the newest 60
 * messages, oldest first. Deleted-for-everyone messages never appear.
 */
export type DealThreadMessage = { id: string; mine: boolean; body: string; at: string };

export async function readDealThread(supabase: SupabaseClient<Database>, conversationId: string | null, userId: string): Promise<DealThreadMessage[]> {
  if (!conversationId) return [];
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => { is: (k: string, v: null) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: { id: string; sender_id: string; body: string; created_at: string }[] | null; error: unknown }> } } } };
    };
  })
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_for_everyone_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return data.reverse().map((m) => ({ id: m.id, mine: m.sender_id === userId, body: m.body, at: m.created_at }));
}
