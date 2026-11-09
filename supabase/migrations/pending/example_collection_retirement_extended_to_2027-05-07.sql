-- The example collection stays until the catalogue fills with real listings.
--
-- WHAT CHANGED ABOUT THE WORLD (founder, 9 November 2026). The forty two
-- example properties were due out on 2026-11-07, ninety days after they landed
-- (20260809084449_an_example_listing_carries_the_day_it_comes_down.sql). That
-- date has arrived and the catalogue is still being filled with real listings:
-- Vallo is mid-launch, and an empty catalogue on every city page and the map
-- would read as a broken product, not a clean one. So the collection stays for
-- another run, and the alarm is moved, not deleted. The new date is a
-- decision, written down, exactly as the original file asked.
--
-- The new day out is 2027-05-07 (six months on). It is mirrored in
-- `apps/web/src/lib/listings/retirement.ts` (EXAMPLE_COLLECTION_RETIREMENT),
-- and the build's alarm (retirement.test.ts) reads this file for it.
--
-- Stated as a literal date, not current_date + an interval, so re-running this
-- file on another environment lands the same day. `excludeDemo` on
-- ListingSearchFilter still hides these rows from any read that asks; this
-- only moves the day somebody has to decide again.

update public.listings
   set demo_retire_after = date '2027-05-07'
 where is_demo;
