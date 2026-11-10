import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { readListerFeePolicy } from "@/lib/money/lister-fee-read";
import { resolveSession } from "@/lib/actions/session";
import { HOTEL_ROOM_FEE_BPS } from "@/lib/host/hotel-fee";
import type { ListerFeePolicy } from "@/lib/money/lister-fee";
import type { FeeCalcConfig, StayRates } from "./model";

/**
 * THE RATES THE CALCULATOR WORKS FROM, READ ON THE SERVER, NEVER TYPED.
 *
 *   A shortlet   Signed in: `lister_fee_policy` through `readListerFeePolicy`,
 *                the read the lister's own fee screen makes (commission,
 *                cap and the processor's most). Signed out that function
 *                answers nothing, so the public policy tables are read
 *                instead (`money_policy_at`, then the shortlet row of
 *                `money_policy_commission_rates`, the rows `lister_fee_policy`
 *                itself resolves), and the processor's most is not shown.
 *   A hotel room The hotel-room commission the host screens state
 *                (`HOTEL_ROOM_FEE_BPS`, held to the database's seed row by
 *                `hotel-fee.test.ts`; the dated row itself is readable by the
 *                service role only), with the same processor's most.
 *   A table      `restaurant_money_settings.seated_fee_minor`, which the
 *                database bills from. Never the code default: a failed read
 *                is an unavailable tab, not a guessed fee.
 *
 * Any part that cannot be read is null, and the calculator says so for that
 * part alone.
 */
export async function readFeeCalcConfig(): Promise<FeeCalcConfig> {
  if (!isSupabaseConfigured()) return { stay: null, hotel: null, restaurant: null };
  const [stay, restaurant] = await Promise.all([readStayRates(), readSeatedFee()]);
  const hotel: StayRates | null = stay
    ? {
        processorKnown: stay.processorKnown,
        policy: { ...stay.policy, valloBps: HOTEL_ROOM_FEE_BPS, capMinor: null, rateVersion: `hotel_room:${stay.policy.rateVersion}` },
      }
    : null;
  return { stay, hotel, restaurant };
}

async function readStayRates(): Promise<StayRates | null> {
  try {
    const session = await resolveSession();
    if (session.state === "signed-in") {
      const policy = await readListerFeePolicy({ listingId: null, propertyType: "shortlet", listingIntent: null });
      if (policy) return { policy, processorKnown: true };
    }
    return await readPublicStayRates();
  } catch {
    return null;
  }
}

/** The public policy rows, the ones `lister_fee_policy` resolves, readable by anybody. */
async function readPublicStayRates(): Promise<StayRates | null> {
  const db = await createClient();
  const { data: version, error } = await db.rpc("money_policy_at", {});
  const v = version as { id?: unknown; version?: unknown; commission_bps?: unknown } | null;
  if (error || !v || typeof v.id !== "number" || typeof v.commission_bps !== "number") return null;
  const { data: row, error: rowError } = await db
    .from("money_policy_commission_rates")
    .select("commission_bps, cap_minor")
    .eq("policy_version_id", v.id)
    .eq("property_type", "shortlet")
    .maybeSingle();
  if (rowError) return null;
  const policy: ListerFeePolicy = {
    rateVersion: typeof v.version === "string" ? v.version : String(v.id),
    valloBps: typeof row?.commission_bps === "number" ? row.commission_bps : v.commission_bps,
    /* Not drawn: the protected rail is off. */
    escrowProtectionBps: 0,
    /* Not known signed out; `processorKnown: false` keeps it out of every figure. */
    directProcessorFeeCapMinor: 0,
    capMinor: row?.cap_minor === null || row?.cap_minor === undefined ? null : Number(row.cap_minor),
  };
  return { policy, processorKnown: false };
}

async function readSeatedFee(): Promise<{ seatedFeeMinor: number } | null> {
  try {
    /* Not in the generated types yet (the admin desk reads it the same way). */
    const db = (await createClient()) as unknown as SupabaseClient;
    const { data, error } = await db.from("restaurant_money_settings").select("seated_fee_minor").maybeSingle();
    const fee = Number((data as { seated_fee_minor?: unknown } | null)?.seated_fee_minor);
    if (error || !data || !Number.isSafeInteger(fee) || fee < 0) return null;
    return { seatedFeeMinor: fee };
  } catch {
    return null;
  }
}
