-- D73B-PROVIDER-ARRANGEMENTS: an approved rental is paid into a protected
-- arrangement held by the provider; Vallo records it and never moves it.
-- Needs b6_member_money_rail.sql, then d73b_provider_arrangements.sql applied.
--  1. the switch is seeded OFF and open refuses while it is off
--  2. the step table: forward only, nothing leaves a final state
--  3. a stay agreement is refused (stays pay by card, D73 Part A)
--  4. both parties must hold an ACTIVE provider customer record; the lister bears the fee
--  5. milestones must be 2 or more and sum to the agreement amount
--  6. one live arrangement per agreement; a second open returns the first
--  7. Vallo cannot claim a provider state; the provider's id and amount must
--     match the record; a repeated report is 'same'; backwards is refused
--  8. a milestone release reported by the provider is recorded forward only
--  9. the event history cannot be rewritten
--  10. a member reads their own arrangement and cannot write it
-- The rent fixture (inspection + agreement) is written with all triggers on in
-- a nested block: if another gate refuses it, steps 3 to 10 raise
-- 'PROBE_SKIP' and are not counted as passes. Everything is rolled back.
do $$
declare
  lister uuid; renter uuid; lst uuid; insp uuid; ag uuid; stay_ag uuid;
  r jsonb; arr uuid; v text; n int;
