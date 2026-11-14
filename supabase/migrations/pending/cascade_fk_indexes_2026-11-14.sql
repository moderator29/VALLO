-- ============================================================================
-- THE THIRTEEN INDEXES THAT MAKE DELETING AN ACCOUNT CHEAP (14 November 2026).
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHY THESE THIRTEEN AND NOT THE NINETY. The performance advisor lists 90
-- foreign keys with no covering index. Read against live, almost every one is
-- on a table with no rows, and none of them is a duplicate of another index
-- (there is not one redundant index anywhere in `public`; the indexing on this
-- database is disciplined). So most of the ninety are not worth an index yet:
-- at 30 profiles every index looks unused, and an index costs on every write
-- for ever.
--
-- These thirteen are different, and the difference is a real product flow.
-- Each one is `ON DELETE CASCADE` pointing at `auth.users` or `public.profiles`.
-- When an account is deleted, Postgres must find the child rows to cascade,
-- and with no index on the referencing column it reads the WHOLE child table
-- to do it, once per table, inside the deletion's own transaction. Vallo
-- deletes accounts: there is a member-facing flow and a console desk for it.
-- Today those thirteen tables are empty, so the scan is instant and nobody
-- would notice. They are the newest tables on the platform (the roommates and
-- Circle waves of 8 and 9 November), which is exactly why they are empty and
-- exactly why they will not stay empty.
--
-- An index on an empty table is instant to create. The same index on a table
-- with a million rows is not, and by then a single account deletion is
-- holding locks while it scans thirteen tables. This is the cheapest moment
-- this change will ever have.
--
-- WHAT THIS DOES. Thirteen plain btree indexes, created IF NOT EXISTS, one per
-- cascading foreign key, named `<table>_<column>_idx` to match the
-- database's existing convention.
--
-- WHAT IT DOES NOT DO. It indexes nothing else the advisor lists: not the
-- audit columns (`*_decided_by`, `*_updated_by`, `*_granted_by`), which are
-- written once and read by a desk at human speed, and not the other 77,
-- which wait for traffic to prove them. It changes no policy, no function and
-- no row.
--
-- THE COST. Thirteen more indexes to maintain on insert and update of those
-- tables. That is the trade, and it is the right way round here: these tables
-- are written a handful of times per person per day and read by cascade on a
-- deletion that must not hang.
--
-- SAFE TO RUN TWICE: every statement is IF NOT EXISTS.
-- TO UNDO: drop index public.<name>; for each one listed by the closing query.
-- ============================================================================

begin;
set local lock_timeout = '5s';

create index if not exists circle_invites_inviter_id_idx on public.circle_invites (inviter_id);
create index if not exists circle_plan_signups_user_id_idx on public.circle_plan_signups (user_id);
create index if not exists circle_plans_organiser_id_idx on public.circle_plans (organiser_id);
create index if not exists circle_shared_shortlists_shared_by_idx on public.circle_shared_shortlists (shared_by);
create index if not exists circle_vouches_voucher_id_idx on public.circle_vouches (voucher_id);
create index if not exists deal_reads_user_id_idx on public.deal_reads (user_id);
create index if not exists message_reactions_user_id_idx on public.message_reactions (user_id);
create index if not exists moderation_appeals_user_id_idx on public.moderation_appeals (user_id);
create index if not exists roommate_group_expenses_created_by_idx on public.roommate_group_expenses (created_by);
create index if not exists roommate_group_posts_author_id_idx on public.roommate_group_posts (author_id);
create index if not exists roommate_group_shortlist_added_by_idx on public.roommate_group_shortlist (added_by);
create index if not exists roommate_group_votes_user_id_idx on public.roommate_group_votes (user_id);
create index if not exists roommate_groups_owner_id_idx on public.roommate_groups (owner_id);

-- READ-BACK, inside the transaction: no cascading foreign key to a person is
-- left without a covering index. If one is, nothing is kept.
do $$
declare
  v_left int;
  v_names text;
begin
  select count(*), string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ')
    into v_left, v_names
    from pg_constraint c
    join lateral unnest(c.conkey) k(attnum) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
   where c.contype = 'f'
     and array_length(c.conkey, 1) = 1
     and c.confdeltype = 'c'
     and c.connamespace = 'public'::regnamespace
     and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
     and not exists (select 1 from pg_index i
                      where i.indrelid = c.conrelid and i.indkey[0] = k.attnum);
  if v_left > 0 then
    raise exception 'still uncovered after this file (%): %', v_left, v_names;
  end if;
end
$$;

commit;

-- What to read: thirteen rows, and a zero. The zero is the point.
select (select count(*) from pg_indexes
         where schemaname = 'public'
           and indexname in ('circle_invites_inviter_id_idx','circle_plan_signups_user_id_idx',
                             'circle_plans_organiser_id_idx','circle_shared_shortlists_shared_by_idx',
                             'circle_vouches_voucher_id_idx','deal_reads_user_id_idx',
                             'message_reactions_user_id_idx','moderation_appeals_user_id_idx',
                             'roommate_group_expenses_created_by_idx','roommate_group_posts_author_id_idx',
                             'roommate_group_shortlist_added_by_idx','roommate_group_votes_user_id_idx',
                             'roommate_groups_owner_id_idx')) as indexes_now_present,
       (select count(*)
          from pg_constraint c
          join lateral unnest(c.conkey) k(attnum) on true
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
         where c.contype = 'f' and array_length(c.conkey,1) = 1 and c.confdeltype = 'c'
           and c.connamespace = 'public'::regnamespace
           and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
           and not exists (select 1 from pg_index i
                            where i.indrelid = c.conrelid and i.indkey[0] = k.attnum)) as still_uncovered;
-- expect: indexes_now_present = 13, still_uncovered = 0.
