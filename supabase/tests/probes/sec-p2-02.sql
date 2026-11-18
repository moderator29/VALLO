-- SEC-P2-02: a member opens a listing thread only as its guest, only with the
-- lister of a published listing, and at most 20 new listing threads a day.
-- Reservation and booking threads, and service-role writes, are unchanged.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin_id constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  l_id uuid;
  lister uuid := gen_random_uuid();   -- filed below
  lister_agent uuid;
  other_listing uuid;
  second_listing uuid := gen_random_uuid();
  i int;
  refused text;
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
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: two flats to rent in Lekki Phase 1, both
  -- published by the one fresh lister, so the daily limit has a second listing
  -- by the same lister to try. All of it is rolled back with the probe. Nothing
  -- asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-sec-p2-02-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe sec-p2-02 host', 'business', 'APPROVED')
  returning id into lister_agent;
  l_id := gen_random_uuid();
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rent_amount_minor, rent_period, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, listing_role)
  values (l_id, lister_agent, 'DRAFT', 'Probe Three bedroom flat in Lekki Phase 1', 'Third floor of a six storey block on a quiet crescent. Fitted kitchen, en suite to two rooms, and a shared generator that runs to midnight.', 'apartment', 'LA', 'Lagos', 'Lekki Phase 1', 6.4441, 3.4712, 3, 3, 4, 'semi_furnished', 'rent', 850000000, 'year', 170000000, 45000000, 'year', 85000000, 85000000, 42500000, 1232500000, 12, 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rent_amount_minor, rent_period, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, listing_role)
  values (second_listing, lister_agent, 'DRAFT', 'Probe Two bedroom flat in Lekki Phase 1', 'Ground floor with its own entrance and a small yard. Unfurnished, borehole to an overhead tank.', 'apartment', 'LA', 'Lagos', 'Lekki Phase 1', 6.4389, 3.4685, 2, 2, 3, 'unfurnished', 'rent', 550000000, 'year', 110000000, 30000000, 'year', 55000000, 55000000, 27500000, 797500000, 12, 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (l_id, second_listing) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (l_id, second_listing);
  -- A published listing the member has no thread on, and a second published
  -- listing by a different lister (or no second lister: the mismatch then
  -- uses the admin as a counterpart who lists nothing).
  -- (16 November 2026: the fixture's first listing and its lister, above.)
  select l.id, a.user_id into l_id, lister
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.id = l_id and l.status = 'PUBLISHED' and a.user_id not in (member, admin_id)
     and not exists (select 1 from public.conversations c where c.guest_id = member and c.listing_id = l.id);
  if l_id is null then raise exception 'PROBE_FAIL sec-p2-02: no published listing to test against'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: what startConversation writes still succeeds.
  insert into public.conversations (guest_id, agent_id, listing_id) values (member, lister, l_id);

  -- REFUSAL 1: a thread with an arbitrary user and no listing (the audit's T2).
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id) values (member, admin_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a thread with an arbitrary user and no listing was created (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 2: a real listing, but the counterpart is not its lister.
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (member, admin_id, l_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a thread on a listing was opened with someone who does not list it (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 3: the lister cannot open a listing thread on a guest's behalf.
  perform set_config('request.jwt.claims', json_build_object('sub', lister, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (admin_id, lister, l_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a lister opened a thread in a guest''s name (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 4: the daily limit. Nineteen more listing threads today (written
  -- as the service would, so they are not themselves checked) make 20; the
  -- 21st, as the member, is refused.
  reset role;
  perform set_config('request.jwt.claims', '', true);
  for i in 1..19 loop
    insert into public.conversations (guest_id, agent_id) values (member, admin_id);
  end loop;
  select l.id into other_listing
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.status = 'PUBLISHED' and a.user_id = lister and l.id <> l_id
     and not exists (select 1 from public.conversations c where c.guest_id = member and c.listing_id = l.id)
   limit 1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  if other_listing is null then
    raise exception 'PROBE_FAIL sec-p2-02: no second published listing by the same lister, so the daily limit cannot be tested';
  end if;
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (member, lister, other_listing);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '54000' then
    raise exception 'PROBE_FAIL sec-p2-02: the 21st listing thread today was not refused by the daily limit (%)', coalesce(refused, 'created');
  end if;

  raise exception 'PROBE_OK sec-p2-02: listing threads need the published listing''s lister and the caller as guest (23514), and the 21st in a day is refused (54000)';
end;
$$;
