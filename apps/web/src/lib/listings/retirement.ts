/**
 * When the example collection comes down.
 *
 * A dataset with no expiry becomes permanent by accident. Forty two example
 * properties were added because an empty catalogue looks broken, and "we will
 * take them out when real listings arrive" is not a plan, it is the sentence
 * that is still true in two years. So there is a date, it is written on every
 * row in `listings.demo_retire_after`, and it is mirrored here because the
 * thing that has to notice the date passing is the build, not a person.
 *
 * `retirement.test.ts` is the alarm. It fails once this date is behind us and
 * the tree still ships the example collection with nothing that removes it.
 *
 * DELIBERATELY NOT A SILENT SWITCH. Nothing in the reading path compares the
 * clock to this date and starts hiding rows. A catalogue that empties itself
 * overnight with no warning is a worse failure than a red build: discovery,
 * the map and every city page would go blank at once and the cause would be
 * invisible from any screen. The switch already exists and is deliberate:
 * `excludeDemo` on `ListingSearchFilter`, pushed down to SQL. This date is
 * what makes somebody reach for it.
 */

/**
 * The day the example collection is due out, as an ISO date in Africa/Lagos.
 *
 * Ninety days from the day the rows landed (2026-08-09). Ninety because
 * DEMO-1, recruiting real listers by hand, is a fortnight of phone calls
 * repeated a few times, and because a quarter is long enough that nobody can
 * claim they were not given a run at it.
 *
 * MOVING THIS DATE IS ALLOWED, ONCE THE REASON IS WRITTEN DOWN. Change it
 * here, change `listings.demo_retire_after` in a migration, and say in the
 * migration header what changed about the world. What is not allowed is
 * deleting the check because it went red.
 *
 * MOVED ON 9 November 2026 (founder), from 2026-11-07 to 2027-05-07: the
 * catalogue is still filling with real listings mid-launch, so the example
 * collection stays for another run rather than leaving every city page and the
 * map blank. The reason and the new write onto the rows are in
 * `supabase/migrations/pending/example_collection_retirement_extended_to_2027-05-07.sql`.
 */
export const EXAMPLE_COLLECTION_RETIREMENT = "2027-05-07";

/** Midnight Lagos on the retirement day, as an instant. */
export function retirementInstant(): Date {
  // +01:00 year round. Nigeria has never observed daylight saving.
  return new Date(`${EXAMPLE_COLLECTION_RETIREMENT}T00:00:00+01:00`);
}

/** Is the collection overdue as of this moment? */
export function isOverdue(now: Date = new Date()): boolean {
  return now.getTime() >= retirementInstant().getTime();
}

/** Whole days left before the collection is overdue. Negative once it is. */
export function daysUntilRetirement(now: Date = new Date()): number {
  const MS_PER_DAY = 86_400_000;
  return Math.ceil((retirementInstant().getTime() - now.getTime()) / MS_PER_DAY);
}
