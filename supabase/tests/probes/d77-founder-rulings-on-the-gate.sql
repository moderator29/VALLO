-- D77-FOUNDER-RULINGS-ON-THE-GATE: the founder's rulings of 7 October 2026.
-- Needs, applied in order: everything d68d needs, d68d_the_rail_decides_the_gate,
-- d77_founder_rulings_on_the_gate.
--  PROBE 1  first deal, scoped: an unverified business's first deal under the
--           threshold is a signal; once verified (with a CAC number) it is not;
--           verified but over the threshold it is (with amount_over)
--  PROBE 2  the threshold is 500,000 naira, and staff can move it
--  PROBE 3  a sale never routes to direct, even when a policy row says direct
--  PROBE 4  the listing wizard's fee acceptance is recorded where b3x reads it:
--           rate_moved and mismatch refuse, recorded writes the row, and the
--           publishing block (lister_fee_gate_blocking) then lets the listing in
--  PROBE 5  one switch: private.rentals_protected_pay_on() is payments_escrowpay_on (10 Nov 2026)
--  PROBE 6  staff controls: forbidden to members, validated, audited; the kill switch
--           needs a reason
--  PROBE 7  the protected payment's open and funding ask the agreement gate
-- Fixture writes keep every trigger on; a refused fixture skips its probe with
-- PROBE_SKIP. Everything is rolled back by the final raise.
do $$
declare
  guest constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  host  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';  -- QA account with staff scope
  step_session constant uuid := '00000000-0000-4000-8000-00000000c0de';
  biz uuid; acc uuid; rt uuid; rp uuid; pol uuid; dd date; b1 uuid; ag1 public.deal_agreements%rowtype;
  lister uuid; renter uuid; lst uuid; sale_lst uuid; sale_owner uuid; insp uuid; sale_ag uuid;
  lp public.listings%rowtype; policy jsonb; price bigint; bps int; prot int; proc_cap bigint; cap bigint;
  vallo bigint; esc bigint; proc bigint; recv_low bigint; recv_high bigint; r jsonb; reasons jsonb;
  start_day date := (now() at time zone 'Africa/Lagos')::date + 12;
