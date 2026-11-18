-- UI-P2-03: no example restaurant is titled as premises to let. The two rows
-- priced per head read as restaurants, and their catalogue entries follow.
do $$
declare
  n int;
begin
  select count(*) into n from public.listings
   where is_demo and property_type = 'restaurant'
     and rate_period = 'guest'
     and title ~* '\m(unit|space|premises|shop|to let)\M';
  if n <> 0 then raise exception 'PROBE_FAIL ui-p2-03: % per-head restaurant(s) still titled as premises', n; end if;

  -- 16 November 2026: the founder deleted every example row from the live
  -- database and does not want them back, so the two example restaurants
  -- this line was written about no longer exist. It now holds what is left
  -- of its meaning: neither of them, while it exists, carries any title but
  -- the renamed one. (Before the deletion it also demanded that both exist;
  -- that half cannot hold on a database without examples.)
  select count(*) into n from public.listings
   where id in ('ed000000-0000-4000-8000-00000000001e', 'ed000000-0000-4000-8000-00000000002a')
     and title not in ('Restaurant in Jabi', 'Restaurant in Bodija');
  if n <> 0 then raise exception 'PROBE_FAIL ui-p2-03: the two examples were not renamed (%)', n; end if;

  select count(*) into n from public.catalogue_entries
   where title in ('Restaurant space in Jabi', 'Restaurant unit in Bodija');
  if n <> 0 then raise exception 'PROBE_FAIL ui-p2-03: the catalogue still carries an old title'; end if;

  raise exception 'PROBE_OK ui-p2-03';
end $$;
