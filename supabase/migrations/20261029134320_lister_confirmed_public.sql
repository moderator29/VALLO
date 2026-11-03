/* THE LISTER'S "STILL AVAILABLE" DATE, READABLE ON THE LISTING PAGE (29
   October 2026, backlog row 33: "last updated and still available on every
   listing").

   `listings.lister_confirmed_at` has been a column since C5
   (`20260930102453`), granted to `authenticated` only, because only the
   lister's own screens read it. The public listing page now says "Confirmed
   available 3 days ago" beside "Listed 12 days ago", which needs the same
   date for a reader with no session. It is a date, not a person: it names
   nobody, and the rows an anonymous reader can see are still only the
   published ones (the existing row policy decides that; this grants a
   column, not a row). `check-migration-rules` M2 requires the anon grant in
   the same change as the column joining the catalogue select. */
set lock_timeout = '5s';

grant select (lister_confirmed_at) on public.listings to anon;
