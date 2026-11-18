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
  lst constant uuid := gen_random_uuid();
  lister_agent uuid;
  s1 timestamptz; s2 timestamptz; first_id uuid; second_id uuid; st text; n int; d int;
begin
  -- 16 November 2026: the example listings this probe borrowed are gone from
  -- the live database, and the founder does not want them back. The lister's
  -- own listing is filed here instead, for this transaction only: the lister's
  -- agent row (found, or filed if there is none), a nightly shortlet with the
  -- facts of the example it replaces, published on an approved mandate as the
  -- platform publishes one. Rolled back; nothing asserted below changes.
  select id into lister_agent from public.agents where user_id = lister;
  if lister_agent is null then
    insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe reschedule lister', 'business', 'APPROVED')
    returning id into lister_agent;
  end if;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (lst, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (lst) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (lst);
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
