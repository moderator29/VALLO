-- DB-02: an approved lister cannot publish, feature or stamp their own
-- listing; the wizard's own steps (draft, edit, submit, unpublish, delete a
-- draft) still work; an admin reviewing through their own signed-in client
-- still approves, publishes and stamps.
--
-- A throwaway account is made an ordinary, unverified agent inside the transaction,
-- exactly as an approved application does (the agents row is written by the
-- service role on approval), so the probe needs no standing agent.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  agent uuid;
  lid uuid := gen_random_uuid();
  forged uuid := gen_random_uuid();
  n int;
  r record;
  attack text;
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
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-02-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-02 lister')
  returning id into agent;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: the wizard's first save shape (lib/agent/listings-actions.ts
  -- saveDraft), without RETURNING so this probe does not depend on DB-03.
  insert into public.listings (id, agent_id, status, title, description, property_type, listing_intent,
    state_code, city, area, bedrooms, bathrooms, rent_amount_minor, rent_period)
  values (lid, agent, 'DRAFT', 'Probe DB-02 flat', 'Probe', 'apartment', 'rent',
    'LA', 'Lagos', 'Yaba', 2, 2, 150000000, 'year');
  select count(*) into n from public.listings where id = lid;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner cannot read back own draft (rows=%)', n; end if;

  -- REFUSAL: a listing created straight into PUBLISHED with every stamp.
  begin
    insert into public.listings (agent_id, title, property_type, status, state_code, city, featured,
      physically_inspected_at, address_verified_at, verified_by, published_at, reviewed_at)
    values (agent, 'Probe DB-02 forged', 'apartment', 'PUBLISHED', 'LA', 'Lagos', true,
      now(), now(), member, now(), now());
    raise exception 'PROBE_FAIL db-02: owner inserted a PUBLISHED listing';
  exception when insufficient_privilege then null;
  end;

  -- REFUSAL: a firm attached by the lister.
  begin
    insert into public.listings (agent_id, title, property_type, status, firm_id)
    values (agent, 'Probe DB-02 firm', 'apartment', 'DRAFT', gen_random_uuid());
    raise exception 'PROBE_FAIL db-02: owner attached a firm';
  exception when insufficient_privilege then null;
  end;

  -- A draft that carries stamps keeps none of them.
  insert into public.listings (id, agent_id, title, property_type, status, featured,
    physically_inspected_at, address_verified_at, verified_by, reviewed_at, reviewer_id, listing_fee_charged_at)
  values (forged, agent, 'Probe DB-02 stamped draft', 'apartment', 'DRAFT', true,
    now(), now(), member, now(), member, now());
  -- Read as the service role: a member no longer selects moderator columns
  -- (DB-10 step 2); what matters is what was stored.
  reset role;
  select featured, physically_inspected_at, address_verified_at, verified_by, reviewed_at, reviewer_id,
         listing_fee_charged_at, listing_role::text as role
    into r from public.listings where id = forged;
  set local role authenticated;
  if r.featured or r.physically_inspected_at is not null or r.address_verified_at is not null
     or r.verified_by is not null or r.reviewed_at is not null or r.reviewer_id is not null
     or r.listing_fee_charged_at is not null or r.role is distinct from 'agent' then
    raise exception 'PROBE_FAIL db-02: stamped draft kept a moderator column: %', row_to_json(r);
  end if;

  -- REFUSALS: every moderator column and every forbidden status on update.
  foreach attack in array array[
    'featured = true',
    'physically_inspected_at = now(), verified_by = ''957b3bd2-cce3-425d-bba9-5cd876ca3d62''',
    'address_verified_at = now(), verified_by = ''957b3bd2-cce3-425d-bba9-5cd876ca3d62''',
    'mandate_verified_at = now(), supply_verified_by = ''957b3bd2-cce3-425d-bba9-5cd876ca3d62''',
    'ownership_verified_at = now(), supply_verified_by = ''957b3bd2-cce3-425d-bba9-5cd876ca3d62''',
    'listing_fee_minor = 0, listing_fee_charged_at = now()',
    'published_at = now()',
    'reviewer_id = ''957b3bd2-cce3-425d-bba9-5cd876ca3d62'', reviewed_at = now()',
    'review_notes = ''approved''',
    'is_demo = true',
    'reference = ''VL-PROBE1''',
    'listing_role = ''owner''',
    'status = ''PUBLISHED''',
    'status = ''APPROVED''',
    'status = ''UNDER_REVIEW'''
  ] loop
    begin
      execute format('update public.listings set %s where id = %L', attack, lid);
      raise exception 'PROBE_FAIL db-02: owner update accepted: %', attack;
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- CONTROL: descriptive edit, then submit (submitListing).
  update public.listings set description = 'Probe edit', rent_negotiable = true where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner edit rows=%', n; end if;
  update public.listings set status = 'SUBMITTED', submitted_at = now() where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner submit rows=%', n; end if;

  -- REFUSAL: content edits once it is with the reviewers.
  begin update public.listings set description = 'changed after submit' where id = lid;
    raise exception 'PROBE_FAIL db-02: owner edited a submitted listing';
  exception when insufficient_privilege then null; end;

  -- CONTROL: somebody else cannot touch it.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.listings set description = 'stranger' where id = lid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL db-02: stranger update rows=%', n; end if;

  -- SCUML item 17 (live 29 Sep): an agent listing is published only on an
  -- approved mandate. It is filed here as the platform files it, outside the
  -- API role, and the admin's publish below is then the real review path.
  reset role;
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = lid and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  set local role authenticated;
  -- CONTROL: the admin review (lib/admin/actions.ts) as authenticated.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.listings set status = 'APPROVED', reviewer_id = admin, reviewed_at = now(), review_notes = 'probe'
   where id = lid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: admin approve rows=%', n; end if;
  -- 29 September 2026: `featured` is no longer set by anybody, staff included
  -- (v06, no paid placement; the check listings_featured_is_never_set), so
  -- the admin's decision stamps the review and the checks, never featured.
  update public.listings set status = 'PUBLISHED', reviewer_id = admin, reviewed_at = now(), published_at = now(),
         physically_inspected_at = now(), address_verified_at = now(), verified_by = admin
   where id = lid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: admin publish rows=%', n; end if;
  select status::text as status, featured, physically_inspected_at into r from public.listings where id = lid;
  if r.status <> 'PUBLISHED' or r.featured or r.physically_inspected_at is null then
    raise exception 'PROBE_FAIL db-02: admin decision did not land: %', row_to_json(r);
  end if;

  -- REFUSALS: the owner rewrites or reprices the live listing, or deletes it.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    update public.listings set title = 'Pay the caution to 0123456789 GTB', description = 'transfer first',
           rent_amount_minor = 1 where id = lid;
    raise exception 'PROBE_FAIL db-02: owner rewrote a live listing';
  exception when insufficient_privilege then null; end;
  begin delete from public.listings where id = lid;
    raise exception 'PROBE_FAIL db-02: owner deleted a live listing';
  exception when insufficient_privilege then null; end;

  -- CONTROL: the owner unpublishes (unpublishListing), edits the draft again,
  -- and deletes a draft.
  update public.listings set status = 'DRAFT' where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner unpublish rows=%', n; end if;
  update public.listings set description = 'edited as a draft again' where id = lid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner edit after unpublish rows=%', n; end if;
  delete from public.listings where id = forged and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-02: owner delete draft rows=%', n; end if;

  raise exception 'PROBE_OK db-02';
end
$$;
