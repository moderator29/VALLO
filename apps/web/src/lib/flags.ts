import "server-only";

import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

/**
 * Runtime feature flags read from the feature_flags table.
 *
 * Fail-open by design: a missing table, missing row, network error or absent
 * Supabase config all mean "enabled". The flags exist to switch features OFF
 * during an incident, never to gate features on. Reads are cached in-process
 * for a short TTL so layouts can consult flags without hammering Postgres.
 */
const TTL_MS = 30_000;

type CacheEntry = { value: boolean; expires: number };
const cache = new Map<string, CacheEntry>();

export type FeatureKey =
  | "bookings"
  | "wallet"
  | "messaging"
  | "assistant"
  | "support"
  | "agent_listings"
  | "hybrid_hotels"
  | "hybrid_restaurants"
  /* Around, the whole social layer. One row takes every social surface and
     every social write path down at once, with no deploy. */
  | "social"
  /* Meetups. Built to SOCIAL_AUDIT section 6 and off until slice 4 safety is
     proven in production and a named person is watching the queue. */
  | "events"
  /* Platform Grade 1 (P0.3): a listing is sent for review only by a lister
     whose identity check is sent or approved. On unless a row says off. */
  | "listing_verification";

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    const value = error ? true : (data?.enabled ?? true);
    cache.set(key, { value, expires: now + TTL_MS });
    return value;
  } catch {
    return true;
  }
}
