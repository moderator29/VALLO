-- FOUR CIRCLE FUNCTIONS A SIGNED-OUT CALLER CAN STILL EXECUTE, AND TWO OF
-- THEM HAVE A REVOKE IN THEIR OWN MIGRATION THAT WAS MEANT TO STOP IT.
-- (Plus four Roommates functions with the same loose end and nothing to
--  change but the tidiness: section 4.)
--
-- Backend audit, 12 November 2026. Grants only. Safe to run twice. No row is
-- changed and no function body is touched. Every claim below was read from the
-- live database before this was written (read only: pg_proc.proacl,
-- pg_default_acl, aclexplode).
--
-- 1. WHY `revoke ... from public` DOES NOT REMOVE THE anon GRANT.
--
--    This project carries Supabase's default privileges for new functions:
--
--      select defaclacl from pg_default_acl d join pg_roles r on r.oid = d.defaclrole
--       where r.rolname = 'postgres' and d.defaclobjtype = 'f'
--         and d.defaclnamespace = 'public'::regnamespace;
--        -> {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
--    `alter default privileges ... grant` ADDS to Postgres's own built-in
--    default for a function, which is `execute to public`. So every function
--    created in `public` by `postgres` is born with FIVE execute entries: the
--    PUBLIC pseudo-role, and four named roles. `revoke all on function X from
--    public` removes exactly one of them, the PUBLIC entry. The `anon` grant
--    is a separate, named grant and survives untouched.
--
--    Two migrations wrote the revoke the short way and are still anon-callable
--    today:
--
--      20261108123839_circle_update_community.sql:56
--        revoke all on function public.circle_update_community from public;
--      20261108190000_circle_remove_member.sql:48
--        revoke all on function public.circle_remove_member from public;
--
--      live:  circle_update_community  -> postgres=X | anon=X | authenticated=X | service_role=X
--             circle_remove_member     -> postgres=X | anon=X | authenticated=X | service_role=X
--
--    The same file's neighbours wrote it the long way and are correct, which
--    is the control for the whole diagnosis:
--
--      20261107210200_features_circle_1_core.sql:895-896
--        revoke all on function public.circle_create_community(...) from public, anon;
--        revoke all on function public.circle_join(uuid) from public, anon;
--
--      live:  circle_create_community  -> postgres=X | authenticated=X | service_role=X
--             circle_join              -> postgres=X | authenticated=X | service_role=X
--
-- 2. AND TWO THAT WERE NEVER REVOKED FROM ANYTHING.
--
--    `accept_circle_invite(uuid)` and `decline_circle_invite(uuid)` have no
--    grant and no revoke in any migration in this repository. They therefore
--    still carry the built-in PUBLIC entry as well:
--
--      live:  accept_circle_invite   -> =X | postgres=X | anon=X | authenticated=X | service_role=X
--             decline_circle_invite  -> =X | postgres=X | anon=X | authenticated=X | service_role=X
--
--    The leading `=X` is PUBLIC. It matters beyond tidiness: a later
--    `revoke execute ... from anon` on these two would appear to work and
--    change nothing, because PUBLIC would still grant it.
--
-- 3. WHAT IS AND IS NOT AT RISK TODAY.
--
--    Nothing is exploitable. All four read `auth.uid()` first and stop:
--    `circle_remove_member` and `circle_update_community` return 'signed_out'
--    before touching a row, and `accept_circle_invite` and
--    `decline_circle_invite` match `invitee_id = (select auth.uid())`, find
--    nothing for a caller with no session, and raise their own refusal
--    (RM201 and RM202; `circle_plan_signups_rls_2026-11-11.sql`, also
--    waiting, moves those two codes from the message into `using errcode`).
--    This is defence in depth being restored, not a hole being closed.
--
--    It is still not free, and the reason is the one `lib/landlord/queries.ts`
--    records: a statement a role may not run, or runs only to refuse, still
--    costs a round trip and spends a transaction on a pooled connection. That
--    file's own header counts 1,678 such denials between 9 and 12 November for
--    one function. The real cost here is the next one: a SECURITY DEFINER
--    write added with the short revoke is anon-callable, and until
--    `supabase/tests/probes/db-21-function-grants.sql` (this branch) nothing
--    in this repository read a function grant at all, so no probe could say
--    so. db-06 reads table and column grants and stops there.
--
-- 4. AND FOUR ROOMMATES FUNCTIONS WITH THE SAME LOOSE END, for a different
--    reason and with no behaviour to change.
--
--    `roommate_home()`, `roommate_institution_page(text)`,
--    `roommate_listing_view(uuid)` and `roommate_search_listings(jsonb)` are
--    SECURITY DEFINER and DELIBERATELY reachable by `anon`: Roommates has
--    public pages (`roommates_2_engine.sql:1555-1558` and `ROOMMATES_ALL.sql`
--    grant each to `anon, authenticated`). What those lines never did is
--    revoke the built-in PUBLIC grant, so all four read `=X` live as well.
--
--    That is not a hole: PUBLIC here grants nothing `anon` is not already
--    meant to have. It is left to tidy because a PUBLIC grant makes a later
--    `revoke ... from anon` on one of them look as though it worked while
--    changing nothing, and because leaving six exceptions in
--    `supabase/tests/probes/db-21-function-grants.sql` is six places for the
--    next one to hide. The grants below restate exactly what they have now.
--
-- 5. THE HOUSE FORM, for anything added after this.
--
--      revoke all on function public.f(args) from public, anon;
--      grant execute on function public.f(args) to authenticated;
--
--    `from public, anon` is not belt and braces. It is two different grants.

set lock_timeout = '5s';

begin;

-- The two whose migrations already tried: finish the job they wrote.
revoke all on function public.circle_update_community(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.circle_update_community(uuid, text, text, text, text[]) to authenticated;

revoke all on function public.circle_remove_member(uuid, uuid) from public, anon;
grant execute on function public.circle_remove_member(uuid, uuid) to authenticated;

-- The two that were never granted or revoked by name at all.
revoke all on function public.accept_circle_invite(uuid) from public, anon;
grant execute on function public.accept_circle_invite(uuid) to authenticated;

revoke all on function public.decline_circle_invite(uuid) from public, anon;
grant execute on function public.decline_circle_invite(uuid) to authenticated;

-- The four Roommates reads: PUBLIC removed, anon restated. A signed-out
-- visitor reaches exactly what they reach today.
revoke all on function public.roommate_home() from public;
grant execute on function public.roommate_home() to anon, authenticated;

revoke all on function public.roommate_institution_page(text) from public;
grant execute on function public.roommate_institution_page(text) to anon, authenticated;

revoke all on function public.roommate_listing_view(uuid) from public;
grant execute on function public.roommate_listing_view(uuid) to anon, authenticated;

revoke all on function public.roommate_search_listings(jsonb) from public;
grant execute on function public.roommate_search_listings(jsonb) to anon, authenticated;

commit;

-- Verification, read only. Expect false for every row.
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can,
--          exists (select 1 from aclexplode(p.proacl) a
--                   where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_can
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('circle_update_community', 'circle_remove_member',
--                        'accept_circle_invite', 'decline_circle_invite')
--    order by 1;
--
-- And that a member still can, which is the point of the grant line:
--   select has_function_privilege('authenticated', 'public.accept_circle_invite(uuid)', 'EXECUTE');
--     -- expect true
--
-- The Roommates four keep anon and lose PUBLIC:
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can,
--          exists (select 1 from aclexplode(p.proacl) a
--                   where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_can
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('roommate_home', 'roommate_institution_page',
--                        'roommate_listing_view', 'roommate_search_listings')
--    order by 1;
--     -- expect anon_can true, public_can false, for all four
