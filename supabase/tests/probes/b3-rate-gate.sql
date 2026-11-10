-- B3-RATE-GATE: no listing reaches review or publication without the lister's
-- recorded acceptance of the fee, on the rate in force and the current price.
-- Needs b3_money_policy_versions.sql and b3_rate_agreement_gate.sql applied.
--  1. a non-demo DRAFT moved to SUBMITTED without acceptance is refused
--  2. a stranger cannot accept for it; a stale version or price is refused
--  3. the owner accepts; the row carries member, time, version, naira figures
--  4. the same move now passes the rate gate
--  5. a price change re-opens the question
--  6. a member cannot insert an acceptance directly
--  7. the payment gate accepts a zero Guarantee leg with no reserve code
--     (read from the function body; no transaction row is written)
--  8. the gate also fires on price edits; acceptances cannot be truncated;
--     the split reads the acceptance as of the agreement (S1)
--  9. BLOCKER-1: for a listing booking the acceptance (200 bps) wins over a
--     higher terms.commission_bps (9000); terms are ignored for listings
-- 10. SF-1: APPROVED -> PUBLISHED with a new policy version landed during
--     review passes on the acceptance of the version in force at submission
-- 11. SF-2: a staff-style SUSPENDED -> PUBLISHED with an older-version
--     acceptance at the current price passes; a lister DRAFT -> SUBMITTED on
--     the same old-version acceptance is refused (current version required)
-- Fixture rows for 9-11 (status jumps, booking, agreement) are plain writes with
-- all triggers on, in nested blocks: if another gate refuses a fixture the step
-- raises notice 'PROBE_SKIP ...' and is skipped (never counted as a pass).
-- No session_replication_role, no DISABLE TRIGGER.
-- The DRAFT fixture is priced INSIDE the probe (rate_minor + rate_period, or
-- sale_price_minor for a sale); rent_amount_minor is never set without
-- rent_period. Everything is rolled back by the final raise.
-- 7 October 2026: since b3x the gate blocks only while the D60 switch
-- `lister_fee_gate_blocking` is on (off on live), so the probe turns it on
-- inside its own transaction; this probe is about the blocking gate.
do $$
declare
  lst record;
  v public.money_policy_versions%rowtype;
  price bigint;
  q jsonb;
  acc public.listing_rate_acceptances%rowtype;
  p2 bigint;
  bk_id uuid;
  ag_id uuid;
  v2 bigint;
  c jsonb;
  ok10 boolean;
  ok11 boolean;
  stranger constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lister uuid;
  lister_agent uuid;
