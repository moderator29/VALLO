-- DB-10 STEP 2 probe. Step 2 was applied on 2026-09-24, after the release deployed,
-- as 20260924070725_db10_step2_signed_in_members_read_only_the_public_columns.sql; PROBE_OK against live that day.
-- A signed-in member who is not the lister, owner or staff cannot read the
-- private columns from the tables; the lister's and owner's own screens and
-- writes still work (the public read plus the definer door; the wizard's
-- insert...returning; the host's first save and edit).
-- 9 November 2026: brought up to the rules of 20260929110457 (private
-- columns and exact points stay private), which tightened what this probe was
-- written against: a signed-in member reads the public point
-- (latitude_public, longitude_public), never the exact one, and staff act on a
-- session that proved the console's second factor. Its sibling probe was
-- updated on 29 September; this one joined the run on 13 October unchanged.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  agent uuid;
  lid uuid := gen_random_uuid();
  newid uuid;
  st text;
  biz uuid;
  n int;
  col text;
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
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-10-step2-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-10 lister') returning id into agent;
  insert into public.listings (id, agent_id, title, property_type, status, listing_role, address, landmark, review_notes)
  values (lid, agent, 'Probe DB-10', 'apartment', 'DRAFT', 'agent', '12 Probe Close', 'By the probe', 'probe note');
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate, and a mandate needs its listing to exist, so the
  -- fixture is filed as a draft, given a mandate as the platform would, then
  -- published (the same fixture db-10 and new-a4-01 use; this step-2 probe
  -- missed the change because it joined the run on 13 October).
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  values (lid, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now());
  update public.listings set status = 'PUBLISHED' where id = lid;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);

  -- REFUSALS: a stranger member reads no private column from any table.
  foreach col in array array['address', 'landmark', 'review_notes', 'reviewer_id'] loop
    begin
      execute format('select count(%I) from public.listings', col) into n;
      raise exception 'PROBE_FAIL db-10: member read listings.%', col;
    exception when insufficient_privilege then null; end;
  end loop;
  foreach col in array array['tin', 'cac_number', 'representative_phone', 'phone', 'email', 'address'] loop
    begin
      execute format('select count(%I) from public.businesses', col) into n;
      raise exception 'PROBE_FAIL db-10: member read businesses.%', col;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    execute 'select count(address) from public.accommodations' into n;
    raise exception 'PROBE_FAIL db-10: member read accommodations.address';
  exception when insufficient_privilege then null; end;
  -- CONTROL: the public columns read.
  select count(*) into n from (select id, title, area, city, latitude_public, longitude_public from public.listings where status = 'PUBLISHED') s;

  -- CONTROL: the lister's wizard insert...returning and the step save.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  with pgrst_source as (
    insert into public.listings (title, property_type, address, landmark, agent_id, status)
    values ('Probe DB-10 draft', 'apartment', '1 Draft Road', 'Near', agent, 'DRAFT')
    returning public.listings.id, public.listings.status
  ) select id, status::text into newid, st from pgrst_source;
  if st <> 'DRAFT' then raise exception 'PROBE_FAIL db-10: wizard insert returned %', st; end if;
  update public.listings set address = '2 Draft Road' where id = newid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-10: wizard step save rows=%', n; end if;
  select * into r from public.listing_private_fields(array[newid]);
  if r.address is distinct from '2 Draft Road' then raise exception 'PROBE_FAIL db-10: lister read back %', row_to_json(r); end if;

  -- CONTROL: the host's first save and an edit of a private field.
  with pgrst_source as (
    insert into public.businesses (owner_id, source, status, kind, name, slug, phone, tin)
    values (member, 'first_party', 'DRAFT', 'hotel', 'Probe DB-10 hotel', 'probe-db10-' || gen_random_uuid(), '+2348031234567', '12345678-0001')
    returning public.businesses.id, public.businesses.status
  ) select id into biz from pgrst_source;
  update public.businesses set tin = '12345678-0002', description = 'x' where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-10: host edit rows=%', n; end if;
  select * into r from public.business_private_fields(array[biz]);
  if r.tin is distinct from '12345678-0002' then raise exception 'PROBE_FAIL db-10: owner read back %', row_to_json(r); end if;

  -- CONTROL: staff decide through their own client (DB-01's admin path).
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.businesses set status = 'PUBLISHED', verification_tier = 1, reviewer_id = admin, published_at = now()
   where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-10: admin decision rows=%', n; end if;

  raise exception 'PROBE_OK db-10-step2';
end
$$;
