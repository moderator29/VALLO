/**
 * V-56 AND V-92, TO THE BOUNDARY. The arithmetic of two holds the founder has
 * not yet switched on, pure so it is tested before any money depends on it.
 *
 *   V-56: an on-platform move-in pays the agency fee into a held payment
 *   instead of to the agent, released on keys received or, failing a problem,
 *   14 days after move-in. The rest is paid now. The pay screen draws these
 *   lines only when both `rent_agency_hold` and `held_payments` are on.
 *   (`money-holds-flags.ts` held the flag readers and was deleted on
 *   13 November 2026 as unreachable, nothing imported it. This line used to
 *   point at it, and a comment naming a file that no longer exists is how an
 *   hour gets lost.)
 *
 *   V-92: a shortlet caution is a hold on the guest's own wallet, released 48
 *   hours after check-out unless the host claims damage with photos first.
 *
 * Integer kobo; calendar days as YYYY-MM-DD; Lagos wall-clock hours.
 */
import { addDays } from "../tenancy/model";

export const AGENCY_HOLD_DAYS = 14;
export const STAY_CAUTION_RELEASE_HOURS = 48;

export type AgencySplit = {
  /** Paid to the lister at payment. */
  nowMinor: number;
  /** Set aside in a held payment for the agency fee. */
  heldMinor: number;
  /** Released on this day unless the tenant raises a problem. */
  releasesOn: string;
};

/** Null when there is nothing to hold: no agency fee, or a fee that is the whole charge. */
export function agencySplit(input: { totalMinor: number; agencyMinor: number | null; moveIn: string }): AgencySplit | null {
  const total = Number.isSafeInteger(input.totalMinor) ? input.totalMinor : 0;
  const agency = Number.isSafeInteger(input.agencyMinor) ? (input.agencyMinor as number) : 0;
  if (agency <= 0 || total <= 0 || agency >= total) return null;
  return { nowMinor: total - agency, heldMinor: agency, releasesOn: addDays(input.moveIn, AGENCY_HOLD_DAYS) };
}

/**
 * When a stay's caution hold is released: check-out day at the listing's
 * check-out hour (Lagos, UTC+1, no daylight saving), plus 48 hours. An ISO
 * instant, so the sentence can print a weekday and a time.
 */
export function stayCautionReleasesAt(checkOut: string, checkOutHour = 12): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return null;
  const hour = Number.isInteger(checkOutHour) && checkOutHour >= 0 && checkOutHour <= 23 ? checkOutHour : 12;
  const at = Date.parse(`${checkOut}T${String(hour).padStart(2, "0")}:00:00+01:00`) + STAY_CAUTION_RELEASE_HOURS * 3_600_000;
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}
