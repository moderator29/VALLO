-- ============================================================================
-- THE DATABASE BACKSTOP ON HOLDS, INSPECTION REQUESTS AND BRIEFS (14 Nov 2026).
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHY. Survey B's B-03: a script with one account could hold every night of a
-- listing. The app half is fixed (lib/security/member-write-limit.ts caps
-- booking holds at 12 an hour, inspection requests and viewings at 15, briefs
-- at 6 a day). But a booking is inserted under the member's own RLS-bound
-- client, so a member's JWT can also insert STRAIGHT through the data API,
-- past the app's ceiling. messages, posts, reports, reviews and listings have
-- carried exactly this backstop since September (private.limit_member_inserts,
-- migration 20260924022108); live today it is missing from public.bookings,
-- public.inspection_requests and public.briefs (read from pg_trigger on
-- 14 November). Viewings ride on inspection_requests, so they are covered.
--
-- WHAT THIS DOES. The same trigger, three more tables, ceilings above the
-- app's so a real person never meets them first:
--   bookings:             12 in 10 minutes, 48 a day
--   inspection_requests:  15 an hour, 60 a day
--   briefs:                6 an hour, 12 a day
-- The limiter fails open (a counter fault lets the write through), service
-- and non-member writes are exempt, exactly as on the five existing tables.
--
-- WHAT IT DOES NOT DO. No app behaviour changes: the app's own limits are
-- lower and answer first with friendlier words. No existing row is touched.
--
-- SAFE TO RUN TWICE: drop trigger if exists, then create.
-- TO UNDO: drop trigger <name> on <table>; for each of the three.
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private.limit_member_inserts()') is null then
    raise exception 'private.limit_member_inserts() is missing; nothing was changed';
  end if;
end
$$;

drop trigger if exists bookings_limit_member_inserts on public.bookings;
create trigger bookings_limit_member_inserts before insert on public.bookings
  for each row execute function private.limit_member_inserts('12', '600', '48');

drop trigger if exists inspection_requests_limit_member_inserts on public.inspection_requests;
create trigger inspection_requests_limit_member_inserts before insert on public.inspection_requests
  for each row execute function private.limit_member_inserts('15', '3600', '60');

drop trigger if exists briefs_limit_member_inserts on public.briefs;
create trigger briefs_limit_member_inserts before insert on public.briefs
  for each row execute function private.limit_member_inserts('6', '3600', '12');

-- READ-BACK, inside the transaction: all three triggers exist, or nothing is kept.
do $$
declare
  n int;
begin
  select count(*) into n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname in ('bookings_limit_member_inserts',
                      'inspection_requests_limit_member_inserts',
                      'briefs_limit_member_inserts')
     and not t.tgisinternal;
  if n <> 3 then
    raise exception 'expected 3 limit triggers, found %; rolled back', n;
  end if;
end
$$;

commit;

-- What to read: the three new rows among the existing limit triggers.
select c.relname as table_name, t.tgname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal and t.tgname like '%limit_member_inserts'
 order by 1;
-- expect 9 rows: the six from September (listings, messages, posts, reports,
-- reviews, story_comments) plus bookings, briefs and inspection_requests.
