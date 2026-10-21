-- NEW-A4-01, AS OF 29 SEPTEMBER: nobody reads an exact point from the tables
-- or the map functions. anon cannot select the exact columns of listings,
-- accommodations, businesses or catalogue_entries; nobody but the owner can
-- call the exact search bodies; every caller of the map and comparison
-- functions gets points rounded to two decimals and distances in 500 m steps
-- (20260929110457). The exact address and pin come only from
-- listing_exact_location, for the lister, staff, a confirmed viewing or a
-- live agreement.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  t text;
  n int;
  bad int;
  r record;
  agent uuid;
  lid uuid := gen_random_uuid();
begin
  -- 29 September: the console's second factor. An admin or a staff member
  -- holds their role only on a session that proved a security key, so this
  -- probe's session carries one for every admin and for the QA member (who
  -- some probes make staff), rolled back with everything else.
  insert into public.console_step_ups (user_id, session_id, expires_at)
  select console_probe_uid, '00000000-0000-4000-8000-00000000c0de', now() + interval '1 hour'
    from (select user_id from public.user_roles where role in ('admin', 'super_admin')
          union select '03f3dd52-ea28-4852-9abe-e5b0a67c2a43'::uuid
          union select '957b3bd2-cce3-425d-bba9-5cd876ca3d62'::uuid) s(console_probe_uid)
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-new-a4-01-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe NEW-A4-01 lister') returning id into agent;
  insert into public.listings (id, agent_id, title, property_type, status, listing_role, listing_intent,
                               rent_amount_minor, rent_period, latitude, longitude, state_code, city, area)
  values (lid, agent, 'Probe NEW-A4-01', 'apartment', 'DRAFT', 'agent', 'rent',
          150000000, 'year', 6.51234, 3.38765, 'LA', 'Lagos', 'Yaba');
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate, and a mandate needs its listing to exist, so the
  -- fixture is filed as a draft, given a mandate as the platform would, then
  -- published.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  values (lid, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now());
  update public.listings set status = 'PUBLISHED' where id = lid;

  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  foreach t in array array['listings', 'accommodations', 'businesses', 'catalogue_entries'] loop
    begin
      execute format('select count(latitude) from public.%I', t) into n;
      raise exception 'PROBE_FAIL new-a4-01: anon read %.latitude', t;
    exception when insufficient_privilege then null; end;
    -- CONTROL: the public point reads.
    begin
      execute format('select count(latitude_public) + count(location_public) from public.%I', t) into n;
    exception when others then
      raise exception 'PROBE_FAIL new-a4-01: anon read of the public point on % failed: % %', t, sqlstate, sqlerrm;
    end;
  end loop;

  select latitude_public, longitude_public into r from public.listings where id = lid;
  if r.latitude_public <> 6.51 or r.longitude_public <> 3.39 then
    raise exception 'PROBE_FAIL new-a4-01: public point is %', row_to_json(r);
  end if;

  begin
    perform * from public.listings_in_bounds_exact(3.0, 6.0, 4.0, 7.0);
    raise exception 'PROBE_FAIL new-a4-01: anon called the exact map body';
  exception when insufficient_privilege then null; end;

  select latitude, longitude into r from public.listings_in_bounds(3.0, 6.0, 4.0, 7.0) where id = lid;
  if r.latitude is distinct from 6.51 or r.longitude is distinct from 3.39 then
    raise exception 'PROBE_FAIL new-a4-01: anon map point is %', row_to_json(r);
  end if;
  select count(*) filter (where distance_m is not null and mod(distance_m::numeric, 500) <> 0) into bad
    from public.comparable_listings(6.5125, 3.3877, 'apartment', 'rent', null, 5000, 3650, null, 200);
  if bad > 0 then raise exception 'PROBE_FAIL new-a4-01: comparable distance not rounded (% rows)', bad; end if;
  select count(*) filter (where distance_m is not null and mod(distance_m::numeric, 500) <> 0),
         count(*) filter (where distance_m is not null)
    into bad, n
    from public.stays_search(p_lat => 6.5125, p_lng => 3.3877, p_sort => 'distance', p_limit => 200);
  if bad > 0 then raise exception 'PROBE_FAIL new-a4-01: stays distance not rounded (% rows)', bad; end if;
  if n = 0 then raise exception 'PROBE_FAIL new-a4-01: stays search returned no distance to check'; end if;
  perform * from public.comparable_supply_near(6.5125, 3.3877, 'apartment', 'rent', null, 3000);
  perform * from public.area_supply_census('LA', 'Lagos', 'Yaba', 'rent');

  -- A signed-in stranger gets the public point from the map too, cannot call
  -- the exact body, and gets no exact location.
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select latitude into r from public.listings_in_bounds(3.0, 6.0, 4.0, 7.0) where id = lid;
  if r.latitude is distinct from 6.51 then
    raise exception 'PROBE_FAIL new-a4-01: signed-in map point is %', row_to_json(r);
  end if;
  begin
    perform * from public.listings_in_bounds_exact(3.0, 6.0, 4.0, 7.0);
    raise exception 'PROBE_FAIL new-a4-01: a member called the exact map body';
  exception when insufficient_privilege then null; end;

  -- The owner gets the exact place through listing_exact_location.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select latitude, why into r from public.listing_exact_location(lid);
  if r.latitude is distinct from 6.51234 or r.why is distinct from 'lister' then
    raise exception 'PROBE_FAIL new-a4-01: owner exact location is %', row_to_json(r);
  end if;

  -- CONTROL: the owner takes a live listing with a point back to a draft
  -- (the generated columns do not trip the owner-write guard).
  update public.listings set status = 'DRAFT' where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a4-01: owner unpublish rows=%', n; end if;

  raise exception 'PROBE_OK new-a4-01';
end
$$;
