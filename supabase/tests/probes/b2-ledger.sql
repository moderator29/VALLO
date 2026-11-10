-- (9 November 2026: the escrow commission assertions described below were
-- retired with ledger_record_payluk_commission; see the dated note in the body.)
-- B2 LEDGER (pending migration b2_ledger): three pots as three tables; an
-- entry is written once per key and a disagreeing replay is refused; a
-- correction is a new entry that moves the opposite way and never exceeds
-- what it corrects; no entry can be updated, deleted or truncated; the
-- fourteen event types and the per-pot exclusions hold; escrow commission is
-- a paired movement out of customer funds and into revenue, refused off the
-- escrow rail; a direct settlement written to ledger_entries posts pot entries
-- that net customer funds to zero and put the commission in revenue; members
-- read nothing, and service_role reads but cannot write directly.
-- Also: a correction of a correction, or on another transaction, is refused;
-- escrow commission is refused on a payment that has not succeeded; an
-- escrow-rail ledger_entries row posts nothing; a refund row (negative, no
-- transaction) posts REFUND_* entries, status 'pending' and attributed to no
-- charge (transaction_id and provider_reference NULL, booking and charge ids
-- in metadata), netting customer funds to zero and reversing the commission
-- out of revenue; pending refunds move no confirmed balance; a booking with
-- a successful escrow charge posts no refund here; service_role has no
-- MAINTAIN on any pot or on the balance view.
--
-- Live fixtures: every hotel listing is is_demo and bookings refuse a demo
-- listing, so the probe clears is_demo on its listing first. The block always
-- ends in a raise, so everything rolls back.
do $$
declare
  v_guest uuid;
  v_guest2 uuid;
  v_listing uuid;
  b uuid := gen_random_uuid();
  tx_direct uuid := gen_random_uuid();
  tx_escrow uuid := gen_random_uuid();
  tx_escrow_pending uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  tx_d1 uuid := gen_random_uuid();
  tx_d2 uuid := gen_random_uuid();
  bal_cf bigint;
  bal_rev bigint;
  le_refund uuid;
  e1 uuid;
  e2 uuid;
  c1 uuid;
  refused boolean;
  t text;
  net bigint;
  tg name;
