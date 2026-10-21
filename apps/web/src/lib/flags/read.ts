import "server-only";

import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

/**
 * A fail-closed feature flag, the pattern of the retired escrow flag: true only
 * when the `feature_flags` row exists and says true. Every other answer,
 * including a failed read, is false.
 */
export async function flagIsOn(key: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
    if (error) return false;
    return data?.enabled === true;
  } catch {
    return false;
  }
}

/**
 * VC1: voice and video calls in Messages. Seeded OFF by the VC1 migration; the
 * database refuses every call function while it is off, this only words screens.
 */
export const VIDEO_CALLS_FLAG = "video_calls";
/** VC1: staff review calls about an existing case. Needs `video_calls` on as well. */
export const ADMIN_REVIEW_CALLS_FLAG = "admin_review_calls";
/**
 * Vallo Pro and Vallo Business can be tried and paid for. Seeded ON by the
 * subscriptions_checkout migration (the founder, 8 October); a missing row
 * reads off here and in the database (`private.subscriptions_checkout_on`).
 */
export const SUBSCRIPTIONS_CHECKOUT_FLAG = "subscriptions_checkout";
/** Saving a card at checkout (the 100 naira check). Its own switch since 17 October, in place of the retired `wallet` row (`lib/payments/methods-actions.ts`). */
export const SAVED_CARDS_FLAG = "saved_cards";
/** V-41: residents' reports beside the lister's claim. */
export const NEIGHBOURS_FLAG = "neighbours_account";
/** V-43: rush-hour times to named places. */
export const COMMUTE_FLAG = "commute_by_the_clock";
/** V-69: a renter asks the lister for one clip. */
export const SHOW_ME_FLAG = "show_me";
/** ROOM BOOKINGS 1: hotel rooms can be requested and paid for (off until the founder switches it on). */
export const ROOM_BOOKINGS_FLAG = "room_bookings";
/**
 * D73: a hotel room or nightly stay at the published price is booked and paid
 * in one flow (no host acceptance, no Vallo review). Seeded off by migration
 * d73a_stays_instant_pay; the database decides each booking, this only words
 * the screens.
 */
export const STAYS_INSTANT_PAY_FLAG = "stays_instant_pay";
/**
 * D60: whether "Send for review" waits for the lister's recorded fee
 * acceptance (D51, D61). The screen is in the wizard regardless; only the
 * blocking is behind this, and with no row it reads off, so publishing is
 * never blocked until Session 2's rate read and acceptance record exist. To
 * turn it on, the day they do:
 *   insert into public.feature_flags (key, enabled) values ('lister_fee_gate_blocking', true)
 *   on conflict (key) do update set enabled = true;
 */
export const LISTER_FEE_GATE_BLOCKING_FLAG = "lister_fee_gate_blocking";
