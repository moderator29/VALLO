-- The revenue sweep, end to end on the throwaway database. Ends E2E_OK.
\set ON_ERROR_STOP on

do $e2e$
declare
  v_ag    uuid;
  v_arr   uuid;
  v_open  jsonb;
  v_sweep uuid;
  v_state jsonb;
  v_n     bigint;
  v_amt   bigint;
begin
  -- ---------------------------------------------------- revenue when earned
  insert into public.deal_agreements default values returning id into v_ag;
  insert into public.provider_arrangements (agreement_id, reference, provider_arrangement_id, amount_minor, status, environment, vallo_commission_bps)
  values (v_ag, 'vallo-pp-e2e', 'TXN_e2e', 180000_00, 'protected', 'sandbox', 200)
  returning id into v_arr;

  -- Nothing is earned while the money is still held.
  select count(*) into v_n from public.ledger_vallo_revenue;
  if v_n <> 0 then raise exception 'E2E_FAIL: revenue recorded before the payment was released (%)', v_n; end if;

  update public.provider_arrangements set status = 'released' where id = v_arr;

  select amount_minor into v_amt from public.ledger_vallo_revenue where direction = 'in';
  if v_amt is distinct from 360000 then
    raise exception 'E2E_FAIL: expected 2 percent of 180,000.00 as 360000 kobo, got %', v_amt;
  end if;

  -- A second report of the same release writes nothing more.
  update public.provider_arrangements set status = 'protected' where id = v_arr;
  update public.provider_arrangements set status = 'released' where id = v_arr;
  select count(*) into v_n from public.ledger_vallo_revenue where direction = 'in';
  if v_n <> 1 then raise exception 'E2E_FAIL: a repeated release wrote % revenue rows', v_n; end if;

  -- A payment opened before this file ran carries no share and earns nothing.
  insert into public.provider_arrangements (agreement_id, reference, amount_minor, status, environment)
  values (v_ag, 'vallo-pp-old', 50000_00, 'protected', 'sandbox') returning id into v_arr;
  update public.provider_arrangements set status = 'released' where id = v_arr;
  select count(*) into v_n from public.ledger_vallo_revenue where direction = 'in';
  if v_n <> 1 then raise exception 'E2E_FAIL: a payment with no recorded share earned revenue'; end if;

  -- A payment on another provider is not this trigger's business.
  insert into public.provider_arrangements (agreement_id, provider, reference, amount_minor, status, vallo_commission_bps)
  values (v_ag, 'paystack', 'vallo-ps-1', 90000_00, 'protected', 200) returning id into v_arr;
  update public.provider_arrangements set status = 'released' where id = v_arr;
  select count(*) into v_n from public.ledger_vallo_revenue where direction = 'in';
  if v_n <> 1 then raise exception 'E2E_FAIL: another provider went through the escrowpay trigger'; end if;

  -- ------------------------------------------------------------- the sweep
  v_state := public.revenue_sweep_state('escrowpay', 'sandbox');
  if (v_state ->> 'unsettled')::boolean then raise exception 'E2E_FAIL: unsettled with no sweep at all'; end if;
  if v_state -> 'last' <> 'null'::jsonb then raise exception 'E2E_FAIL: a last sweep out of nowhere'; end if;

  v_open := public.revenue_sweep_open('escrowpay', 'sandbox', 'ngn', 360000, 'WAL_1');
  if v_open ->> 'status' <> 'ok' then raise exception 'E2E_FAIL: the first sweep did not open: %', v_open; end if;
  v_sweep := (v_open ->> 'id')::uuid;

  -- The currency is stored as the ledger wants it, whatever case it arrived in.
  if (select currency from public.provider_revenue_sweeps where id = v_sweep) <> 'NGN' then
    raise exception 'E2E_FAIL: the currency was not upper-cased';
  end if;

  -- While one is open, no second sweep can start.
  if public.revenue_sweep_open('escrowpay', 'sandbox', 'NGN', 100000, 'WAL_1') ->> 'status' <> 'already_open' then
    raise exception 'E2E_FAIL: two sweeps opened at once, so one balance could be sent twice';
  end if;
  select count(*) into v_n from public.provider_revenue_sweeps;
  if v_n <> 1 then raise exception 'E2E_FAIL: % sweep rows after a refused second open', v_n; end if;

  v_state := public.revenue_sweep_state('escrowpay', 'sandbox');
  if not (v_state ->> 'unsettled')::boolean then raise exception 'E2E_FAIL: an open sweep did not read as unsettled'; end if;

  -- A refused amount changes nothing.
  if public.revenue_sweep_open('escrowpay', 'production', 'NGN', 0, 'WAL_1') ->> 'status' <> 'refused' then
    raise exception 'E2E_FAIL: a sweep of nothing was allowed';
  end if;

  -- ------------------------------------------------------------- settling
  if public.revenue_sweep_settle(v_sweep, 'processing', 'POT_1', null) ->> 'status' <> 'refused' then
    raise exception 'E2E_FAIL: an unknown settle status was accepted';
  end if;
  if public.revenue_sweep_settle(gen_random_uuid(), 'sent', 'POT_x', null) ->> 'status' <> 'not_found' then
    raise exception 'E2E_FAIL: a sweep that does not exist was settled';
  end if;

  perform public.revenue_sweep_settle(v_sweep, 'sent', 'POT_1', null);
  select amount_minor into v_amt from public.ledger_vallo_revenue where direction = 'out';
  if v_amt is distinct from 360000 then raise exception 'E2E_FAIL: the money that left was recorded as %', v_amt; end if;
  if (select provider_reference from public.ledger_vallo_revenue where direction = 'out') <> 'POT_1' then
    raise exception 'E2E_FAIL: the ledger row does not name the provider payout';
  end if;

  -- Settling twice writes one ledger row.
  perform public.revenue_sweep_settle(v_sweep, 'sent', 'POT_1', null);
  select count(*) into v_n from public.ledger_vallo_revenue where direction = 'out';
  if v_n <> 1 then raise exception 'E2E_FAIL: settling twice wrote % rows out', v_n; end if;

  -- The book now reads as what is still at the partner: in minus out, zero here.
  select coalesce(sum(case when direction = 'in' then amount_minor else -amount_minor end), 0)
    into v_amt from public.ledger_vallo_revenue;
  if v_amt <> 0 then raise exception 'E2E_FAIL: the revenue book reads % after everything was swept', v_amt; end if;

  -- The desk's figure for what is still at the partner: in minus out.
  if (public.revenue_sweep_state('escrowpay', 'sandbox') ->> 'at_partner_minor')::bigint <> 0 then
    raise exception 'E2E_FAIL: at_partner_minor is % after everything was swept',
      (public.revenue_sweep_state('escrowpay', 'sandbox') ->> 'at_partner_minor');
  end if;

  -- With that one settled, the next sweep may open.
  v_open := public.revenue_sweep_open('escrowpay', 'sandbox', 'NGN', 50000, 'WAL_1');
  if v_open ->> 'status' <> 'ok' then raise exception 'E2E_FAIL: a settled sweep still blocks the next one'; end if;
  v_sweep := (v_open ->> 'id')::uuid;

  -- A failure keeps its reason, writes no ledger row, and frees the next one.
  perform public.revenue_sweep_settle(v_sweep, 'failed', null, 'The partner refused: insufficient balance.');
  select count(*) into v_n from public.ledger_vallo_revenue where direction = 'out';
  if v_n <> 1 then raise exception 'E2E_FAIL: a failed sweep wrote a ledger row'; end if;
  if (select failure from public.provider_revenue_sweeps where id = v_sweep) is null then
    raise exception 'E2E_FAIL: a failed sweep kept no reason';
  end if;

  -- An unknown answer keeps the gate shut until a person or a later run settles it.
  v_open := public.revenue_sweep_open('escrowpay', 'sandbox', 'NGN', 70000, 'WAL_1');
  v_sweep := (v_open ->> 'id')::uuid;
  perform public.revenue_sweep_settle(v_sweep, 'unknown', null, 'The request timed out.');
  if public.revenue_sweep_open('escrowpay', 'sandbox', 'NGN', 70000, 'WAL_1') ->> 'status' <> 'already_open' then
    raise exception 'E2E_FAIL: a sweep nobody can account for did not hold the gate';
  end if;
  if not (public.revenue_sweep_state('escrowpay', 'sandbox') ->> 'unsettled')::boolean then
    raise exception 'E2E_FAIL: an unknown sweep did not read as unsettled';
  end if;

  -- The two books do not mix: production has its own gate.
  if public.revenue_sweep_open('escrowpay', 'production', 'NGN', 70000, 'WAL_2') ->> 'status' <> 'ok' then
    raise exception 'E2E_FAIL: the sandbox gate blocked the production book';
  end if;

  -- Every move is on the audit log.
  select count(*) into v_n from public.audit_log where action like 'revenue.sweep.%';
  if v_n < 6 then raise exception 'E2E_FAIL: only % audit rows for the sweeps', v_n; end if;

  raise notice 'E2E_OK';
end;
$e2e$;
