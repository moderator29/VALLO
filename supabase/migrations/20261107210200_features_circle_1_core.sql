-- FEATURES: VALLO CIRCLE, THE CORE (the founder's brief of 7 November 2026,
-- FEED_AND_CIRCLE_BRIEF.md; the model is VALLO_CIRCLE.md v3 section 6).
-- Agent FEATURES. For the founder to paste in the Supabase SQL Editor; the
-- lead checks it live and moves it into migrations/.
--
-- REUSED, NOT REBUILT (checked live, 7 November 2026):
--   posts            discussions, questions (kind ASK), answers (replies),
--                    guides, opportunities: one table, two new columns
--   post_reactions   likes and saves, unchanged
--   areas            the Neighbourhoods section, unchanged
--   reports, blocks, mutes, notifications, confirmed_phones: unchanged
--
-- NEW: circle_communities, circle_memberships, post_helpful,
-- circle_accepted_answers, circle_question_follows, professional_profiles;
-- posts.community_id, posts.circle_type, posts.title, posts.helpful_count.
--
-- REPLACED, WITH THE SAME TEXT PLUS ONE RULE EACH (read them side by side):
--   policy   posts_select          + private.can_see_community(community_id)
--   function private.can_see_post  + the same rule (it guards reactions and
--                                    post media)
--   function private.fan_out_post  + a Circle reply links to /circle/p/..,
--                                    and a reply to a question reads as an
--                                    answer
-- posts_select is ONE permissive policy. A second policy would OR with it and
-- let a private community's posts out, so the rule goes inside it.
--
-- Every new table has RLS on. Every function is security definer with
-- search_path ''. Nothing here deletes data.

set lock_timeout = '5s';

-- ===========================================================================
-- 1. Communities

create table if not exists public.circle_communities (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  name             text not null check (length(btrim(name)) between 3 and 60),
  description      text not null default '' check (length(description) <= 500),
  category         text not null check (category in (
                     'neighbourhood', 'renting', 'buying', 'landlords', 'investing',
                     'short_lets', 'design', 'building', 'professionals', 'general')),
  area_id          uuid references public.areas (id) on delete set null,
  cover_path       text check (cover_path is null or length(cover_path) <= 300),
  visibility       text not null default 'public' check (visibility in ('public', 'private')),
  rules            text[] not null default '{}' check (cardinality(rules) <= 10),
  status           text not null default 'live' check (status in ('live', 'paused', 'removed')),
  started_by_vallo boolean not null default false,
  created_by       uuid references auth.users (id) on delete set null,
  member_count     integer not null default 0,
  post_count       integer not null default 0,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists circle_communities_category on public.circle_communities (category) where status = 'live';
create index if not exists circle_communities_area on public.circle_communities (area_id) where area_id is not null;

comment on table public.circle_communities is
  'Vallo Circle: topic and neighbourhood communities. Written only through the circle_* functions.';

alter table public.circle_communities enable row level security;

-- A private community is a closed door, not a hidden one: its name and
-- description show so people can ask to join. Its posts do not (section 3).
drop policy if exists circle_communities_select on public.circle_communities;
create policy circle_communities_select on public.circle_communities
  for select to anon, authenticated
  using (status = 'live'
         or created_by = (select auth.uid())
         or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
         or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role)));

revoke all on table public.circle_communities from public;
grant select on table public.circle_communities to anon, authenticated;

-- ===========================================================================
-- 2. Memberships

