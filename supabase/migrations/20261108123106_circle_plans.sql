-- CIRCLE PLANS: a member proposes an activity in a community.
--
-- A plan is a lightweight community activity: "Let's view homes in Lekki
-- this Saturday" or "Shared rental search for 2-bed in Yaba". Members
-- sign up, and the organiser can cap the group. When the plan is done
-- the organiser marks it complete.
--
-- Rules:
-- 1. Only active members may create plans.
-- 2. Only active members may sign up.
-- 3. The organiser can cancel or complete the plan.
-- 4. Community members can see all plans in their communities.

set lock_timeout = '5s';

create table if not exists public.circle_plans (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.circle_communities (id) on delete cascade,
  organiser_id    uuid not null references auth.users (id) on delete cascade,
  title           text not null check (length(title) between 3 and 140),
  description     text not null default '' check (length(description) <= 2000),
  status          text not null default 'open' check (status in ('open', 'full', 'completed', 'cancelled')),
  max_members     int check (max_members is null or max_members between 2 and 100),
  scheduled_at    timestamptz,
  location        text check (location is null or length(location) <= 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists circle_plans_community on public.circle_plans (community_id, status);

create table if not exists public.circle_plan_signups (
  plan_id     uuid not null references public.circle_plans (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  signed_up_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

alter table public.circle_plans enable row level security;
alter table public.circle_plan_signups enable row level security;

create policy circle_plans_select on public.circle_plans
  for select to authenticated
  using (
    private.circle_role(community_id, (select auth.uid())) is not null
    or organiser_id = (select auth.uid())
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

create policy circle_plans_insert on public.circle_plans
  for insert to authenticated
  with check (
    organiser_id = (select auth.uid())
    and private.circle_role(community_id, (select auth.uid())) is not null
  );

create policy circle_plans_update on public.circle_plans
  for update to authenticated
  using (
    organiser_id = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator')
  )
  with check (
    organiser_id = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator')
  );

create policy circle_plan_signups_select on public.circle_plan_signups
  for select to authenticated
  using (true);

create policy circle_plan_signups_insert on public.circle_plan_signups
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy circle_plan_signups_delete on public.circle_plan_signups
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.circle_plans from public;
revoke all on table public.circle_plan_signups from public;
grant select, insert, update on table public.circle_plans to authenticated;
grant select, insert, delete on table public.circle_plan_signups to authenticated;
