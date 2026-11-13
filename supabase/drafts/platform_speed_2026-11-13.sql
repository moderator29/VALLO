-- PLATFORM SPEED, 13 November 2026. A DRAFT, NOT APPLIED AND NOT VERIFIED.
--
-- What was measured today (pg_stat_statements, counting since the reset at
-- 11:08 UTC):
--
--   public.shell_context()      577 calls   mean 637 ms   max 6,158 ms   sd 1,070
--   public.passcode_status()    727 calls   mean 108 ms   max 2,419 ms   sd   213
--   listings catalogue selects  ~650 calls  mean 234-266 ms (now cached by the app)
--
-- EXPLAIN (analyze, buffers) of shell_context() as the `authenticated` role
-- with an unknown uid: 68 ms, 2,186 shared buffer hits, for a member with NO
-- rows at all. Every table it touches is tiny (notifications 297 rows,
-- businesses 7, agents 2), and each subquery alone runs in under a
-- millisecond with the right index. The cost is the policy evaluation: each
-- RLS policy on each table is an InitPlan (one of them reads 300 buffers), and
-- a plain `stable` SQL function is planned and policy-checked for every call,
-- for every table, with my_staff_access() and console_step_up_ok() nested
-- inside it. The difference between 68 ms warm and 637 ms mean is contention
-- and connection churn on the pooler, which no index fixes.
--
-- THE CHANGE PROPOSED: read the shell's row as SECURITY DEFINER with the uid
-- taken ONCE from the verified token and every subquery filtered on it
-- explicitly, so no policy is evaluated at all. This is safe because every
-- field is the caller's own (their profile, their handle, their unread count,
-- their agent row, the businesses they own or front, their roles, their staff
-- grant) and the function raises for an anonymous caller. It also keeps
-- `console_verified` out of the shell: the console asks my_staff_access()
-- itself where it needs the step-up answer, and the shell only ever reads
-- `scopes` off this value (shell-queries.ts, hasStaffScopes).
--
-- The app is unchanged by this draft: it reads the same keys from the same
-- jsonb. Apply only after the probes in supabase/tests pass against it.

set lock_timeout = '5s';

create or replace function public.shell_context()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $fn$
  with me as (
    select coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) as uid
  )
  select case when (select uid from me) = '00000000-0000-0000-0000-000000000000'::uuid then null::jsonb else
  jsonb_build_object(
    'profile', (select jsonb_build_object(
                         'first_name', p.first_name, 'nickname', p.nickname,
                         'display_name', p.display_name, 'avatar_url', p.avatar_url)
                  from public.profiles p, me where p.id = me.uid),
    'handle', (select s.handle from public.social_profiles s, me where s.user_id = me.uid),
    -- notifications_unread_idx (user_id) where read_at is null: an index-only scan.
    'unread', (select count(*) from public.notifications n, me
                where n.user_id = me.uid and n.read_at is null),
    'agent', (select jsonb_build_object('id', a.id, 'display_name', a.display_name,
                                        'type', a.type, 'role', a.role, 'status', a.status)
                from public.agents a, me where a.user_id = me.uid),
    'businesses', coalesce((select jsonb_agg(jsonb_build_object(
                                     'id', b.id, 'name', b.name, 'kind', b.kind,
                                     'status', b.status, 'is_demo', b.is_demo)
                                   order by b.created_at, b.id)
                              from public.businesses b, me
                             where b.owner_id = me.uid or b.agent_id = me.uid), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(r.role order by r.role)
                         from public.user_roles r, me
                        where r.user_id = me.uid and r.role in ('admin', 'super_admin')), '[]'::jsonb),
    -- Only what the shell reads: the scopes. The console asks my_staff_access()
    -- itself for the handbook and the step-up answer.
    'staff', jsonb_build_object(
       'scopes', coalesce((select to_jsonb(g.scopes::text[]) from public.staff_grants g, me
                            where g.user_id = me.uid and g.revoked_at is null), '[]'::jsonb)),
    'is_host', exists (select 1 from public.businesses b, me
                        where b.owner_id = me.uid
                          and b.kind <> 'agency'
                          and b.is_demo is not true)
  ) end
$fn$;

revoke all on function public.shell_context() from public, anon;
grant execute on function public.shell_context() to authenticated;

-- PROBE (run as a member before trusting this): the answer must equal, key for
-- key, what the current function returns for the same member, apart from
-- `staff`, which carries `scopes` only. Then:
--   explain (analyze, buffers) select public.shell_context();
-- should read under 5 ms and under 50 shared buffer hits for any member.

-- passcode_status() is lib/passcode's (not touched today). Its mean of 108 ms
-- for a one-row primary-key read on member_passcodes (17 rows) says the same
-- thing: contention, not the query. It is already SECURITY DEFINER with an
-- explicit uid. The app now reads it beside the shell row, not after it.