create table if not exists public.circle_memberships (
  community_id      uuid not null references public.circle_communities (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  role              text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status            text not null default 'active' check (status in ('active', 'requested')),
  muted             boolean not null default false,
  rules_accepted_at timestamptz,
  joined_at         timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists circle_memberships_user on public.circle_memberships (user_id) where status = 'active';

alter table public.circle_memberships enable row level security;

create or replace function private.circle_role(p_community uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.circle_memberships m
   where m.community_id = p_community and m.user_id = p_user and m.status = 'active';
$$;

-- Members see each other (the directory); you always see your own row; owners
-- and moderators see requests.
drop policy if exists circle_memberships_select on public.circle_memberships;
create policy circle_memberships_select on public.circle_memberships
  for select to authenticated
  using (user_id = (select auth.uid())
         or (status = 'active' and private.circle_role(community_id, (select auth.uid())) is not null
             and not private.blocked_with(user_id))
         or private.circle_role(community_id, (select auth.uid())) in ('owner', 'moderator'));

-- Leaving is a delete of your own row (an owner leaves through circle_leave).
drop policy if exists circle_memberships_delete_self on public.circle_memberships;
create policy circle_memberships_delete_self on public.circle_memberships
  for delete to authenticated
  using (user_id = (select auth.uid()) and role <> 'owner');

-- Muting a community is your own switch.
drop policy if exists circle_memberships_update_self on public.circle_memberships;
create policy circle_memberships_update_self on public.circle_memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.circle_memberships from public, anon;
grant select, delete on table public.circle_memberships to authenticated;
grant update (muted) on table public.circle_memberships to authenticated;

-- Counters, written only here.
create or replace function private.circle_bump_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.community_id, old.community_id);
begin
  update public.circle_communities c
     set member_count = (select count(*) from public.circle_memberships m
                          where m.community_id = v_id and m.status = 'active')
   where c.id = v_id;
  return null;
end;
$$;

drop trigger if exists circle_memberships_count on public.circle_memberships;
create trigger circle_memberships_count
  after insert or delete or update of status on public.circle_memberships
  for each row execute function private.circle_bump_members();

-- ===========================================================================
-- 3. Posts in Circle: two columns that say where and what, a title, and the
--    helpful counter. Everything else about a post is unchanged.

alter table public.posts add column if not exists community_id uuid references public.circle_communities (id) on delete set null;
alter table public.posts add column if not exists circle_type text check (circle_type is null or circle_type in (
  'discussion', 'question', 'guide', 'opportunity', 'announcement'));
alter table public.posts add column if not exists title text check (title is null or length(btrim(title)) between 3 and 140);
alter table public.posts add column if not exists helpful_count integer not null default 0;

create index if not exists posts_community_recent on public.posts (community_id, created_at desc, id desc)
  where community_id is not null and depth = 0;
create index if not exists posts_circle_type_recent on public.posts (circle_type, created_at desc)
  where community_id is not null and depth = 0;

create or replace function private.can_see_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_community is null or exists (
    select 1 from public.circle_communities c
     where c.id = p_community
       and c.status = 'live'
       and (c.visibility = 'public'
            or private.circle_role(c.id, (select auth.uid())) is not null)
  );
$$;

-- posts_select, as it is live today, plus the community rule inside the first
-- group (the one that answers for everybody else's posts).
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select
  using (
    ((status = 'LIVE'::public.social_status)
      and ((area_id is null) or (exists (select 1 from public.areas a
             where a.id = posts.area_id and a.status = any (array['ACTIVE'::public.area_status, 'PAUSED'::public.area_status]))))
      and (not private.blocked_with(author_id))
      and private.can_see_community(community_id))
    or (author_id = (select auth.uid()))
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
    or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  );

-- can_see_post, as it is live today, plus the same rule. It guards
-- post_reactions inserts and post_media reads.
create or replace function private.can_see_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.posts p
      left join public.areas a on a.id = p.area_id
     where p.id = p_post
       and (p.status = 'LIVE' or p.author_id = (select auth.uid()))
       and (p.area_id is null or a.status in ('ACTIVE', 'PAUSED'))
       and not private.blocked_with(p.author_id)
       and private.can_see_community(p.community_id)
  );
$$;

-- Before insert, after posts_place (names run in order): a reply takes its
-- thread's community; a new Circle post needs a member, a title and a type;
-- an announcement needs an owner or moderator; an opportunity needs a
-- confirmed phone and is held for review before anyone sees it.
create or replace function private.circle_place_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_community uuid;
  v_role text;
  v_c public.circle_communities%rowtype;
begin
  if new.parent_id is not null then
    select p.community_id into v_parent_community from public.posts p where p.id = new.parent_id;
    new.community_id := v_parent_community;
    new.circle_type := null;
    new.title := null;
    if v_parent_community is not null then new.allow_quotes := false; end if;
    if v_parent_community is not null and not private.can_see_community(v_parent_community) then
      raise exception 'Join this community to reply.' using errcode = 'RM020';
    end if;
    return new;
  end if;

  if new.community_id is null then
    new.circle_type := null;
    new.title := null;
    return new;
  end if;

  select * into v_c from public.circle_communities c where c.id = new.community_id;
  if not found or v_c.status <> 'live' then
    raise exception 'That community is not open for posts.' using errcode = 'RM021';
  end if;

  v_role := private.circle_role(new.community_id, new.author_id);
  if v_role is null then
    raise exception 'Join this community to post in it.' using errcode = 'RM022';
  end if;

  if new.title is null then
    raise exception 'Give your post a short title.' using errcode = 'RM023';
  end if;

  new.circle_type := coalesce(new.circle_type, case when new.kind = 'ASK' then 'question' else 'discussion' end);
  if new.kind = 'ASK' then new.circle_type := 'question'; end if;
  if new.circle_type = 'question' and new.kind <> 'ASK' then new.kind := 'ASK'; end if;

  if new.circle_type = 'announcement' and v_role not in ('owner', 'moderator') then
    raise exception 'Only the people who run this community can post an announcement.' using errcode = 'RM024';
  end if;

  if new.circle_type = 'opportunity' then
    if not exists (select 1 from public.confirmed_phones cp where cp.user_id = new.author_id) then
      raise exception 'Confirm your phone before you post an opportunity.' using errcode = 'RM025';
    end if;
    new.status := 'HELD';
    new.hold_reason := 'Opportunities are checked before they show.';
  end if;

  /* A Circle post stays in Circle: it is not quoted into the feed. */
  new.allow_quotes := false;
  return new;
end;
$$;

drop trigger if exists posts_place_circle on public.posts;
create trigger posts_place_circle
  before insert on public.posts
  for each row execute function private.circle_place_post();

-- Before update, after posts_zz_guard_update: where a post lives and the
-- helpful counter are not the author's to change. The counter trigger below
-- runs one level deeper and is let through.
create or replace function private.circle_guard_post_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  new.community_id := old.community_id;
  new.circle_type := old.circle_type;
  new.helpful_count := old.helpful_count;
  if old.community_id is not null then new.allow_quotes := false; end if;
  if old.title is not null and new.title is null then new.title := old.title; end if;
  return new;
end;
$$;

drop trigger if exists posts_zzz_guard_circle on public.posts;
create trigger posts_zzz_guard_circle
  before update on public.posts
  for each row execute function private.circle_guard_post_update();

-- A private community's post is never reposted into the feed.
create or replace function private.circle_refuse_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.posts p where p.id = new.post_id and p.community_id is not null) then
    raise exception 'Circle posts stay in Circle. Share the link instead.' using errcode = 'RM026';
  end if;
  return new;
end;
$$;

drop trigger if exists post_reposts_circle on public.post_reposts;
create trigger post_reposts_circle
  before insert on public.post_reposts
  for each row execute function private.circle_refuse_repost();

-- The community's post counter and last activity.
create or replace function private.circle_bump_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.community_id, old.community_id);
begin
  if v_id is null then return null; end if;
  update public.circle_communities c
     set post_count = (select count(*) from public.posts p
                        where p.community_id = v_id and p.depth = 0 and p.status = 'LIVE'),
         last_activity_at = now()
   where c.id = v_id;
  return null;
