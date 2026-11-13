-- ============================================================================
-- AUTH SPEED, THE DATABASE HALF (agent SPEED, 13 November 2026).
--
-- NOT APPLIED. NOT VERIFIED AGAINST LIVE. Written from the migrations in the
-- repository while the database connection was down; nobody has run a single
-- line of it. Only the founder applies it, in the Supabase SQL editor, AFTER
-- reading the output of PART 0 (read-only) and checking it matches what is
-- described here.
--
-- Every statement is safe to run twice: each one either reads, sets a value
-- to the same value, or checks before it acts.
--
-- WHAT THE MEASUREMENTS SAID (docs/handoff/AUTH_LATENCY_2026-11-13.md):
--   * the statements on the sign-in, passcode and Face ID paths are already
--     single-row, primary-key or unique-index lookups, and answered in 3 to 6
--     ms inside Supabase at 16:50 Lagos time today. No auth query is slow by
--     itself, and no new index is needed for them (checked: rate_limits has
--     its primary key on (bucket, subject, window_start); member_passcodes is
--     keyed by user_id; money_credentials.credential_id and
--     money_challenges.challenge are unique);
--   * the 15:00 to 15:40 statement timeouts (57014) and the wild maximums in
--     docs/handoff/QUERY_TIMINGS_BEFORE_RESET_2026-11-13.md (a small insert at
--     74.6 s, a sweep at 25 s) are the signature of the WHOLE database
--     stalling (contention, or the compute's disk or CPU budget running out),
--     not of a slow auth statement.
-- So this file does three small things that lower the constant background
-- load, and leaves one larger decision written out for the founder.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART 0. READ FIRST. Read-only. Run this block and keep the output.
-- ----------------------------------------------------------------------------

-- 0a. The auth-path statements since this morning's reset: calls, mean, max,
--     and spread. A max far above the mean with a small mean is a stall the
--     statement waited in, not a slow statement.
select calls,
       round(mean_exec_time::numeric, 1)   as mean_ms,
       round(max_exec_time::numeric, 1)    as max_ms,
       round(stddev_exec_time::numeric, 1) as sd_ms,
       left(regexp_replace(query, '\s+', ' ', 'g'), 120) as statement
  from pg_stat_statements
 where query ilike any (array[
         '%consume_rate_limit%', '%passcode_status%', '%passcode_verify%',
         '%money_credentials%', '%money_challenges%', '%shell_context%',
         '%my_sessions%', '%cron.job_run_details%', '%hold_claims_sweep%',
         '%calls_sweep%', '%request_push_drain%'])
 order by max_exec_time desc
 limit 40;

-- 0b. Every pg_cron job and when it runs. Look for anything at '* * * * *'.
select jobid, jobname, schedule, active from cron.job order by schedule, jobname;

-- 0c. How much pg_cron history is kept. pg_cron never deletes it by itself,
--     and every run of every job inserts a row (the 74.6 s insert).
select count(*) as rows_kept,
       min(start_time) as oldest,
       pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size
  from cron.job_run_details;

-- 0d. Per-role statement timeouts (anon 3 s, authenticated 8 s are known;
--     service_role is the one to look at, see PART 4).
select rolname, rolconfig from pg_roles
 where rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres');

-- 0e. The rate-limit table: its size, and how many of its updates were HOT
--     (written in place, no index touched). Every sign-in makes two of them.
select n_live_tup, n_dead_tup, n_tup_upd, n_tup_hot_upd, last_autovacuum
  from pg_stat_user_tables
 where relid = 'public.rate_limits'::regclass;


-- ----------------------------------------------------------------------------
-- PART 1. THE RATE-LIMIT COUNTER: ROOM FOR IN-PLACE UPDATES.
--
-- Each sign-in makes two `consume_rate_limit` calls (they stay one after the
-- other, by design, see apps/web/src/lib/auth/actions.ts), each an insert or
-- an `update ... set count = count + 1` on public.rate_limits. The count is
-- not in any index, so Postgres can write the new row version on the same
-- page (a HOT update) and skip every index, but only when the page has free
-- room. A table filled to 100 % (the default) has none, so most updates
-- touch the indexes and leave dead rows for vacuum.
--
-- fillfactor 70 leaves 30 % of each page free for those in-place updates;
-- the vacuum settings make autovacuum visit this small, busy table after 5 %
-- of it changes instead of the default 20 %. Takes effect for new pages at
-- once and for existing ones after the next vacuum. Running it twice sets
-- the same values. Cost: the table takes about 40 % more pages (it is a
-- small table; a day of windows at most, purged hourly).
-- ----------------------------------------------------------------------------
alter table public.rate_limits set (
  fillfactor = 70,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);


-- ----------------------------------------------------------------------------
-- PART 2. PG_CRON'S OWN HISTORY: KEEP A WEEK.
--
-- cron.job_run_details gains a row per job per run (two jobs at once a
-- minute, more every five), and nothing ever deleted them. Its insert hit
-- 74.6 s before the reset: on a table that only grows, each insert and the
-- vacuum behind it cost a little more, and every one of them competes with
-- a sign-in for the same disk.
--
-- 2a deletes history older than seven days (the platform's own job record,
-- public.job_runs, is separate and untouched; the pg-cron-watch check reads
-- only recent rows). 2b schedules the same delete daily at 03:47 UTC, a
-- minute nothing else uses. Both safe twice: the delete finds nothing new,
-- and the job is removed by name before it is added again.
-- ----------------------------------------------------------------------------

-- 2a.
delete from cron.job_run_details where end_time < now() - interval '7 days';

-- 2b.
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'vallo_purge_cron_history';
  perform cron.schedule(
    'vallo_purge_cron_history',
    '47 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- PART 3. THE HOLD SWEEP: EVERY FIVE MINUTES, NOT EVERY MINUTE.
--
-- private.hold_claims_sweep() ran 27,057 times between 25 October and 13
-- November (every minute), 724 s in all, with a 25 s maximum. Each run
-- re-reads auth.users twice (the two anti-join deletes) and recomputes every
-- member who holds a live claim. A claim is SET and CLEARED through
-- private.hold_claim_set / hold_claim_clear, which act at once; the sweep
-- only catches claims whose `until` has passed. Running it every five
-- minutes means an expired claim can be lifted up to four minutes later than
-- today. That is the cautious direction (a hold lasts slightly longer, never
-- shorter), but IT IS A COMPLIANCE SCHEDULE AND THE FOUNDER'S CALL: skip
-- this part if a hold must lift within the minute.
--
-- The schedule is 2-59/5 (minutes 2, 7, 12, ...), so it never starts on the
-- same minute as the five-minute jobs at 0, 5, 10 (vallo_push_drain at */5).
--
-- private.calls_sweep() stays every minute: it times out ringing calls, and
-- a call left ringing for five minutes is a visible fault. Its scan is
-- already on calls_open_idx (state, updated_at).
--
-- Safe twice: it only alters a job that exists, to the same schedule.
-- ----------------------------------------------------------------------------
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'vallo_hold_claims_sweep';
  if v_job is not null then
    perform cron.alter_job(job_id => v_job, schedule => '2-59/5 * * * *');
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- PART 4. NOT RUN BY THIS FILE: A CEILING ON SERVICE-ROLE STATEMENTS.
--
-- anon has a 3 s statement_timeout and authenticated 8 s, so a member's own
-- read can never wait longer than that. service_role has NONE (check with
-- 0d). The app's service-role reads include the Face ID key and challenge,
-- the rate-limit count, the QA-account check on /settings and the terms
-- receipt. In a stall such a read waits as long as the stall lasts, and that
-- is one way a signed-in page fails to load for 90 seconds. The app now puts
-- its own deadlines on the ones in front of a tap (passkey-unlock.ts: 3 s;
-- the counts: 1.5 s), but other service-role reads on page renders have none.
--
-- A role-level ceiling would end them all. It would also end any legitimate
-- long service-role statement (a reconcile, a purge, a backfill called over
-- PostgREST). Read 0a and the pg_stat_statements rows for service_role
-- before choosing a value; 30 s is a starting point that no healthy app
-- request comes near. Uncomment to apply; safe twice.
--
-- alter role service_role set statement_timeout = '30s';
-- notify pgrst, 'reload config';
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- READ-BACK. What the parts above changed.
-- ----------------------------------------------------------------------------
select relname, reloptions from pg_class where oid = 'public.rate_limits'::regclass;
-- expect: {fillfactor=70,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_scale_factor=0.05}

select jobname, schedule, active from cron.job
 where jobname in ('vallo_purge_cron_history', 'vallo_hold_claims_sweep', 'vallo_calls_sweep')
 order by jobname;
-- expect: vallo_calls_sweep '* * * * *', vallo_hold_claims_sweep '2-59/5 * * * *',
--         vallo_purge_cron_history '47 3 * * *'

select count(*) as rows_kept, min(start_time) as oldest from cron.job_run_details;
-- expect: oldest within the last seven days

select rolname, rolconfig from pg_roles where rolname = 'service_role';
-- expect: unchanged unless PART 4 was uncommented
