-- CIRCLE VOUCHES: a member vouches for another member in a community.
--
-- A vouch is a one-line endorsement from one member to another, visible
-- on the recipient's profile and inside the community. One vouch per
-- (community, voucher, vouchee) triple. The vouchee cannot vouch for
-- themselves. Both parties must be active members of the community.
--
-- Rules:
-- 1. Only active members may vouch.
-- 2. One vouch per (community, voucher, vouchee) triple.
-- 3. The voucher can withdraw their vouch.
-- 4. The vouchee sees vouches they received.
-- 5. Community owners/mods see all vouches.

set lock_timeout = '5s';

create table if not exists public.circle_vouches (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.circle_communities (id) on delete cascade,
  voucher_id    uuid not null references auth.users (id) on delete cascade,
  vouchee_id    uuid not null references auth.users (id) on delete cascade,
  note          text not null default '' check (length(note) <= 280),
  created_at    timestamptz not null default now(),
  constraint circle_vouches_no_self check (voucher_id <> vouchee_id),
  constraint circle_vouches_unique unique (community_id, voucher_id, vouchee_id)
);

create index if not exists circle_vouches_vouchee on public.circle_vouches (vouchee_id);
create index if not exists circle_vouches_community on public.circle_vouches (community_id);

alter table public.circle_vouches enable row level security;

create policy circle_vouches_select on public.circle_vouches
  for select to authenticated
  using (
    vouchee_id = (select auth.uid())
    or voucher_id = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator')
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

create policy circle_vouches_insert on public.circle_vouches
  for insert to authenticated
  with check (
    voucher_id = (select auth.uid())
    and private.circle_role(community_id, (select auth.uid())) is not null
  );

create policy circle_vouches_delete on public.circle_vouches
  for delete to authenticated
  using (voucher_id = (select auth.uid()));

revoke all on table public.circle_vouches from public;
grant select, insert, delete on table public.circle_vouches to authenticated;
