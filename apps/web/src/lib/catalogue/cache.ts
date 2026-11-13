import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

/**
 * THE PUBLIC CATALOGUE, READ ONCE AND SERVED TO EVERYBODY (platform speed,
 * 13 November 2026).
 *
 * A listing page made 31 round trips to the database, twelve of them one
 * after another, and the search page 25. Every one of those answers is the
 * same for every reader: a PUBLISHED listing, its photographs, its review
 * count, its lister's public name. So the answer is computed once, kept in
 * Next's data cache (shared by every server instance on Vercel), and every
 * reader after the first is drawn from it without a round trip.
 *
 * WHAT MAY GO IN HERE, AND WHAT MAY NEVER.
 *
 *   - Only what a signed-out stranger is allowed to read. Every cached read is
 *     made through a cookie-free anonymous client (`anonymousClient` in the
 *     readers), so the database's own `anon` grants decide what is kept: no
 *     address, no phone, no email, nothing per member.
 *   - Never a member's own state: their saved heart, their booking, their
 *     own-listing controls, their passcode, their unread count. Those are read
 *     per request, beside the cached shell, and never block it.
 *   - Never something a correctness argument depends on (a price a payment is
 *     taken at, an availability a booking is made against). Actions keep
 *     reading the live row through `getListingRepository()`.
 *
 * HOW LONG, AND HOW IT IS MADE FRESH.
 *
 *   - Every write path in this app that changes a public catalogue row calls
 *     `catalogueChanged()` (`./invalidate.ts`), which expires the entry at
 *     once: the next reader waits for a fresh read, nobody is served the old
 *     one. Takedowns, unpublishing, price edits, photos and review replies
 *     included.
 *   - A write that does not pass through this app (a SQL fix, a trigger, a
 *     rating aggregate) is picked up within `CATALOGUE_REVALIDATE_SECONDS`:
 *     after that the next reader is served the held copy once while a fresh
 *     one is read behind it.
 *   - A read that FAILED is never kept. The readers throw on a database error
 *     inside the cached function, so nothing is stored, and the caller gets
 *     the same empty answer it always had.
 */

/** Every cached catalogue entry carries this tag; expiring it empties them all. */
export const CATALOGUE_TAG = "catalogue";
/** Lists of listings: search results, shelves, the restaurant list, the map. */
export const CATALOGUE_LISTS_TAG = "catalogue:lists";
export const listingTag = (id: string) => `catalogue:listing:${id.toLowerCase()}`;
export const stayTag = (id: string) => `catalogue:stay:${id.toLowerCase()}`;
export const venueTag = (id: string) => `catalogue:venue:${id.toLowerCase()}`;

/**
 * How long a held answer is fresh, in seconds. Short on purpose: it is only
 * the backstop for writes made outside this app. Writes made through it
 * expire the entry immediately.
 */
export const CATALOGUE_REVALIDATE_SECONDS = 60;

/**
 * Run `load` through Next's data cache under `key`, tagged with `tags`.
 *
 * Outside a Next server (a unit test, a script) there is no cache to use and
 * `unstable_cache` refuses with an invariant; the read then simply runs, which
 * is exactly what happened before this file existed.
 */
export async function catalogueCached<T>(key: readonly string[], tags: readonly string[], load: () => Promise<T>): Promise<T> {
  const run = unstable_cache(load, ["catalogue", ...key], {
    tags: [CATALOGUE_TAG, ...tags],
    revalidate: CATALOGUE_REVALIDATE_SECONDS,
  });
  try {
    return await run();
  } catch (error) {
    if (isMissingCache(error)) return load();
    throw error;
  }
}

function isMissingCache(error: unknown): boolean {
  return error instanceof Error && /incrementalCache missing/.test(error.message);
}

/**
 * Expire tags now, so the next reader waits for a fresh read rather than being
 * served the old one (`{ expire: 0 }`, which is what a takedown needs).
 *
 * Never throws: a write that has committed must not report failure because the
 * cache could not be told. `revalidateTag` refuses outside a server action or
 * a route handler; the backstop above still applies.
 */
export function expireCatalogueTags(tags: readonly string[]): void {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      console.error(`[catalogue] could not expire tag=${tag}`, error instanceof Error ? error.message : "");
    }
  }
}
