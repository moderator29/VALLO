-- CIRCLE INVITES: a member invites another person to a community.
--
-- An invite is a row linking the community, the inviter and the invitee.
-- The invitee accepts or declines. A private community's join request
-- path already exists (circle_memberships with status 'requested' +
-- decideJoinRequest); invites let members bring people in directly.
--
-- Rules:
-- 1. Only active members may invite.
-- 2. One open invite per (community, inviter, invitee) triple.
-- 3. Accepting an invite creates a membership (or reactivates a departed one).
-- 4. The invitee sees their own invites. The inviter sees their own sent invites.
-- 5. An admin or community owner sees all invites for their communities.

set lock_timeout = '5s';

create table if not exists public.circle_invites (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.circle_communities (id) on delete cascade,
  inviter_id    uuid not null references auth.users (id) on delete cascade,
  invitee_id    uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  constraint circle_invites_no_self check (inviter_id <> invitee_id)
);

create unique index if not exists circle_invites_unique_open
  on public.circle_invites (community_id, inviter_id, invitee_id)
  where (status = 'pending');

create index if not exists circle_invites_invitee on public.circle_invites (invitee_id, status) where status = 'pending';
create index if not exists circle_invites_community on public.circle_invites (community_id, status);

alter table public.circle_invites enable row level security;

-- Invitees see invites sent to them, inviters see invites they sent,
-- community owners/mods/admins see all invites for their communities.
create policy circle_invites_select on public.circle_invites
  for select to authenticated
  using (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator')
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

-- Only active members may insert invites.
create policy circle_invites_insert on public.circle_invites
  for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and private.circle_role(community_id, (select auth.uid())) is not null
  );

-- Invitees update to accept/decline; inviters update to withdraw.
create policy circle_invites_update on public.circle_invites
  for update to authenticated
  using (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
  )
  with check (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
  );

revoke all on table public.circle_invites from public;
grant select, insert, update on table public.circle_invites to authenticated;

-- Accept: create or reactivate the membership, mark the invite accepted.
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
    raise exception 'RM201: Invite not found or already decided.';
  end if;

  -- Create or reactivate membership.
  insert into public.circle_memberships (community_id, user_id, role, status, joined_at)
  values (v_invite.community_id, v_invite.invitee_id, 'member', 'active', now())
  on conflict (community_id, user_id) do update
    set status = 'active', joined_at = now();

  -- Bump member count.
  update public.circle_communities
  set member_count = member_count + 1, updated_at = now()
  where id = v_invite.community_id;

  -- Mark invite accepted.
  update public.circle_invites
  set status = 'accepted', decided_at = now()
  where id = p_invite_id;
end;
$$;

-- Decline: mark the invite declined.
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
    raise exception 'RM202: Invite not found or already decided.';
  end if;
end;
$$;
