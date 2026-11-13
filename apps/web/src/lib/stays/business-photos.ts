import "server-only";

/**
 * Photographs on the business spine, read.
 *
 * `business_photos` is the restaurant's answer to `accommodation_photos`
 * (migration `20260919220000_p3_a_restaurant_can_carry_photographs`): up to
 * ten rows per business, position 0 is the cover, and `storage_path` is a path
 * inside the PUBLIC `accommodation-photos` bucket rather than a URL.
 *
 * THE BUCKET IS SHARED AND THAT IS DELIBERATE, so there is exactly one place
 * in the application that turns a stored path into a URL. `accommodationPhotoUrl`
 * is that place; `businessPhotoUrl` is a named door onto it so a reader of a
 * restaurant surface is not left wondering whether the wrong bucket has been
 * used. The migration's header carries the full argument, including the one
 * that settled it: a second bucket would have been invisible to the account
 * deletion purge until somebody remembered to add it.
 *
 * Every read goes through the caller's own RLS-bound client and asks.
 * `business_photos_select` answers: anybody may read the photographs of a
 * PUBLISHED business, the owner may read their own whatever its status, and an
 * admin may read any. Nothing here re-states that rule, and nothing here
 * throws: a failed read is no photographs, which every surface already draws
 * honestly with a category plate and a "No photographs yet" chip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { createClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/env";
import { accommodationPhotoUrl } from "./photos";
import { MAX_BUSINESS_PHOTOS } from "../host/photos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BusinessPhoto = {
  id: string;
  /** The stored path, which is what a write and a delete work on. */
  storagePath: string;
  /** The public URL, which is what a surface renders. */
  url: string;
  /** 0 is the cover. */
  position: number;
};

/** The public URL for one stored business photograph. See the header. */
export function businessPhotoUrl(storagePath: string): string {
  return accommodationPhotoUrl(storagePath);
}

/** One venue's photographs, cover first. Empty when it has none. */
export async function listBusinessPhotos(businessId: string): Promise<BusinessPhoto[]> {
  if (!isSupabaseConfigured() || !UUID_RE.test(businessId)) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_photos")
      .select("id, storage_path, position")
      .eq("business_id", businessId)
      .order("position", { ascending: true })
      .limit(MAX_BUSINESS_PHOTOS);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      storagePath: row.storage_path,
      url: businessPhotoUrl(row.storage_path),
      position: row.position,
    }));
  } catch {
    return [];
  }
}

/**
 * The cover photograph for each of several venues, in one read, for a shelf.
 *
 * A venue with no photographs is simply absent from the map, so the card keeps
 * the category plate it already draws rather than pointing at nothing.
 */
export async function businessCoverUrls(
  businessIds: readonly string[],
): Promise<Map<string, string>> {
  return new Map(await businessCoverPairs(businessIds));
}

/**
 * The same read as `businessCoverUrls`, answered as `[businessId, url]` pairs
 * so the public catalogue cache can keep it (a Map does not survive the data
 * cache's JSON; pairs do). `client` reads through a given client instead of
 * the request's own; `strict` throws on a failed read instead of answering
 * empty, so a cache never keeps a failure (`lib/catalogue/stays.ts`).
 */
export async function businessCoverPairs(
  businessIds: readonly string[],
  options: { client?: SupabaseClient<Database>; strict?: boolean } = {},
): Promise<[string, string][]> {
  const pairs: [string, string][] = [];
  const ids = [...new Set(businessIds.filter((id) => UUID_RE.test(id)))];
  if (!isSupabaseConfigured() || ids.length === 0) return pairs;
  try {
    const supabase = options.client ?? (await createClient());
    const { data, error } = await supabase
      .from("business_photos")
      .select("business_id, storage_path, position")
      .in("business_id", ids)
      .order("position", { ascending: true });
    if (error && options.strict) throw new Error("business photos read failed");
    if (error || !data) return pairs;
    /* Ordered by position, so the first row seen for a venue is its cover and
       every later one is passed over. */
    const seen = new Set<string>();
    for (const row of data) {
      if (seen.has(row.business_id)) continue;
      seen.add(row.business_id);
      pairs.push([row.business_id, businessPhotoUrl(row.storage_path)]);
    }
    return pairs;
  } catch (thrown) {
    if (options.strict) throw thrown;
    return pairs;
  }
}
