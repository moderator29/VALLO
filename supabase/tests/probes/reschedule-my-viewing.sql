-- RESCHEDULE-MY-VIEWING. Needs 20261101*_reschedule_my_viewing.
--  1. a stranger cannot move somebody else's viewing
--  2-4. the renter's move withdraws the old one and books the new one, one live viewing left
--  5-6. a time that is not free is refused and the current viewing stands
--  7. a closed viewing cannot be moved
do $$
declare
  lister constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  renter constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  stranger constant uuid := '2255d905-0f31-437e-b719-aa2e4a18e03d';
  lst constant uuid := 'ed000000-0000-4000-8000-000000000003';
  s1 timestamptz; s2 timestamptz; first_id uuid; second_id uuid; st text; n int; d int;
begin
  -- the only published listings here are examples; inside this rolled-back block one stands in as real
  set local session_replication_role = replica;
  update public.listings set is_demo = false, demo_retire_after = null where id = lst;
  set local session_replication_role = origin;
  for d in 0..6 loop
    insert into public.viewing_windows (lister_id, listing_ids, weekday, starts, ends, slot_minutes, active)
    values (lister, array[lst], d, '09:00', '18:00', 30, true);
  end loop;
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', renter), true);
  select slot_at into s1 from public.viewing_slots(lst, 14) order by slot_at offset 2 limit 1;
  select slot_at into s2 from public.viewing_slots(lst, 14) order by slot_at offset 5 limit 1;
  if s1 is null or s2 is null then raise exception 'PROBE_FAIL setup: no slots'; end if;
  first_id := public.book_viewing_slot_mode(lst, s1, 'probe', 'in_person');

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', stranger), true);
  begin
    perform public.reschedule_my_viewing(first_id, s2);
    raise exception 'PROBE_FAIL 1: a stranger moved the viewing';
  exception when others then
    if sqlerrm like 'PROBE_FAIL%' then raise; end if;
  end;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', renter), true);
  second_id := public.reschedule_my_viewing(first_id, s2);
  select state into st from public.inspection_requests where id = first_id;
  if st <> 'WITHDRAWN' then raise exception 'PROBE_FAIL 2: old viewing is %', st; end if;
  select state into st from public.inspection_requests where id = second_id;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL 3: new viewing is %', st; end if;
  select count(*) into n from public.inspection_requests where requester_id = renter and listing_id = lst and state in ('REQUESTED','PROPOSED','CONFIRMED');
  if n <> 1 then raise exception 'PROBE_FAIL 4: % live viewings', n; end if;

  begin
    perform public.reschedule_my_viewing(second_id, s2 + interval '7 minutes');
    raise exception 'PROBE_FAIL 5: an invalid time was accepted';
  exception when others then
    if sqlerrm like 'PROBE_FAIL%' then raise; end if;
  end;
  select state into st from public.inspection_requests where id = second_id;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL 6: a refused move lost the viewing (%)', st; end if;

  begin
    perform public.reschedule_my_viewing(first_id, s1);
    raise exception 'PROBE_FAIL 7: a closed viewing was moved';
  exception when others then
    if sqlerrm like 'PROBE_FAIL%' then raise; end if;
  end;
  raise exception 'PROBE_OK reschedule-my-viewing';
end $$;
