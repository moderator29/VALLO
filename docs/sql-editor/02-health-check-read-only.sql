-- READ ONLY. Paste into the Supabase SQL editor (project uccixoonmbhrnyczyigt) and run each query.
-- Nothing here writes. It is the advisor pass the 17 October audit could not run, because the
-- session's connector had no access to the project. Each query should return no rows, or the
-- number named beside it; anything else is a finding to hand to the next session.

-- 1. Public tables with row level security off. Expect: no rows.
select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
 order by 1;

-- 2. SECURITY DEFINER functions in public that anon can execute. Expect: only the deliberate
--    public reads (each should be named in docs/security/GRANT_STATE.md).
select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
 order by 1;

-- 3. SECURITY DEFINER functions without a fixed search_path. Expect: no rows.
select n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private') and p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');

-- 4. Views in public that run with their owner's rights. Expect: no rows.
select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and not coalesce((select bool_or(o in ('security_invoker=true', 'security_invoker=on')) from unnest(c.reloptions) o), false);

-- 5. The custody guard on feature flags. Expect: true. The probe track-a-custody-retired says the
--    live database let the wallet switch be turned on, while every migration in the repository
--    refuses it. If this is false, or the trigger is missing from query 6, the live database has
--    drifted from the repository: decide whether the guard should be restored.
select pg_get_functiondef('private.guard_feature_flag_write()'::regprocedure) like '%''wallet''%' as refuses_wallet;

-- 6. Triggers on feature_flags. Expect: feature_flags_guard_write and feature_flags_audit_after_change, enabled (O).
select tgname, tgenabled, tgfoid::regproc
  from pg_trigger
 where tgrelid = 'public.feature_flags'::regclass and not tgisinternal;

-- 7. booking_is_paid never answers NULL. Expect: false (not NULL). NULL means
--    migration 20261021105606_booking_is_paid_never_null.sql is not applied.
select private.booking_is_paid(gen_random_uuid());

-- 8. Policies that call auth.uid() per row instead of once (slow on big tables). Expect: no rows.
select tablename, policyname
  from pg_policies
 where schemaname = 'public'
   and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.(uid|jwt|role)\(\)'
   and (coalesce(qual, '') || coalesce(with_check, '')) !~ '\(\s*SELECT\s+auth\.(uid|jwt|role)\(\)'
 order by 1, 2;

-- 9. Foreign keys with no index that covers them. Expect: a short list; each is worth an index
--    if the table is large or the parent is deleted from.
select c.conrelid::regclass as tbl, c.conname
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace and n.nspname = 'public'
 where c.contype = 'f'
   and not exists (select 1 from pg_index i
                    where i.indrelid = c.conrelid
                      and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
                      and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
 order by 1, 2;

-- 10. Push tokens by platform. If iOS and Android read zero after a phone allowed notifications,
--     the device never reached POST /api/push/register (docs/push/FIRST_NOTIFICATION.md).
select platform, count(*) from public.push_tokens group by platform;

-- 11. Scheduled jobs that failed in the last day. Expect: no rows.
select j.jobname, count(*)
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 where d.status = 'failed' and d.start_time > now() - interval '24 hours'
 group by j.jobname;
