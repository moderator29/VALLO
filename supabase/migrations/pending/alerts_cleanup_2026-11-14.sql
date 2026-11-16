-- ============================================================================
-- THE ALERTS DESK BECOMES READABLE AGAIN (14 November 2026).
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHAT LIVE HOLDS TODAY. 92 open alerts. Most are the same few faults
-- repeated: "Store: readiness, red" alone holds 29 open rows for one
-- unchanged condition, "Catalogue: read failed" 12 (the 13 November disk IO
-- trouble), "Sanctions: lists unreadable" 10 (last seen 29 September, the
-- job has run green since). The cause is a bug in the app's alert fold that
-- measured the dedup window against created_at instead of last_seen_at, so
-- a daily fault opened a fresh row every other day. That bug is fixed in
-- code on the branch; this file clears the pile the bug left behind.
--
-- WHAT THIS DOES. Resolves 76 of the 92 (the counts as of the check; the
-- numbers may differ slightly when you run it, and that is fine):
--   1. DUPLICATES: where several OPEN rows share one title and subject, every
--      row but the newest is resolved. The newest stays open, so every live
--      fault keeps exactly one row on the desk.
--   2. STALE: open rows last seen before 1 November whose fault has not
--      recurred (sanctions lists, September reconcile silences, old push
--      drain rows). The one open "Abuse in a message" row is NEVER touched:
--      that is a person's report waiting on a person.
--   3. FIXED CLIENT ERRORS: the realtime "postgres_changes after subscribe"
--      crash (fixed 6 November, ownChannelName) and the iOS Haptics error
--      (fixed 6 November). Neither has recurred since the fix.
--   4. display-rates "schedule, silent" of 14 November: resolved ONLY if
--      job_runs shows display-rates has since run with outcome ok (it ran
--      clean at 12:50 UTC today). If that read finds no green run, the row
--      stays open.
-- Each resolution is stamped with the founder account and written to the
-- audit log as one summary row, the same shape the desk's own Resolve uses.
--
-- WHAT STAYS OPEN (about 16): the newest row of each still-live fault
-- (store readiness, catalogue, email outbox, pg cron watch, the unexplained
-- RangeError client errors, schedule silent) and the abuse report. Those are
-- real work, not noise.
--
-- WHAT IT DOES NOT DO. It fixes no fault. Store readiness is still red and
-- the RangeError is still unexplained; they keep their one open row each.
--
-- SAFE TO RUN TWICE: the second run finds nothing open that matches and
-- resolves nothing.
-- TO UNDO: update public.risk_alerts set status = 'open', resolved_at = null,
--   resolved_by = null where id in (select (metadata->>'alert_id')::uuid from
--   public.audit_log where action = 'risk_alert.bulk_cleanup');
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $$
declare
  v_founder uuid := (select f.user_id from private.founder_accounts f order by f.user_id limit 1);
  v_resolved int := 0;
  v_count int;
begin
  if v_founder is null then
    raise exception 'no founder account found; nothing was changed';
  end if;

  create temp table _to_resolve (id uuid primary key, why text) on commit drop;

  /* 1. Duplicates: keep the newest open row per (title, subject). */
  insert into _to_resolve (id, why)
  select d.id, 'duplicate of a newer open alert for the same fault'
    from (select a.id,
                 row_number() over (partition by a.title, coalesce(a.entity_id, '')
                                    order by coalesce(a.last_seen_at, a.created_at) desc, a.created_at desc) as rn
            from public.risk_alerts a where a.status = 'open') d
   where d.rn > 1
  on conflict (id) do nothing;

  /* 2. Stale: last seen before 1 November, never a human case. */
  insert into _to_resolve (id, why)
  select a.id, 'stale: last seen before 1 November and the job has run green since'
    from public.risk_alerts a
   where a.status = 'open'
     and coalesce(a.last_seen_at, a.created_at) < timestamptz '2026-11-01 00:00:00+00'
     and a.entity_type <> 'message'
  on conflict (id) do nothing;

  /* 3. Client errors whose fix shipped on 6 November and has held. */
  insert into _to_resolve (id, why)
  select a.id, 'fixed in code on 6 November and not seen since'
    from public.risk_alerts a
   where a.status = 'open'
     and a.entity_type = 'client_error'
     and (a.description like '%postgres_changes%' or a.description like '%Haptics.then%')
  on conflict (id) do nothing;

  /* 4. display-rates flagged as silent before its first ever run; only if a
        green run exists. Skips, with a notice, when live shows none. */
  if exists (select 1 from public.job_runs r where r.job = 'display-rates' and r.outcome = 'ok') then
    insert into _to_resolve (id, why)
    select a.id, 'the watch flagged a one-day-old job; job_runs shows it has run clean'
      from public.risk_alerts a
     where a.status = 'open'
       and a.title = 'Cron: schedule, silent'
       and a.description like '%display-rates%'
    on conflict (id) do nothing;
  else
    raise notice 'display-rates has no green run in job_runs; its alert stays open';
  end if;

  /* A human case is never cleanup. If any selected row is one, keep nothing. */
  if exists (select 1 from _to_resolve t join public.risk_alerts a on a.id = t.id
              where a.entity_type = 'message') then
    raise exception 'the cleanup selected a message alert; rolled back';
  end if;

  update public.risk_alerts a
     set status = 'resolved',
         resolved_at = now(),
         resolved_by = v_founder
    from _to_resolve t
   where a.id = t.id
     and a.status = 'open';
  get diagnostics v_resolved = row_count;

  /* One audit row per resolved alert, the action the desk's Resolve writes,
     plus the reason, so the trail reads the same as a hand resolution. */
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  select v_founder, 'risk_alert.bulk_cleanup', 'risk_alert', t.id::text,
         jsonb_build_object('alert_id', t.id, 'why', t.why,
                            'note', 'Alerts desk cleanup of 14 November 2026: the dedup fold bug left repeats open.')
    from _to_resolve t;

  raise notice 'resolved % open alerts', v_resolved;

  /* READ-BACK: if the desk is not clean by these rules, keep nothing. */
  select count(*) into v_count
    from (select 1 from public.risk_alerts a where a.status = 'open'
          group by a.title, coalesce(a.entity_id, '') having count(*) > 1) d;
  if v_count > 0 then
    raise exception 'duplicate open alerts remain (% groups); rolled back', v_count;
  end if;

  select count(*) into v_count from public.risk_alerts a
   where a.status = 'open' and a.entity_type <> 'message'
     and coalesce(a.last_seen_at, a.created_at) < timestamptz '2026-11-01 00:00:00+00';
  if v_count > 0 then
    raise exception 'stale open alerts remain (%); rolled back', v_count;
  end if;

end
$$;

commit;

-- What the desk now shows: one row per live fault. Expect about 16 rows,
-- "Abuse in a message" among them, and no title appearing twice with the
-- same subject.
select a.severity, a.title, a.entity_type,
       to_char(coalesce(a.last_seen_at, a.created_at), 'DD Mon HH24:MI') as last_seen
  from public.risk_alerts a
 where a.status = 'open'
 order by coalesce(a.last_seen_at, a.created_at) desc;
