-- CIRCLE PLAN SIGNUPS: close the two holes the plans migration left open,
-- and stop the member counter being bumped twice on an accepted invite.
--
-- Backend audit, 11 November 2026. Safe to run twice. No row is deleted and
-- no column changes; this only narrows what a signed-in stranger may do, and
-- removes one arithmetic line from one function.
--
-- WHAT WAS WRONG
--
-- 1. READ. `20261108123106_circle_plans.sql` created
--    `circle_plan_signups_select` with `using (true)` for every authenticated
--    role. Its own header says "Community members can see all plans in their
--    communities", and `circle_plans_select` enforces exactly that, but the
--    signup rows beside them were readable by ANY signed-in account on the
--    platform: every (plan, member) pair in every community, private ones
--    included. That is the attendance list of a private group, and it is also
--    how a stranger finds the plan ids in the first place.
--
-- 2. WRITE. `circle_plan_signups_insert` only checks `user_id = auth.uid()`,
--    so any signed-in account could add ITSELF to any plan in any community,
--    including a private community it is not a member of and cannot read.
--    The same file's rule 2 says "Only active members may sign up". Nothing
--    enforced it: not the policy, and not `signUpForPlan` in
--    `apps/web/src/lib/features/circle/actions.ts`, which only proves the
--    caller is signed in. Every other table in the Circle set
--    (`circle_invites`, `circle_vouches`, `circle_shared_shortlists`) already
--    requires `private.circle_role(community_id, auth.uid()) is not null`;
--    this one was the outlier.
--
-- 3. COUNTER. `public.accept_circle_invite`
--    (`20261108122218_circle_invites.sql`) does
--    `member_count = member_count + 1` after inserting the membership, but
--    `circle_memberships_count` (trigger, `20261107210200_features_circle_1_core.sql`)
--    had already recomputed `member_count` from the memberships table on that
--    same insert. Every accepted invite therefore left the community one
--    member over its real count, for ever. The trigger is the single writer;
--    the manual line is removed and the counter is recomputed once here for
--    any community that has already drifted.
--
-- 4. THE CAP ON A PLAN IS COLLECTED AND ENFORCED NOWHERE. `circle_plans`
--    carries `max_members` (2 to 100, set in the Create a plan form) and a
--    `status` whose check allows 'full'. Nothing counts signups against the
--    cap and nothing ever writes 'full': there is no trigger on either table
--    and `signUpForPlan` (apps/web/src/lib/features/circle/actions.ts) only
--    inserts. A plan capped at four takes four hundred. The count is kept by
--    the database, under the plan's own row lock, because two people tapping
--    at once is exactly the case a count in the application misses.
--
-- 5. THE TWO INVITE REFUSALS NEVER REACH THE MEMBER. Every other function on
--    this platform raises its sentence with `using errcode = 'RMnnn'` (40 of
--    them: RM001, RM010, RM020, RM030, RM050 and the rest), and the app reads
--    the code to decide whether the sentence is one it may show. These two
--    put the code INSIDE the message and set no errcode, so PostgREST reports
--    SQLSTATE P0001, `wordsFor` in the circle actions does not recognise it,
--    and a member who taps Accept on an invite somebody already withdrew
--    reads "That did not go through. Try again." instead of what happened.
--    They are the only two functions on the live database that do this.
--
-- The app reads signups only for plans it has already read (always inside one
-- community, `readCommunityPlans`), so the narrowed read changes nothing a
-- member sees.

set lock_timeout = '5s';

begin;

-- 1. Read a signup only as its own row, or as a member of that plan's
--    community, or as staff. `private.circle_role` is the same helper every
--    other Circle policy uses.
drop policy if exists circle_plan_signups_select on public.circle_plan_signups;
create policy circle_plan_signups_select on public.circle_plan_signups
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.circle_plans p
       where p.id = circle_plan_signups.plan_id
         and private.circle_role(p.community_id, (select auth.uid())) is not null
    )
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
    or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  );

-- 2. Sign up only as yourself, and only to a plan in a community you belong
--    to, which is what the plans migration said the rule was.
drop policy if exists circle_plan_signups_insert on public.circle_plan_signups;
create policy circle_plan_signups_insert on public.circle_plan_signups
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.circle_plans p
       where p.id = circle_plan_signups.plan_id
         and private.circle_role(p.community_id, (select auth.uid())) is not null
    )
  );

