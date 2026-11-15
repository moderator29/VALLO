/*
 * ============================================================================
 * VALLO'S OWN EARNINGS: RECORDED WHEN THEY ARE EARNED, AND MOVED TO VALLO'S
 * BANK (the founder, 15 November 2026: "wire our 2% ... then the sweep to
 * bank").
 * ============================================================================
 *
 * NOT APPLIED. Only the founder runs it, in the Supabase SQL editor.
 *
 * WHAT THIS IS FOR. Vallo now names its own share on every protected payment
 * (`marketplace_commission_bps`, 2 percent). The payment partner credits that
 * share to Vallo's own wallet at the partner, where it sits until somebody
 * moves it. On the card rail the same money lands in Vallo's bank by itself,
 * because Vallo's share is simply the remainder of a Paystack split. Here it
 * does not. This file gives that money a record and a way home.
 *
 * WHAT IT ADDS, and nothing else:
 *
 *   1. `provider_arrangements.vallo_commission_bps`
 *      The share that was actually sent to the partner for that one payment.
 *      Written by the app when the payment is opened. Nullable: every payment
 *      opened before this file ran simply has no figure, and earns no
 *      recorded revenue, which is the truthful answer for those.
 *
 *   2. A trigger that records the revenue WHEN A PAYMENT IS RELEASED.
 *      One row in `ledger_vallo_revenue`, direction `in`, worked out from the
 *      amount and the share on that payment's own record. Idempotent: the
 *      ledger's unique key means a second release report writes nothing.
 *
 *   3. `provider_revenue_sweeps`
 *      One row per attempt to move the wallet balance to Vallo's bank: what
 *      was asked for, what the partner answered, and when. A partial unique
 *      index allows only ONE unfinished sweep at a time, so the same balance
 *      can never be sent twice.
 *
 *   4. Three functions, service role only, for the job that does the moving:
 *      `revenue_sweep_state`, `revenue_sweep_open`, `revenue_sweep_settle`.
 *      A finished sweep writes its own `out` row in the ledger, so the Vallo
 *      revenue book reads as "Vallo's money still sitting at the partner".
 *
 *   5. `escrowpay` becomes an allowed provider on `ledger_vallo_revenue`,
 *      and the dead `payluk` is dropped from that list. The table is empty
 *      today, so neither change can touch a record.
 *
 * WHAT IT DOES NOT DO. It moves no money by itself. The job stays asleep
 * until BOTH the switch `payments_escrowpay_sweep_on` is on AND the
 * deployment has `ESCROWPAY_SWEEP_PAYOUT_ACCOUNT_ID` set to Vallo's own
 * payout account at the partner. It reads nothing a member can see, grants
 * nothing to `anon` or `authenticated`, and changes no existing function.
 *
 * SAFE TO RUN TWICE. Every part is `if not exists` or a replace. It makes no
 * destructive change and drops no data.
 *
 * CHECKED READ-ONLY AGAINST THE LIVE DATABASE ON 15 NOVEMBER 2026:
 *   - `ledger_vallo_revenue` exists, holds 0 rows, and its provider check is
 *     ('paystack', 'payluk', 'vallo');
 *   - `private.is_ledger_event` admits FEE_CHARGED, WITHDRAWAL_INITIATED and
 *     WITHDRAWAL_COMPLETED, and the table's own check forbids the five
 *     ESCROW_/DEPOSIT_ events, none of which are used here;
 *   - `provider_arrangements` has `amount_minor`, `currency`, `status`,
 *     `environment` and `reference`, and no `vallo_commission_bps`.
 *
 * A clean run ends with the notice
 *   revenue_sweep_2026-11-15: self-check passed
 */

begin;

set local lock_timeout = '5s';

-- ------------------------------------------------- 1. the share on a payment
alter table public.provider_arrangements
  add column if not exists vallo_commission_bps integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_arrangements'::regclass
      and conname = 'provider_arrangements_vallo_commission_bps_check'
  ) then
    alter table public.provider_arrangements
      add constraint provider_arrangements_vallo_commission_bps_check
      check (vallo_commission_bps is null or (vallo_commission_bps >= 0 and vallo_commission_bps <= 10000));
  end if;
end;
$$;

comment on column public.provider_arrangements.vallo_commission_bps is
  'Vallo''s own share of this one payment, in basis points, exactly as it was sent to the payment partner as marketplace_commission_bps. Null for a payment opened before 15 November 2026.';

-- ------------------------------------------- 2. the ledger accepts escrowpay
alter table public.ledger_vallo_revenue
  drop constraint if exists ledger_vallo_revenue_provider_check;

alter table public.ledger_vallo_revenue
  add constraint ledger_vallo_revenue_provider_check
  check (provider = any (array['paystack'::text, 'escrowpay'::text, 'vallo'::text]));

