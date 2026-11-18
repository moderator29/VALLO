-- B3-FEE-ACCEPTANCE (D61): the fee acceptance record is a legal artifact.
-- Needs b3_money_policy_versions (applied) and b3_fee_acceptance_record.sql.
-- Does NOT need b3_rate_agreement_gate.sql and never moves a listing's status.
--  1. the worst-case range: 1,800,000 naira -> fee 36,000..63,000 (Vallo 2 percent, plus the payment partner's 1.5 percent in the worst case; founder rate of 10 Nov 2026), receive 1,737,000..1,764,000
--  2. a stranger cannot quote or accept for the listing
--  3. stale version, stale protection rate, stale rent, any wrong figure, bad terms version: refused
--  4. the owner accepts; the row carries actor, both rates, terms version, every figure
--  5. a member cannot insert, update or remove a record; truncate is refused for everyone
--  6. current_fee_acceptance returns the latest; a member sees only their own records
--  7. a rent change re-prompts (quote says not accepted) and the old record stays
-- current_fee_acceptance is read at clock_timestamp(): accepted_at is clock time, later than
-- this transaction's now(). The fixture is priced inside the probe; everything is rolled back by the final raise.
do $$
declare
  lst record;
  f jsonb;
  q jsonb;
  acc public.listing_fee_acceptances%rowtype;
  acc2 public.listing_fee_acceptances%rowtype;
  n int;
  stay constant uuid := gen_random_uuid();
  lister constant uuid := gen_random_uuid();   -- the stay's host, filed below
  lister_agent uuid;
  stranger constant uuid := gen_random_uuid();
  tg name;
  tv constant text := '2026-10-06';
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
          'probe-b3-fee-acceptance-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe b3-fee-acceptance host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (stay) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (stay);
  -- The seeded stay (is_demo on production; the supply-proof gate lifted for this
  -- transaction only, as chargebacks.sql). The figures never read is_demo or status.
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = stay;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  select l.id, a.user_id, l.listing_intent, l.rent_amount_minor into lst
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.id = stay and a.user_id is not null;
  if lst.id is null then
    raise exception 'PROBE_FAIL b3-fee-acceptance 0: the seeded stay or its owning agent is missing';
  end if;
  if lst.user_id = stranger then
    raise exception 'PROBE_FAIL b3-fee-acceptance 0: the stranger owns the fixture';
  end if;
  if lst.listing_intent = 'sale' then
    update public.listings set sale_price_minor = 180000000 where id = lst.id;
  elsif lst.rent_amount_minor is not null then
    update public.listings set rent_amount_minor = 180000000 where id = lst.id;
  else
    update public.listings set rate_minor = 180000000, rate_period = 'night' where id = lst.id;
  end if;

  -- 1. The range, computed by the server.
  f := private.fee_terms_figures(lst.id);
  if f->>'status' <> 'ok' or (f->>'rent_minor')::bigint <> 180000000
     or (f->>'commission_bps')::int <> 200 or (f->>'protection_bps')::int <> 150
     or (f->>'fee_low_minor')::bigint <> 3600000 or (f->>'fee_high_minor')::bigint <> 6300000
     or (f->>'receive_low_minor')::bigint <> 173700000 or (f->>'receive_high_minor')::bigint <> 176400000 then
    raise exception 'PROBE_FAIL b3-fee-acceptance 1: figures wrong: %', f;
  end if;

  -- 2. A stranger.
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.fee_terms_quote(lst.id);
  if q->>'status' <> 'not_found' then raise exception 'PROBE_FAIL b3-fee-acceptance 2a: stranger quoted: %', q; end if;
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 6300000, 173700000, 176400000);
  if q->>'status' <> 'not_found' then raise exception 'PROBE_FAIL b3-fee-acceptance 2b: stranger accepted: %', q; end if;
  -- 5a. Direct insert.
  begin
    insert into public.listing_fee_acceptances (listing_id, member_id, terms_version, policy_version_id, policy_version,
      protection_rate_id, property_type, commission_bps, protection_bps, rent_minor, fee_low_minor, fee_high_minor,
      receive_low_minor, receive_high_minor, figures_shown)
    values (lst.id, stranger, tv, (f->>'policy_version_id')::bigint, 'x', (f->>'protection_rate_id')::bigint,
      'apartment', 0, 0, 100, 0, 0, 100, 100, '{}');
    raise exception 'PROBE_FAIL b3-fee-acceptance 5a: a member inserted a record directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 3. The owner, with every kind of stale or wrong figure.
  perform set_config('request.jwt.claims', json_build_object('sub', lst.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint + 1000000, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 6300000, 173700000, 176400000);
  if q->>'status' <> 'rate_changed' then raise exception 'PROBE_FAIL b3-fee-acceptance 3a: stale version: %', q; end if;
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint + 1000000,
         180000000, 3600000, 6300000, 173700000, 176400000);
  if q->>'status' <> 'rate_changed' then raise exception 'PROBE_FAIL b3-fee-acceptance 3b: stale protection: %', q; end if;
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000001, 3600000, 6300000, 173700001, 176400001);
  if q->>'status' <> 'price_changed' then raise exception 'PROBE_FAIL b3-fee-acceptance 3c: stale rent: %', q; end if;
  -- The old D61-wrong figure: "keeps 96 percent" on the high side.
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 6300000, 173700000, 173700000);
  if q->>'status' <> 'figures_mismatch' then raise exception 'PROBE_FAIL b3-fee-acceptance 3d: wrong figure: %', q; end if;
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 3600000, 176400000, 176400000);
  if q->>'status' <> 'figures_mismatch' then raise exception 'PROBE_FAIL b3-fee-acceptance 3e: best case only: %', q; end if;
  q := public.accept_fee_terms(lst.id, 'v1', (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 6300000, 173700000, 176400000);
  if q->>'status' <> 'bad_terms_version' then raise exception 'PROBE_FAIL b3-fee-acceptance 3f: terms version: %', q; end if;
  select count(*) into n from public.listing_fee_acceptances where listing_id = lst.id;
  if n <> 0 then raise exception 'PROBE_FAIL b3-fee-acceptance 3g: a refused call wrote % rows', n; end if;

  -- 4. Accept.
  q := public.accept_fee_terms(lst.id, tv, (f->>'policy_version_id')::bigint, (f->>'protection_rate_id')::bigint,
         180000000, 3600000, 6300000, 173700000, 176400000);
  if q->>'status' <> 'ok' or (q->>'accepted')::boolean is not true then
    raise exception 'PROBE_FAIL b3-fee-acceptance 4: owner could not accept: %', q;
  end if;
  q := public.fee_terms_quote(lst.id);
  if (q->>'accepted')::boolean is not true then raise exception 'PROBE_FAIL b3-fee-acceptance 4b: quote not accepted: %', q; end if;

  -- 6. Current record, as the member.
  acc := public.current_fee_acceptance(lst.id, clock_timestamp());
  if acc.id is null or acc.id <> (q->>'acceptance_id')::uuid then
    raise exception 'PROBE_FAIL b3-fee-acceptance 6a: current record not returned to its owner';
  end if;
  if acc.member_id <> lst.user_id or acc.terms_version <> tv or acc.commission_bps <> 200 or acc.protection_bps <> 150
     or acc.rent_minor <> 180000000 or acc.fee_low_minor <> 3600000 or acc.fee_high_minor <> 6300000
     or acc.receive_low_minor <> 173700000 or acc.receive_high_minor <> 176400000
     or acc.figures_shown->>'receive_low_naira' <> '1,737,000.00' then
    raise exception 'PROBE_FAIL b3-fee-acceptance 4c: record wrong: %', to_jsonb(acc);
  end if;

  -- 5b. Update / remove as the member (no grant).
  begin
    update public.listing_fee_acceptances set rent_minor = 1 where id = acc.id;
    raise exception 'PROBE_FAIL b3-fee-acceptance 5b: a member updated a record';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 6b. A stranger cannot see it.
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  acc2 := public.current_fee_acceptance(lst.id, clock_timestamp());
  if acc2.id is not null then raise exception 'PROBE_FAIL b3-fee-acceptance 6b: a stranger read the record'; end if;
  reset role;

  -- 5c. Even the owner of the table cannot edit, remove or truncate.
  begin
    update public.listing_fee_acceptances set rent_minor = 1 where id = acc.id;
    raise exception 'PROBE_FAIL b3-fee-acceptance 5c: the record was edited';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'delete ' || 'from public.listing_fee_acceptances where id = $1' using acc.id;
    raise exception 'PROBE_FAIL b3-fee-acceptance 5d: the record was removed';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.listing_fee_acceptances;
    raise exception 'PROBE_FAIL b3-fee-acceptance 5e: the record was truncated';
  exception when insufficient_privilege then null;
  end;

  -- 7. A rent change re-prompts; the old record stays.
  if lst.listing_intent = 'sale' then
    update public.listings set sale_price_minor = 200000000 where id = lst.id;
  elsif lst.rent_amount_minor is not null then
    update public.listings set rent_amount_minor = 200000000 where id = lst.id;
  else
    update public.listings set rate_minor = 200000000 where id = lst.id;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', lst.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.fee_terms_quote(lst.id);
  if (q->>'accepted')::boolean is not false or (q->>'acceptance_id')::uuid <> acc.id then
    raise exception 'PROBE_FAIL b3-fee-acceptance 7a: a rent change did not re-prompt: %', q;
  end if;
  q := public.accept_fee_terms(lst.id, tv, (q->>'policy_version_id')::bigint, (q->>'protection_rate_id')::bigint,
         200000000, (q->>'fee_low_minor')::bigint, (q->>'fee_high_minor')::bigint,
         (q->>'receive_low_minor')::bigint, (q->>'receive_high_minor')::bigint);
  if q->>'status' <> 'ok' then raise exception 'PROBE_FAIL b3-fee-acceptance 7b: re-accept failed: %', q; end if;
  acc2 := public.current_fee_acceptance(lst.id, clock_timestamp());
  if acc2.id <> (q->>'acceptance_id')::uuid or acc2.rent_minor <> 200000000 then
    raise exception 'PROBE_FAIL b3-fee-acceptance 7c: current is not the latest';
  end if;
  acc2 := public.current_fee_acceptance(lst.id, acc.accepted_at);
  if acc2.id is distinct from acc.id then
    raise exception 'PROBE_FAIL b3-fee-acceptance 7e: the record in force at the first acceptance is not the first';
  end if;
  select count(*) into n from public.listing_fee_acceptances where listing_id = lst.id;
  reset role;
  if n <> 2 then raise exception 'PROBE_FAIL b3-fee-acceptance 7d: % records, expected 2 (history kept)', n; end if;

  raise exception 'PROBE_OK b3-fee-acceptance';
end $$;
