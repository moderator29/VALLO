-- DELETE EVERY DEMO RECORD FROM THE LIVE DATABASE (founder, 16 November 2026:
-- "delete all sample listing on our platform, end to end, all areas, and all
-- demo stuff").
--
-- DESTRUCTIVE. One transaction: either all of it happens or none of it does.
-- Counted live, read-only, on 16 November 2026 before this was written:
--
--   listings (is_demo)            64 of 65   (the 1 real one stays)
--   accommodations (is_demo)       5 of 5
--   room_types (is_demo)          11 of 11
--   businesses (is_demo)           7 of 7    (restaurants and stay businesses)
--   catalogue_entries (is_demo)   71 of 72   (the 1 real one stays)
--   conversations on demo listings 13       (24 messages, all between the
--                                            founder's own two accounts)
--   saved_items on demo listings   57       (go with the listings)
--   the "Vallo Examples" account   1        (owns only demo businesses)
--
-- Nothing real points at them: 0 bookings, 0 deal agreements, 0 rent
-- payments, 0 revenue rows, 0 reservations, 0 reviews, 0 promotions, 0 calls,
-- 0 mandates, 0 posts or stories on a demo listing.
--
-- KEPT ON PURPOSE:
--   - the 132 author-less feed posts: they are Vallo's own daily tips, not demo;
--   - the agent profile flagged is_demo (agent e0000000-...-0002): it belongs to
--     the founder's own "omojuni PHANTOM" account, and deleting it would also
--     remove that account's payout and verification records. Decide separately;
--   - photos in Storage: SQL cannot remove the files themselves. They are no
--     longer linked from anything and can be cleared from the Storage page.
--
-- Run it in the Supabase SQL editor as one paste.

begin;

do $before$
begin
  raise notice 'before: % demo listings, % demo stays, % demo room types, % demo businesses, % demo catalogue rows',
    (select count(*) from public.listings where is_demo),
    (select count(*) from public.accommodations where is_demo),
    (select count(*) from public.room_types where is_demo),
    (select count(*) from public.businesses where is_demo),
    (select count(*) from public.catalogue_entries where is_demo);
end;
$before$;

-- 1. Test chats about demo listings (their messages go with them).
delete from public.conversations c
 using public.listings l
 where l.id = c.listing_id and l.is_demo;

-- 2. Demo listings (photos, amenities, saves, stats and the rest cascade).
delete from public.listings where is_demo;

-- 3. Demo stays: room types, then the stays, then the businesses behind them.
delete from public.room_types where is_demo;
delete from public.accommodations where is_demo;
delete from public.businesses where is_demo;

-- 4. Anything demo left in the search catalogue.
delete from public.catalogue_entries where is_demo;

-- 5. The "Vallo Examples" account, only if it now owns nothing at all.
do $examples$
declare
  examples constant uuid := 'e0000000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from public.businesses where owner_id = examples)
     or exists (select 1 from public.agents where user_id = examples)
     or exists (select 1 from public.posts where author_id = examples) then
    raise notice 'Vallo Examples account kept: it still owns something';
  else
    begin
      delete from auth.users where id = examples;
      raise notice 'Vallo Examples account deleted';
    exception when others then
      raise notice 'Vallo Examples account kept (%): delete it from Authentication > Users', sqlerrm;
    end;
  end if;
end;
$examples$;

-- 6. Self-check: nothing demo is left. Any failure here undoes everything.
do $check$
begin
  if exists (select 1 from public.listings where is_demo)
     or exists (select 1 from public.accommodations where is_demo)
     or exists (select 1 from public.room_types where is_demo)
     or exists (select 1 from public.businesses where is_demo)
     or exists (select 1 from public.catalogue_entries where is_demo) then
    raise exception 'demo delete self-check: demo rows remain';
  end if;
  raise notice 'demo delete self-check passed: % listings, % catalogue rows remain (all real)',
    (select count(*) from public.listings), (select count(*) from public.catalogue_entries);
end;
$check$;

commit;