-- --------------------------------------------- 3. revenue recorded when earned
create or replace function private.record_vallo_commission()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_amount bigint;
begin
  /* Only the move INTO released, only on this provider, and only where the
     payment carries the share that was sent. Anything else: nothing. */
  if new.status is distinct from 'released' then return new; end if;
  if old.status is not distinct from 'released' then return new; end if;
  if new.provider is distinct from 'escrowpay' then return new; end if;
  if new.vallo_commission_bps is null or new.vallo_commission_bps = 0 then return new; end if;
  if new.amount_minor is null or new.amount_minor <= 0 then return new; end if;

  /* Rounded up to the kobo, the same way the app rounds a fee, so the two
     never disagree by a kobo on the same payment. */
  v_amount := ceil((new.amount_minor::numeric * new.vallo_commission_bps) / 10000)::bigint;
  if v_amount <= 0 then return new; end if;

  insert into public.ledger_vallo_revenue
    (idempotency_key, provider, provider_reference, rail, event_type, amount_minor, currency, direction, status, metadata)
  values
    ('commission:' || new.id::text,
     'escrowpay',
     new.provider_arrangement_id,
     'escrow',
     'FEE_CHARGED',
     v_amount,
     coalesce(new.currency, 'NGN'),
     'in',
     'confirmed',
     jsonb_build_object(
       'arrangement_id', new.id,
       'reference', new.reference,
       'amount_minor', new.amount_minor,
       'commission_bps', new.vallo_commission_bps,
       'environment', new.environment))
  on conflict (idempotency_key) do nothing;

  return new;
end;
$fn$;

drop trigger if exists record_vallo_commission on public.provider_arrangements;
create trigger record_vallo_commission
  after update of status on public.provider_arrangements
  for each row
  execute function private.record_vallo_commission();

-- --------------------------------------------------- 4. the sweeps themselves
create table if not exists public.provider_revenue_sweeps (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null check (provider = 'escrowpay'),
  environment    text not null check (environment in ('sandbox', 'production')),
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor   bigint not null check (amount_minor > 0),
  wallet_id      text,
  status         text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'unknown')),
  provider_payout_id text,
  failure        text,
  opened_at      timestamptz not null default now(),
  settled_at     timestamptz
);

comment on table public.provider_revenue_sweeps is
  'One row per attempt to move Vallo''s own earnings from its wallet at the payment partner to Vallo''s bank. Never a member''s money.';

/* ONE UNFINISHED SWEEP AT A TIME, per provider and book. This index is what
   stops the same balance being sent twice when two runs overlap. */
create unique index if not exists provider_revenue_sweeps_one_open
  on public.provider_revenue_sweeps (provider, environment)
  where status in ('sending', 'unknown');

create index if not exists provider_revenue_sweeps_recent
  on public.provider_revenue_sweeps (provider, environment, opened_at desc);

alter table public.provider_revenue_sweeps enable row level security;
revoke all on public.provider_revenue_sweeps from anon, authenticated;

