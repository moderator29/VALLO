import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/env";

/**
 * WHETHER "WAS THIS HELPFUL?" HAS SOMEWHERE TO WRITE. The pending migration
 * (`docs_page_feedback_2026-11-10.sql`) adds `public.doc_feedback_ready()`;
 * until it is applied the call fails and this answers false, so the control
 * is not drawn. Read once a minute per server, never per visitor.
 */
const TTL_MS = 60_000;
let cache: { value: boolean; expires: number } | null = null;

export async function docFeedbackReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;
  let value = false;
  try {
    const db = (await createClient()) as unknown as SupabaseClient;
    const { data, error } = await db.rpc("doc_feedback_ready");
    value = !error && data === true;
  } catch {
    value = false;
  }
  cache = { value, expires: now + TTL_MS };
  return value;
}
