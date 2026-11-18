-- CHARGEBACKS DESK (track/chargebacks, cb01): the timeline and the evidence
-- note are finance staff's only (a stranger and a plain member are refused, an
-- admin whose session proved its key reads and writes); a note is an
-- append-only event of kind `note` written in the current state, with an
-- audit row, and a short note is refused; the lister's own hold view says
-- held only for a LOST chargeback still owed, with the owed total net of what
-- was recovered, never for an undecided one (counted as open instead), and a
-- signed-out caller reads nothing. Everything is rolled back by the final
-- raise.
do $$
declare
  lister uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  staffer uuid;
  who uuid;
  sess uuid := gen_random_uuid();
  stay uuid := gen_random_uuid();
  stay_host uuid := gen_random_uuid();   -- the stay's host, filed below
  stay_host_agent uuid;
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  tg name;
  rate bigint;
  bk uuid;
  ref text := 'cb01-probe-' || gen_random_uuid()::text;
  did text := 'dsp-cb01-' || gen_random_uuid()::text;
  r jsonb;
  cb uuid;
  cb2 uuid;
  n int;
  refused boolean;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay), listed
  -- by a fresh host of its own. All of it is rolled back with the probe. Nothing
  -- asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (stay_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-cb01-chargeback-desk-host-' || stay_host || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (stay_host, 'Probe cb01-chargeback-desk host', 'business', 'APPROVED')
  returning id into stay_host_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, stay_host_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (stay) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (stay);
  -- The booking fixture the chargebacks probe uses (everything rolls back).
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = stay;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  select rate_minor into rate from public.listings where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, lister, lagos + 40, lagos + 42, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, payee_user_id)
  values (bk, 'paystack', ref, 100000, 'NGN', 'SUCCESSFUL', lister);
  perform set_config('vallo.recording_unknown_charge', '', true);

  -- A finance-capable staffer: an admin whose session proved its key.
  select u.id into staffer from auth.users u where u.id <> lister order by u.created_at limit 1;
  insert into public.user_roles (user_id, role) values (staffer, 'admin') on conflict do nothing;
  insert into public.console_step_ups (user_id, session_id, expires_at) values (staffer, sess, now() + interval '1 hour');

  -- Intake by the service role: one dispute lost and owed, one undecided.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  r := public.chargeback_open(ref, 'paystack', did, 40000);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL cb01: open %', r; end if;
  cb := (r->>'chargeback_id')::uuid;
  r := public.chargeback_open(ref, 'paystack', did || '-2', 10000);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL cb01: second open %', r; end if;
  cb2 := (r->>'chargeback_id')::uuid;

  -- 1. The lister: an undecided dispute holds nothing and is counted as open.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', lister)::text, true);
  r := public.my_chargeback_hold();
  if (r->>'held')::boolean or (r->>'open_count')::int <> 2 or (r->>'owed_minor')::bigint <> 0 then
    raise exception 'PROBE_FAIL cb01: undecided read as held %', r; end if;

  -- 2. Lost and part recovered: held, owed net of the recovered total.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  r := public.chargeback_move(cb, 'lost', null, 15000);
  if r->>'status' <> 'ok' or r->>'recovery' <> 'owed' then raise exception 'PROBE_FAIL cb01: lose %', r; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', lister)::text, true);
  r := public.my_chargeback_hold();
  if not (r->>'held')::boolean or (r->>'owed_minor')::bigint <> 25000 or (r->>'count')::int <> 1
     or r->>'currency' <> 'NGN' or (r->>'open_count')::int <> 1 or r->>'since' is null then
    raise exception 'PROBE_FAIL cb01: hold view %', r; end if;
  if public.lister_chargeback_hold(lister) is not true then raise exception 'PROBE_FAIL cb01: views disagree'; end if;

  -- 3. Somebody else reads their own (empty) answer, never the lister's.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text, true);
  r := public.my_chargeback_hold();
  if (r->>'held')::boolean or (r->>'owed_minor')::bigint <> 0 or (r->>'open_count')::int <> 0 then
    raise exception 'PROBE_FAIL cb01: a stranger read a hold %', r; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.my_chargeback_hold();
  if (r->>'held')::boolean or (r->>'count')::int <> 0 then raise exception 'PROBE_FAIL cb01: signed out read a hold %', r; end if;

  -- 4. The timeline and the note are refused to the lister and to a stranger.
  foreach who in array array[lister, gen_random_uuid()] loop
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', who)::text, true);
    refused := false;
    begin
      perform count(*) from public.staff_chargeback_events(cb);
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then raise exception 'PROBE_FAIL cb01: % read the timeline', who; end if;
    r := public.chargeback_add_note(cb, 'A note nobody should be able to write.');
    if r->>'status' <> 'forbidden' then raise exception 'PROBE_FAIL cb01: % wrote a note %', who, r; end if;
  end loop;

  -- 5. The service role has no note: a note is a person's.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  r := public.chargeback_add_note(cb, 'The webhook should not write notes.');
  if r->>'status' <> 'forbidden' then raise exception 'PROBE_FAIL cb01: service role wrote a note %', r; end if;

  -- 6. Finance staff on a proved session: a short note is refused, a real one
  --    lands as a `note` event in the current state, with an audit row, and
  --    the timeline reads every event in order.
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', staffer, 'session_id', sess)::text, true);
  r := public.chargeback_add_note(cb, 'too short');
  if r->>'status' <> 'reason_needed' then raise exception 'PROBE_FAIL cb01: short note %', r; end if;
  r := public.chargeback_add_note(gen_random_uuid(), 'A note on a chargeback that is not there.');
  if r->>'status' <> 'gone' then raise exception 'PROBE_FAIL cb01: note on nothing %', r; end if;
  r := public.chargeback_add_note(cb, 'Check-in photos and the receipt sent to Paystack.');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL cb01: note %', r; end if;
  if not exists (select 1 from public.chargeback_events e where e.id = (r->>'event_id')::uuid
                  and e.kind = 'note' and e.to_state = 'lost' and e.from_state = 'lost'
                  and e.recovery = 'owed' and e.actor_id = staffer) then
    raise exception 'PROBE_FAIL cb01: note event shape'; end if;
  if not exists (select 1 from public.audit_log where action = 'chargeback.noted' and entity_id = cb::text and actor_id = staffer) then
    raise exception 'PROBE_FAIL cb01: note not audited'; end if;
  select count(*) into n from public.staff_chargeback_events(cb);
  if n <> 3 then raise exception 'PROBE_FAIL cb01: timeline has % events, expected 3', n; end if;
  if (select e.kind from public.staff_chargeback_events(cb) e limit 1) <> 'opened' then
    raise exception 'PROBE_FAIL cb01: timeline not oldest first'; end if;
  if exists (select 1 from public.staff_chargeback_events(cb2) where kind <> 'opened') then
    raise exception 'PROBE_FAIL cb01: timeline crossed chargebacks'; end if;

  -- 7. A note is append-only like every other event.
  begin
    update public.chargeback_events set note = 'x' where kind = 'note' and chargeback_id = cb;
    raise exception 'PROBE_FAIL cb01: note edited';
  exception when insufficient_privilege then null;
  end;

  -- 8. Grants.
  if has_function_privilege('anon', 'public.staff_chargeback_events(uuid)', 'execute')
     or has_function_privilege('anon', 'public.chargeback_add_note(uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.my_chargeback_hold()', 'execute')
     or not has_function_privilege('authenticated', 'public.my_chargeback_hold()', 'execute')
     or has_function_privilege('authenticated', 'public.lister_chargeback_hold(uuid)', 'execute')
     or has_table_privilege('authenticated', 'public.chargeback_events', 'select') then
    raise exception 'PROBE_FAIL cb01: grants';
  end if;

  raise exception 'PROBE_OK cb01-chargeback-desk';
end
$$;