-- ------------------------------------------------------------- 5. the three
create or replace function public.revenue_sweep_state(p_provider text, p_environment text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $fn$
  select jsonb_build_object(
    'unsettled', exists (
      select 1 from public.provider_revenue_sweeps s
      where s.provider = p_provider and s.environment = p_environment and s.status in ('sending', 'unknown')),
    'open', (
      select to_jsonb(x) from (
        select s.id, s.amount_minor, s.currency, s.wallet_id, s.status, s.opened_at
        from public.provider_revenue_sweeps s
        where s.provider = p_provider and s.environment = p_environment and s.status in ('sending', 'unknown')
        order by s.opened_at limit 1) x),
    'last', (
      select to_jsonb(x) from (
        select s.id, s.amount_minor, s.currency, s.status, s.provider_payout_id, s.failure, s.opened_at, s.settled_at
        from public.provider_revenue_sweeps s
        where s.provider = p_provider and s.environment = p_environment
        order by s.opened_at desc limit 1) x),
    'at_partner_minor', coalesce((
      select sum(case when l.direction = 'in' then l.amount_minor else -l.amount_minor end)
      from public.ledger_vallo_revenue l
      where l.provider = 'escrowpay' and l.status = 'confirmed'), 0),
    'swept_30d_minor', coalesce((
      select sum(s.amount_minor) from public.provider_revenue_sweeps s
      where s.provider = p_provider and s.environment = p_environment
        and s.status = 'sent' and s.settled_at > now() - interval '30 days'), 0));
$fn$;

create or replace function public.revenue_sweep_open(
  p_provider text, p_environment text, p_currency text, p_amount_minor bigint, p_wallet_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_id uuid;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    return jsonb_build_object('status', 'refused', 'why', 'amount');
  end if;
  begin
    insert into public.provider_revenue_sweeps (provider, environment, currency, amount_minor, wallet_id)
    values (p_provider, p_environment, upper(p_currency), p_amount_minor, p_wallet_id)
    returning id into v_id;
  exception
    when unique_violation then
      /* Another run holds the open sweep. This one does nothing at all. */
      return jsonb_build_object('status', 'already_open');
  end;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'revenue.sweep.opened', 'revenue_sweep', v_id::text,
          jsonb_build_object('amount_minor', p_amount_minor, 'currency', upper(p_currency), 'environment', p_environment));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$fn$;

create or replace function public.revenue_sweep_settle(
  p_id uuid, p_status text, p_provider_payout_id text, p_failure text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_row public.provider_revenue_sweeps;
begin
  if p_status not in ('sent', 'failed', 'unknown') then
    return jsonb_build_object('status', 'refused', 'why', 'status');
  end if;

  update public.provider_revenue_sweeps s
     set status = p_status,
         provider_payout_id = coalesce(p_provider_payout_id, s.provider_payout_id),
         failure = case when p_status = 'sent' then null else left(coalesce(p_failure, s.failure), 300) end,
         settled_at = case when p_status in ('sent', 'failed') then now() else s.settled_at end
   where s.id = p_id
   returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  /* Money that has left the partner reduces what Vallo still holds there.
     Idempotent by the ledger's own unique key, so settling twice writes once. */
  if p_status = 'sent' then
    insert into public.ledger_vallo_revenue
      (idempotency_key, provider, provider_reference, rail, event_type, amount_minor, currency, direction, status, metadata)
    values
      ('sweep:' || v_row.id::text, 'escrowpay', v_row.provider_payout_id, 'escrow', 'WITHDRAWAL_COMPLETED',
       v_row.amount_minor, v_row.currency, 'out', 'confirmed',
       jsonb_build_object('sweep_id', v_row.id, 'wallet_id', v_row.wallet_id, 'environment', v_row.environment))
    on conflict (idempotency_key) do nothing;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'revenue.sweep.' || p_status, 'revenue_sweep', v_row.id::text,
          jsonb_build_object('amount_minor', v_row.amount_minor, 'payout_id', v_row.provider_payout_id, 'failure', v_row.failure));

  return jsonb_build_object('status', 'ok', 'id', v_row.id, 'sweep_status', p_status);
end;
$fn$;

revoke all on function public.revenue_sweep_state(text, text) from public, anon, authenticated;
revoke all on function public.revenue_sweep_open(text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.revenue_sweep_settle(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.revenue_sweep_state(text, text) to service_role;
grant execute on function public.revenue_sweep_open(text, text, text, bigint, text) to service_role;
grant execute on function public.revenue_sweep_settle(uuid, text, text, text) to service_role;

commit;

-- --------------------------------------------------------------- SELF-CHECK
-- Raises unless every part is in place and refuses the people it should.
do $check$
declare
  v_count int;
begin
  if to_regclass('public.provider_revenue_sweeps') is null then
    raise exception 'revenue_sweep_2026-11-15: the sweeps table is missing';
  end if;

  select count(*) into v_count from information_schema.columns
   where table_schema = 'public' and table_name = 'provider_arrangements' and column_name = 'vallo_commission_bps';
  if v_count <> 1 then
    raise exception 'revenue_sweep_2026-11-15: provider_arrangements.vallo_commission_bps is missing';
  end if;

  select count(*) into v_count from pg_trigger
   where tgrelid = 'public.provider_arrangements'::regclass and tgname = 'record_vallo_commission';
  if v_count <> 1 then
    raise exception 'revenue_sweep_2026-11-15: the commission trigger is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ledger_vallo_revenue'::regclass
       and conname = 'ledger_vallo_revenue_provider_check'
       and pg_get_constraintdef(oid) like '%escrowpay%') then
    raise exception 'revenue_sweep_2026-11-15: the ledger still refuses escrowpay';
  end if;

  select count(*) into v_count from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('revenue_sweep_state', 'revenue_sweep_open', 'revenue_sweep_settle');
  if v_count <> 3 then
    raise exception 'revenue_sweep_2026-11-15: expected three sweep functions, found %', v_count;
  end if;

  if has_function_privilege('authenticated', 'public.revenue_sweep_open(text, text, text, bigint, text)', 'execute')
     or has_function_privilege('anon', 'public.revenue_sweep_settle(uuid, text, text, text)', 'execute') then
    raise exception 'revenue_sweep_2026-11-15: a signed-in member can call a sweep function, which they must not';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.provider_revenue_sweeps'::regclass) then
    raise exception 'revenue_sweep_2026-11-15: row level security is off on the sweeps table';
  end if;

  raise notice 'revenue_sweep_2026-11-15: self-check passed';
end;
$check$;

-- To see where Vallo's own money stands afterwards:
-- select status, amount_minor, currency, provider_payout_id, opened_at, settled_at
--   from public.provider_revenue_sweeps order by opened_at desc limit 20;
-- select direction, event_type, sum(amount_minor), count(*)
--   from public.ledger_vallo_revenue group by 1, 2;