end;
$$;

drop trigger if exists posts_circle_count on public.posts;
create trigger posts_circle_count
  after insert or update of status on public.posts
  for each row execute function private.circle_bump_posts();

-- ===========================================================================
-- 4. Helpful marks (the reputation that rewards help; never a score)

create table if not exists public.post_helpful (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_helpful_user on public.post_helpful (user_id);

alter table public.post_helpful enable row level security;

create or replace function private.may_mark_helpful(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
     where p.id = p_post
       and p.community_id is not null
       and p.depth > 0
       and p.status = 'LIVE'
       and p.author_id is distinct from (select auth.uid())
  ) and private.can_see_post(p_post);
$$;

drop policy if exists post_helpful_select_own on public.post_helpful;
create policy post_helpful_select_own on public.post_helpful
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists post_helpful_insert_own on public.post_helpful;
create policy post_helpful_insert_own on public.post_helpful
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.may_mark_helpful(post_id));

drop policy if exists post_helpful_delete_own on public.post_helpful;
create policy post_helpful_delete_own on public.post_helpful
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.post_helpful from public, anon;
grant select, insert, delete on table public.post_helpful to authenticated;

create or replace function private.circle_bump_helpful()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
  v_author uuid;
  v_root uuid;
begin
  update public.posts p
     set helpful_count = (select count(*) from public.post_helpful h where h.post_id = v_post)
   where p.id = v_post
  returning p.author_id, coalesce(p.root_id, p.id) into v_author, v_root;

  if tg_op = 'INSERT' and v_author is not null and not private.blocked_between(v_author, new.user_id) then
    perform private.notify_once(
      'helpful:' || v_post::text || ':' || ((now() at time zone 'Africa/Lagos')::date)::text,
      v_author, 'social'::public.notification_kind,
      'Marked helpful',
      'Someone found your answer helpful.',
      '/circle/p/' || v_root::text || '#a-' || v_post::text);
  end if;
  return null;