begin
  select id into v_guest from auth.users order by created_at limit 1;
  select id into v_guest2 from auth.users where id <> v_guest order by created_at limit 1;
  select l.id into v_listing from public.listings l where l.property_type = 'hotel' limit 1;
  if v_guest is null or v_guest2 is null or v_listing is null then
    raise exception 'PROBE_FAIL b2-ledger: fixtures missing (a user, a hotel listing)';
  end if;
  -- Rolled back with the block: bookings refuse a demo listing, and the
  -- supply-proof gate (SCUML item 17) refuses to un-demo an agent listing, so
  -- it is lifted for this transaction only, as crypto-pay-2 and chargebacks do.
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = v_listing;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b, v_listing, v_guest, current_date + 420, current_date + 421, 1, 10000, 10000, 10000);
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  -- One whole success per booking (transactions_one_whole_success_per_booking),
  -- so the escrow charge is a flatmate share of the same booking.
  insert into public.transactions (id, booking_id, provider, provider_ref, amount_minor, currency, status, rail, share_payer_id)
  values (tx_direct, b, 'paystack', 'probe-b2-ledger-d-' || b::text, 10000, 'NGN', 'SUCCESSFUL', 'direct', null),
         (tx_escrow, b, 'paystack', 'probe-b2-ledger-e-' || b::text, 10000, 'NGN', 'SUCCESSFUL', 'escrow', v_guest),
         (tx_escrow_pending, b, 'paystack', 'probe-b2-ledger-ep-' || b::text, 10000, 'NGN', 'PENDING', 'escrow', null);
  perform set_config('vallo.recording_unknown_charge', '', true);

  -- Idempotent on the key; a disagreeing replay is refused.
  e1 := public.ledger_record('vallo_revenue', 'probe-b2-key-1', 'FEE_CHARGED', 'in', 500, 'NGN', 'vallo');
  e2 := public.ledger_record('vallo_revenue', 'probe-b2-key-1', 'FEE_CHARGED', 'in', 500, 'NGN', 'vallo');
  if e1 is null or e1 <> e2 then raise exception 'PROBE_FAIL b2-ledger: a replay wrote a second entry'; end if;
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-key-1', 'FEE_CHARGED', 'in', 501, 'NGN', 'vallo');
  exception when unique_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a disagreeing replay was accepted'; end if;

  -- Corrections: opposite direction, never more than the original.
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-corr-same', 'FEE_CHARGED', 'in', 100, 'NGN', 'vallo', p_corrects => e1);
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a same-direction correction was accepted'; end if;
  c1 := public.ledger_record('vallo_revenue', 'probe-b2-corr-1', 'FEE_CHARGED', 'out', 300, 'NGN', 'vallo', p_corrects => e1);
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-corr-2', 'FEE_CHARGED', 'out', 201, 'NGN', 'vallo', p_corrects => e1);
  exception when check_violation then refused := true;
  end;
  if c1 is null or not refused then raise exception 'PROBE_FAIL b2-ledger: corrections may exceed the entry'; end if;
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-corr-corr', 'FEE_CHARGED', 'in', 100, 'NGN', 'vallo', p_corrects => c1);
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a correction of a correction was accepted'; end if;
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-corr-tx', 'FEE_CHARGED', 'out', 1, 'NGN', 'vallo',
                                 p_transaction => tx_direct, p_corrects => e1);
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a correction on another transaction was accepted'; end if;

  -- The fourteen types, and what each pot may not carry.
  refused := false;
  begin
    perform public.ledger_record('customer_funds', 'probe-b2-bad-type', 'BALANCE_ADJUSTED', 'in', 1, 'NGN', 'paystack');
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: an unknown event type was accepted'; end if;
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-rev-escrow', 'ESCROW_FUNDED', 'in', 1, 'NGN', 'payluk');
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: revenue accepted an escrow event'; end if;
  refused := false;
  begin
    perform public.ledger_record('marketing_float', 'probe-b2-float-pl', 'DEPOSIT_CONFIRMED', 'in', 1, 'NGN', 'payluk');
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: the float accepted a Payluk entry'; end if;

  -- 9 November 2026: the escrow commission checks that stood here are gone.
  -- They exercised public.ledger_record_payluk_commission, which no code has
  -- ever called (its only wrapper, recordEscrowCommission, was removed as dead
  -- code that day) and which the founder's SQL block drops with the rest of
  -- the retired Payluk rail. Every other ledger rule above and below is kept.

  -- Direct settlement posts the pots, netting customer funds to zero.
  insert into public.ledger_entries (booking_id, transaction_id, gross_minor, platform_fee_minor, agent_share_minor,
                                     processor_fee_minor, guarantee_reserve_minor, net_settlement_minor)
  values (b, tx_direct, 10000, 200, 9650, 150, 0, 9650);
  select coalesce(sum(case direction when 'in' then amount_minor else -amount_minor end), 0) into net
    from public.ledger_customer_funds where transaction_id = tx_direct;
  if net <> 0 or (select count(*) from public.ledger_customer_funds where transaction_id = tx_direct) <> 4 then
    raise exception 'PROBE_FAIL b2-ledger: a direct settlement did not net customer funds to zero (net %)', net;
  end if;
  if (select sum(amount_minor) from public.ledger_vallo_revenue where transaction_id = tx_direct and direction = 'in') is distinct from 200 then
    raise exception 'PROBE_FAIL b2-ledger: the direct commission did not land in revenue';
  end if;

  -- An escrow-rail settlement row posts nothing to the direct path.
  insert into public.ledger_entries (booking_id, transaction_id, gross_minor, platform_fee_minor, agent_share_minor,
                                     processor_fee_minor, guarantee_reserve_minor, net_settlement_minor)
  values (b, tx_escrow, 10000, 200, 9650, 150, 0, 9650);
  if exists (select 1 from public.ledger_customer_funds where idempotency_key like 'settle:' || tx_escrow::text || ':%') then
    raise exception 'PROBE_FAIL b2-ledger: an escrow-rail row was posted as a direct settlement';
  end if;

  -- A refund row (negative, no transaction, as the refund writers insert it).
  -- The booking b has a successful escrow charge, so it posts nothing here.
  insert into public.ledger_entries (booking_id, transaction_id, gross_minor, platform_fee_minor, agent_share_minor,
                                     processor_fee_minor, guarantee_reserve_minor, net_settlement_minor)
  values (b, null, -1000, -20, -965, -15, 0, -1000)
  returning id into le_refund;
  if exists (select 1 from public.ledger_customer_funds where idempotency_key like 'refund:' || b::text || ':%')
     or exists (select 1 from public.ledger_vallo_revenue where idempotency_key like 'refund:' || b::text || ':%') then
    raise exception 'PROBE_FAIL b2-ledger: a refund on a booking with an escrow charge was posted';
  end if;

  -- A direct-only booking with two cards (flatmates): the refund posts
  -- pending, attributed to neither charge.
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b2, v_listing, v_guest, current_date + 430, current_date + 431, 1, 10000, 10000, 10000);
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  -- Two flatmates' shares: one success per payer (transactions_one_share_success_per_payer).
  insert into public.transactions (id, booking_id, provider, provider_ref, amount_minor, currency, status, rail, created_at, share_payer_id)
  values (tx_d1, b2, 'paystack', 'probe-b2-ledger-d1-' || b2::text, 5000, 'NGN', 'SUCCESSFUL', 'direct', now() - interval '1 minute', v_guest),
         (tx_d2, b2, 'paystack', 'probe-b2-ledger-d2-' || b2::text, 5000, 'NGN', 'SUCCESSFUL', 'direct', now(), v_guest2);
  perform set_config('vallo.recording_unknown_charge', '', true);
  select coalesce(sum(balance_minor) filter (where pot = 'customer_funds'), 0),
         coalesce(sum(balance_minor) filter (where pot = 'vallo_revenue'), 0)
    into bal_cf, bal_rev from public.ledger_balances_by_book where currency = 'NGN';
  insert into public.ledger_entries (booking_id, transaction_id, gross_minor, platform_fee_minor, agent_share_minor,
                                     processor_fee_minor, guarantee_reserve_minor, net_settlement_minor)
  values (b2, null, -1000, -20, -965, -15, 0, -1000)
  returning id into le_refund;
  select coalesce(sum(case direction when 'in' then amount_minor else -amount_minor end), 0) into net
    from public.ledger_customer_funds where idempotency_key like 'refund:' || b2::text || ':' || le_refund::text || ':%';
  if net <> 0 or not exists (select 1 from public.ledger_customer_funds
                              where idempotency_key = 'refund:' || b2::text || ':' || le_refund::text || ':refunded'
                                and event_type = 'REFUND_COMPLETED' and direction = 'out' and amount_minor = 1000) then
    raise exception 'PROBE_FAIL b2-ledger: a refund did not reach customer funds netting to zero (net %)', net;
  end if;
  if not exists (select 1 from public.ledger_vallo_revenue
                  where idempotency_key = 'refund:' || b2::text || ':' || le_refund::text || ':commission'
                    and event_type = 'REFUND_COMPLETED' and direction = 'out' and amount_minor = 20) then
    raise exception 'PROBE_FAIL b2-ledger: a refund did not reverse the commission in revenue';
  end if;
  if exists (select 1 from (select transaction_id, provider_reference, status, metadata from public.ledger_customer_funds
                             where idempotency_key like 'refund:' || b2::text || ':%'
                            union all
                            select transaction_id, provider_reference, status, metadata from public.ledger_vallo_revenue
                             where idempotency_key like 'refund:' || b2::text || ':%') r
              where r.transaction_id is not null or r.provider_reference is not null or r.status <> 'pending'
                 or r.metadata->>'booking_id' is distinct from b2::text
                 or not (r.metadata->'charges' @> jsonb_build_array(tx_d1, tx_d2))) then
    raise exception 'PROBE_FAIL b2-ledger: a refund entry was attributed to a charge, not pending, or lacks booking/charges metadata';
  end if;
  if (select coalesce(sum(balance_minor) filter (where pot = 'customer_funds'), 0) from public.ledger_balances_by_book where currency = 'NGN') <> bal_cf
     or (select coalesce(sum(balance_minor) filter (where pot = 'vallo_revenue'), 0) from public.ledger_balances_by_book where currency = 'NGN') <> bal_rev then
    raise exception 'PROBE_FAIL b2-ledger: a pending refund moved a confirmed balance';
  end if;

  -- No MAINTAIN for service_role (PG17 default ACL).
  foreach t in array array['ledger_customer_funds', 'ledger_vallo_revenue', 'ledger_marketing_float', 'ledger_balances_by_book'] loop
    if has_table_privilege('service_role', 'public.' || t, 'maintain') then
      raise exception 'PROBE_FAIL b2-ledger: service_role holds MAINTAIN on %', t;
    end if;
  end loop;

  -- Append-only, in every pot: one real row each, then update, delete and truncate.
  perform public.ledger_record('marketing_float', 'probe-b2-float-1', 'DEPOSIT_CONFIRMED', 'in', 1000, 'NGN', 'vallo');
  foreach t in array array['ledger_customer_funds', 'ledger_vallo_revenue', 'ledger_marketing_float'] loop
    execute format('select id from public.%I limit 1', t) into e2;
    if e2 is null then raise exception 'PROBE_FAIL b2-ledger: % has no row to test', t; end if;
    refused := false;
    begin
      execute format('update public.%I set metadata = metadata where id = $1', t) using e2;
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then raise exception 'PROBE_FAIL b2-ledger: % accepted an update', t; end if;
    refused := false;
    begin
      execute format('%s %s public.%I where id = $1', 'delete', 'from', t) using e2;
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then raise exception 'PROBE_FAIL b2-ledger: % accepted a delete', t; end if;
    refused := false;
    begin
      execute format('truncate public.%I', t);
    -- Refused either by the no-truncate trigger (42501) or, for a pot another
    -- table references (promotion.purchases -> ledger_vallo_revenue), by
    -- Postgres itself before any trigger runs (0A000). Both are a refusal.
    exception when insufficient_privilege or feature_not_supported then refused := true;
    end;
    if not refused then raise exception 'PROBE_FAIL b2-ledger: % accepted a truncate', t; end if;
  end loop;

  -- Who can see and write.
  set local role authenticated;
  refused := false;
  begin
    perform 1 from public.ledger_customer_funds limit 1;
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a member read customer funds'; end if;
  refused := false;
  begin
    perform public.ledger_record('vallo_revenue', 'probe-b2-member', 'FEE_CHARGED', 'in', 1, 'NGN', 'vallo');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: a member wrote revenue'; end if;
  reset role;
  set local role service_role;
  perform 1 from public.ledger_vallo_revenue limit 1;
  refused := false;
  begin
    insert into public.ledger_vallo_revenue (idempotency_key, provider, event_type, amount_minor, currency, direction)
    values ('probe-b2-direct-write', 'vallo', 'FEE_CHARGED', 1, 'NGN', 'in');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL b2-ledger: service_role wrote a pot directly'; end if;
  reset role;

  raise exception 'PROBE_OK b2-ledger';
end
$$;
