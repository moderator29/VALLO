-- ============================================================================
-- THE 720 SESSIONS THAT NEVER END (read from live, 14 November 2026).
--
-- A DRAFT, NOT A PENDING FILE. It signs people out, so it is the founder's
-- decision and not a tidy-up. Read all of this before running any of it.
--
-- WHAT LIVE HOLDS TODAY (read-only, 14 November 2026):
--   720 sessions in auth.sessions, EVERY ONE still open (not_after is null),
--   for 22 people. The oldest was opened on 11 August. 597 have not been
--   touched in thirty days.
--   By user agent:
--     330  "Mozilla/5.0 (X11; Linux) Safari/"  the test browser, 315 idle 30d+
--     154  "Mozilla/5.0 (iPhone)"              real phones, 86 idle 30d+
--     146  "node"                              server-side password proofs
--      24  iPhone 18_7                         real phones
--
-- WHY THERE ARE 146 `node` SESSIONS. Checking a password means signing in
-- with it: there is no other way to ask the auth service whether a password
-- is right. `lib/account-deletion/reauthenticate.ts` did that for every money
-- step-up, every console entry and every deletion check, and never closed the
-- session afterwards. THAT IS FIXED IN CODE on this branch: the proof now
-- signs out with `scope: "local"`, which revokes that one session and no
-- other. So the number stops growing from the day the fix deploys. This file
-- is about the ones already there.
--
-- THE REAL FIX IS A SETTING, NOT THIS FILE. Supabase Auth can time-box a
-- session and end an idle one by itself, and then GoTrue does this cleanup
-- for ever without anybody running SQL. It is in the dashboard under
-- Authentication, Sessions: a time-box (how long a session may live at all)
-- and an inactivity timeout (how long without use before it ends). The
-- founder sets those; a session that never expires is a credential that never
-- expires, and 315 of ours belong to a test browser.
--
-- WHAT THIS FILE DOES IF HE RUNS IT. Ends sessions untouched for more than
-- thirty days. It does NOT delete rows: it sets `not_after`, which is how
-- GoTrue itself marks a session finished, so nothing is lost from the record.
--
-- WHAT IT COSTS. Anybody on one of those sessions is signed out and signs in
-- again. For the 315 test-browser sessions and the 133 idle `node` ones that
-- is nothing at all. For a real phone that has not opened Vallo in a month it
-- is one sign-in.
--
-- SAFE TO RUN TWICE: the second run finds nothing.
-- TO UNDO: there is no undo. A session ended is ended, and the person signs
-- in again. That is the whole risk, and it is small, but it is real.
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $$
declare
  v_ended int;
begin
  update auth.sessions
     set not_after = now()
   where not_after is null
     and coalesce(refreshed_at, created_at) < now() - interval '30 days';
  get diagnostics v_ended = row_count;
  raise notice 'ended % sessions idle for more than thirty days', v_ended;

  /* READ-BACK: a live session must never be ended by this file. */
  if exists (select 1 from auth.sessions
              where not_after is not null
                and coalesce(refreshed_at, created_at) >= now() - interval '30 days'
                and not_after >= now() - interval '1 minute') then
    raise exception 'a session used within thirty days was ended; rolled back';
  end if;
end
$$;

commit;

-- What to read afterwards: open sessions by how recently they were used.
select case
         when coalesce(refreshed_at, created_at) > now() - interval '7 days' then 'used this week'
         when coalesce(refreshed_at, created_at) > now() - interval '30 days' then 'used this month'
         else 'older'
       end as last_used,
       count(*) as sessions
  from auth.sessions
 where not_after is null
 group by 1 order by 2 desc;
-- expect: no "older" row at all, and the rest untouched.