end;
$$;

drop trigger if exists post_helpful_count on public.post_helpful;
create trigger post_helpful_count
  after insert or delete on public.post_helpful
  for each row execute function private.circle_bump_helpful();

-- ===========================================================================
-- 5. Accepted answers and followed questions

create table if not exists public.circle_accepted_answers (
  question_id uuid primary key references public.posts (id) on delete cascade,
  answer_id   uuid not null references public.posts (id) on delete cascade,
  accepted_at timestamptz not null default now()
);

alter table public.circle_accepted_answers enable row level security;

drop policy if exists circle_accepted_answers_select on public.circle_accepted_answers;
create policy circle_accepted_answers_select on public.circle_accepted_answers
  for select to anon, authenticated using (private.can_see_post(question_id));

revoke all on table public.circle_accepted_answers from public;
grant select on table public.circle_accepted_answers to anon, authenticated;

create table if not exists public.circle_question_follows (
  question_id uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index if not exists circle_question_follows_user on public.circle_question_follows (user_id);

alter table public.circle_question_follows enable row level security;

drop policy if exists circle_question_follows_own on public.circle_question_follows;
create policy circle_question_follows_own on public.circle_question_follows
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists circle_question_follows_insert on public.circle_question_follows;
create policy circle_question_follows_insert on public.circle_question_follows
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.posts p where p.id = question_id and p.circle_type = 'question')
              and private.can_see_post(question_id));

drop policy if exists circle_question_follows_delete on public.circle_question_follows;
create policy circle_question_follows_delete on public.circle_question_follows
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.circle_question_follows from public, anon;
grant select, insert, delete on table public.circle_question_follows to authenticated;

-- After a Circle post is written: the asker follows their own question, and
-- the followers of a question hear about a new answer (one notice an hour per
-- question per person; the asker is told by fan_out_post below).
create or replace function private.circle_after_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root public.posts%rowtype;
  v_follower uuid;
  v_hour text := to_char(now() at time zone 'Africa/Lagos', 'YYYYMMDDHH24');
begin
  if new.community_id is null or new.status <> 'LIVE' then return null; end if;

  if new.parent_id is null and new.circle_type = 'question' and new.author_id is not null then
    insert into public.circle_question_follows (question_id, user_id)
    values (new.id, new.author_id) on conflict do nothing;
    return null;
  end if;

  if new.parent_id is null then return null; end if;
  select * into v_root from public.posts p where p.id = coalesce(new.root_id, new.parent_id);
  /* Only a direct answer to the question, not a reply under an answer. */
  if not found or v_root.circle_type is distinct from 'question' or new.parent_id <> v_root.id then
    return null;
  end if;

  for v_follower in
    select f.user_id from public.circle_question_follows f
     where f.question_id = v_root.id
       and f.user_id is distinct from new.author_id
       and f.user_id is distinct from v_root.author_id
     limit 500
  loop
    if private.block_between(v_follower, new.author_id) then continue; end if;
    perform private.notify_once(
      'qfollow:' || v_root.id::text || ':' || v_follower::text || ':' || v_hour,
      v_follower, 'social'::public.notification_kind,
      'New answer',
      left('A question you follow has a new answer: ' || coalesce(v_root.title, 'open it to read'), 110),
      '/circle/p/' || v_root.id::text || '#a-' || new.id::text);
  end loop;
  return null;
end;
$$;

drop trigger if exists posts_circle_after on public.posts;
create trigger posts_circle_after
  after insert on public.posts
  for each row execute function private.circle_after_post();

-- fan_out_post, as it is live today, with the Circle destinations: a reply in
-- Circle opens /circle/p/<thread>, and a reply to a question reads as an
-- answer. Mentions are unchanged except for the same destination.
create or replace function private.fan_out_post(p_post public.posts)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  parent_author uuid;
  who           text;
  named         text;
  named_id      uuid;
  sent          integer := 0;
  thread        uuid;
  href          text;
  is_answer     boolean := false;
