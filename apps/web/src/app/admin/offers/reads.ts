import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AdminDeal, AdminOfferRow, OffersOverview } from "./model";

/**
 * READS FOR THE OFFERS AND DEALS DESK. Lead-owned in spirit: the bodies are
 * filled from the SQL (an audited definer function, never a table read with the
 * service key). `null` means "could not be read" and the desk says so in words;
 * it never draws zeros it did not read.
 */

export type DeskRead = { overview: OffersOverview; rows: AdminOfferRow[] };

export async function readOffersDesk(_supabase: SupabaseClient<Database>): Promise<DeskRead | null> {
  return null;
}

export async function readAdminDeal(_supabase: SupabaseClient<Database>, _offerId: string): Promise<AdminDeal | null> {
  return null;
}