-- 3. The membership trigger is the only writer of member_count. Same function
--    as before in every other respect.
create or replace function public.accept_circle_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  select * into v_invite
  from public.circle_invites
  where id = p_invite_id and invitee_id = (select auth.uid()) and status = 'pending'
  for update;

  if not found then
    raise exception 'That invite is not there any more, or it was already decided.'
      using errcode = 'RM201';
  end if;

  insert into public.circle_memberships (community_id, user_id, role, status, joined_at)
  values (v_invite.community_id, v_invite.invitee_id, 'member', 'active', now())
  on conflict (community_id, user_id) do update
    set status = 'active', joined_at = now();

  -- member_count is maintained by circle_memberships_count on the insert
  -- above. Adding to it here counted every accepted invite twice.
  update public.circle_communities
  set updated_at = now()
  where id = v_invite.community_id;

  update public.circle_invites
  set status = 'accepted', decided_at = now()
  where id = p_invite_id;
end;
$$;

-- 4. The same convention for the decline, which has the same fault.
create or replace function public.decline_circle_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.circle_invites
  set status = 'declined', decided_at = now()
  where id = p_invite_id and invitee_id = (select auth.uid()) and status = 'pending';

  if not found then
    raise exception 'That invite is not there any more, or it was already decided.'
      using errcode = 'RM202';
  end if;
end;
$$;

-- 5. The cap, counted by the database under the plan's own row lock, so two
--    people tapping Sign up at the same moment cannot both get the last
--    place. `status` is moved to 'full' when the last place goes and back to
--    'open' when somebody withdraws, which is what the screens already draw.
create or replace function private.circle_plan_signup_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap   integer;
  taken integer;
begin
  select p.max_members into cap from public.circle_plans p where p.id = new.plan_id for update;
  if cap is null then
    return new;
  end if;
  select count(*) into taken from public.circle_plan_signups s where s.plan_id = new.plan_id;
  if taken >= cap then
    raise exception 'That plan is full.' using errcode = 'RM204';
  end if;
  if taken + 1 >= cap then
    update public.circle_plans p set status = 'full', updated_at = now()
     where p.id = new.plan_id and p.status = 'open';
  end if;
  return new;
end;
$$;

create or replace function private.circle_plan_signup_reopen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap   integer;
  taken integer;
begin
  select p.max_members into cap from public.circle_plans p where p.id = old.plan_id for update;
  if cap is null then
    return old;
  end if;
  select count(*) into taken from public.circle_plan_signups s where s.plan_id = old.plan_id;
  if taken < cap then
    update public.circle_plans p set status = 'open', updated_at = now()
     where p.id = old.plan_id and p.status = 'full';
  end if;
  return old;
end;
$$;

revoke all on function private.circle_plan_signup_cap() from public, anon, authenticated;
revoke all on function private.circle_plan_signup_reopen() from public, anon, authenticated;

drop trigger if exists circle_plan_signups_cap on public.circle_plan_signups;
create trigger circle_plan_signups_cap
  before insert on public.circle_plan_signups
  for each row execute function private.circle_plan_signup_cap();

drop trigger if exists circle_plan_signups_reopen on public.circle_plan_signups;
create trigger circle_plan_signups_reopen
  after delete on public.circle_plan_signups
  for each row execute function private.circle_plan_signup_reopen();

-- 6. Repair any community whose counter already drifted. Idempotent: it sets
--    the counter to the figure the trigger would have written.
update public.circle_communities c
   set member_count = (select count(*) from public.circle_memberships m
                        where m.community_id = c.id and m.status = 'active')
 where c.member_count is distinct from
       (select count(*) from public.circle_memberships m
         where m.community_id = c.id and m.status = 'active');

commit;

-- Verification, read only.
--   select count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'circle_plan_signups'
--      and coalesce(qual, with_check) like '%circle_role%';   -- expect 2
--   select c.id, c.member_count,
--          (select count(*) from public.circle_memberships m
--            where m.community_id = c.id and m.status = 'active') as actual
--     from public.circle_communities c;                        -- expect equal
--   select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
--    where c.relname = 'circle_plan_signups' and not t.tgisinternal;  -- expect 2
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosrc ~ 'RM[0-9]{3}:';          -- expect 0
