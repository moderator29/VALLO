-- GOOD FOR SHARING HAS NEVER BEEN READABLE.
--
-- Backend audit, 11 November 2026. Safe to run twice. No row is changed.
-- Two SELECT grants, nothing else.
--
-- WHAT IS WRONG.
--
-- `public.listings` does not grant SELECT at table level. It grants it on
-- named columns: 81 of its 105 to `anon` and 90 to `authenticated`, with
-- the address, the coordinates, the reviewer's notes and the listing fee
-- held back. That is the right shape and it is deliberate. It also means a
-- column added to this table afterwards arrives readable by NOBODY but the
-- service role, silently, because ALTER TABLE ADD COLUMN carries no grant.
--
-- `pending/roommates_3_integrations.sql` adds `shared_living_ok` and
-- `max_occupants` to `public.listings` and grants neither. Both columns are
-- on the live database today. Neither can be read by a member or a visitor:
--
--   has_column_privilege('authenticated','public.listings','shared_living_ok','SELECT')  -> false
--   has_column_privilege('authenticated','public.listings','max_occupants','SELECT')     -> false
--   has_column_privilege('anon', ...)                                                    -> false
--
-- The WRITE side works, which is why this never looked broken from the
-- lister's side of the desk: `public.roommate_set_listing_sharing` is
-- SECURITY DEFINER, so it sets both columns happily. Only the read is
-- refused, with 42501.
--
-- WHAT A PERSON SEES.
--
--   `/agent/listings/<id>/sharing`
--   (app/agent/listings/[listingId]/sharing/page.tsx) reads
--   `id, title, bedrooms, shared_living_ok, max_occupants` through the
--   lister's own client. The whole statement is refused, so `row.data` is
--   null. 42501 is not one of the codes `lib/features/degrade.ts` treats as
--   "the SQL is not pasted yet", so the page does not say Roommates is not
--   open: it takes the other branch and tells the lister their own listing
--   is not theirs. The form cannot be reached at all, by anybody.
--
--   `RoommatesForHome` on the public listing page
--   (app/(app)/listing/[id]/RoommatesForHome.tsx) reads the same two
--   columns and swallows the refusal, so the "Good for sharing" line is
--   never drawn for anybody either.
--
-- AND THE TABLE SAYS SO ITSELF. On 11 November 2026 not one listing on the
-- live database had `shared_living_ok` set. Nobody has ever reached the
-- form, so nobody has ever set it.
--
-- WHY BOTH ROLES. Neither column is personal and neither is a secret: they
-- are what the listing advertises about itself, next to the bedroom count
-- `anon` already reads. The line is meant to be on the public listing page,
-- which a signed-out visitor loads as `anon`. Granting only `authenticated`
-- would fix the lister's form and leave the public page as it is today.
--
-- NOTHING ELSE CHANGES. No policy, no RLS, no write grant: a lister still
-- changes these two columns only through `roommate_set_listing_sharing`,
-- which checks ownership itself. The redacted columns stay redacted.
--
-- This also moves two lines in `supabase/tests/probes/db-06.sql`: that probe
-- now reads column grants as well as table grants, and names these two
-- columns under `readpending`, so it is green both before and after this is
-- run. `supabase/tests/probes-pending/listings-sharing-select-grant.sql`
-- fails until this is applied, which is the point of it.

set lock_timeout = '5s';

begin;

grant select (shared_living_ok, max_occupants) on table public.listings to anon, authenticated;

commit;

-- Verification, read only.
--   select has_column_privilege('authenticated','public.listings','shared_living_ok','SELECT'),
--          has_column_privilege('authenticated','public.listings','max_occupants','SELECT'),
--          has_column_privilege('anon','public.listings','shared_living_ok','SELECT'),
--          has_column_privilege('anon','public.listings','max_occupants','SELECT');
--     -- expect true, true, true, true
--   select has_column_privilege('anon','public.listings','address','SELECT');
--     -- expect false: the redaction is untouched
