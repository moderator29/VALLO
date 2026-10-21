-- DB-03 (with SUP-01): an agent's first save of a listing, in the exact
-- shape PostgREST sends for `.insert({...}).select("id, status").single()`
-- (a data-modifying CTE whose RETURNING names only the selected columns:
-- PostgREST never sends `RETURNING *`, and a member cannot select every
-- column since DB-10 step 2), must succeed. Strangers still see
-- and change nothing; a firm member sees the firm's listing without 42P17.
--
-- A throwaway account is made an ordinary agent inside the transaction, as an
-- approved application does (service role writes the agents row); a second
-- throwaway account stands in as the agent who is the firm's principal.
do $$
declare
  member constant uuid := gen_random_uuid(); -- throwaway accounts, see the 17 October 2026 note below
  other constant uuid := gen_random_uuid();
  agent uuid;
  other_agent uuid;
  firm uuid;
  firm_listing uuid := gen_random_uuid();
  lid uuid;
  st text;
  n int;
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
  -- anything was asserted. The lister and the principal are throwaway accounts
  -- made here, ordinary accounts with no agents row exactly as the QA member
  -- and admin were when this probe was written, rolled back with everything
  -- else. Nothing here needed the principal to be staff.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-03-lister-' || member || '@example.invalid', '{}', '{}', now(), now()),
         (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-03-principal-' || other || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-03 lister') returning id into agent;
  insert into public.agents (user_id, display_name) values (other, 'Probe DB-03 principal') returning id into other_agent;
  insert into public.businesses (owner_id, kind, name, slug, status)
  values (other, 'agency', 'Probe DB-03 firm', 'probe-db03-' || gen_random_uuid(), 'DRAFT') returning id into firm;
  insert into public.firm_members (firm_id, agent_id, member_role, status)
  values (firm, other_agent, 'principal', 'active'), (firm, agent, 'staff', 'active');
  insert into public.listings (id, agent_id, title, property_type, status, firm_id, listing_role)
  values (firm_listing, other_agent, 'Probe DB-03 firm listing', 'apartment', 'DRAFT', firm, 'firm');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- The app path: saveDraft's column set plus agent_id and status, RETURNING.
  -- supabase-js drops undefined keys, so only the columns a rent draft
  -- carries are named.
  begin
    with pgrst_source as (
      insert into public.listings (title, description, property_type, listing_intent, state_code, city, area,
        address, landmark, bedrooms, bathrooms, toilets, parking_spaces, floor, total_floors, size_sqm,
        rent_amount_minor, rent_period, rent_negotiable, caution_deposit_minor, service_charge_minor,
        service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor,
        minimum_tenancy_months, available_from, price_negotiable,
        power_backup, prepaid_meter, agent_id, status)
      values ('Probe DB-03 flat', 'Probe', 'apartment', 'rent', 'LA', 'Lagos', 'Yaba',
        '1 Probe Street', 'Near the probe', 2, 2, 2, 1, 1, 3, 80,
        150000000, 'year', true, 15000000, 5000000,
        'year', 15000000, 10000000, 5000000, 200000000,
        12, current_date, false,
        'NONE', true, agent, 'DRAFT')
      returning public.listings.id, public.listings.status
    )
    select id, status::text into lid, st from pgrst_source;
  exception when others then
    raise exception 'PROBE_FAIL db-03: app insert...returning refused: % %', sqlstate, sqlerrm;
  end;
  if lid is null or st <> 'DRAFT' then raise exception 'PROBE_FAIL db-03: returned %/%', lid, st; end if;

  -- The follow-up step save (update, no returning) and the owner's reads.
  update public.listings set description = 'Probe step two' where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-03: owner step save rows=%', n; end if;
  select count(*) into n from public.listings where agent_id = agent;
  if n <> 1 then raise exception 'PROBE_FAIL db-03: owner sees own rows=%', n; end if;

  -- A firm member sees the firm's draft (and no 42P17 on the way).
  begin
    select count(*) into n from public.listings where id = firm_listing;
  exception when others then
    raise exception 'PROBE_FAIL db-03: firm listing read: % %', sqlstate, sqlerrm;
  end;
  if n <> 1 then raise exception 'PROBE_FAIL db-03: firm member sees firm draft rows=%', n; end if;
  -- ...but cannot rewrite it (WITH CHECK is the lister only).
  -- Refused either way: 0 rows under the lister-only write policy, or 42501
  -- from a WITH CHECK.
  begin
    update public.listings set title = 'hijack' where id = firm_listing;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'PROBE_FAIL db-03: firm staff rewrote the principal''s listing rows=%', n; end if;
  exception when insufficient_privilege then null;
  end;

  -- ...nor delete it (DELETE has no WITH CHECK, so only a write policy
  -- keyed on the lister stops it).
  delete from public.listings where id = firm_listing;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL db-03: firm staff deleted the principal''s listing rows=%', n; end if;

  -- REFUSAL: inserting for somebody else's agent id.
  begin
    insert into public.listings (agent_id, title, property_type, status) values (other_agent, 'x', 'apartment', 'DRAFT');
    raise exception 'PROBE_FAIL db-03: insert for another agent accepted';
  exception when insufficient_privilege then null;
  end;

  -- CONTROL: a stranger sees and changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.listings where id in (lid, firm_listing);
  if n <> 0 then raise exception 'PROBE_FAIL db-03: stranger sees drafts rows=%', n; end if;
  update public.listings set title = 'stranger' where id = lid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL db-03: stranger update rows=%', n; end if;

  -- CONTROL: the lister deletes their own draft (deleteListing).
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  delete from public.listings where id = lid and agent_id = agent;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-03: owner delete own draft rows=%', n; end if;

  raise exception 'PROBE_OK db-03';
end
$$;
