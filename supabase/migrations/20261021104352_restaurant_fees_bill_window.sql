-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). THE RESTAURANT FEES DESK READS THE SAME LAGOS MONTHS FOR BILLS AS FOR SEATED TABLES.
--
-- What it fixes: `public.restaurant_seated_fees(p_months)` limits the seated
-- tables to the last p_months Lagos months but read paid bills from all time,
-- so once bills are paid through Vallo the desk would grow a row for every
-- month that ever had a paid bill, outside the window it says it shows.
-- Also a Lagos-time slip in both windows: `date_trunc('month', now() at time
-- zone 'Africa/Lagos')` is a local timestamp without a zone, and comparing it
-- with a timestamptz casts it in the session zone (UTC), so the window opened
-- at 01:00 Lagos on the first of the month and a table seated in that first
-- hour fell out of the oldest month. Both windows now convert the local start
-- back to a Lagos instant with `at time zone 'Africa/Lagos'`.
--
-- BEFORE APPLYING: read the live definition
--   select pg_get_functiondef('public.restaurant_seated_fees(integer)'::regprocedure);
-- and check it matches 20261013071048_restaurant_fee_per_seated_table.sql (the
-- per seated TABLE version). Check the grants after.
set lock_timeout = '5s';

create or replace function public.restaurant_seated_fees(p_months integer default 6)
returns table (
  business_id uuid,
  business_name text,
  month date,
  seated_tables integer,
  seated_guests integer,
  fee_minor bigint,
  bills_paid integer,
  bill_commission_minor bigint
)
language plpgsql stable security definer set search_path to '' as $fn$
declare
  fee bigint;
begin
  if not (private.has_role(auth.uid(), 'admin'::public.app_role)
          or private.has_role(auth.uid(), 'super_admin'::public.app_role)) then
    return;
  end if;
  select s.seated_fee_minor into fee from public.restaurant_money_settings s where s.id;
  return query
  with seated as (
    select s.business_id,
           date_trunc('month', s.outcome_at at time zone 'Africa/Lagos')::date as month,
           count(*)::integer as tables,
           coalesce(sum(s.seated_guests), 0)::integer as guests
      from public.reservation_seatings s
     where s.outcome = 'SEATED'
       and s.business_id is not null
       and (s.disputed_at is null or s.dispute_resolved_at is not null)
       and s.outcome_at >= (date_trunc('month', now() at time zone 'Africa/Lagos') - make_interval(months => greatest(p_months, 1) - 1)) at time zone 'Africa/Lagos'
     group by 1, 2
  ), bills as (
    select b.business_id,
           date_trunc('month', b.paid_at at time zone 'Africa/Lagos')::date as month,
           count(*)::integer as paid,
           coalesce(sum(b.commission_minor), 0)::bigint as commission
      from public.restaurant_bills b
     where b.status = 'paid' and b.business_id is not null
       and b.paid_at >= (date_trunc('month', now() at time zone 'Africa/Lagos') - make_interval(months => greatest(p_months, 1) - 1)) at time zone 'Africa/Lagos'
     group by 1, 2
  )
  select coalesce(se.business_id, bi.business_id),
         bz.name,
         coalesce(se.month, bi.month),
         coalesce(se.tables, 0),
         coalesce(se.guests, 0),
         coalesce(se.tables, 0)::bigint * coalesce(fee, 0),
         coalesce(bi.paid, 0),
         coalesce(bi.commission, 0)
    from seated se
    full join bills bi on bi.business_id = se.business_id and bi.month = se.month
    left join public.businesses bz on bz.id = coalesce(se.business_id, bi.business_id)
   order by 3 desc, 2;
end $fn$;
revoke all on function public.restaurant_seated_fees(integer) from public, anon;
grant execute on function public.restaurant_seated_fees(integer) to authenticated;
