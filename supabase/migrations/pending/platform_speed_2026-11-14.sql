-- PLATFORM SPEED: THE SHELL'S ROW WITHOUT THE POLICY WORK (14 November 2026).
--
-- STATUS: NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER WITH READS ONLY.
--
-- public.shell_context() is on the path of every signed-in page load. As it
-- stands it is SECURITY INVOKER, so every table it touches has its RLS
-- policies evaluated on every call, with my_staff_access() and
-- console_step_up_ok() nested inside it. This file reads the same row as
-- SECURITY DEFINER, with the caller's id taken once from the verified token
-- and every subquery filtered on it, so no policy is evaluated.
--
-- WHAT WAS CHECKED (read only, nothing created): the body below was run for 32
-- live members (every staff grant, every admin role, every agent, every
-- business owner, the fifteen with the most unread notifications, the fifteen
-- newest accounts and the QA member) beside the live function called as that
-- member. All 32 answers were identical key for key, and the staff scopes were
-- identical for all 32. On a quiet database the live function took 3.8 ms a
-- call and this body 0.5 ms. The 633 ms mean in pg_stat_statements was
-- measured during the 13 November stall, so expect this to matter most under
-- load, not to take 600 ms off a quiet page.
--
-- THE TWO DELIBERATE DIFFERENCES FROM THE LIVE FUNCTION:
--   1. `staff` carries `scopes` only. The live one carries the whole
--      my_staff_access() answer (position, handbook, console_verified). The
--      shell reads `scopes` and nothing else (shell-queries.ts, hasStaffScopes);
--      the console asks my_staff_access() itself.
--   2. A caller with no id gets null, not an object of nulls. anon cannot call
--      it today and cannot after; the app treats null as "use the separate
--      reads".
--
-- Every field is the caller's own. The businesses clause repeats what RLS
-- allowed (the owner's own, or a published one, or any for an admin), so a
-- business somebody merely fronts is no more visible than it was.
--
-- Safe to run twice. To undo, re-apply the function from migration PERF-DB 4.

set lock_timeout = '5s';

create or replace function public.shell_context()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $fn$
  with me as (select (select auth.uid()) as uid)
  select case when (select uid from me) is null then null::jsonb else
  jsonb_build_object(
    'profile', (select jsonb_build_object(
                         'first_name', p.first_name, 'nickname', p.nickname,
                         'display_name', p.display_name, 'avatar_url', p.avatar_url)
                  from public.profiles p, me where p.id = me.uid),
    'handle', (select s.handle from public.social_profiles s, me where s.user_id = me.uid),
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
                             where b.owner_id = me.uid
                                or (b.agent_id = me.uid
                                    and (b.status = 'PUBLISHED'
                                         or exists (select 1 from public.user_roles ar
                                                     where ar.user_id = me.uid
                                                       and ar.role in ('admin', 'super_admin'))))), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(r.role order by r.role)
                         from public.user_roles r, me
                        where r.user_id = me.uid and r.role in ('admin', 'super_admin')), '[]'::jsonb),
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

-- READ-BACK. Raises (and so undoes the whole file) if anything is not as written.
do $readback$
declare
  v_row jsonb;
begin
  if not (select p.prosecdef and position('search_path=' in coalesce(array_to_string(p.proconfig, ','), '')) > 0
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'shell_context') then
    raise exception 'shell_context: not security definer with a fixed search_path';
  end if;
  if has_function_privilege('anon', 'public.shell_context()', 'execute')
     or not has_function_privilege('authenticated', 'public.shell_context()', 'execute') then
    raise exception 'shell_context: grants are not as designed';
  end if;

  -- Nobody signed in: nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  if public.shell_context() is not null then
    raise exception 'shell_context: answered a caller with no id';
  end if;

  -- An id that is nobody: an empty row, and never anybody else's.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dead', true);
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000dead","role":"authenticated"}', true);
  set local role authenticated;
  v_row := public.shell_context();
  reset role;
  if v_row is null
     or v_row -> 'profile' <> 'null'::jsonb
     or (v_row ->> 'unread')::int <> 0
     or v_row -> 'businesses' <> '[]'::jsonb
     or v_row -> 'roles' <> '[]'::jsonb
     or v_row -> 'staff' -> 'scopes' <> '[]'::jsonb
     or (v_row ->> 'is_host')::boolean then
    raise exception 'shell_context: an unknown member was answered with somebody''s data: %', v_row;
  end if;
end
$readback$;

select p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_may,
       has_function_privilege('authenticated', p.oid, 'execute') as member_may
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'shell_context';
-- expect: true, false, true
