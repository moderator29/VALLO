-- SHARE A LISTING INTO THE FEED (founder, 10 November 2026: "anyone can share
-- a listing into the feed, MAX 2 listings per user, platform-wide; only the
-- SUPER ADMIN can share more").
--
-- NOT APPLIED. Additive only: two columns on `public.posts`, three indexes,
-- two checks, one function and one trigger. Nothing existing is dropped,
-- narrowed or rewritten. Safe to run twice.
--
-- WHY THE POSTS TABLE AND NOT A NEW TABLE. A listing share IS a feed post (a
-- GIST by the sharer with an optional note), so likes, comments, reposts,
-- reports, mute and block, moderation holds and notifications keep working
-- with no new code. A separate table would have needed a write grant for
-- `authenticated` (and an entry in `supabase/tests/probes/db-06.sql`), a second
-- RLS surface and a join on every feed read. So: NO new table, NO new grant,
-- and db-06's allowlist is unchanged. `posts_insert_self` still decides who
-- may insert, and the scanner, rate limits, holds and reports apply as to any
-- post.
--
-- `posts.listing_id` is NOT reused: `posts_listing_chk` only lets SHOWCASE and
-- SYSTEM rows carry it, and a SHOWCASE must be the author's own listing. A
-- share may be of anybody's listing, so it has its own columns:
--   is_listing_share   boolean not null default false
--   shared_listing_id  uuid references public.listings (id) on delete set null
-- The flag is separate from the id on purpose: a share of a listing that is
-- later deleted loses its id (SET NULL, no NOT NULL contradiction) but is
-- still a share, so it still counts against the sharer's two until removed.
--
-- THE LIMIT, IN THE DATABASE. `private.listing_share_guard()` runs BEFORE
-- INSERT on every post. For a listing share it takes a per-user advisory
-- transaction lock, counts the author's active shares (is_listing_share and
-- status <> 'REMOVED': a held share counts, a removed one frees its slot) and
-- refuses a third one. Two parallel requests from the same person queue on
-- the lock, and the second counts the first's committed row, so the limit
-- cannot be exceeded under READ COMMITTED (what PostgREST uses). A super
-- admin (a `user_roles` row with role super_admin, the same source
-- `requireAdmin` and `private.has_role` read) has no limit. An admin who is
-- not a super admin is limited like everyone. Role is read straight from
-- `user_roles`, not through `private.has_role`, because that helper also
-- demands a console step-up for the caller's own admin roles, which is a
-- rule about the console, not about this limit.
--
-- The same trigger refuses: a share by a non-user author, a reply, a share
-- with no listing, a listing that is not PUBLISHED, open and not an example
-- (the same rule as `posts_genuine_listing`), a second ACTIVE share of the
-- same listing by the same person (also a unique index), and a note over 280
-- characters. On UPDATE it freezes both columns, so a share cannot be turned
-- into a plain post to free a slot or the other way round.
--
-- SQLSTATEs (the app maps them to sentences): LS001 limit reached, LS002 the
-- same listing already shared, LS003 not a valid share, LS004 listing not live.

set lock_timeout = '5s';

alter table public.posts add column if not exists is_listing_share boolean not null default false;
alter table public.posts add column if not exists shared_listing_id uuid references public.listings (id) on delete set null;

alter table public.posts drop constraint if exists posts_listing_share_shape;
alter table public.posts add constraint posts_listing_share_shape
  check (
    (not is_listing_share and shared_listing_id is null)
    or (is_listing_share and parent_id is null and kind = 'GIST' and author_kind = 'USER')
  );

alter table public.posts drop constraint if exists posts_listing_share_note_len;
alter table public.posts add constraint posts_listing_share_note_len
  check (not is_listing_share or body is null or char_length(body) <= 280);

-- One active share of a listing per person.
create unique index if not exists posts_listing_share_once_idx
  on public.posts (author_id, shared_listing_id)
  where is_listing_share and shared_listing_id is not null and status <> 'REMOVED';

-- The slot count: a person's active shares.
create index if not exists posts_listing_share_author_idx
  on public.posts (author_id)
  where is_listing_share and status <> 'REMOVED';

-- "Who shared this listing" and the cascade of the foreign key.
create index if not exists posts_shared_listing_idx
  on public.posts (shared_listing_id)
  where shared_listing_id is not null;

create or replace function private.listing_share_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  if tg_op = 'UPDATE' then
    -- Written once with the post. Nobody flips it afterwards.
    if pg_trigger_depth() <= 1 then
      new.is_listing_share := old.is_listing_share;
      new.shared_listing_id := old.shared_listing_id;
    end if;
    return new;
  end if;

  if not coalesce(new.is_listing_share, false) then
    if new.shared_listing_id is not null then
      raise exception 'That is not a listing share.' using errcode = 'LS003';
    end if;
    return new;
  end if;

  if new.author_kind is distinct from 'USER'
     or new.author_id is null
     or new.parent_id is not null
     or new.shared_listing_id is null then
    raise exception 'That is not a listing share.' using errcode = 'LS003';
  end if;

  if not exists (
    select 1 from public.listings l
     where l.id = new.shared_listing_id
       and l.status = 'PUBLISHED'
       and l.closed_at is null
       and not coalesce(l.is_demo, false)
  ) then
    raise exception 'That listing is not live, so it cannot be shared.' using errcode = 'LS004';
  end if;

  -- One person's shares are counted one request at a time.
  perform pg_advisory_xact_lock(hashtextextended('listing-share:' || new.author_id::text, 0));

  if exists (
    select 1 from public.posts p
     where p.author_id = new.author_id
       and p.is_listing_share
       and p.shared_listing_id = new.shared_listing_id
       and p.status <> 'REMOVED'
  ) then
    raise exception 'You have already shared that listing.' using errcode = 'LS002';
  end if;

  if not exists (
    select 1 from public.user_roles r
     where r.user_id = new.author_id and r.role = 'super_admin'
  ) then
    select count(*) into v_used
      from public.posts p
     where p.author_id = new.author_id
       and p.is_listing_share
       and p.status <> 'REMOVED';
    if v_used >= 2 then
      raise exception 'You can share up to 2 listings at a time. Remove one to share another.' using errcode = 'LS001';
    end if;
  end if;

  -- A share with no note still has content (posts_content_chk).
  if new.payload is null then
    new.payload := jsonb_build_object('listing_share', 1);
  end if;
  return new;
end;
$$;

revoke all on function private.listing_share_guard() from public, anon, authenticated;

drop trigger if exists posts_listing_share_guard on public.posts;
create trigger posts_listing_share_guard
  before insert or update of is_listing_share, shared_listing_id on public.posts
  for each row execute function private.listing_share_guard();

-- Self-checks.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'posts' and column_name = 'is_listing_share') then
    raise exception 'posts.is_listing_share was not added';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'posts' and column_name = 'shared_listing_id') then
    raise exception 'posts.shared_listing_id was not added';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'posts_listing_share_guard' and not tgisinternal) then
    raise exception 'posts_listing_share_guard was not created';
  end if;
end $$;
