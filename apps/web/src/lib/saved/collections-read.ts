import type { SupabaseClient } from "@supabase/supabase-js";
import { reportReadError } from "../observability/read-error";
import type { SavedCollection } from "./collections";

/** The member's lists with the keys inside them, under their own RLS. A failed read is no lists. */
export async function readCollections(db: SupabaseClient): Promise<SavedCollection[]> {
  try {
    const loose = db as unknown as {
      from(t: string): { select(c: string): { order(c: string, o: { ascending: boolean }): PromiseLike<{ data: unknown; error: unknown }> } };
    };
    const { data, error } = await loose
      .from("saved_collections")
      .select("id, name, saved_collection_items(kind, target_id)")
      .order("created_at", { ascending: true });
    if (error) {
      await reportReadError("read.saved.collections", error);
      return [];
    }
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
      const r = row as { id: string; name: string; saved_collection_items?: { kind: string; target_id: string }[] };
      return {
        id: r.id,
        name: r.name,
        keys: (r.saved_collection_items ?? []).map((i) => `${i.kind}:${i.target_id}`),
      };
    });
  } catch {
    return [];
  }
}
