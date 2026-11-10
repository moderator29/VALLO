import "server-only";

import { resolveSession } from "@/lib/actions/session";
import { lagosToday } from "@/lib/rent/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NO_FACTS, badgeTierFrom, type BadgeTier, type BelongingsFacts } from "./belongings";

/**
 * The four numbers the Belongings rows may carry, read under the caller's own
 * RLS in one round trip.
 *
 *   bookings            `bookings_guest_select`: guest_id = auth.uid()
 *   saved_items         `saved_items_own`: user_id = auth.uid()
 *   saved_places        the same rule, on the stays side's saves
 *   deal_agreements     the agreements this person is a party to, so the
 *                       ledger's own policies decide
 *   inspection_requests `inspection_requests_select_party`
 *
 * Every read is a head count or a single row, never a list. The `eq` on the
 * caller's id narrows a set the policy has already bounded; it is not what
 * enforces anything.
 *
 * A read that fails comes back `null`, and the row then shows no number at
 * all. It never comes back 0, because 0 is an answer and a failed read is not
 * one. That is the rule the wallet page learned the hard way with a credit
 * that never arrived (see `getWalletForViewer`).
 */
export async function loadBelongings(): Promise<BelongingsFacts> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return NO_FACTS;
  const { supabase, user } = session;
  const today = lagosToday();

  const [upcoming, savedItems, savedPlaces, agreements, inspections] = await Promise.all([
    headCount(
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("guest_id", user.id)
        .in("status", ["PENDING", "CONFIRMED"])
        /* The same line `getMyBookings` draws between Upcoming and Past: a
           stay whose check out is today or earlier is behind them. */
        .gt("check_out", today),
    ),
    headCount(
      supabase
        .from("saved_items")
        .select("listing_id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ),
    headCount(
      supabase
        .from("saved_places")
        .select("entity_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        /* The two kinds the Saved screen draws. Anything else in the table is
           not on that screen, so it is not in this number either. */
        .in("entity_kind", ["accommodation", "restaurant"]),
    ),
    readOpenAgreements(supabase),
    headCount(
      supabase
        .from("inspection_requests")
        .select("id", { count: "exact", head: true })
        .eq("requester_id", user.id)
        /* What the inspections page calls Open: somebody's move, or booked in. */
        .in("state", ["REQUESTED", "PROPOSED", "CONFIRMED"]),
    ),
  ]);

  return {
    upcomingBookings: upcoming,
    saved: savedItems === null || savedPlaces === null ? null : savedItems + savedPlaces,
    openAgreements: agreements,
    openInspections: inspections,
  };
}

async function headCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  try {
    const { count, error } = await query;
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

type Client = Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>["supabase"];

/**
 * Agreements this person is a party to that are waiting on somebody or open
 * for payment, under their own RLS. Null when the read failed.
 */
async function readOpenAgreements(supabase: Client): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("deal_agreements")
      .select("id", { count: "exact", head: true })
      .neq("kind", "sale")
      .in("status", ["awaiting_parties", "in_review", "approved", "rejected"]);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

/**
 * The signed-in person's badge tier, read from `public.person_badge`, the one
 * source (SELECT is granted to authenticated). Never
 * computed here. The view is newer than the generated types, so the read goes
 * through an untyped client; the value is narrowed by `badgeTierFrom`. A failed
 * read is no badge, never a guessed one.
 */
export async function loadOwnBadgeTier(): Promise<BadgeTier> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  try {
    const client = session.supabase as unknown as SupabaseClient;
    const { data, error } = await client
      .from("person_badge")
      .select("tier")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return badgeTierFrom((data as { tier?: unknown }).tier);
  } catch {
    return null;
  }
}
