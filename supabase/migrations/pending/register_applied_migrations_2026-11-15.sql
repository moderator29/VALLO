-- ============================================================================
-- THE MIGRATION REGISTER CATCHES UP WITH THE DATABASE (15 November 2026).
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 15 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHAT IS WRONG TODAY. Your database keeps its own list of which migrations
-- have run, in `supabase_migrations.schema_migrations`. The repository holds
-- 778 migration files. That list holds 774, and the newest it knows about is
-- from 9 November.
--
-- WHY. Only one way of applying SQL writes to that list: the migration tool.
-- The Supabase SQL editor does not, and neither does the direct query path
-- the lead used. So four changes are really in the database, verified by
-- reading the database itself, while the list has never heard of them:
--
--   20261115120000  protected_payout_to_lister
--                   (all six payout columns on provider_arrangements: read
--                    back on live, 15 November)
--   20261115130000  scoped_staff_listing_doors
--                   (mandate_consents and property_candidates carry the
--                    scoped door: read back on live, 15 November)
--   20261115130100  insert_limits_bookings_inspections_briefs
--                   (three insert triggers: read back on live, 15 November)
--   20261115130200  cascade_fk_indexes
--                   (thirteen indexes, nothing cascading left uncovered:
--                    read back on live, 15 November)
--
-- WHY IT MATTERS. That list is what tells a fresh database which files it
-- still needs. Today a rebuild would stop at 9 November and produce a
-- database with no payout columns, no scoped staff doors, no insert
-- backstops and no cascade indexes, while every file for them sat unread in
-- the repository. It is the difference between a database you can rebuild
-- and one you cannot.
--
-- WHAT THIS DOES. Writes those four rows, and nothing else. It creates no
-- table, no function, no policy, no index. It changes not one row of anybody's
-- data. It is bookkeeping, and it is the whole fix.
--
-- WHAT IT DOES NOT DO. It does not apply anything. Every one of these four is
-- already in the database; this only records that fact. If one of them were
-- NOT really applied, this file would make the database lie about itself, so
-- each row is written ONLY IF its change is actually present, checked here
-- against the catalogue. A change that is missing is skipped with a notice
-- rather than recorded, and the notice names it.
--
-- WHY THE OTHER TWO ARE NOT HERE. The alerts cleanup and the stale sessions
-- file changed ROWS, not the shape of the database. They are not migrations
-- and a rebuild should not replay them; they stay where they are as the
-- record of what was done, which is how this repository already treats data
-- changes (see `example_collection_retirement_extended_to_2027-05-07.sql`).
--
-- SAFE TO RUN TWICE: every insert is ON CONFLICT DO NOTHING.
-- TO UNDO: delete from supabase_migrations.schema_migrations where version in
--   ('20261115120000','20261115130000','20261115130100','20261115130200');
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $$
declare
  v_written int := 0;
  v_skipped text := '';

  /* Each change, and the question that proves it is really in the database. */
  v_payout boolean := (
    select count(*) = 6 from information_schema.columns
     where table_schema = 'public' and table_name = 'provider_arrangements'
       and column_name in ('payout_status','payout_reference','payout_amount_minor',
                           'payout_fee_minor','payout_updated_at','payout_completed_at'));

  v_doors boolean := (
    select count(*) = 2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('mandate_consents','property_candidates')
       and pg_get_functiondef(p.oid) ilike '%staff_can%');

  v_limits boolean := (
    select count(*) = 3 from pg_trigger
     where tgname in ('bookings_limit_member_inserts',
                      'inspection_requests_limit_member_inserts',
                      'briefs_limit_member_inserts')
       and not tgisinternal);

  v_indexes boolean := (
    select count(*) = 13 from pg_indexes
     where schemaname = 'public'
       and indexname in ('circle_invites_inviter_id_idx','circle_plan_signups_user_id_idx',
                         'circle_plans_organiser_id_idx','circle_shared_shortlists_shared_by_idx',
                         'circle_vouches_voucher_id_idx','deal_reads_user_id_idx',
                         'message_reactions_user_id_idx','moderation_appeals_user_id_idx',
                         'roommate_group_expenses_created_by_idx','roommate_group_posts_author_id_idx',
                         'roommate_group_shortlist_added_by_idx','roommate_group_votes_user_id_idx',
                         'roommate_groups_owner_id_idx'));
begin
  if v_payout then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261115120000', 'protected_payout_to_lister')
    on conflict (version) do nothing;
    v_written := v_written + 1;
  else
    v_skipped := v_skipped || ' protected_payout_to_lister';
  end if;

  if v_doors then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261115130000', 'scoped_staff_listing_doors')
    on conflict (version) do nothing;
    v_written := v_written + 1;
  else
    v_skipped := v_skipped || ' scoped_staff_listing_doors';
  end if;

  if v_limits then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261115130100', 'insert_limits_bookings_inspections_briefs')
    on conflict (version) do nothing;
    v_written := v_written + 1;
  else
    v_skipped := v_skipped || ' insert_limits_bookings_inspections_briefs';
  end if;

  if v_indexes then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261115130200', 'cascade_fk_indexes')
    on conflict (version) do nothing;
    v_written := v_written + 1;
  else
    v_skipped := v_skipped || ' cascade_fk_indexes';
  end if;

  raise notice 'recorded % of 4 migrations', v_written;
  if v_skipped <> '' then
    raise notice 'SKIPPED, because the change is not in this database:%', v_skipped;
    raise notice 'that is not a failure of this file. Apply those files first, then run this again.';
  end if;

  /* READ-BACK, inside the transaction: the register must never hold a version
     twice, and must never have lost one it already had. */
  if (select count(*) from supabase_migrations.schema_migrations) < 774 then
    raise exception 'the register lost rows; rolled back';
  end if;
end
$$;

commit;

-- What to read afterwards: the four newest entries the register knows about.
select version, name
  from supabase_migrations.schema_migrations
 order by version desc
 limit 6;
-- expect, newest first: 20261115130200 cascade_fk_indexes,
--                       20261115130100 insert_limits_bookings_inspections_briefs,
--                       20261115130000 scoped_staff_listing_doors,
--                       20261115120000 protected_payout_to_lister,
--                       then 20261109000000 roommates_all and the one before it.

-- And the count, which should now be 778, the same as the repository's file count.
select count(*) as register_now from supabase_migrations.schema_migrations;
