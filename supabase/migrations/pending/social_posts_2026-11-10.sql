-- THE SOCIAL MEDIA DESK: THE CONTENT CALENDAR, DRAFTS, THE MEDIA LIBRARY AND
-- THE APPROVAL RECORD (founder, 10 November 2026). Extends the Social Media
-- Manager position (`staff_business_dev_social_media_2026-11-10.sql`, which
-- must be applied first: it adds the `social_media` scope this table's RLS
-- and the desk's own guard both read).
--
-- NOT APPLIED. Additive only: one new table and one new private storage
-- bucket. Nothing existing is touched, dropped or narrowed. Safe to run
-- twice (every statement is `if not exists` / `on conflict do nothing`).
--
-- THIS IS A PLANNING AND REPORTING TOOL, NOT A PUBLISHING INTEGRATION. There
-- is no platform API, no OAuth and no credential of any kind here or in the
-- app code that reads this table. The Social Media Manager plans a post here,
-- sends it for approval, posts it BY HAND on the real platform in a separate
-- browser tab, and then comes back and records that it went out, with the
-- live URL if there is one. This table is that record, forever, not a batch
-- for one month.
--
-- SHAPE. The Social Media Manager's real weekly planning sheet is a grid:
-- weekdays Monday to Friday, four fixed daily slots (Post 1, 8am-11am; Post 2,
-- 11am-2pm; Post 3, 2pm-6pm; Post 4, 6pm-9pm). `slot` carries that column
-- (post_1..post_4, nullable: a post can still be planned with no slot chosen).
-- `format` tells a feed post apart from a short-form video/reel and a story,
-- which is how the role's monthly KPIs are counted (feed posts, reels,
-- stories are each a different target).
--
-- RLS. The console hands a holder of the `social_media` scope the SERVICE
-- client once the database has already proved they hold that scope and have
-- acknowledged the handbook (`lib/admin/guard.ts`, `requireAdmin`), exactly as
-- every other scoped desk does; RLS below is the admin-role policy other
-- staff-only tables carry for a caller on their OWN session (an admin acting
-- outside the console), the same shape as
-- `support_ticket_escalations_admin_read`
-- (20260929204530_support_desk_escalations_and_member_context.sql). No member
-- and no other staff scope can read or write this table at all.

create table if not exists public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null,
  category         text not null,
  format           text not null default 'feed_post',
  slot             text,
  campaign         text,
  caption          text not null default '',
  planned_at       date not null,
  status           text not null default 'draft',
  media_urls       text[] not null default '{}',
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  posted_at        timestamptz,
  live_url         text,
  rejection_reason text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint social_posts_platform_check check (platform in
    ('instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'youtube', 'other')),
  constraint social_posts_category_check check (category in
    ('property', 'stays', 'restaurants', 'roommates', 'circle', 'product_announcement',
     'brand_campaign', 'educational', 'customer_story', 'partnership', 'other')),
  constraint social_posts_format_check check (format in
    ('feed_post', 'reel', 'story', 'other')),
  constraint social_posts_slot_check check (slot is null or slot in
    ('post_1', 'post_2', 'post_3', 'post_4')),
  constraint social_posts_status_check check (status in
    ('draft', 'awaiting_approval', 'approved', 'posted', 'cancelled')),
  constraint social_posts_caption_len check (char_length(caption) <= 5000),
  constraint social_posts_campaign_len check (campaign is null or char_length(campaign) <= 140),
  constraint social_posts_live_url_len check (live_url is null or char_length(live_url) <= 2000),
  constraint social_posts_rejection_reason_len check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  constraint social_posts_media_urls_len check (cardinality(media_urls) <= 20),
  -- A post carries an approver and a decision time together, or neither.
  constraint social_posts_approved_pair check ((approved_by is null) = (approved_at is null)),
  -- Only an approved post may be marked posted.
  constraint social_posts_posted_needs_approval check (status <> 'posted' or approved_at is not null),
  constraint social_posts_rejection_needs_reason check (status <> 'draft' or rejection_reason is null or char_length(btrim(rejection_reason)) > 0)
);

comment on table public.social_posts is
  'The Social Media Manager''s content calendar, drafts, campaigns and the permanent record of what was actually posted by hand. No platform API, no OAuth, no credential: this is a planning and reporting table only.';

create index if not exists social_posts_planned_at_idx on public.social_posts (planned_at);
create index if not exists social_posts_status_idx on public.social_posts (status);
create index if not exists social_posts_campaign_idx on public.social_posts (campaign) where campaign is not null;
create index if not exists social_posts_created_by_idx on public.social_posts (created_by);

create or replace function private.social_posts_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists social_posts_touch_updated_at on public.social_posts;
create trigger social_posts_touch_updated_at
  before update on public.social_posts
  for each row execute function private.social_posts_touch_updated_at();

alter table public.social_posts enable row level security;
revoke all on table public.social_posts from public, anon, authenticated;
grant select, insert, update on table public.social_posts to authenticated;

drop policy if exists social_posts_admin_read on public.social_posts;
create policy social_posts_admin_read on public.social_posts
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists social_posts_admin_write on public.social_posts;
create policy social_posts_admin_write on public.social_posts
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists social_posts_admin_update on public.social_posts;
create policy social_posts_admin_update on public.social_posts
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- The media library's storage. Private, like `identity-checks`: no
-- storage.objects policy at all, so only the service role (the client the
-- Social Media Manager's scoped session is handed) reads or writes it, and
-- the desk streams a thumbnail through a short signed URL it asks for itself.
-- Images and short videos only, the same video ceiling the rest of the
-- product already uses (`MAX_UPLOAD_BYTES`, 100MB,
-- 20261013062253_listing_videos_take_a_hundred_megabytes.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media-library', 'social-media-library', false, 104857600,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

-- Self-checks.
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'social_posts' and column_name = 'format'
  ) then
    raise exception 'social_posts: format column missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'social-media-library') then
    raise exception 'social_posts: social-media-library bucket missing';
  end if;
end
$check$;

notify pgrst, 'reload schema';
