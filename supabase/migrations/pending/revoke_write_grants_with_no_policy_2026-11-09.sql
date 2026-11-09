-- Revoke every write grant on a public table that no permissive policy can
-- ever satisfy. 9 November 2026.
--
-- WHAT CHANGED ABOUT THE WORLD
-- The Roommates release (roommates_all, applied live earlier today) and the
-- moderation desk left `authenticated` holding INSERT, UPDATE or DELETE on
-- tables where no permissive policy allows that command. Row level security is
-- enabled on every one of them and each has a read policy, so those writes
-- were already refused: nothing in the product used them, and nothing stops
-- working when they go. The two places the app touches these tables
-- (readMyActiveGroups in lib/features/roommates/queries.ts and the thread's
-- RoommateMatch line) are reads, and the writes that do happen go through
-- definer functions: a group is created by roommate_create_group, staff
-- decisions land through moderation_decide.
--
-- A grant no policy can satisfy is not protection, it is litter, and it is
-- exactly what the db-06 probe's third assertion refuses. This migration
-- clears it so the probe passes on the truth rather than on a wider
-- allowlist. The grants that ARE policy backed are declared in
-- supabase/tests/probes/db-06.sql and are deliberately left alone.
--
-- Safe to re-run: REVOKE on a privilege already gone is a no-op.

begin;

-- Fully dead: no permissive policy for insert, update or delete.
revoke insert, update, delete on public.member_restrictions from authenticated;
revoke insert, update, delete on public.moderation_appeals from authenticated;
revoke insert, update, delete on public.moderation_case_events from authenticated;
revoke insert, update, delete on public.moderation_case_evidence from authenticated;
revoke insert, update, delete on public.moderation_case_reports from authenticated;
revoke insert, update, delete on public.moderation_cases from authenticated;
revoke insert, update, delete on public.roommate_group_members from authenticated;
revoke insert, update, delete on public.roommate_interests from authenticated;
revoke insert, update, delete on public.roommate_viewings from authenticated;

-- Partly dead: UPDATE has a policy and the app uses it, insert and delete do not.
revoke insert, delete on public.roommate_groups from authenticated;
revoke insert, delete on public.roommate_match_weights from authenticated;
revoke insert, delete on public.roommate_verifications from authenticated;

-- Prove it: no write privilege on a public table is left without a permissive
-- policy behind it. This is the db-06 probe's own third assertion, run here so
-- the migration refuses to commit if it has missed one.
do $$
declare dead text;
begin
  select string_agg(format('%s.%s', l.tbl, l.cmd), ', ') into dead
    from (select t.relname tbl, cmds.cmd
            from pg_class t join pg_namespace ns on ns.oid = t.relnamespace
           cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) cmds(cmd)
           where ns.nspname = 'public' and t.relkind in ('r', 'p', 'v', 'm', 'f')
             and has_table_privilege('authenticated', t.oid, cmds.cmd)) l
   where not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = l.tbl
                        and p.permissive = 'PERMISSIVE'
                        and p.cmd in (l.cmd, 'ALL')
                        and p.roles && array['public', 'authenticated']::name[]);
  if dead is not null then
    raise exception 'write grants still have no policy behind them: %', dead;
  end if;
  raise notice 'every authenticated write grant has a permissive policy behind it';
end $$;

commit;
