-- CIRCLE SHARED SHORTLISTS: a member shares a saved collection with a community.
--
-- A shared shortlist is a link between a saved_search_collection and a
-- community. The collection owner shares it; community members can see it.
-- The owner can unshare. Only active members can share. The collection
-- keeps its existing RLS for the owner; the share only adds read access
-- for community members.

set lock_timeout = '5s';

create table if not exists public.circle_shared_shortlists (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.circle_communities (id) on delete cascade,
  collection_id   uuid not null,
  shared_by       uuid not null references auth.users (id) on delete cascade,
  title           text not null check (length(title) between 1 and 120),
  description     text not null default '' check (length(description) <= 500),
  created_at      timestamptz not null default now(),
  constraint circle_shared_shortlists_unique unique (community_id, collection_id)
);

create index if not exists circle_shared_shortlists_community
  on public.circle_shared_shortlists (community_id);

alter table public.circle_shared_shortlists enable row level security;

create policy circle_shared_shortlists_select on public.circle_shared_shortlists
  for select to authenticated
  using (
    shared_by = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) is not null
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
  );

create policy circle_shared_shortlists_insert on public.circle_shared_shortlists
  for insert to authenticated
  with check (
    shared_by = (select auth.uid())
    and private.circle_role(community_id, (select auth.uid())) is not null
  );

create policy circle_shared_shortlists_delete on public.circle_shared_shortlists
  for delete to authenticated
  using (
    shared_by = (select auth.uid())
    or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator')
  );

revoke all on table public.circle_shared_shortlists from public;
grant select, insert, delete on table public.circle_shared_shortlists to authenticated;