begin
  if p_post.author_id is null or p_post.status <> 'LIVE' then return; end if;

  who    := private.social_handle(p_post.author_id);
  thread := coalesce(p_post.root_id, p_post.id);
  href   := case when p_post.community_id is not null
                 then '/circle/p/' || thread || case when p_post.parent_id is not null then '#a-' || p_post.id else '' end
                 else '/post/' || thread end;

  if p_post.parent_id is not null then
    select author_id into parent_author from public.posts where id = p_post.parent_id;
    if p_post.community_id is not null then
      select (r.circle_type = 'question' and r.id = p_post.parent_id) into is_answer
        from public.posts r where r.id = thread;
    end if;

    perform private.notify_social(
      parent_author,
      p_post.author_id,
      case when coalesce(is_answer, false) then 'New answer' else 'New reply' end,
      coalesce('@' || who, 'Somebody') ||
        case when coalesce(is_answer, false) then ' answered: ' else ' replied: ' end ||
        left(coalesce(nullif(btrim(p_post.body), ''), 'they answered you'), 120),
      href
    );
  end if;

  for named in
    select distinct lower(tok[2])
      from regexp_matches(coalesce(p_post.body, ''),
                          '(^|[^A-Za-z0-9_@])@([a-z][a-z0-9_]{2,19})', 'gi') as m(tok)
  loop
    exit when sent >= 5;

    select user_id into named_id from public.social_profiles where handle = named;
    if named_id is null or named_id = parent_author then continue; end if;
    /* Nobody is told about a post they cannot open. */
    if p_post.community_id is not null and not exists (
         select 1 from public.circle_communities c
          where c.id = p_post.community_id
            and (c.visibility = 'public' or private.circle_role(c.id, named_id) is not null)) then
      continue;
    end if;

    perform private.notify_social(
      named_id,
      p_post.author_id,
      'You were mentioned',
      coalesce('@' || who, 'Somebody') || ' mentioned you: ' ||
        left(coalesce(nullif(btrim(p_post.body), ''), 'in a post'), 120),
      href
    );
    sent := sent + 1;
  end loop;
end;
$function$;

-- ===========================================================================
-- 6. Professional profiles. Verification is never set here: it is read from
--    agents.verified, a credentials row with its checker, or a business check.

create table if not exists public.professional_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  headline   text not null check (length(btrim(headline)) between 3 and 80),
  kinds      text[] not null default '{}' check (cardinality(kinds) between 1 and 3 and kinds <@ array[
               'agent', 'landlord', 'developer', 'architect', 'interior_designer', 'property_manager',
               'surveyor', 'lawyer', 'valuer', 'builder', 'investor']::text[]),
  area_ids   uuid[] not null default '{}' check (cardinality(area_ids) <= 8),
  years      smallint check (years is null or years between 0 and 60),
  bio        text not null default '' check (length(bio) <= 600),
  links      text[] not null default '{}' check (cardinality(links) <= 3),
  listed     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professional_profiles enable row level security;

drop policy if exists professional_profiles_select on public.professional_profiles;
create policy professional_profiles_select on public.professional_profiles
  for select to anon, authenticated
  using ((listed and not private.blocked_with(user_id)) or user_id = (select auth.uid()));

drop policy if exists professional_profiles_insert_own on public.professional_profiles;
create policy professional_profiles_insert_own on public.professional_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists professional_profiles_update_own on public.professional_profiles;
create policy professional_profiles_update_own on public.professional_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists professional_profiles_delete_own on public.professional_profiles;
create policy professional_profiles_delete_own on public.professional_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.professional_profiles from public;
grant select on table public.professional_profiles to anon;
grant select, insert, update, delete on table public.professional_profiles to authenticated;

-- ===========================================================================
-- 7. The doors: create, join, leave, decide, accept

