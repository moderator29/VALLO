-- CIRCLE-PLAN-SIGNUPS-ARE-MEMBERS-ONLY: a signed-in stranger can neither read
-- a community's plan signups nor add themselves to one of its plans.
--
-- PENDING until `supabase/migrations/pending/circle_plan_signups_rls_2026-11-11.sql`
-- is applied. It fails today, which is the point.
--
-- `20261108123106_circle_plans.sql` states its own rules: "2. Only active
-- members may sign up" and "4. Community members can see all plans in their
-- communities". `circle_plans` enforces both. `circle_plan_signups` enforces
-- neither: its select policy is `using (true)` for every authenticated role,
-- and its insert policy checks only `user_id = auth.uid()`. Every other table
-- in the Circle set (`circle_invites`, `circle_vouches`,
-- `circle_shared_shortlists`) requires
-- `private.circle_role(community_id, auth.uid()) is not null`.
--
-- Rolls back always.
do $$
declare
  member   constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  outsider constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  community uuid;
  plan       uuid;
  third      uuid;
  n          int;
  cap_status text;
  declined_code text;
begin
  insert into public.circle_communities (name, slug, description, category, visibility, status, created_by)
  values ('Probe circle', 'probe-circle-' || substr(gen_random_uuid()::text, 1, 8), '', 'general', 'private', 'live', member)
  returning id into community;
  insert into public.circle_memberships (community_id, user_id, role, status, joined_at)
  values (community, member, 'owner', 'active', now());
  insert into public.circle_plans (community_id, organiser_id, title, description)
  values (community, member, 'Probe plan', '')
  returning id into plan;
  insert into public.circle_plan_signups (plan_id, user_id) values (plan, member);

  -- CONTROL: the member of the community sees their own community's signups.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated',
                      'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.circle_plan_signups s where s.plan_id = plan;
  if n <> 1 then raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a member of the community sees % signups, expected 1', n; end if;

  -- A signed-in stranger, who is not a member and cannot read the plan.
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', outsider, 'role', 'authenticated',
                      'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  select count(*) into n from public.circle_plans p where p.id = plan;
  if n <> 0 then raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a stranger read the plan itself, rows=%', n; end if;

  select count(*) into n from public.circle_plan_signups s where s.plan_id = plan;
  if n <> 0 then raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a stranger read % signups of a private community', n; end if;

  begin
    insert into public.circle_plan_signups (plan_id, user_id) values (plan, outsider);
    raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a stranger signed themselves up to a private community plan';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
  end;

  reset role;

  -- The cap is the database's, counted under the plan's own row lock.
  update public.circle_plans set max_members = 2 where id = plan;
  insert into public.circle_memberships (community_id, user_id, role, status, joined_at)
  values (community, outsider, 'member', 'active', now());
  insert into public.circle_plan_signups (plan_id, user_id) values (plan, outsider);
  select p.status into strict cap_status from public.circle_plans p where p.id = plan;
  if cap_status <> 'full' then
    raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: the last place did not move the plan to full, status=%', cap_status;
  end if;
  third := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (third, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-circle-plan-' || third || '@example.invalid', '{}', '{}', now(), now());
  insert into public.circle_memberships (community_id, user_id, role, status, joined_at)
  values (community, third, 'member', 'active', now());
  begin
    insert into public.circle_plan_signups (plan_id, user_id) values (plan, third);
    raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a third person joined a plan capped at two';
  exception
    when sqlstate 'RM204' then null;
  end;
  delete from public.circle_plan_signups where plan_id = plan and user_id = outsider;
  select p.status into strict cap_status from public.circle_plans p where p.id = plan;
  if cap_status <> 'open' then
    raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: a withdrawal did not reopen the plan, status=%', cap_status;
  end if;

  -- The two invite refusals carry their RM code as a SQLSTATE, the way every
  -- other refusal on this platform does, so the app may show the sentence.
  declined_code := 'none';
  begin
    perform public.decline_circle_invite('00000000-0000-4000-8000-0000000000de');
  exception when others then
    declined_code := sqlstate;
  end;
  if declined_code <> 'RM202' then
    raise exception 'PROBE_FAIL circle-plan-signups-are-members-only: decline_circle_invite answered SQLSTATE %, not RM202, so the app shows the generic failure', declined_code;
  end if;

  raise exception 'PROBE_OK circle-plan-signups-are-members-only';
end $$;
