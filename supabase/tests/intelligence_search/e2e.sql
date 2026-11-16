-- End to end for intelligence_search_2026-11-16.sql on the local stub. Ends E2E_OK.
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');
insert into private.test_scopes values ('11111111-1111-1111-1111-111111111111', 'content'), ('33333333-3333-3333-3333-333333333333', 'analyst');

do $$
declare r jsonb; n integer; h text;
begin
  -- Analytics: the service role records; words with a phone number lose their text.
  set local role service_role;
  perform public.search_event_record('search', '2 Bedroom in LEKKI', 'property', 'all', 4, 120, 'Lekki, Lagos', null, null, 'v:a');
  perform public.search_event_record('search', 'call 0803 123 4567 about flat', null, 'all', 0, 90, null, null, null, 'v:b');
  perform public.search_event_record('click', '2 bedroom in lekki', null, 'all', null, null, null, 'property', 1, 'v:a');
  perform public.search_event_record('nonsense', 'x', null, 'all', 1, 1, null, null, null, 'v:c');
  perform public.search_event_record('search', 'x', null, 'not-a-tab', 1, 1, null, null, null, 'v:c');
  reset role;
  if (select count(*) from public.search_events) <> 3 then raise exception 'E2E_FAIL bad events were kept or good ones lost'; end if;
  if exists (select 1 from public.search_events where query like '%0803%') then raise exception 'E2E_FAIL a phone number was kept'; end if;
  if (select count(*) from public.search_events where query is null and event = 'search') <> 1 then raise exception 'E2E_FAIL the row with the phone was not kept without its words'; end if;
  select session_hash into h from public.search_events where query = '2 bedroom in lekki' and event = 'search';
  if h is null or h !~ '^[0-9a-f]{32}$' or h like '%v:a%' then raise exception 'E2E_FAIL the visit was not hashed'; end if;

  -- The privacy floor: two visits are not enough, three are.
  set local role service_role;
  perform public.search_event_record('search', 'hotels in abuja', 'stay', 'all', 2, 50, 'Abuja', null, null, 'v:1');
  perform public.search_event_record('search', 'hotels in abuja', 'stay', 'all', 2, 50, 'Abuja', null, null, 'v:2');
  perform public.search_event_record('search', 'hotels in abuja', 'stay', 'all', 2, 50, 'Abuja', null, null, 'v:2');
  reset role;
  set local role anon;
  if exists (select 1 from public.search_popular_queries(30, 8)) then raise exception 'E2E_FAIL a query under the floor was returned'; end if;
  reset role;
  set local role service_role;
  perform public.search_event_record('search', 'hotels in abuja', 'stay', 'all', 2, 50, 'Abuja', null, null, 'v:3');
  reset role;
  set local role anon;
  if (select count(*) from public.search_popular_queries(30, 8) where query = 'hotels in abuja' and sessions = 3) <> 1 then raise exception 'E2E_FAIL a query at the floor was not returned'; end if;
  begin
    perform 1 from public.search_events;
    raise exception 'E2E_FAIL anon read the events';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.search_event_record('search', 'x', null, 'all', 1, 1, null, null, null, null);
    raise exception 'E2E_FAIL anon recorded an event';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Aliases: the content scope writes and is audited; analyst reads only; a stranger is refused.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  if public.admin_search_alias_put('buka', 'restaurant', 'word') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a stranger added an alias'; end if;
  if public.admin_search_overview(7) ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a stranger read the desk'; end if;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  r := public.admin_search_alias_put('  Buka ', 'restaurant', 'word');
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL content could not add an alias: %', r; end if;
  if public.admin_search_alias_put('vi2', '0803123456789', 'word') ->> 'status' <> 'invalid' then raise exception 'E2E_FAIL a long number was accepted'; end if;
  if public.admin_search_alias_set_active((r ->> 'id')::uuid, false) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL content could not disable'; end if;
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  if public.admin_search_alias_put('x', 'y', 'word') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL analyst wrote an alias'; end if;
  r := public.admin_search_overview(30);
  if r ->> 'status' <> 'ok' or (r ->> 'searches')::int <> 6 or (r ->> 'clicks')::int <> 1 or (r ->> 'zero_results')::int <> 1 then raise exception 'E2E_FAIL overview figures wrong: %', r; end if;
  if jsonb_array_length(r -> 'top_queries') <> 1 or r -> 'top_queries' -> 0 ->> 'query' <> 'hotels in abuja' then raise exception 'E2E_FAIL the floor was not applied to top words: %', r -> 'top_queries'; end if;
  if (public.admin_search_aliases() ->> 'can_edit')::boolean then raise exception 'E2E_FAIL analyst was told it can edit'; end if;
  reset role;
  if (select count(*) from public.audit_log where action in ('search_alias.added', 'search_alias.disabled')) <> 2 then raise exception 'E2E_FAIL alias changes were not audited'; end if;
  set local role anon;
  if exists (select 1 from public.search_aliases_active()) then raise exception 'E2E_FAIL a disabled alias is active'; end if;
  reset role;

  -- Recent searches: own rows only, newest 20 kept, digits refused.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  for n in 1..25 loop perform public.search_recent_remember('flat number ' || n); end loop;
  perform public.search_recent_remember('my number is 08031234567');
  if (select count(*) from public.search_recent) <> 20 then raise exception 'E2E_FAIL the newest 20 were not kept'; end if;
  if exists (select 1 from public.search_recent where query like '%0803%') then raise exception 'E2E_FAIL a phone number was kept as a recent search'; end if;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  if (select count(*) from public.search_recent) <> 0 then raise exception 'E2E_FAIL a member saw another member''s searches'; end if;
  perform public.search_recent_clear();
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform public.search_recent_forget('flat number 25');
  if (select count(*) from public.search_recent) <> 19 then raise exception 'E2E_FAIL forget removed the wrong rows'; end if;
  perform public.search_recent_clear();
  if (select count(*) from public.search_recent) <> 0 then raise exception 'E2E_FAIL clear left rows'; end if;
  reset role;

  -- Retention.
  update public.search_events set created_at = now() - interval '91 days' where event = 'click';
  set local role service_role;
  if public.search_events_purge() <> 1 then raise exception 'E2E_FAIL the purge did not remove the old row'; end if;
  reset role;
  raise notice 'E2E_OK';
end $$;
