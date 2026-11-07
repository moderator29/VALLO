-- Recovered from the live supabase_migrations.schema_migrations on 7 November
-- 2026 (Survey B, D-08): applied live on 31 October and never committed.
set lock_timeout = '5s';
alter table public.web_vitals_samples validate constraint web_vitals_samples_start_kind_check;
alter table public.web_vitals_samples validate constraint web_vitals_samples_metric_check;

-- The desk's read: cold start and kept-page numbers, p50 and p90, per start kind.
create or replace function public.admin_cold_start()
returns table (
  start_kind text,
  cold boolean,
  effective_type text,
  samples bigint,
  p50_hide_ms double precision,
  p90_hide_ms double precision,
  p50_open_ms double precision,
  p90_open_ms double precision,
  p50_lcp_ms double precision,
  p90_lcp_ms double precision
)
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
     or not (private.has_role(actor, 'admin'::public.app_role)
             or private.has_role(actor, 'super_admin'::public.app_role)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select coalesce(s.start_kind, 'unknown'),
         coalesce(s.cold, false),
         coalesce(s.effective_type, 'unknown'),
         count(*) filter (where s.metric = 'LCP'),
         percentile_cont(0.5) within group (order by s.value) filter (where s.metric = 'BOOT_HIDE'),
         percentile_cont(0.9) within group (order by s.value) filter (where s.metric = 'BOOT_HIDE'),
         percentile_cont(0.5) within group (order by s.value) filter (where s.metric = 'BOOT_OPEN'),
         percentile_cont(0.9) within group (order by s.value) filter (where s.metric = 'BOOT_OPEN'),
         percentile_cont(0.5) within group (order by s.value) filter (where s.metric = 'LCP'),
         percentile_cont(0.9) within group (order by s.value) filter (where s.metric = 'LCP')
    from public.web_vitals_samples s
   where s.at > now() - interval '14 days'
   group by 1, 2, 3
  having count(*) filter (where s.metric = 'LCP') > 0
   order by 4 desc
   limit 200;
end;
$fn$;

revoke all on function public.admin_cold_start() from public, anon, authenticated;
grant execute on function public.admin_cold_start() to authenticated;