begin
  -- 9 November 2026: the probe used to borrow a live non-demo DRAFT, and the
  -- live database has none left (one APPROVED listing and the demo set), so
  -- it failed at step 0 before asserting anything. The lister and the DRAFT
  -- are now throwaways made here, like the other lister fixtures since 17
  -- October, and rolled back with everything else.
  lister := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-b3-rate-gate-lister-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (lister, 'Probe B3 lister') returning id into lister_agent;
  insert into public.listings (agent_id, title, property_type, status, listing_role, listing_intent)
  values (lister_agent, 'Probe B3 rate gate', 'apartment', 'DRAFT', 'agent', 'rent');
  select l.id, a.user_id, l.listing_intent, l.sale_price_minor, l.rent_amount_minor, l.rate_minor
    into lst
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.agent_id = lister_agent and l.status = 'DRAFT'
   limit 1;
  if lst.id is null then
    raise exception 'PROBE_FAIL b3-rate-gate 0: the DRAFT fixture was not filed';
  end if;
  -- Price the fixture (it is filed unpriced).
  if lst.listing_intent = 'sale' then
    update public.listings set sale_price_minor = 5000000 where id = lst.id;
    price := 5000000;
  else
    update public.listings set rate_minor = 5000000, rate_period = 'night' where id = lst.id;
    price := coalesce(lst.rent_amount_minor, 5000000);
  end if;
  v := public.money_policy_at(now());
  insert into public.feature_flags (key, enabled) values ('lister_fee_gate_blocking', true)
  on conflict (key) do update set enabled = true;

  begin
    update public.listings set status = 'SUBMITTED', submitted_at = now() where id = lst.id;
    raise exception 'PROBE_FAIL b3-rate-gate 1: a listing went for review with no acceptance';
  exception when insufficient_privilege then
    if sqlerrm not like 'rate_agreement_required%' then
      raise exception 'PROBE_FAIL b3-rate-gate 1: refused, but by another gate first: %', sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.accept_listing_rate(lst.id, v.id, price);
  if q->>'status' <> 'not_found' then
    raise exception 'PROBE_FAIL b3-rate-gate 2a: a stranger accepted: %', q;
  end if;
  begin
    insert into public.listing_rate_acceptances (listing_id, member_id, policy_version_id, property_type, amount_minor,
                                                 commission_bps, commission_minor, net_minor, figures_shown)
    values (lst.id, stranger, v.id, 'apartment', 100, 0, 0, 100, '{}');
    raise exception 'PROBE_FAIL b3-rate-gate 6: a member inserted an acceptance directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', lst.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.accept_listing_rate(lst.id, v.id + 1000000, price);
  if q->>'status' <> 'rate_changed' then raise exception 'PROBE_FAIL b3-rate-gate 2b: stale version: %', q; end if;
  q := public.accept_listing_rate(lst.id, v.id, price + 1);
  if q->>'status' <> 'price_changed' then raise exception 'PROBE_FAIL b3-rate-gate 2c: stale price: %', q; end if;
  q := public.accept_listing_rate(lst.id, v.id, price);
  if q->>'status' <> 'ok' then raise exception 'PROBE_FAIL b3-rate-gate 3: owner could not accept: %', q; end if;
  reset role;

  select * into acc from public.listing_rate_acceptances where id = (q->>'acceptance_id')::uuid;
  if acc.member_id <> lst.user_id or acc.policy_version_id <> v.id or acc.amount_minor <> price
     or acc.commission_minor + acc.net_minor <> price or acc.figures_shown->>'amount_naira' is null then
    raise exception 'PROBE_FAIL b3-rate-gate 3: acceptance row wrong: %', to_jsonb(acc);
  end if;

  begin
    update public.listings set status = 'SUBMITTED', submitted_at = now() where id = lst.id;
  exception when others then
    if sqlerrm like 'rate_agreement_required%' then
      raise exception 'PROBE_FAIL b3-rate-gate 4: accepted listing still refused';
    end if;
    -- another gate (photos, supply proof, EDD) may refuse this DRAFT; the rate gate passed.
  end;

  begin
    if lst.listing_intent = 'sale' then
      update public.listings set sale_price_minor = price + 100, status = 'DRAFT' where id = lst.id;
    elsif lst.rent_amount_minor is null then
      update public.listings set rate_minor = price + 100, status = 'DRAFT' where id = lst.id;
    else
      -- rent already has its rent_period on this row; only the amount moves.
      update public.listings set rent_amount_minor = price + 100, status = 'DRAFT' where id = lst.id;
    end if;
    update public.listings set status = 'SUBMITTED', submitted_at = now() where id = lst.id;
    raise exception 'PROBE_FAIL b3-rate-gate 5: a re-priced listing went for review on the old acceptance';
  exception when insufficient_privilege then
    if sqlerrm not like 'rate_agreement_required%' then
      raise exception 'PROBE_FAIL b3-rate-gate 5: refused by another gate: %', sqlerrm;
    end if;
  end;

  -- Re-accept on the stored (re-priced) price, on the version in force now (v1).
  p2 := private.b3_listing_price_minor(lst.id);
  perform set_config('request.jwt.claims', json_build_object('sub', lst.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  q := public.accept_listing_rate(lst.id, v.id, p2);
  reset role;
  if q->>'status' <> 'ok' then raise exception 'PROBE_FAIL b3-rate-gate 9: re-accept failed: %', q; end if;

  -- 9. BLOCKER-1. Triggers stay on; if another gate refuses the fixture, skip.
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights,
                                 price_per_night_minor, subtotal_minor, total_minor)
    values (lst.id, stranger, current_date + 30, current_date + 31, 1, p2, p2, p2)
    returning id into bk_id;
    insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms)
    values ('stay', lst.id, bk_id, stranger, lst.user_id, p2, jsonb_build_object('commission_bps', 9000))
    returning id into ag_id;
  exception when others then
    bk_id := null; ag_id := null;
    raise notice 'PROBE_SKIP b3-rate-gate 9: booking/agreement fixture refused by another gate: %', sqlerrm;
  end;
  if ag_id is not null then
    c := private.b3_commission_for_booking(bk_id, 1000000, ag_id);
    if c->>'status' <> 'ok' or c->>'source' <> 'acceptance'
       or (c->>'commission_bps')::int <> v.commission_bps
       or (c->>'commission_minor')::bigint <> (1000000 * v.commission_bps) / 10000 then
      raise exception 'PROBE_FAIL b3-rate-gate 9: terms beat the acceptance on a listing booking: %', c;
    end if;
  end if;

  -- 10. SF-1: in review (APPROVED, submitted an hour ago), then a new version lands.
  begin
    update public.listings set status = 'APPROVED', submitted_at = now() - interval '1 hour' where id = lst.id;
    ok10 := true;
  exception when others then
    ok10 := false;
    raise notice 'PROBE_SKIP b3-rate-gate 10: APPROVED fixture refused by another gate: %', sqlerrm;
  end;
  insert into public.money_policy_versions (version, effective_from, commission_bps, guarantee_bps, vat_bps,
                                            vat_registered, withdrawal_min_minor, note)
  values ('probe-b3-rate-gate', now(), v.commission_bps + 100, v.guarantee_bps, v.vat_bps,
          v.vat_registered, v.withdrawal_min_minor, 'probe fixture, rolled back')
  returning id into v2;
  if (public.money_policy_at(now())).id <> v2 then
    raise exception 'PROBE_FAIL b3-rate-gate 10: fixture version is not in force';
  end if;
  if ok10 then
    begin
      update public.listings set status = 'PUBLISHED' where id = lst.id;
    exception when others then
      if sqlerrm like 'rate_agreement_required%' then
        raise exception 'PROBE_FAIL b3-rate-gate 10: APPROVED -> PUBLISHED stranded by a version change during review';
      end if;
      -- another publish gate may refuse; the rate gate passed.
    end;
  end if;

  -- 11. SF-2: staff reinstate (SUSPENDED -> PUBLISHED) on the old-version acceptance.
  begin
    update public.listings set status = 'SUSPENDED' where id = lst.id;
    ok11 := true;
  exception when others then
    ok11 := false;
    raise notice 'PROBE_SKIP b3-rate-gate 11a: SUSPENDED fixture refused by another gate: %', sqlerrm;
  end;
  if ok11 then
    begin
      update public.listings set status = 'PUBLISHED' where id = lst.id;
    exception when others then
      if sqlerrm like 'rate_agreement_required%' then
        raise exception 'PROBE_FAIL b3-rate-gate 11a: staff re-entry to PUBLISHED refused on an old-version acceptance';
      end if;
    end;
  end if;
  -- ... but a lister-driven DRAFT -> SUBMITTED needs the current version (v2).
  begin
    update public.listings set status = 'DRAFT' where id = lst.id;
    ok11 := true;
  exception when others then
    ok11 := false;
    raise notice 'PROBE_SKIP b3-rate-gate 11b: DRAFT fixture refused by another gate: %', sqlerrm;
  end;
  if ok11 then
    begin
      update public.listings set status = 'SUBMITTED', submitted_at = now() where id = lst.id;
      raise exception 'PROBE_FAIL b3-rate-gate 11b: a lister submitted on an old-version acceptance';
    exception when insufficient_privilege then
      if sqlerrm not like 'rate_agreement_required%' then
        raise exception 'PROBE_FAIL b3-rate-gate 11b: refused by another gate: %', sqlerrm;
      end if;
    end;
  end if;

  if position('coalesce(new.guarantee_minor, 0) > 0' in pg_get_functiondef('private.transactions_payment_gate()'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL b3-rate-gate 7: payment gate still demands a reserve at zero';
  end if;

  if position('rent_amount_minor' in pg_get_triggerdef((select oid from pg_trigger where tgname = 'listings_zz_b3_rate_agreement_gate'))) = 0 then
    raise exception 'PROBE_FAIL b3-rate-gate 8a: the gate does not fire on price edits';
  end if;
  begin
    truncate public.listing_rate_acceptances;
    raise exception 'PROBE_FAIL b3-rate-gate 8b: acceptances were truncated';
  exception when insufficient_privilege then null;
  end;
  if position('ag.created_at' in pg_get_functiondef('private.b3_commission_for_booking(uuid,bigint,uuid)'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL b3-rate-gate 8c: the split does not read the acceptance as of the agreement';
  end if;

  raise exception 'PROBE_OK b3-rate-gate';
end $$;
