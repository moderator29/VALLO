-- CHARGEBACKS (Session 2, 7.8; migration chargebacks): only finance staff or
-- the service role can open or move a chargeback; intake refuses unsettled,
-- wrong-provider, over-amount and over-disputed charges and tells a
-- conflicting retry from a harmless one; a lost chargeback holds the lister's
-- payouts until recovered or written off with a reason; the recovered total
-- only rises and only while owed; won <-> lost reversals need a reason;
-- no-change calls write nothing; events are append-only; no app role can
-- touch the tables directly. Everything is rolled back by the final raise.
do $$
declare
  lister uuid;
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  stay   uuid := gen_random_uuid();
  stay_host uuid := gen_random_uuid();   -- the stay's host, filed below
  stay_host_agent uuid;
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  tg name;
  rate bigint;
  bk uuid;
  bk2 uuid;
  tx uuid;
  ref text := 'cb-probe-' || gen_random_uuid()::text;
  ref_p text := 'cb-probe-p-' || gen_random_uuid()::text;
  ref_n text := 'cb-probe-n-' || gen_random_uuid()::text;
  did text := 'dsp-' || gen_random_uuid()::text;
  r jsonb;
  cb uuid;
  cb2 uuid;
  n int;
  before_n int;
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
          'probe-chargebacks-host-' || stay_host || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (stay_host, 'Probe chargebacks host', 'business', 'APPROVED')
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
  -- The booking fixture crypto-pay-2 uses: the seeded stay, its supply-proof
  -- gate lifted for this transaction only (everything rolls back).
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = stay;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  select rate_minor into rate from public.listings where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 20, lagos + 22, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 30, lagos + 32, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk2;
  lister := member;
  if bk is null then raise exception 'PROBE_FAIL chargebacks: the booking fixture did not land'; end if;

  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, payee_user_id)
  values (bk, 'paystack', ref, 100000, 'NGN', 'SUCCESSFUL', lister) returning id into tx;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, payee_user_id)
  values (bk, 'paystack', ref_p, 100000, 'NGN', 'PENDING', lister);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status)
  values (bk2, 'paystack', ref_n, 100000, 'NGN', 'SUCCESSFUL');
  perform set_config('vallo.recording_unknown_charge', '', true);

  -- 1. A stranger is refused.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text, true);
  r := public.chargeback_open(ref, 'paystack', did, 50000);
  if r->>'status' <> 'forbidden' then raise exception 'PROBE_FAIL chargebacks: stranger opened %', r; end if;

  -- From here on, the service role (the webhook intake).
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

  -- 2. Intake refusals.
  r := public.chargeback_open(ref, 'paystack', did, 100001);
  if r->>'status' <> 'bad_amount' then raise exception 'PROBE_FAIL chargebacks: over-amount accepted %', r; end if;
  r := public.chargeback_open('no-such-' || ref, 'paystack', did, 1);
  if r->>'status' <> 'no_such_charge' then raise exception 'PROBE_FAIL chargebacks: unknown charge %', r; end if;
  r := public.chargeback_open(ref, 'payluk', did, 1);
  if r->>'status' <> 'provider_mismatch' then raise exception 'PROBE_FAIL chargebacks: provider not matched %', r; end if;
  r := public.chargeback_open(ref_p, 'paystack', 'dsp-p-' || did, 1);
  if r->>'status' <> 'not_settled' then raise exception 'PROBE_FAIL chargebacks: pending charge accepted %', r; end if;
  r := public.chargeback_open(ref, 'paystack', null, 1);
  if r->>'status' <> 'bad_input' then raise exception 'PROBE_FAIL chargebacks: null dispute id %', r; end if;
  r := public.chargeback_open(ref, null, did, 1);
  if r->>'status' <> 'bad_input' then raise exception 'PROBE_FAIL chargebacks: null provider %', r; end if;

  -- 3. Open, then a retry is idempotent and a disagreeing retry is a conflict.
  r := public.chargeback_open(ref, 'paystack', did, 50000);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: open %', r; end if;
  cb := (r->>'chargeback_id')::uuid;
  if (select currency from public.chargebacks where id = cb) <> 'NGN' then raise exception 'PROBE_FAIL chargebacks: currency not copied'; end if;
  r := public.chargeback_open(ref, 'paystack', did, 50000);
  if r->>'status' <> 'duplicate' or (r->>'chargeback_id')::uuid <> cb then raise exception 'PROBE_FAIL chargebacks: retry %', r; end if;
  r := public.chargeback_open(ref, 'paystack', did, 40000);
  if r->>'status' <> 'conflict' then raise exception 'PROBE_FAIL chargebacks: mismatched retry %', r; end if;
  select count(*) into n from public.chargebacks where provider = 'paystack' and provider_dispute_id = did;
  if n <> 1 then raise exception 'PROBE_FAIL chargebacks: retry made % rows', n; end if;

  -- 4. Disputes on one charge cannot add up past it.
  r := public.chargeback_open(ref, 'paystack', 'dsp-2-' || did, 50001);
  if r->>'status' <> 'over_charge' then raise exception 'PROBE_FAIL chargebacks: over-disputed charge %', r; end if;

  -- 5. A charge with no payee is flagged.
  r := public.chargeback_open(ref_n, 'paystack', 'dsp-n-' || did, 100);
  if r->>'status' <> 'ok' or (r->>'unattributed')::boolean is not true then raise exception 'PROBE_FAIL chargebacks: unattributed %', r; end if;
  cb2 := (r->>'chargeback_id')::uuid;
  if not (select lister_unattributed from public.chargebacks where id = cb2) then raise exception 'PROBE_FAIL chargebacks: flag unset'; end if;
  if not exists (select 1 from public.audit_log where action = 'chargeback.unattributed' and entity_id = cb2::text) then
    raise exception 'PROBE_FAIL chargebacks: unattributed not audited'; end if;

  -- 6. An open dispute does not hold payouts.
  if public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: open dispute holds'; end if;

  -- 7. No-change, illegal moves, and the evidence deadline.
  select count(*) into before_n from public.chargeback_events where chargeback_id = cb;
  r := public.chargeback_move(cb, 'opened');
  if r->>'status' <> 'noop' then raise exception 'PROBE_FAIL chargebacks: same-state move %', r; end if;
  if (select count(*) from public.chargeback_events where chargeback_id = cb) <> before_n then
    raise exception 'PROBE_FAIL chargebacks: noop wrote an event'; end if;
  r := public.chargeback_move(cb, null, 'recovered');
  if r->>'status' <> 'illegal_recovery' then raise exception 'PROBE_FAIL chargebacks: recovery before loss %', r; end if;
  r := public.chargeback_move(cb, null, null, 100);
  if r->>'status' <> 'recovery_not_open' then raise exception 'PROBE_FAIL chargebacks: recovered total on an open chargeback %', r; end if;
  r := public.chargeback_move(cb, null, null, null, null, null, null, now() + interval '9 days');
  if r->>'status' <> 'ok' or (select evidence_due_at from public.chargebacks where id = cb) is null then
    raise exception 'PROBE_FAIL chargebacks: evidence deadline not moved %', r; end if;

  -- 8. Evidence back and forth, then a win, then an arbitration loss.
  r := public.chargeback_move(cb, 'evidence_submitted');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: to evidence_submitted %', r; end if;
  r := public.chargeback_move(cb, 'evidence_requested');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: back to evidence_requested %', r; end if;
  r := public.chargeback_move(cb, 'won');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: won %', r; end if;
  r := public.chargeback_move(cb, 'lost');
  if r->>'status' <> 'reason_needed' then raise exception 'PROBE_FAIL chargebacks: unreasoned won->lost %', r; end if;
  r := public.chargeback_move(cb, 'lost', null, null, null, 'issuer took it to pre-arbitration');
  if r->>'status' <> 'ok' or r->>'recovery' <> 'owed' then raise exception 'PROBE_FAIL chargebacks: won->lost %', r; end if;
  if not public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: lost+owed does not hold'; end if;
  if (select closed_at from public.chargebacks where id = cb) is null then raise exception 'PROBE_FAIL chargebacks: closed_at unset'; end if;

  -- 9. lost -> won with a reason resets recovery and lifts the hold; back to lost.
  r := public.chargeback_move(cb, 'won', null, null, null, 'arbitration decided for the merchant');
  if r->>'status' <> 'ok' or r->>'recovery' <> 'none' then raise exception 'PROBE_FAIL chargebacks: lost->won %', r; end if;
  if public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: won kept hold'; end if;
  r := public.chargeback_move(cb, 'lost', 'none', null, null, 'issuer appealed the arbitration');
  if r->>'status' <> 'illegal_recovery' then raise exception 'PROBE_FAIL chargebacks: lost with no recovery %', r; end if;
  r := public.chargeback_move(cb, 'lost', null, null, null, 'issuer appealed the arbitration');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: lost again %', r; end if;

  -- 10. Partial recovery keeps the hold, cannot go down or past the amount.
  r := public.chargeback_move(cb, null, null, 20000);
  if r->>'status' <> 'ok' or (select recovered_minor from public.chargebacks where id = cb) <> 20000 then
    raise exception 'PROBE_FAIL chargebacks: partial %', r; end if;
  if not exists (select 1 from public.chargeback_events where chargeback_id = cb and recovered_minor = 20000) then
    raise exception 'PROBE_FAIL chargebacks: partial not in the trail'; end if;
  r := public.chargeback_move(cb, null, null, 10000);
  if r->>'status' <> 'bad_recovered' then raise exception 'PROBE_FAIL chargebacks: recovered went down %', r; end if;
  r := public.chargeback_move(cb, null, null, 50001);
  if r->>'status' <> 'bad_recovered' then raise exception 'PROBE_FAIL chargebacks: recovered past amount %', r; end if;
  r := public.chargeback_move(cb, null, 'recovered');
  if r->>'status' <> 'recovered_must_be_full' then raise exception 'PROBE_FAIL chargebacks: partial marked recovered %', r; end if;
  if not public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: partial lifted hold'; end if;
  r := public.chargeback_move(cb, 'won', null, null, null, 'processor reversed the chargeback');
  if r->>'status' <> 'illegal' then raise exception 'PROBE_FAIL chargebacks: lost->won after money moved %', r; end if;

  -- 11. Write-off needs a reason, lifts the hold, and can be reopened.
  r := public.chargeback_move(cb, null, 'written_off', null, null, 'short');
  if r->>'status' <> 'reason_needed' then raise exception 'PROBE_FAIL chargebacks: unreasoned write-off %', r; end if;
  r := public.chargeback_move(cb, null, 'written_off', null, null, 'lister unreachable after 3 notices');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL chargebacks: write-off %', r; end if;
  if public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: write-off kept hold'; end if;
  r := public.chargeback_move(cb, null, 'owed', null, null, 'lister reachable again, pursuing');
  if r->>'status' <> 'ok' or not public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: reopen %', r; end if;

  -- 12. Reaching the full amount marks it recovered and lifts the hold.
  r := public.chargeback_move(cb, null, null, 50000);
  if r->>'status' <> 'ok' or r->>'recovery' <> 'recovered' then raise exception 'PROBE_FAIL chargebacks: full recovery %', r; end if;
  if public.lister_chargeback_hold(lister) then raise exception 'PROBE_FAIL chargebacks: recovered kept hold'; end if;

  -- 13. Every write left an event and an audit row.
  select count(*) into n from public.chargeback_events where chargeback_id = cb;
  if n < 12 then raise exception 'PROBE_FAIL chargebacks: only % events', n; end if;
  select count(*) into n from public.audit_log where entity_type = 'chargeback' and entity_id = cb::text;
  if n < 12 then raise exception 'PROBE_FAIL chargebacks: only % audit rows', n; end if;

  -- 14. Events are append-only.
  begin
    update public.chargeback_events set note = 'x' where chargeback_id = cb;
    raise exception 'PROBE_FAIL chargebacks: event updated';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.chargeback_events where chargeback_id = cb;
    raise exception 'PROBE_FAIL chargebacks: event removed';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from pg_trigger where not tgisinternal
        and tgname in ('chargeback_events_01_no_truncate', 'chargebacks_01_no_truncate')) <> 2 then
    raise exception 'PROBE_FAIL chargebacks: no-truncate triggers missing';
  end if;

  -- 15. Grants.
  if has_table_privilege('authenticated', 'public.chargebacks', 'select')
     or has_table_privilege('service_role', 'public.chargebacks', 'update')
     or has_table_privilege('service_role', 'public.chargebacks', 'insert')
     or has_table_privilege('service_role', 'public.chargeback_events', 'truncate')
     or has_table_privilege('service_role', 'public.chargeback_events', 'insert')
     or has_function_privilege('authenticated', 'public.lister_chargeback_hold(uuid)', 'execute')
     or has_function_privilege('anon', 'public.chargeback_move(uuid,text,text,bigint,text,text,jsonb,timestamptz)', 'execute') then
    raise exception 'PROBE_FAIL chargebacks: grants too wide';
  end if;

  raise exception 'PROBE_OK chargebacks';
end
$$;
