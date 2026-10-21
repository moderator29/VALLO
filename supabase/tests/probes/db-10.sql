-- DB-10 STEP 1 (live now): the owners' and staff's door to the private
-- columns. The lister (and staff) read a listing's address, landmark and
-- reviewer note through listing_private_fields; a business owner (and staff)
-- read its contact, registration and tier through business_private_fields;
-- anyone else gets no row, a call takes at most 500 ids, and anon cannot
-- call either. The step 2 probe
-- (authenticated loses the columns on the tables) is
-- tests/pending/db-10-step2.sql.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  agent uuid;
  lid uuid := gen_random_uuid();
  biz uuid;
  n int;
  r record;
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
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-10-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-10 lister') returning id into agent;
  insert into public.listings (id, agent_id, title, property_type, status, listing_role, address, landmark, review_notes)
  values (lid, agent, 'Probe DB-10', 'apartment', 'DRAFT', 'agent', '12 Probe Close', 'By the probe', 'probe note');
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate, and a mandate needs its listing to exist, so the
  -- fixture is filed as a draft, given a mandate as the platform would, then
  -- published.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  values (lid, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now());
  update public.listings set status = 'PUBLISHED' where id = lid;
  insert into public.businesses (owner_id, kind, name, slug, status, tin, cac_number, representative_phone)
  values (member, 'hotel', 'Probe DB-10 hotel', 'probe-db10-' || gen_random_uuid(), 'PUBLISHED', '12345678-0001', 'RC123456', '+2348031234567')
  returning id into biz;

  set local role authenticated;

  -- The lister and the owner read their own private fields.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select * into r from public.listing_private_fields(array[lid]);
  if r.address is distinct from '12 Probe Close' or r.review_notes is distinct from 'probe note' then
    raise exception 'PROBE_FAIL db-10: lister private read %', row_to_json(r);
  end if;
  select * into r from public.business_private_fields(array[biz]);
  if r.tin is distinct from '12345678-0001' then
    raise exception 'PROBE_FAIL db-10: owner private read %', row_to_json(r);
  end if;

  -- Staff read them too.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.listing_private_fields(array[lid]);
  if n <> 1 then raise exception 'PROBE_FAIL db-10: staff listing private rows=%', n; end if;
  select count(*) into n from public.business_private_fields(array[biz]);
  if n <> 1 then raise exception 'PROBE_FAIL db-10: staff business private rows=%', n; end if;

  -- Any other member gets nothing through the door.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.listing_private_fields(array[lid]);
  if n <> 0 then raise exception 'PROBE_FAIL db-10: stranger listing private rows=%', n; end if;
  select count(*) into n from public.business_private_fields(array[biz]);
  if n <> 0 then raise exception 'PROBE_FAIL db-10: stranger business private rows=%', n; end if;

  -- More than 500 ids in one call is refused.
  begin
    perform * from public.listing_private_fields(array(select gen_random_uuid() from generate_series(1, 501)));
    raise exception 'PROBE_FAIL db-10: 501 ids accepted';
  exception when invalid_parameter_value then null; end;

  -- anon cannot call it at all.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform * from public.listing_private_fields(array[lid]);
    raise exception 'PROBE_FAIL db-10: anon called listing_private_fields';
  exception when insufficient_privilege then null; end;

  raise exception 'PROBE_OK db-10';
end
$$;