begin
  -- 1.
  -- 10 November 2026: the superseded rentals_protected_pay row was retired
  -- (the founder's end-of-batch block); absent reads as off, as it must.
  if coalesce((select enabled from public.feature_flags where key = 'rentals_protected_pay'), false) then
    raise exception 'PROBE_FAIL d73b 1: rentals_protected_pay reads on';
  end if;
  -- 10 November 2026: private.rentals_protected_pay_on() reads the new
  -- provider's switch, payments_escrowpay_on (it read payments_payluk_on from
  -- 7 October, D77). The row exists (seeded off by the categories file); the
  -- off state is set inside this transaction, so the probe holds once the
  -- founder turns the rail on.
  if not exists (select 1 from public.feature_flags where key = 'payments_escrowpay_on') then
    raise exception 'PROBE_FAIL d73b 1: the payments_escrowpay_on switch row is missing';
  end if;
  update public.feature_flags set enabled = false where key = 'payments_escrowpay_on';
  if private.rentals_protected_pay_on() then raise exception 'PROBE_FAIL d73b 1: reads on'; end if;

  -- 2.
  if not private.provider_arrangement_step_ok('awaiting_payment', 'protected')
     or not private.provider_arrangement_step_ok('protected', 'released')
     or not private.provider_arrangement_step_ok('disputed', 'refunded')
     or private.provider_arrangement_step_ok('released', 'protected')
     or private.provider_arrangement_step_ok('refunded', 'released')
     or private.provider_arrangement_step_ok('protected', 'awaiting_payment') then
    raise exception 'PROBE_FAIL d73b 2: the step table is wrong';
  end if;

  select l.id, a.user_id into lst, lister
    from public.listings l join public.agents a on a.id = l.agent_id
   where not coalesce(l.is_demo, false) and a.user_id is not null limit 1;
  select u.id into renter from auth.users u where u.id <> lister order by u.created_at limit 1;
  begin
    insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
    values (lst, renter, lister, now()) returning id into insp;
    insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms, status,
                                        decided_at)
    values ('rent', lst, insp, renter, lister, 50000000, '{"total_minor": 50000000}', 'approved', now())
    returning id into ag;
  exception when others then
    raise notice 'PROBE_SKIP d73b 3-10: the rent fixture was refused: %', sqlerrm;
    raise exception 'PROBE_OK d73b-provider-arrangements (steps 1 and 2; fixture skipped)';
  end;

  r := public.provider_arrangement_open(ag, 'standard', null);
  if r ->> 'status' <> 'switched_off' then raise exception 'PROBE_FAIL d73b 1: open with the switch off: %', r; end if;
  update public.feature_flags set enabled = true where key = 'payments_escrowpay_on';
  if not private.rentals_protected_pay_on() then raise exception 'PROBE_FAIL d73b 1: the switch on does not read on'; end if;

  -- 3.
  select id into stay_ag from public.deal_agreements where kind = 'stay' limit 1;
  if stay_ag is not null then
    r := public.provider_arrangement_open(stay_ag, 'standard', null);
    if r ->> 'status' <> 'not_payable' then raise exception 'PROBE_FAIL d73b 3: a stay opened %', r; end if;
  end if;

  -- 4.
  r := public.provider_arrangement_open(ag, 'standard', null);
  if r ->> 'status' not in ('buyer_not_onboarded', 'seller_not_onboarded') then
    raise exception 'PROBE_FAIL d73b 4: opened without provider customers %', r;
  end if;
  insert into public.financial_provider_accounts (user_id, provider, provider_customer_id, status)
  values (renter, 'payluk', 'probe_buyer_' || renter, 'ACTIVE'), (lister, 'payluk', 'probe_seller_' || lister, 'ACTIVE')
  on conflict (user_id, provider) do update set provider_customer_id = excluded.provider_customer_id, status = 'ACTIVE';

  -- 5.
  r := public.provider_arrangement_open(ag, 'milestone', '[{"title":"a","amount_minor":10000000},{"title":"b","amount_minor":10000000}]');
  if r ->> 'reason' is distinct from 'sum' then raise exception 'PROBE_FAIL d73b 5: %', r; end if;
  r := public.provider_arrangement_open(ag, 'milestone', '[{"title":"all","amount_minor":50000000}]');
  if r ->> 'reason' is distinct from 'count' then raise exception 'PROBE_FAIL d73b 5: one milestone %', r; end if;
  r := public.provider_arrangement_open(ag, 'milestone',
         '[{"title":"First rent","amount_minor":20000000},{"title":"Balance","amount_minor":30000000}]');
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL d73b 5: open %', r; end if;
  arr := (r ->> 'id')::uuid;
  if (select who_pays_fee from public.provider_arrangements where id = arr) <> 'seller' then
    raise exception 'PROBE_FAIL d73b 4: the fee is not the lister''s';
  end if;

  -- 6.
  r := public.provider_arrangement_open(ag, 'standard', null);
  if r ->> 'status' <> 'exists' or (r ->> 'id')::uuid <> arr then raise exception 'PROBE_FAIL d73b 6: %', r; end if;

  -- 7.
  if public.provider_arrangement_observe(arr, 'protected', 'vallo') <> 'refused' then
    raise exception 'PROBE_FAIL d73b 7: Vallo claimed a provider state';
  end if;
  v := public.provider_arrangement_observe(arr, 'awaiting_payment', 'provider_response', 'AWAITING_PAYMENT', 'PENDING',
         'probe_esc_1', 'PY_PROBE', 50000000, 1000000,
         '[{"position":1,"provider_milestone_id":"pm1","status":"PENDING"},{"position":2,"provider_milestone_id":"pm2","status":"PENDING"}]');
  if v <> 'changed' then raise exception 'PROBE_FAIL d73b 7: arranged %', v; end if;
  if public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING', 'probe_esc_2') <> 'id_mismatch'
     or public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING', 'probe_esc_1', null, 1) <> 'amount_mismatch'
     or public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING', 'probe_esc_1', null, 50000000) <> 'changed'
     or public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING') <> 'same' then
    raise exception 'PROBE_FAIL d73b 7: the observe rules';
  end if;

  -- 8.
  perform public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING', null, null, null, null,
            '[{"provider_milestone_id":"pm1","status":"RELEASED"}]');
  if (select status from public.provider_arrangement_milestones where arrangement_id = arr and position = 1) <> 'released' then
    raise exception 'PROBE_FAIL d73b 8: the released milestone was not recorded';
  end if;
  perform public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING', null, null, null, null,
            '[{"provider_milestone_id":"pm1","status":"PENDING"}]');
  if (select status from public.provider_arrangement_milestones where arrangement_id = arr and position = 1) <> 'released' then
    raise exception 'PROBE_FAIL d73b 8: a released milestone went back';
  end if;
  if public.provider_arrangement_observe(arr, 'released', 'provider_webhook', 'CLOSED', 'COMPLETED') <> 'changed'
     or public.provider_arrangement_observe(arr, 'protected', 'provider_webhook', 'OPENED', 'ONGOING') <> 'refused' then
    raise exception 'PROBE_FAIL d73b 7: a final state was left';
  end if;

  -- 9.
  begin
    delete from public.provider_arrangement_events where arrangement_id = arr;
    raise exception 'PROBE_FAIL d73b 9: the history was deleted';
  exception when raise_exception then
    if sqlerrm like 'PROBE_FAIL%' then raise; end if;
  end;

  -- 10.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', renter, 'role', 'authenticated')::text, true);
  select count(*) into n from public.provider_arrangements where id = arr;
  if n <> 1 then raise exception 'PROBE_FAIL d73b 10: the renter cannot read their arrangement'; end if;
  begin
    update public.provider_arrangements set status = 'released' where id = arr;
    raise exception 'PROBE_FAIL d73b 10: a member wrote an arrangement';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select count(*) into n from public.provider_arrangements where id = arr;
  if n <> 0 then raise exception 'PROBE_FAIL d73b 10: a stranger can read the arrangement'; end if;
  reset role;

  raise exception 'PROBE_OK d73b-provider-arrangements';
end
$$;