create or replace function public.circle_create_community(
  p_name text, p_slug text, p_description text, p_category text,
  p_visibility text, p_rules text[], p_cover_path text, p_area_id uuid, p_by_vallo boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  staff boolean;
  v_id uuid;
  v_slug text := lower(btrim(p_slug));
begin
  if uid is null then return 'signed_out'; end if;
  staff := private.has_role(uid, 'admin'::public.app_role) or private.has_role(uid, 'super_admin'::public.app_role);
  if not staff and not exists (select 1 from public.confirmed_phones cp where cp.user_id = uid) then
    return 'phone';
  end if;
  if not staff and (select count(*) from public.circle_communities c
                     where c.created_by = uid and c.created_at > now() - interval '7 days') >= 3 then
    return 'limit';
  end if;
  if exists (select 1 from public.circle_communities c where c.slug = v_slug) then
    return 'taken';
  end if;
  if p_cover_path is not null and split_part(p_cover_path, '/', 1) <> uid::text then
    return 'cover';
  end if;

  insert into public.circle_communities
    (slug, name, description, category, visibility, rules, cover_path, area_id, started_by_vallo, created_by)
  values
    (v_slug, btrim(p_name), coalesce(btrim(p_description), ''), p_category,
     coalesce(p_visibility, 'public'),
     coalesce((select array_agg(left(btrim(r), 200)) from unnest(p_rules) r where btrim(r) <> ''), '{}'),
     p_cover_path, p_area_id, staff and coalesce(p_by_vallo, false), uid)
  returning id into v_id;

  insert into public.circle_memberships (community_id, user_id, role, status, rules_accepted_at)
  values (v_id, uid, 'owner', 'active', now());

  return 'ok:' || v_slug;
end;
$$;

create or replace function public.circle_join(p_community uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_c public.circle_communities%rowtype;
  v_owner uuid;
begin
  if uid is null then return 'signed_out'; end if;
  select * into v_c from public.circle_communities c where c.id = p_community and c.status = 'live';
  if not found then return 'missing'; end if;
  if exists (select 1 from public.circle_memberships m where m.community_id = p_community and m.user_id = uid) then
    return (select m.status from public.circle_memberships m where m.community_id = p_community and m.user_id = uid);
  end if;

  insert into public.circle_memberships (community_id, user_id, role, status, rules_accepted_at)
  values (p_community, uid, 'member',
          case when v_c.visibility = 'private' then 'requested' else 'active' end, now());

  if v_c.visibility = 'private' then
    for v_owner in
      select m.user_id from public.circle_memberships m
       where m.community_id = p_community and m.status = 'active' and m.role in ('owner', 'moderator')
       limit 10
    loop
      perform private.notify_social(v_owner, uid, left('Join request: ' || v_c.name, 40),
        coalesce(private.person_name(uid), 'Someone') || ' asked to join ' || v_c.name || '.',
        '/circle/c/' || v_c.slug || '/manage');
    end loop;
    return 'requested';
  end if;
  return 'active';
end;
$$;

create or replace function public.circle_leave(p_community uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return 'signed_out'; end if;
  if private.circle_role(p_community, uid) = 'owner'
     and (select count(*) from public.circle_memberships m
           where m.community_id = p_community and m.role = 'owner' and m.status = 'active') = 1 then
    return 'owner';
  end if;
  delete from public.circle_memberships m where m.community_id = p_community and m.user_id = uid;
  return 'left';
end;
$$;

create or replace function public.circle_decide_request(p_community uuid, p_user uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_c public.circle_communities%rowtype;
begin
  if uid is null then return 'signed_out'; end if;
  if private.circle_role(p_community, uid) not in ('owner', 'moderator') then return 'not_allowed'; end if;
  select * into v_c from public.circle_communities c where c.id = p_community;
  if not exists (select 1 from public.circle_memberships m
                  where m.community_id = p_community and m.user_id = p_user and m.status = 'requested') then
    return 'missing';
  end if;
  if p_approve then
    update public.circle_memberships m set status = 'active', joined_at = now()
     where m.community_id = p_community and m.user_id = p_user;
    perform private.notify_social(p_user, uid, left('Welcome to ' || v_c.name, 40),
      'Your request to join was accepted.', '/circle/c/' || v_c.slug);
    return 'approved';
  end if;
  delete from public.circle_memberships m where m.community_id = p_community and m.user_id = p_user;
  return 'declined';
end;
$$;

create or replace function public.circle_accept_answer(p_question uuid, p_answer uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_q public.posts%rowtype;
  v_a public.posts%rowtype;
begin
  if uid is null then return 'signed_out'; end if;
  select * into v_q from public.posts p where p.id = p_question;
  if not found or v_q.circle_type is distinct from 'question' or v_q.author_id <> uid then
    return 'not_allowed';
  end if;
  if p_answer is null then
    delete from public.circle_accepted_answers a where a.question_id = p_question;
    return 'cleared';
  end if;
  select * into v_a from public.posts p where p.id = p_answer;
  if not found or v_a.parent_id is distinct from p_question or v_a.status <> 'LIVE' or v_a.author_id = uid then
    return 'not_allowed';
  end if;
  insert into public.circle_accepted_answers (question_id, answer_id)
  values (p_question, p_answer)
  on conflict (question_id) do update set answer_id = excluded.answer_id, accepted_at = now();
  perform private.notify_social(v_a.author_id, uid, 'Answer accepted',
    left('Your answer was accepted: ' || coalesce(v_q.title, 'open it to read'), 110),
    '/circle/p/' || p_question::text || '#a-' || p_answer::text);
  return 'accepted';
end;
$$;

-- ===========================================================================
-- 8. The live counts for the Circle banner and the community cards.
--    Aggregates only: no row, no name, no private post leaves.

create or replace function public.circle_home_stats()
returns table (members bigint, posts bigint, active bigint, communities bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(distinct m.user_id) from public.circle_memberships m
       join public.circle_communities c on c.id = m.community_id
      where m.status = 'active' and c.status = 'live'),
    (select count(*) from public.posts p
      where p.community_id is not null and p.depth = 0 and p.status = 'LIVE'),
    (select count(distinct x.who) from (
        select p.author_id as who from public.posts p
         where p.community_id is not null and p.status = 'LIVE' and p.created_at > now() - interval '7 days'
        union
        select h.user_id from public.post_helpful h where h.created_at > now() - interval '7 days'
      ) x where x.who is not null),
    (select count(*) from public.circle_communities c where c.status = 'live');
$$;

create or replace function public.circle_community_active(p_ids uuid[])
returns table (community_id uuid, active bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.community_id, count(distinct p.author_id)
    from public.posts p
   where p.community_id = any (p_ids[1:50])
     and p.status = 'LIVE'
     and p.created_at > now() - interval '7 days'
   group by p.community_id;
$$;

-- ===========================================================================
-- 9. Grants

revoke all on function private.circle_role(uuid, uuid) from public, anon;
-- The membership policies call it as the signed-in member.
grant execute on function private.circle_role(uuid, uuid) to authenticated;
revoke all on function private.can_see_community(uuid) from public, anon;
grant execute on function private.can_see_community(uuid) to authenticated, anon;
revoke all on function private.circle_place_post() from public, anon, authenticated;
revoke all on function private.circle_guard_post_update() from public, anon, authenticated;
revoke all on function private.circle_refuse_repost() from public, anon, authenticated;
revoke all on function private.circle_bump_posts() from public, anon, authenticated;
revoke all on function private.circle_bump_members() from public, anon, authenticated;
revoke all on function private.circle_bump_helpful() from public, anon, authenticated;
revoke all on function private.circle_after_post() from public, anon, authenticated;
revoke all on function private.may_mark_helpful(uuid) from public, anon;
grant execute on function private.may_mark_helpful(uuid) to authenticated;

revoke all on function public.circle_create_community(text, text, text, text, text, text[], text, uuid, boolean) from public, anon;
revoke all on function public.circle_join(uuid) from public, anon;
revoke all on function public.circle_leave(uuid) from public, anon;
revoke all on function public.circle_decide_request(uuid, uuid, boolean) from public, anon;
revoke all on function public.circle_accept_answer(uuid, uuid) from public, anon;
grant execute on function public.circle_create_community(text, text, text, text, text, text[], text, uuid, boolean) to authenticated;
grant execute on function public.circle_join(uuid) to authenticated;
grant execute on function public.circle_leave(uuid) to authenticated;
grant execute on function public.circle_decide_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.circle_accept_answer(uuid, uuid) to authenticated;

revoke all on function public.circle_home_stats() from public;
revoke all on function public.circle_community_active(uuid[]) from public;
grant execute on function public.circle_home_stats() to anon, authenticated;
grant execute on function public.circle_community_active(uuid[]) to anon, authenticated;

-- Probe after paste (read only):
--   select * from public.circle_home_stats();
--   select policyname, qual from pg_policies where tablename = 'posts' and policyname = 'posts_select';