begin
  -- PROBE 2 (read first, before anything moves it).
  if (select amount_threshold_minor from public.agreement_risk_settings where id = 1) <> 50000000 then
    if (select updated_by from public.agreement_risk_settings where id = 1) is not null then
      raise notice 'PROBE_SKIP d77 2: staff have already set the threshold to %', (select amount_threshold_minor from public.agreement_risk_settings where id = 1);
    else
      raise exception 'PROBE_FAIL d77 2: the threshold is not 500,000 naira';
    end if;
  end if;
  update public.agreement_risk_settings set amount_threshold_minor = 50000000, check_first_deal = true, check_amount = true,
                                            check_recent_change = false, check_payout_name = false, check_fraud_radar = false where id = 1;
  update public.feature_flags set enabled = true where key = 'room_bookings';
  update public.feature_flags set enabled = false where key in ('stays_instant_pay', 'agreement_review_all');

  -- PROBE 1: a hotel (direct rail) whose business is not verified.
  insert into public.businesses (owner_id, kind, name, slug, status, source)
  values (host, 'hotel', 'Probe D77 Hotel', 'probe-d77-' || gen_random_uuid(), 'PUBLISHED', 'first_party') returning id into biz;
  insert into public.accommodations (business_id, name, slug, status)
  values (biz, 'Probe D77 Hotel', 'probe-d77-a-' || gen_random_uuid(), 'PUBLISHED') returning id into acc;
  insert into public.room_types (accommodation_id, name, category, sleeps, units_total, base_rate_minor, status)
  values (acc, 'Probe double', 'double', 2, 4, 5000000, 'PUBLISHED') returning id into rt;
  select id into pol from public.cancellation_policies limit 1;
  insert into public.rate_plans (room_type_id, name, cancellation_policy_id, rate_minor, currency, min_stay_nights, active)
  values (rt, 'Probe room only', pol, 5000000, 'NGN', 1, true) returning id into rp;
  for dd in select generate_series(start_day, start_day + 3, interval '1 day')::date loop
    insert into public.room_inventory (room_type_id, date, units_open) values (rt, dd, 4);
  end loop;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  insert into public.bookings (guest_id, accommodation_id, room_type_id, rate_plan_id, rooms, check_in, check_out, adults)
  values (guest, acc, rt, rp, 1, start_day, start_day + 1, 2) returning id into b1;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.bookings set status = 'CONFIRMED' where id = b1;
  select * into ag1 from public.deal_agreements where booking_id = b1;
  if exists (select 1 from public.deal_agreements x where x.owner_id = host and x.status = 'paid') then
    raise notice 'PROBE_SKIP d77 1: the QA host already has a paid deal, so first_deal cannot fire';
  else
    reasons := private.agreement_review_required(ag1.id) -> 'reasons';
    if not reasons ? 'first_deal' then
      raise exception 'PROBE_FAIL d77 1: an unverified business''s first deal under the threshold raised no signal: %', reasons;
    end if;
    -- A CAC number in the form businesses_cac_number_check accepts (RC + digits),
    -- and verified as the platform records it: businesses_derive_badge derives
    -- `verified` from verification_tier, so the tier is what is set.
    update public.businesses set verification_tier = 1, verified = true, cac_number = 'RC-7700077' where id = biz;
    reasons := private.agreement_review_required(ag1.id) -> 'reasons';
    if reasons ? 'first_deal' then
      raise exception 'PROBE_FAIL d77 1: a verified business''s first deal under the threshold still raised first_deal';
    end if;
    update public.agreement_risk_settings set amount_threshold_minor = 100 where id = 1;
    reasons := private.agreement_review_required(ag1.id) -> 'reasons';
    if not (reasons ? 'first_deal' and reasons ? 'amount_over') then
      raise exception 'PROBE_FAIL d77 1: a verified first deal over the threshold did not raise first_deal and amount_over: %', reasons;
    end if;
    update public.agreement_risk_settings set amount_threshold_minor = 50000000 where id = 1;
  end if;

  -- PROBE 3: a sale never routes to direct.
  insert into public.payment_rail_policy (listing_intent, rail, precedence, reason)
  values ('sale', 'direct', 1000, 'PROBE d77: a direct answer for sales, rolled back');
  select l.id, a.user_id into sale_lst, sale_owner from public.listings l join public.agents a on a.id = l.agent_id
   where l.listing_intent = 'sale' and a.user_id is not null and not coalesce(l.is_demo, false) limit 1;
  if sale_lst is null then
    raise notice 'PROBE_SKIP d77 3: no sale listing to probe';
  else
    select u.id into renter from auth.users u where u.id <> sale_owner order by u.created_at limit 1;
    begin
      insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
      values (sale_lst, renter, sale_owner, now()) returning id into insp;
      insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms)
      values ('rent', sale_lst, insp, renter, sale_owner, 900000000, '{"total_minor": 900000000}') returning id into sale_ag;
    exception when others then
      raise notice 'PROBE_SKIP d77 3: the sale fixture was refused: %', sqlerrm;
    end;
    if sale_ag is not null and private.rail_for_agreement(sale_ag) is not distinct from 'direct' then
      raise exception 'PROBE_FAIL d77 3: a sale resolved to the direct rail';
    end if;
  end if;

  -- PROBE 4: the wizard's fee acceptance, read back by b3x's gate.
  select l.* into lp from public.listings l join public.agents a on a.id = l.agent_id
   where not coalesce(l.is_demo, false) and a.user_id is not null and l.listing_intent = 'rent'
     and coalesce(l.rent_amount_minor, l.rate_minor) > 1000000 limit 1;
  select a.user_id into lister from public.agents a where a.id = lp.agent_id;
  if lp.id is null then
    raise notice 'PROBE_SKIP d77 4: no rent listing with a price';
  else
    price := coalesce(lp.rent_amount_minor, lp.rate_minor);
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
    if guest <> lister and public.lister_fee_policy(lp.id, null, null) is not null then
      raise exception 'PROBE_FAIL d77 4: a stranger read the lister''s fee policy';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', lister, 'role', 'authenticated')::text, true);
    policy := public.lister_fee_policy(lp.id, null, null);
    if policy is null then raise exception 'PROBE_FAIL d77 4: the owner could not read the fee policy'; end if;
    bps := (policy ->> 'commission_bps')::int; prot := (policy ->> 'escrow_protection_bps')::int;
    proc_cap := (policy ->> 'direct_processor_fee_cap_minor')::bigint; cap := (policy ->> 'cap_minor')::bigint;
    vallo := (price * bps) / 10000;
    if cap is not null and vallo > cap then vallo := cap; end if;
    esc := (price * prot) / 10000;
    proc := least(proc_cap, price - vallo);
    recv_low := price - greatest(vallo + esc, vallo + proc);
    recv_high := price - least(vallo + esc, vallo + proc);
    r := public.lister_fee_accept(lp.id, 'lister-fee-2026-10-06.2', 'not-the-version', bps, prot, proc_cap, cap,
                                  price, vallo, esc, proc, recv_low, recv_high);
    if r ->> 'status' <> 'rate_moved' then raise exception 'PROBE_FAIL d77 4: a stale rate was not refused: %', r; end if;
    r := public.lister_fee_accept(lp.id, 'lister-fee-2026-10-06.2', policy ->> 'rate_version', bps, prot, proc_cap, cap,
                                  price, vallo, esc, proc, recv_low + 1, recv_high);
    if r ->> 'status' <> 'mismatch' then raise exception 'PROBE_FAIL d77 4: wrong figures were not refused: %', r; end if;
    r := public.lister_fee_accept(lp.id, 'lister-fee-2026-10-06.2', policy ->> 'rate_version', bps, prot, proc_cap, cap,
                                  price, vallo, esc, proc, recv_low, recv_high);
    if r ->> 'status' <> 'recorded' then raise exception 'PROBE_FAIL d77 4: the acceptance was not recorded: %', r; end if;
    reset role;
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    if not exists (select 1 from public.listing_fee_acceptances f where f.listing_id = lp.id and f.member_id = lister
                     and f.rent_minor = price and f.terms_version = '2026-10-06.2'
                     and f.receive_low_minor = recv_low and f.receive_high_minor = recv_high) then
      raise exception 'PROBE_FAIL d77 4: the record is not the one b3x reads';
    end if;
    -- The publishing block lets the listing in on this record alone.
    delete from public.listing_rate_acceptances where listing_id = lp.id;
    insert into public.feature_flags (key, enabled) values ('lister_fee_gate_blocking', true)
    on conflict (key) do update set enabled = true;
    begin
      update public.listings set status = 'DRAFT' where id = lp.id;
      update public.listings set status = 'SUBMITTED' where id = lp.id;
    exception
      when insufficient_privilege then
        if sqlerrm like '%rate_agreement_required%' then
          raise exception 'PROBE_FAIL d77 4: the b3x gate did not read the wizard''s record';
        end if;
        raise notice 'PROBE_SKIP d77 4b: the listing could not be moved to test the gate: %', sqlerrm;
      when others then
        raise notice 'PROBE_SKIP d77 4b: the listing could not be moved to test the gate: %', sqlerrm;
    end;
  end if;

  -- PROBE 5: one switch for protected rent. Since 10 November 2026 it is
  -- the new provider's, payments_escrowpay_on (it was payments_payluk_on).
  if private.rentals_protected_pay_on() is distinct from
     coalesce((select enabled from public.feature_flags where key = 'payments_escrowpay_on'), false) then
    raise exception 'PROBE_FAIL d77 5: the protected rent switch is not payments_escrowpay_on';
  end if;
  update public.feature_flags set enabled = not enabled where key = 'payments_escrowpay_on';
  if private.rentals_protected_pay_on() is distinct from (select enabled from public.feature_flags where key = 'payments_escrowpay_on') then
    raise exception 'PROBE_FAIL d77 5: the protected rent switch did not follow payments_escrowpay_on';
  end if;

  -- PROBE 6: staff controls.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  if public.admin_update_risk_settings(80000000, 5, true, true, true, true, true) ->> 'status' <> 'forbidden'
     or public.admin_set_review_kill_switch(true, 'a reason long enough') ->> 'status' <> 'forbidden' then
    raise exception 'PROBE_FAIL d77 6: a member reached the staff controls';
  end if;
  reset role;
  insert into public.console_step_ups (user_id, session_id, expires_at)
  values (host, step_session, now() + interval '1 hour')
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'session_id', step_session)::text, true);
  if public.admin_update_risk_settings(50, 5, true, true, true, true, true) ->> 'status' <> 'bad_threshold'
     or public.admin_update_risk_settings(80000000, 61, true, true, true, true, true) ->> 'status' <> 'bad_days' then
    raise exception 'PROBE_FAIL d77 6: the settings took a bad value';
  end if;
  r := public.admin_update_risk_settings(80000000, 5, false, true, true, true, true);
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL d77 6: staff could not save the settings: %', r; end if;
  if public.admin_set_review_kill_switch(true, 'short') ->> 'status' <> 'reason_required' then
    raise exception 'PROBE_FAIL d77 6: the kill switch moved without a reason';
  end if;
  r := public.admin_set_review_kill_switch(true, 'Probe: a fraud wave on direct deals');
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL d77 6: staff could not turn the kill switch on: %', r; end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if (select amount_threshold_minor from public.agreement_risk_settings where id = 1) <> 80000000
     or (select check_first_deal from public.agreement_risk_settings where id = 1)
     or (select updated_by from public.agreement_risk_settings where id = 1) is distinct from host
     or not (select enabled from public.feature_flags where key = 'agreement_review_all')
     or (select count(*) from public.audit_log where actor_id = host and created_at >= now()
           and action in ('agreement_risk_settings.update', 'agreement_review_all.on')) < 2 then
    raise exception 'PROBE_FAIL d77 6: the staff changes were not saved and audited';
  end if;

  -- PROBE 7: the gate reaches the protected payment (its behaviour is exercised
  -- in the PGlite run; here, that the trigger is in place on live).
  if not exists (select 1 from pg_trigger t where t.tgname = 'provider_arrangements_00_payable_gate'
                   and t.tgrelid = 'public.provider_arrangements'::regclass and t.tgenabled <> 'D') then
    raise exception 'PROBE_FAIL d77 7: the protected payment does not ask the agreement gate';
  end if;

  raise exception 'PROBE_OK d77-founder-rulings-on-the-gate';
end
$$;
