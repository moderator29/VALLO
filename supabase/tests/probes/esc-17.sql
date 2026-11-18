-- ESC-17: "today" for a move-in date and for an account's active bookings is
-- the Lagos date, whatever the session's TimeZone. Between them, the two
-- session zones below disagree with Lagos about the date at every hour of the
-- UTC day, so a body that reads current_date fails one of them. Rolls back.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  stay constant uuid := gen_random_uuid();
  lister constant uuid := gen_random_uuid();   -- host, filed below
  lister_agent uuid;
  lagos_today constant date := (now() at time zone 'Africa/Lagos')::date;
  r jsonb; bk uuid; before_n int; after_n int;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay). All of
  -- it is rolled back with the probe. Nothing asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-esc-17-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe esc-17 host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- A confirmed stay that checked out yesterday in Lagos does not hold the
  -- account open. Bookings cannot be made in the past, so it is moved back
  -- with triggers set aside for that one update (no table lock).
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = stay and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id = stay;
  set local timezone = 'Etc/GMT+12';
  before_n := (private.deletion_money_blockers(member) ->> 'active_bookings')::int;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos_today + 200, lagos_today + 202, 2, 1, 2, 2, 'CONFIRMED') returning id into bk;
  set local session_replication_role = replica;
  update public.bookings set check_in = lagos_today - 3, check_out = lagos_today - 1 where id = bk;
  set local session_replication_role = origin;
  after_n := (private.deletion_money_blockers(member) ->> 'active_bookings')::int;
  if after_n <> before_n then
    raise exception 'PROBE_FAIL esc-17: a stay that checked out yesterday in Lagos still blocks deletion (session zone UTC-12)';
  end if;

  -- Twelve hours behind UTC: yesterday in Lagos is in the past.
  set local timezone = 'Etc/GMT+12';
  r := private.open_rent_charge(gen_random_uuid(), gen_random_uuid(), lagos_today - 1);
  if r ->> 'status' <> 'move_in_past' then
    raise exception 'PROBE_FAIL esc-17: yesterday in Lagos was %, not move_in_past (session zone UTC-12)', r ->> 'status';
  end if;

  -- Fourteen hours ahead of UTC: today in Lagos is not in the past.
  set local timezone = 'Pacific/Kiritimati';
  r := private.open_rent_charge(gen_random_uuid(), gen_random_uuid(), lagos_today);
  if r ->> 'status' = 'move_in_past' then
    raise exception 'PROBE_FAIL esc-17: today in Lagos was refused as move_in_past (session zone UTC+14)';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname, p.proname) in (('private', 'open_rent_charge'), ('private', 'deletion_money_blockers'))
       and p.prosrc ilike '%current_date%'
  ) then
    raise exception 'PROBE_FAIL esc-17: a money body still reads current_date';
  end if;

  raise exception 'PROBE_OK esc-17';
end $$;
