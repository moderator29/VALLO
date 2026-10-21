-- S1 (29 September 2026): with DB-10 step 2 live, a member reads only the
-- public columns of listings, businesses and accommodations. The first time
-- it went live today it was rolled back because four probes read whole rows
-- as the member; this probe is the guard that the narrowing never again
-- breaks an owner saving their own place, and never again leaks:
--
--  OWNERS STILL WORK, in the exact statements the app sends through
--  PostgREST (a data-modifying CTE whose RETURNING names only the selected
--  columns; an update with no RETURNING):
--   * an agent creates a listing with its address and landmark
--     (saveDraft: `.insert(...).select("id, status")`), edits it, reads its
--     public columns, reads its private ones back through
--     listing_private_fields and its exact place through
--     listing_exact_location, and deletes the draft;
--   * a host creates a business with phone, email, address and CAC number
--     (saveHostDraft: `.insert(...).select("id, status")`), edits them, and
--     reads them back through business_private_fields;
--   * the host creates a property with its address and pin
--     (`.insert(...).select("id")`) and edits it.
--  NOBODY ELSE READS THEM:
--   * a stranger (any signed-in account) is refused every private column and
--     the exact point, and the definers answer them with no row;
--   * the owner's own client is refused them too (the app never asks: it
--     goes through the definers), and `select *` is refused outright.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  agent uuid;
  lid uuid;
  biz uuid;
  acc uuid;
  st text;
  n int;
  r record;
  col text;
