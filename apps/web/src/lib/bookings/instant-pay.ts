/**
 * D73 Part A: a booking at a price the business fixed (a hotel room from its
 * rate plan, a nightly stay at its published rate) is booked and paid in one
 * flow, the way a hotel booking API such as LiteAPI works.
 *
 * The database decides, never this file. With `stays_instant_pay` on, the
 * trigger `bookings_instant_when_fixed_price` (migration
 * d73a_stays_instant_pay) accepts the guest's own booking when it is written
 * and records the stay agreement as approved by the system (decided_by null,
 * terms.instant_booking true). The app only reads what happened, so the guest
 * goes straight to paying when the database said yes and keeps today's
 * request screen when it did not (switch off, a host with no payout set up, an
 * agent without a live mandate).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { getDictionary } from "@vallo/i18n";

/**
 * How long an unpaid instant booking is held before the sweep gives its
 * nights back. Mirrors private.instant_pay_window() exactly; the sweep runs
 * every 15 minutes, so the release lands between 30 and 45 minutes.
 */
export const INSTANT_PAY_WINDOW_MINUTES = 30;

/** SW11: source of truth is now `packages/i18n/src/locales/inspections.en.ts`. */
const _ir = getDictionary("en").inspections.instantRoom;
export const INSTANT_ROOM_COPY = {
  action: _ir.action,
  body: _ir.bodyTemplate.replace("{minutes}", String(INSTANT_PAY_WINDOW_MINUTES)),
} as const;

type AgreementFacts = {
  status: string | null;
  decided_by: string | null;
  decided_at: string | null;
  terms: unknown;
};

/** True only for an agreement the system approved as an instant booking. */
export function isInstantAgreement(agreement: AgreementFacts | null | undefined): boolean {
  if (!agreement || agreement.decided_by !== null) return false;
  const terms = agreement.terms;
  if (terms === null || typeof terms !== "object" || Array.isArray(terms)) return false;
  return (terms as Record<string, unknown>).instant_booking === true;
}

/**
 * When an unpaid instant booking stops being held: approval time plus the
 * window. Null when the agreement is not an approved instant one or carries
 * no usable decision time.
 */
export function instantPayBy(agreement: AgreementFacts | null | undefined): string | null {
  if (!agreement || agreement.status !== "approved" || !isInstantAgreement(agreement)) return null;
  const at = agreement.decided_at ? Date.parse(agreement.decided_at) : Number.NaN;
  if (!Number.isFinite(at)) return null;
  return new Date(at + INSTANT_PAY_WINDOW_MINUTES * 60_000).toISOString();
}

export type InstantOutcome = { instant: boolean; payBy: string | null };

/**
 * What the database did with a booking the guest just wrote, read under the
 * guest's own RLS. Any failed read is "not instant": the guest then sees the
 * request screen, which the checkout corrects on its own read.
 */
export async function readInstantOutcome(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<InstantOutcome> {
  const none: InstantOutcome = { instant: false, payBy: null };
  try {
    const [bookingRead, agreementRead] = await Promise.all([
      supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle(),
      supabase
        .from("deal_agreements")
        .select("status, decided_by, decided_at, terms")
        .eq("booking_id", bookingId)
        .maybeSingle(),
    ]);
    if (bookingRead.error || agreementRead.error) return none;
    if ((bookingRead.data as { status?: string } | null)?.status !== "CONFIRMED") return none;
    const agreement = agreementRead.data as AgreementFacts | null;
    const payBy = instantPayBy(agreement);
    return payBy ? { instant: true, payBy } : none;
  } catch {
    return none;
  }
}
