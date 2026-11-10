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
  | "listing_verification"
  /* Founder, 7 November 2026: a renter verifies their identity before the
     first payment of a rental of 5 months or more. Stays never ask. On
     unless a row says off. */
  | "rental_verification"
  /* Vallo Roommates, the whole product area (its own place in the side nav and
     every /roommates route). One row takes the entry and the pages down with
     no deploy; a missing row, table or network error reads as on. */
  | "roommates";

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