begin
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-s1-owner-writes-keep-working-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe S1 lister') returning id into agent;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);

  -- The listing: saveDraft's first save, exactly as PostgREST sends it.
  begin
    with pgrst_source as (
      insert into public.listings (title, description, property_type, listing_intent, state_code, city, area,
        address, landmark, bedrooms, bathrooms, rent_amount_minor, rent_period, agent_id, status)
      values ('Probe S1 flat', 'Probe', 'apartment', 'rent', 'LA', 'Lagos', 'Yaba',
        '1 Probe Street', 'Opposite the probe', 2, 2, 150000000, 'year', agent, 'DRAFT')
      returning public.listings.id, public.listings.status
    )
    select id, status::text into lid, st from pgrst_source;
  exception when others then
    raise exception 'PROBE_FAIL s1: owner listing create refused: % %', sqlstate, sqlerrm;
  end;
  if lid is null or st <> 'DRAFT' then raise exception 'PROBE_FAIL s1: listing create returned %/%', lid, st; end if;

  -- The step saves: the address, then the pin (writeListing / the map step).
  update public.listings set address = '2 Probe Street', landmark = 'Beside the probe', description = 'Edited'
   where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL s1: owner listing edit rows=%', n; end if;
  update public.listings set latitude = 6.51234, longitude = 3.38765 where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL s1: owner listing pin rows=%', n; end if;

  -- The owner's reads: public columns directly, private ones through the definers.
  select id, status::text as status, title, latitude_public, ownership_verified_at into r from public.listings where id = lid;
  if r.id is null or r.latitude_public <> 6.51 then raise exception 'PROBE_FAIL s1: owner public read %', row_to_json(r); end if;
  select address, landmark into r from public.listing_private_fields(array[lid]);
  if r.address is distinct from '2 Probe Street' or r.landmark is distinct from 'Beside the probe' then
    raise exception 'PROBE_FAIL s1: owner private read %', row_to_json(r);
  end if;
  select latitude, why into r from public.listing_exact_location(lid);
  if r.latitude is distinct from 6.51234 or r.why is distinct from 'lister' then
    raise exception 'PROBE_FAIL s1: owner exact place %', row_to_json(r);
  end if;

  -- The business: saveHostDraft's first save, then the contact step.
  begin
    with pgrst_source as (
      insert into public.businesses (owner_id, source, status, kind, name, slug, phone, email, address, cac_number)
      values (member, 'first_party', 'DRAFT', 'hotel', 'Probe S1 hotel', 'probe-s1-' || gen_random_uuid(),
        '+2348031234567', 'probe-s1@example.com', '3 Probe Close', 'RC 1234567')
      returning public.businesses.id, public.businesses.status
    )
    select id, status::text into biz, st from pgrst_source;
  exception when others then
    raise exception 'PROBE_FAIL s1: owner business create refused: % %', sqlstate, sqlerrm;
  end;
  if biz is null or st <> 'DRAFT' then raise exception 'PROBE_FAIL s1: business create returned %/%', biz, st; end if;
  update public.businesses set phone = '+2348039876543', address = '4 Probe Close', tin = '12345678-0001' where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL s1: owner business edit rows=%', n; end if;
  select phone, address, tin into r from public.business_private_fields(array[biz]);
  if r.phone is distinct from '+2348039876543' or r.address is distinct from '4 Probe Close' or r.tin is distinct from '12345678-0001' then
    raise exception 'PROBE_FAIL s1: owner business private read %', row_to_json(r);
  end if;

  -- The property: saveAccommodationDraft's first save and an edit.
  begin
    with pgrst_source as (
      insert into public.accommodations (business_id, name, slug, status, address, latitude, longitude)
      values (biz, 'Probe S1 property', 'probe-s1-a-' || gen_random_uuid(), 'DRAFT', '5 Probe Close', 6.5, 3.4)
      returning public.accommodations.id
    )
    select id into acc from pgrst_source;
  exception when others then
    raise exception 'PROBE_FAIL s1: owner property create refused: % %', sqlstate, sqlerrm;
  end;
  update public.accommodations set address = '6 Probe Close', description = 'Edited' where id = acc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL s1: owner property edit rows=%', n; end if;

  -- The owner's own client is refused the private columns and `*` too.
  begin
    select address into r from public.listings where id = lid;
    raise exception 'PROBE_FAIL s1: a member selected listings.address';
  exception when insufficient_privilege then null; end;
  begin
    select * into r from public.businesses where id = biz;
    raise exception 'PROBE_FAIL s1: a member selected * from businesses';
  exception when insufficient_privilege then null; end;

  -- A stranger: no private column, no exact point, nothing from the definers.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  foreach col in array array['address', 'landmark', 'review_notes', 'reviewer_id', 'latitude', 'longitude', 'location'] loop
    begin
      execute format('select count(%I) from public.listings', col) into n;
      raise exception 'PROBE_FAIL s1: a member read listings.%', col;
    exception when insufficient_privilege then null; end;
  end loop;
  foreach col in array array['address', 'phone', 'email', 'cac_number', 'tin', 'registered_name',
                             'representative_name', 'representative_phone', 'review_notes', 'verification_tier'] loop
    begin
      execute format('select count(%I) from public.businesses', col) into n;
      raise exception 'PROBE_FAIL s1: a member read businesses.%', col;
    exception when insufficient_privilege then null; end;
  end loop;
  foreach col in array array['address', 'review_notes', 'latitude'] loop
    begin
      execute format('select count(%I) from public.accommodations', col) into n;
      raise exception 'PROBE_FAIL s1: a member read accommodations.%', col;
    exception when insufficient_privilege then null; end;
  end loop;
  select count(*) into n from public.listing_private_fields(array[lid]);
  if n <> 0 then raise exception 'PROBE_FAIL s1: a stranger read the listing''s private fields'; end if;
  select count(*) into n from public.business_private_fields(array[biz]);
  if n <> 0 then raise exception 'PROBE_FAIL s1: a stranger read the business''s private fields'; end if;
  select count(*) into n from public.listing_exact_location(lid);
  if n <> 0 then raise exception 'PROBE_FAIL s1: a stranger read the exact place'; end if;
  -- CONTROL: the public columns and the public point still read.
  select count(*) into n from (select id, title, status, latitude_public, longitude_public, ownership_verified_at from public.listings) s;
  select count(*) into n from (select id, name, kind, status, latitude_public from public.businesses) s;

  -- The lister deletes their own draft (deleteListing).
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  delete from public.listings where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL s1: owner delete own draft rows=%', n; end if;

  raise exception 'PROBE_OK s1-owner-writes-keep-working';
end
$$;
