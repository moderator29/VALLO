-- NEW-A4-01 STEP 2 probe. Step 2 was applied on 2026-09-24, after the release deployed,
-- as 20260924070623_new_a4_01_step2_anon_reads_only_the_public_point.sql; PROBE_OK against live that day.
-- A signed-out caller never reads an exact point. anon cannot
-- select the exact columns of listings, accommodations, businesses or
-- catalogue_entries, cannot call the exact search bodies, and the public
-- search functions hand anon points rounded to two decimals and distances
-- rounded to 500 m. A signed-in member still gets the exact point, and an
-- owner can still take a live listing back to a draft (the generated columns
-- do not trip the owner-write guard).
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
  -- A live listing at a known exact point, for the comparisons below.
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-new-a4-01-step2-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe NEW-A4-01 lister') returning id into agent;
  insert into public.listings (id, agent_id, title, property_type, status, listing_role, listing_intent,
                               rent_amount_minor, rent_period, latitude, longitude, state_code, city, area)
  values (lid, agent, 'Probe NEW-A4-01', 'apartment', 'PUBLISHED', 'agent', 'rent',
          150000000, 'year', 6.51234, 3.38765, 'LA', 'Lagos', 'Yaba');

  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  foreach t in array array['listings', 'accommodations', 'businesses', 'catalogue_entries'] loop
    begin
      execute format('select count(latitude) from public.%I', t) into n;
      raise exception 'PROBE_FAIL new-a4-01: anon read %.latitude', t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('select count(location) from public.%I', t) into n;
      raise exception 'PROBE_FAIL new-a4-01: anon read %.location', t;
    exception when insufficient_privilege then null; end;
    -- CONTROL: the public point reads.
    execute format('select count(latitude_public) from public.%I', t) into n;
  end loop;

  select latitude_public, longitude_public into r from public.listings where id = lid;
  if r.latitude_public <> 6.51 or r.longitude_public <> 3.39 then
    raise exception 'PROBE_FAIL new-a4-01: public point is %', row_to_json(r);
  end if;

  -- CONTROL: the canary's signed-out card read shape (public point aliased).
  perform id, latitude_public, longitude_public from public.listings where status = 'PUBLISHED' limit 1;

  begin
    perform * from public.listings_in_bounds_exact(3.0, 6.0, 4.0, 7.0);
    raise exception 'PROBE_FAIL new-a4-01: anon called the exact map body';
  exception when insufficient_privilege then null; end;

  -- The map as anon: coarse.
  select latitude, longitude into r from public.listings_in_bounds(3.0, 6.0, 4.0, 7.0) where id = lid;
  if r.latitude is distinct from 6.51 or r.longitude is distinct from 3.39 then
    raise exception 'PROBE_FAIL new-a4-01: anon map point is %', row_to_json(r);
  end if;

  -- Distances as anon: 500 m steps, so a moving origin cannot triangulate.
  select count(*) filter (where distance_m is not null and mod(distance_m::numeric, 500) <> 0) into bad
    from public.comparable_listings(6.5125, 3.3877, 'apartment', 'rent', null, 5000, 3650, null, 200);
  if bad > 0 then raise exception 'PROBE_FAIL new-a4-01: anon comparable distance not rounded (% rows)', bad; end if;
  select count(*) filter (where distance_m is not null and mod(distance_m::numeric, 500) <> 0),
         count(*) filter (where distance_m is not null)
    into bad, n
    from public.stays_search(p_lat => 6.5125, p_lng => 3.3877, p_sort => 'distance', p_limit => 200);
  if bad > 0 then raise exception 'PROBE_FAIL new-a4-01: anon stays distance not rounded (% rows)', bad; end if;
  if n = 0 then raise exception 'PROBE_FAIL new-a4-01: anon stays search returned no distance to check'; end if;
  perform * from public.comparable_supply_near(6.5125, 3.3877, 'apartment', 'rent', null, 3000);
  perform * from public.area_supply_census('LA', 'Lagos', 'Yaba', 'rent');

  -- CONTROL: a signed-in member still gets the exact point.
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  select latitude, longitude into r from public.listings_in_bounds(3.0, 6.0, 4.0, 7.0) where id = lid;
  if r.latitude is distinct from 6.51234 then
    raise exception 'PROBE_FAIL new-a4-01: member map point is %', row_to_json(r);
  end if;

  -- CONTROL: the owner takes the live listing back to a draft.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  update public.listings set status = 'DRAFT' where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a4-01: owner unpublish rows=%', n; end if;

  raise exception 'PROBE_OK new-a4-01-step2';
end
$$;
