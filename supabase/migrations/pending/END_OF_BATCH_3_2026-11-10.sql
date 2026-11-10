-- END_OF_BATCH_3, 10 NOVEMBER 2026. THE LAST BLOCK. PASTE THE WHOLE FILE INTO THE SUPABASE SQL EDITOR AND RUN IT ONCE.
--
-- ONE TRANSACTION: it all applies or none of it does. If any step raises, nothing changes and the editor shows
-- which check failed. Safe to run twice (every statement is "if not exists", "on conflict do nothing" or
-- "create or replace"). Additive only: nothing is dropped, narrowed or deleted, and no member data is changed.
--
-- CHECKED AGAINST THE LIVE DATABASE ON 10 NOVEMBER 2026 (read only): none of these tables, buckets or columns
-- exist yet (0 of 10 new tables, 0 of 2 buckets, 55 schools, no logo columns). The earlier second batch
-- (protected rail server steps, member category read, Was this helpful) IS already live (all five of its functions
-- exist), so it is NOT repeated here.
--
-- WHAT IS IN IT, IN ORDER
--   1. Staff tasks and announcements (My Desk).
--   2. Social Media desk: posts and the private media library bucket.
--   3. Business Development desk: prospects and their activity.
--   4. COO desk: escalations and staff access recommendations.
--   5. Weekly reports and the private proof bucket.
--   6. Schools directory, first list: 490 institutions (on top of the 55 already live).
--   7. Schools directory, second list: 239 more (nursing and midwifery schools, colleges, polytechnics).
--   8. School logos (27 so far), aliases for search, and the updated school read function.
--
-- DELIBERATELY NOT IN THIS FILE (each needs your own separate yes):
--   * newsletter_default_on_2026-11-launch.sql  turns marketing emails back on for 17 members (changes member data).
--   * rt01_remove_retired_objects.sql and rt02_remove_v100_renter_passport.sql  permanent drops.
--
-- HOW IT WAS CHECKED: each part carries its own self-check block that raises if a table, column or bucket is
-- missing; the whole file was parsed as PostgreSQL syntax (no errors) before it was handed to you. It has NOT been run
-- against the live database, so the closing query at the end is the proof: run the file, then read the single row.

begin;

-- ==================================================================== PART 1 of 8: Staff tasks and announcements (My Desk)  (from staff_tasks_announcements_2026-11-10.sql)
-- MY DESK: STAFF TASKS, TASK COMMENTS AND ANNOUNCEMENTS (founder, 10
-- November 2026). The personal workspace at `/admin/my-desk`, its task list
-- at `/admin/my-desk/tasks` and its announcements at
-- `/admin/my-desk/announcements`.
--
-- NOT APPLIED. Additive only: four new tables. Nothing existing is touched,
-- dropped or narrowed. Safe to run twice (every statement is `if not exists`
-- or `drop ... if exists` then create). Does not depend on any other pending
-- file: it reads only `private.has_role` and `public.app_role`, which are
-- already live.
--
-- WHO MAY DO WHAT (enforced in the server actions, `lib/admin/my-desk`):
--   * Anyone with console access may create a task for themselves, comment on
--     a task they are involved in, and move the status of a task assigned to
--     them.
--   * Assigning a task to somebody else needs the COO position, the
--     `operations` scope, or an admin or super admin role.
--   * Posting an announcement needs the COO position or an admin or super
--     admin role. Everyone reads those addressed to `all` or to a scope they
--     hold, and marks them read.
--
-- USER REFERENCES. Every reference to `auth.users` on a task, a comment or an
-- announcement is NULLABLE with ON DELETE SET NULL, so deleting an account
-- never blocks and never rewrites history; there is no check constraint that
-- requires a user id to stay non-null. The one exception is the primary key
-- of `staff_announcement_reads` (announcement_id, user_id): a key column
-- cannot be null, so that row is removed with its account (ON DELETE
-- CASCADE), which is correct for a "has this person read it" marker.
--
-- RLS. Same shape as `social_posts_2026-11-10.sql`: the admin and super admin
-- roles through `private.has_role((select auth.uid()), ...)`, never
-- `private.staff_can` inside a policy. A scoped staff member holds no admin
-- role, so they reach these tables through the SERVICE client that
-- `requireAdmin(scope)` hands out after the database has proved the scope and
-- the handbook (`lib/admin/guard.ts`). No member can read or write any of
-- these tables. No delete grant is given on any table.

create table if not exists public.staff_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  detail        text not null default '',
  assigned_to   uuid references auth.users (id) on delete set null,
  created_by    uuid references auth.users (id) on delete set null,
  due_date      date,
  status        text not null default 'todo',
  priority      text not null default 'normal',
  related_desk  text,
  related_link  text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  constraint staff_tasks_status_check check (status in ('todo', 'in_progress', 'blocked', 'done')),
  constraint staff_tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint staff_tasks_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint staff_tasks_detail_len check (char_length(detail) <= 4000),
  constraint staff_tasks_related_desk_len check (related_desk is null or char_length(related_desk) <= 60),
  -- An internal console path only: starts with /admin, no scheme, no host, no dot-dot.
  constraint staff_tasks_related_link_internal check (
    related_link is null
    or (char_length(related_link) <= 300
        and related_link ~ '^/admin([/?#][A-Za-z0-9_./?=&#%-]*)?$'
        and related_link !~ '\.\.'
        and related_link !~ '//')
  ),
  -- A finished task carries its finish time, and an unfinished one does not.
  constraint staff_tasks_completed_pair check ((status = 'done') = (completed_at is not null))
);

comment on table public.staff_tasks is
  'Internal staff tasks: assigned to a person, with a due date, status and priority. Read and written through the console only.';

create index if not exists staff_tasks_assigned_to_idx on public.staff_tasks (assigned_to, status);
create index if not exists staff_tasks_created_by_idx on public.staff_tasks (created_by);
create index if not exists staff_tasks_due_date_idx on public.staff_tasks (due_date) where status <> 'done';

create table if not exists public.staff_task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.staff_tasks (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint staff_task_comments_body_len check (char_length(btrim(body)) between 1 and 2000)
);

comment on table public.staff_task_comments is
  'Comments on a staff task, kept when the author''s account is deleted (author_id becomes null).';

create index if not exists staff_task_comments_task_idx on public.staff_task_comments (task_id, created_at);
create index if not exists staff_task_comments_author_idx on public.staff_task_comments (author_id);

create table if not exists public.staff_announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  -- 'all', or the name of a staff scope (for example 'support'). The app
  -- checks the name against the scope list, so adding a scope later never
  -- needs a change to this table.
  audience    text not null default 'all',
  pinned      boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint staff_announcements_title_len check (char_length(btrim(title)) between 1 and 140),
  constraint staff_announcements_body_len check (char_length(btrim(body)) between 1 and 4000),
  constraint staff_announcements_audience_shape check (audience = 'all' or audience ~ '^[a-z_]{1,40}$')
);

comment on table public.staff_announcements is
  'Announcements from the COO or an admin to all staff or to one staff scope.';

create index if not exists staff_announcements_created_idx on public.staff_announcements (pinned desc, created_at desc);
create index if not exists staff_announcements_created_by_idx on public.staff_announcements (created_by);

create table if not exists public.staff_announcement_reads (
  announcement_id uuid not null references public.staff_announcements (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

comment on table public.staff_announcement_reads is
  'Which staff member has read which announcement. Removed with the account (a key column cannot be null).';

create index if not exists staff_announcement_reads_user_idx on public.staff_announcement_reads (user_id);

alter table public.staff_tasks enable row level security;
alter table public.staff_task_comments enable row level security;
alter table public.staff_announcements enable row level security;
alter table public.staff_announcement_reads enable row level security;

revoke all on table public.staff_tasks from public, anon, authenticated;
revoke all on table public.staff_task_comments from public, anon, authenticated;
revoke all on table public.staff_announcements from public, anon, authenticated;
revoke all on table public.staff_announcement_reads from public, anon, authenticated;

grant select, insert, update on table public.staff_tasks to authenticated;
grant select, insert on table public.staff_task_comments to authenticated;
grant select, insert, update on table public.staff_announcements to authenticated;
grant select, insert, update on table public.staff_announcement_reads to authenticated;

-- staff_tasks
drop policy if exists staff_tasks_admin_read on public.staff_tasks;
create policy staff_tasks_admin_read on public.staff_tasks
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_tasks_admin_insert on public.staff_tasks;
create policy staff_tasks_admin_insert on public.staff_tasks
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_tasks_admin_update on public.staff_tasks;
create policy staff_tasks_admin_update on public.staff_tasks
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- staff_task_comments
drop policy if exists staff_task_comments_admin_read on public.staff_task_comments;
create policy staff_task_comments_admin_read on public.staff_task_comments
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_task_comments_admin_insert on public.staff_task_comments;
create policy staff_task_comments_admin_insert on public.staff_task_comments
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- staff_announcements
drop policy if exists staff_announcements_admin_read on public.staff_announcements;
create policy staff_announcements_admin_read on public.staff_announcements
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_announcements_admin_insert on public.staff_announcements;
create policy staff_announcements_admin_insert on public.staff_announcements
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_announcements_admin_update on public.staff_announcements;
create policy staff_announcements_admin_update on public.staff_announcements
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- staff_announcement_reads: a person sees and writes only their own marker.
drop policy if exists staff_announcement_reads_own_read on public.staff_announcement_reads;
create policy staff_announcement_reads_own_read on public.staff_announcement_reads
  for select to authenticated
  using (user_id = (select auth.uid())
         and (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role)));

drop policy if exists staff_announcement_reads_own_insert on public.staff_announcement_reads;
create policy staff_announcement_reads_own_insert on public.staff_announcement_reads
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and (private.has_role((select auth.uid()), 'admin'::public.app_role)
                   or private.has_role((select auth.uid()), 'super_admin'::public.app_role)));

drop policy if exists staff_announcement_reads_own_update on public.staff_announcement_reads;
create policy staff_announcement_reads_own_update on public.staff_announcement_reads
  for update to authenticated
  using (user_id = (select auth.uid())
         and (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role)))
  with check (user_id = (select auth.uid())
              and (private.has_role((select auth.uid()), 'admin'::public.app_role)
                   or private.has_role((select auth.uid()), 'super_admin'::public.app_role)));

-- Self-checks.
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'staff_tasks' and column_name = 'completed_at'
  ) then
    raise exception 'staff_tasks: completed_at column missing';
  end if;
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'staff_announcement_reads'
  ) then
    raise exception 'staff_announcement_reads: table missing';
  end if;
  -- No user reference on a task may be NOT NULL.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'staff_tasks'
       and column_name in ('assigned_to', 'created_by') and is_nullable = 'NO'
  ) then
    raise exception 'staff_tasks: a user reference is NOT NULL';
  end if;
end
$check$;

notify pgrst, 'reload schema';

-- ==================================================================== PART 2 of 8: Social Media desk: posts and the media library  (from social_posts_2026-11-10.sql)
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
  -- An approver always comes with a decision time. The approver may later be null (their account was deleted), so the reverse is not required.
  constraint social_posts_approved_pair check (approved_by is null or approved_at is not null),
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

-- ==================================================================== PART 3 of 8: Business Development desk: prospects and activity  (from bd_prospects_2026-11-10.sql)
-- THE BUSINESS DEVELOPMENT DESK: A LIGHTWEIGHT PARTNERSHIP PIPELINE
-- (founder, 10 November 2026, the Business Development Director position,
-- real first name Sophia Duru. Read with
-- staff_business_dev_social_media_2026-11-10.sql, which adds the
-- `business_development` scope this table's RLS and the desk's own guard
-- both read, and must be applied first).
--
-- NOT APPLIED. Additive only: two new tables. Nothing existing is touched,
-- dropped or narrowed. Safe to run twice (every statement is
-- `if not exists` / `on conflict do nothing` / `create or replace`).
--
-- THIS IS A CRM-LITE, NOT AN ENTERPRISE CRM. One row per prospect
-- (landlord, agent, hotel, shortlet host, restaurant or other business the
-- Business Development Director is bringing onto Vallo), one row per
-- logged activity against that prospect (a contact attempt with its
-- outcome, a follow-up, a plain note, or a stage change), and nothing else:
-- no money, no payment data, no identity document.
--
-- WHY TWO TABLES, NOT ONE. The role's real first-month KPIs (the founder's
-- 30-day framework) count four different things that a single `notes` text
-- column cannot answer honestly:
--   * prospects identified: a count of rows in bd_prospects.
--   * qualified businesses contacted: a count of distinct prospects with at
--     least one bd_prospect_activity row of kind 'contact' (which carries
--     the outcome, so "meaningful tailored contact, outcome recorded" is a
--     real column, not a claim).
--   * follow-up activity: a count of bd_prospect_activity rows of kind
--     'follow_up'. Logged, dated, attributed to the person who logged it.
--   * businesses onboarded: bd_prospects.onboarded_at is not null. This is
--     DELIBERATELY SEPARATE from a submitted or approved listing: the
--     founder's own document says a business onboarded is not automatically
--     an approved listing, and the two figures must be reported apart, never
--     folded into one number. A prospect's onboarding only requires it be
--     contactable (the email/phone check below) and the stage reached
--     'onboarded'; it says nothing about any listing.
--   * complete listings submitted: read from the real `public.listings`
--     table (already the listing desk's own source of truth,
--     `lib/admin/reads/listings.ts`), joined through the optional
--     `listing_id` column below once the Director links a submitted listing
--     back to the prospect that brought it in. The desk never counts a
--     listing twice and never counts one that is still a draft.
--
-- RLS. The console hands a holder of the `business_development` scope the
-- SERVICE client once the database has already proved they hold that scope
-- and have acknowledged the handbook (`lib/admin/guard.ts`, `requireAdmin`),
-- exactly as every other scoped desk does; RLS below is the admin-role
-- policy other staff-only tables carry for a caller on their OWN session (an
-- admin acting outside the console), the same shape as
-- `support_ticket_escalations_admin_read`
-- (20260929204530_support_desk_escalations_and_member_context.sql) and
-- `social_posts_admin_read` (social_posts_2026-11-10.sql). No member and no
-- other staff scope can read or write either table at all.
--
-- NOT private.staff_can in the policy itself: that function is revoked from
-- `authenticated` on purpose (track_k), and a policy that calls it fails
-- every read with 42501 for every role including the staff it means to let
-- in. That is exactly the bug d77x
-- (20261007164415_d77x_risk_settings_read_by_staff.sql) found and fixed on
-- `agreement_risk_settings`, after d68d shipped the broken version. The
-- policies below use `private.has_role(... 'admin')` /
-- `private.has_role(... 'super_admin')`, the pattern that is actually
-- callable from a policy.
--
-- NO MONEY, NO PAYMENT DATA, NO IDENTITY DOCUMENT. This table stores
-- contact and pipeline-stage data only: who the business is, where they
-- are, what stage the conversation is at, and what was said. Nothing here
-- is a payout, a bank detail or an uploaded document.

create table if not exists public.bd_prospects (
  id              uuid primary key default gen_random_uuid(),
  contact_name    text not null,
  business_name   text not null,
  category        text not null,
  email           text,
  phone           text,
  location        text,
  stage           text not null default 'new',
  notes           text,
  assigned_to     uuid references auth.users (id) on delete set null,
  -- Nullable, not "not null": ON DELETE SET NULL would otherwise violate a
  -- NOT NULL constraint the moment the creator's account is deleted, which
  -- would block the member deletion itself. The row and its history stay;
  -- only who created it is forgotten. (Lead review, 10 Nov 2026.)
  created_by      uuid references auth.users (id) on delete set null,
  -- The listing this partnership produced, once the Director knows which
  -- one it is. Deliberately NOT set automatically: onboarding a business
  -- and that business's listing being submitted and approved are two
  -- different, separately reported facts (founder's ruling, 10 Nov 2026).
  listing_id      uuid references public.listings (id) on delete set null,
  -- When this business finished onboarding (contactable, the onboarding
  -- steps done). Null until then. Never set by a trigger: a person decides
  -- this, the same way a person decides a stage.
  onboarded_at    timestamptz,
  next_follow_up_at date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bd_prospects_category_chk check (category in
    ('landlord', 'agent', 'hotel', 'shortlet_host', 'restaurant', 'other')),
  constraint bd_prospects_stage_chk check (stage in
    ('new', 'contacted', 'interested', 'meeting_scheduled', 'negotiation',
     'proposal_sent', 'agreement_pending', 'onboarded', 'rejected')),
  constraint bd_prospects_contact_name_len check (char_length(btrim(contact_name)) between 1 and 160),
  constraint bd_prospects_business_name_len check (char_length(btrim(business_name)) between 1 and 160),
  constraint bd_prospects_location_len check (location is null or char_length(location) <= 200),
  constraint bd_prospects_notes_len check (notes is null or char_length(notes) <= 4000),
  constraint bd_prospects_email_len check (email is null or char_length(email) <= 200),
  constraint bd_prospects_phone_len check (phone is null or char_length(phone) <= 40),
  -- A prospect must be reachable one way or the other. "No duplicates" (the
  -- KPI's own words) is a process goal for the person doing the work, not a
  -- hard database constraint: two different landlords can genuinely share a
  -- business name, so the desk warns rather than refuses (see the read
  -- function's own-name lookup), and the Director is the one who knows
  -- whether two rows are the same business or not.
  constraint bd_prospects_contact_route_chk check (email is not null or phone is not null),
  -- A business counted onboarded must still be reachable.
  constraint bd_prospects_onboarded_needs_contact_chk check (onboarded_at is null or email is not null or phone is not null)
);

comment on table public.bd_prospects is
  'The Business Development desk''s partnership pipeline: contact and pipeline-stage data only. No money, no payment data, no identity document. onboarded_at is reported separately from listing_id/listing status: a business onboarded is not automatically an approved listing.';

create index if not exists bd_prospects_stage_idx on public.bd_prospects (stage);
create index if not exists bd_prospects_assigned_to_idx on public.bd_prospects (assigned_to) where assigned_to is not null;
create index if not exists bd_prospects_next_follow_up_idx on public.bd_prospects (next_follow_up_at) where next_follow_up_at is not null;
create index if not exists bd_prospects_listing_id_idx on public.bd_prospects (listing_id) where listing_id is not null;
create index if not exists bd_prospects_business_name_idx on public.bd_prospects (lower(business_name));

-- The activity log: contacts (with outcome), follow-ups, plain notes, and
-- stage changes, each a dated, attributed row, which is what lets the desk
-- count "qualified businesses contacted" and "follow-up activity" as real
-- rows rather than free text nobody can total.
create table if not exists public.bd_prospect_activity (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.bd_prospects (id) on delete cascade,
  kind         text not null,
  body         text not null,
  -- For a 'contact' row: the outcome of that contact attempt, in the
  -- Director's own words ("interested, wants a call next week",
  -- "not interested, no fit"). Null for every other kind.
  outcome      text,
  -- Nullable for the same reason as bd_prospects.created_by above: a NOT
  -- NULL column paired with ON DELETE SET NULL would block deleting the
  -- actor's account.
  actor_id     uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint bd_prospect_activity_kind_chk check (kind in ('contact', 'follow_up', 'note', 'stage_change')),
  constraint bd_prospect_activity_body_len check (char_length(btrim(body)) between 1 and 2000),
  constraint bd_prospect_activity_outcome_len check (outcome is null or char_length(outcome) <= 500),
  constraint bd_prospect_activity_outcome_kind_chk check (outcome is null or kind = 'contact')
);

comment on table public.bd_prospect_activity is
  'Dated, attributed activity against one prospect: a contact attempt and its outcome, a follow-up, a plain note, or a stage change. This is what lets the Business Development desk count contacts and follow-ups as real rows.';

create index if not exists bd_prospect_activity_prospect_idx on public.bd_prospect_activity (prospect_id, created_at desc);
create index if not exists bd_prospect_activity_kind_created_idx on public.bd_prospect_activity (kind, created_at);

create or replace function private.bd_prospects_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists bd_prospects_touch_updated_at on public.bd_prospects;
create trigger bd_prospects_touch_updated_at
  before update on public.bd_prospects
  for each row execute function private.bd_prospects_touch_updated_at();

alter table public.bd_prospects enable row level security;
alter table public.bd_prospect_activity enable row level security;
revoke all on table public.bd_prospects from public, anon, authenticated;
revoke all on table public.bd_prospect_activity from public, anon, authenticated;
grant select, insert, update on table public.bd_prospects to authenticated;
grant select, insert on table public.bd_prospect_activity to authenticated;

drop policy if exists bd_prospects_admin_read on public.bd_prospects;
create policy bd_prospects_admin_read on public.bd_prospects
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists bd_prospects_admin_write on public.bd_prospects;
create policy bd_prospects_admin_write on public.bd_prospects
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists bd_prospects_admin_update on public.bd_prospects;
create policy bd_prospects_admin_update on public.bd_prospects
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists bd_prospect_activity_admin_read on public.bd_prospect_activity;
create policy bd_prospect_activity_admin_read on public.bd_prospect_activity
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists bd_prospect_activity_admin_write on public.bd_prospect_activity;
create policy bd_prospect_activity_admin_write on public.bd_prospect_activity
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- No delete policy on either table: a pipeline row or a logged activity is
-- the record, not a draft; nothing in the app deletes one.

-- Self-checks.
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bd_prospects' and column_name = 'onboarded_at'
  ) then
    raise exception 'bd_prospects: onboarded_at column missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bd_prospects' and column_name = 'listing_id'
  ) then
    raise exception 'bd_prospects: listing_id column missing';
  end if;
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'bd_prospect_activity'
  ) then
    raise exception 'bd_prospect_activity: table missing';
  end if;
end
$check$;

notify pgrst, 'reload schema';

-- ==================================================================== PART 4 of 8: COO desk: escalations and staff access recommendations  (from coo_overview_2026-11-10.sql)
-- THE COO DESK: ESCALATIONS AND STAFF ACCESS RECOMMENDATIONS
-- (founder, 10 November 2026, correcting an earlier draft: the COO desk at
-- `/admin/overview` carries its own working tools, not only summaries of
-- other desks).
--
-- NOT APPLIED. Additive only: two new tables. Nothing existing is touched,
-- dropped or narrowed. Safe to run twice (every statement is
-- `if not exists` / `on conflict do nothing` / `create or replace`).
--
-- WHO THE COO IS, IN THIS DATABASE. `coo` is a staff position
-- (`JOB_DESCRIPTIONS.coo`), granted through `admin_grant_staff` with the
-- bundle `listing_approval, moderation, support, agreements, operations`,
-- exactly like any other staff member: no app_role, no special row
-- anywhere. "The COO" for RLS purposes is therefore the same shape as every
-- other scope check in this file: an admin, a super admin, or (for the
-- actions that need the full bundle) a staff grant that holds EVERY one of
-- those five scopes. The app's own guard (`requireCoo`,
-- `lib/admin/overview/guard.ts`) proves the five-scope case and then hands
-- out the service client, exactly as `requireAdmin(scope)` already does for
-- a single scope; the RLS below is the fallback for a caller on their own
-- session (an admin or super admin acting outside the console), the same
-- admin-role shape as `support_ticket_escalations_admin_read`
-- (20260929204530_support_desk_escalations_and_member_context.sql) and
-- `social_posts_admin_read` (social_posts_2026-11-10.sql). NOT
-- `private.staff_can` directly in a policy: that function is revoked from
-- `authenticated` on purpose and a policy that calls it fails for every
-- role, the exact bug d77x
-- (20261007164415_d77x_risk_settings_read_by_staff.sql) found and fixed.
--
-- 1. ESCALATIONS. "Take escalations from the team leads, and decide what
-- they cannot" (JOB_DESCRIPTIONS.coo). Any admin (a team lead with a staff
-- scope, or an admin/super admin) may raise one; resolving one is reserved
-- below to admin-role callers directly, with the app layer additionally
-- admitting a full-bundle COO through the service client the way every
-- other scoped write in this product works.
--
-- 2. STAFF ACCESS RECOMMENDATIONS. "Recommend staff access changes to the
-- super admin as the team changes" (JOB_DESCRIPTIONS.coo). The COO cannot
-- grant or revoke access themselves; only `admin_grant_staff` /
-- `admin_revoke_staff` do that, and neither is touched here. This table is
-- a note left for the super admin, nothing more: no automatic grant reads
-- or acts on it.

create table if not exists public.coo_escalations (
  id              uuid primary key default gen_random_uuid(),
  -- Nullable, not "not null": ON DELETE SET NULL would otherwise violate a
  -- NOT NULL constraint the moment the raiser's account is deleted, which
  -- would block the member deletion itself. The escalation and its history
  -- stay; only who raised it is forgotten. (Lead review, 10 Nov 2026.)
  raised_by       uuid references auth.users (id) on delete set null,
  source_desk     text not null,
  subject         text not null,
  detail          text not null,
  status          text not null default 'open',
  resolved_by     uuid references auth.users (id) on delete set null,
  resolution_note text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  constraint coo_escalations_source_desk_chk check (source_desk in
    ('listing_approval', 'moderation', 'support', 'agreements', 'operations',
     'business_development', 'social_media', 'other')),
  constraint coo_escalations_status_chk check (status in ('open', 'in_progress', 'resolved')),
  constraint coo_escalations_subject_len check (char_length(btrim(subject)) between 1 and 200),
  constraint coo_escalations_detail_len check (char_length(btrim(detail)) between 1 and 4000),
  constraint coo_escalations_resolution_note_len check (resolution_note is null or char_length(resolution_note) <= 2000),
  -- A resolved escalation carries WHEN it was resolved; who resolved it
  -- (`resolved_by`) is informative only and is not required, because that
  -- account can later be deleted (ON DELETE SET NULL) without the row
  -- becoming invalid. An unresolved escalation carries neither.
  -- (Lead review, 10 Nov 2026: the earlier version required resolved_by
  -- not null when resolved, which ON DELETE SET NULL would violate the
  -- moment the resolver's account was deleted.)
  constraint coo_escalations_resolved_pair check (
    (status = 'resolved') = (resolved_at is not null)
    and (status = 'resolved' or (resolved_by is null and resolved_at is null))
  )
);

comment on table public.coo_escalations is
  'Something a team lead cannot decide, raised to the COO. "Take escalations from the team leads, and decide what they cannot" (JOB_DESCRIPTIONS.coo).';

create index if not exists coo_escalations_status_idx on public.coo_escalations (status, created_at);
create index if not exists coo_escalations_raised_by_idx on public.coo_escalations (raised_by);

create table if not exists public.staff_access_recommendations (
  id                           uuid primary key default gen_random_uuid(),
  -- Nullable for the same reason as coo_escalations.raised_by above: a NOT
  -- NULL column paired with ON DELETE SET NULL would block deleting the
  -- recommender's account.
  recommended_by               uuid references auth.users (id) on delete set null,
  about_name                   text not null,
  recommended_position_or_scope text not null,
  reason                       text not null,
  status                       text not null default 'open',
  created_at                   timestamptz not null default now(),
  constraint staff_access_recommendations_status_chk check (status in ('open', 'actioned', 'declined')),
  constraint staff_access_recommendations_about_len check (char_length(btrim(about_name)) between 1 and 200),
  constraint staff_access_recommendations_what_len check (char_length(btrim(recommended_position_or_scope)) between 1 and 200),
  constraint staff_access_recommendations_reason_len check (char_length(btrim(reason)) between 1 and 2000)
);

comment on table public.staff_access_recommendations is
  'A note for the super admin: "Recommend staff access changes to the super admin as the team changes" (JOB_DESCRIPTIONS.coo). Never grants or revokes anything itself; admin_grant_staff and admin_revoke_staff are unchanged and untouched by this table.';

create index if not exists staff_access_recommendations_status_idx on public.staff_access_recommendations (status, created_at);

alter table public.coo_escalations enable row level security;
alter table public.staff_access_recommendations enable row level security;
revoke all on table public.coo_escalations from public, anon, authenticated;
revoke all on table public.staff_access_recommendations from public, anon, authenticated;
grant select, insert, update on table public.coo_escalations to authenticated;
grant select, insert, update on table public.staff_access_recommendations to authenticated;

drop policy if exists coo_escalations_admin_read on public.coo_escalations;
create policy coo_escalations_admin_read on public.coo_escalations
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists coo_escalations_admin_write on public.coo_escalations;
create policy coo_escalations_admin_write on public.coo_escalations
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists coo_escalations_admin_update on public.coo_escalations;
create policy coo_escalations_admin_update on public.coo_escalations
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_access_recommendations_admin_read on public.staff_access_recommendations;
create policy staff_access_recommendations_admin_read on public.staff_access_recommendations
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_access_recommendations_admin_write on public.staff_access_recommendations;
create policy staff_access_recommendations_admin_write on public.staff_access_recommendations
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_access_recommendations_admin_update on public.staff_access_recommendations;
create policy staff_access_recommendations_admin_update on public.staff_access_recommendations
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- No delete policy on either table: neither an escalation nor a
-- recommendation is ever deleted, only resolved or actioned.

do $check$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'coo_escalations') then
    raise exception 'coo_escalations: table missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'staff_access_recommendations') then
    raise exception 'staff_access_recommendations: table missing';
  end if;
end
$check$;

notify pgrst, 'reload schema';

-- ==================================================================== PART 5 of 8: Weekly reports and the proof bucket  (from staff_weekly_reports_2026-11-10.sql)
-- THE WEEKLY REPORT: ONE REPORT PER PERSON PER WEEK, WITH PROOF (founder,
-- 10 November 2026). Every staff position and every admin files a weekly
-- report: what was achieved, the numbers, blockers and needs, next week's
-- plan, and proof (links and files). The form opens each Saturday 00:00 Lagos
-- time and is due the following Monday 12:00 Lagos time; the app decides that,
-- the table only stores the result (`is_late`).
--
-- NOT APPLIED. Additive only: one new table and one new private storage
-- bucket. Nothing existing is touched, dropped or narrowed. Safe to run
-- twice (every statement is `if not exists`, `or replace`, `drop ... if
-- exists` before a create, or `on conflict do nothing`). Depends on nothing
-- pending except that `private.has_role` already exists, as it does for
-- `social_posts_2026-11-10.sql`.
--
-- SHAPE. A week is named by its Monday (`week_start`, a date). The check
-- `extract(isodow from week_start) = 1` makes any other day impossible.
-- `numbers` is a jsonb array of {label, value, target, source, deskValue}
-- where source is 'desk' (counted by the system and prefilled) or 'typed'.
-- `proofs` is a jsonb array of {id, kind, url | path, caption, ...} where a
-- link is https and a file is a path inside the private bucket under the
-- author's own folder; the app validates both before writing.
--
-- USER REFERENCES. `author_id` and `reviewed_by` are nullable and both
-- `on delete set null`: a report outlives the account that wrote or reviewed
-- it, with the author shown as removed. There is no constraint that forces a
-- user id to stay non-null. The unique key (author_id, week_start) treats a
-- null author as distinct, so orphaned reports never block anyone.
--
-- RLS. The console hands a staff member the SERVICE client once the database
-- has proved they hold a scope and have acknowledged the handbook
-- (`lib/admin/guard.ts`, `requireAdmin`), so staff reach this table through
-- that client and the app re-checks, on every action, that the caller owns the
-- report or is a reviewer (admin, super admin or the COO position). The
-- policies below are the admin-role shape `social_posts_2026-11-10.sql` uses,
-- for an admin on their OWN session. `private.staff_can` is never called in a
-- policy.

create table if not exists public.staff_weekly_reports (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references auth.users (id) on delete set null,
  position        text,
  week_start      date not null,
  status          text not null default 'draft',
  accomplishments text not null default '',
  numbers         jsonb not null default '[]'::jsonb,
  blockers        text not null default '',
  next_week       text not null default '',
  proofs          jsonb not null default '[]'::jsonb,
  submitted_at    timestamptz,
  is_late         boolean not null default false,
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint staff_weekly_reports_status_check check (status in
    ('draft', 'submitted', 'reviewed', 'reopened')),
  constraint staff_weekly_reports_week_is_monday check (extract(isodow from week_start) = 1),
  constraint staff_weekly_reports_position_len check (position is null or char_length(position) <= 80),
  constraint staff_weekly_reports_accomplishments_len check (char_length(accomplishments) <= 5000),
  constraint staff_weekly_reports_blockers_len check (char_length(blockers) <= 3000),
  constraint staff_weekly_reports_next_week_len check (char_length(next_week) <= 3000),
  constraint staff_weekly_reports_review_note_len check (review_note is null or char_length(review_note) <= 2000),
  constraint staff_weekly_reports_numbers_shape check (jsonb_typeof(numbers) = 'array' and jsonb_array_length(numbers) <= 30),
  constraint staff_weekly_reports_proofs_shape check (jsonb_typeof(proofs) = 'array' and jsonb_array_length(proofs) <= 20),
  -- A submitted or reviewed report always carries the time it was submitted.
  constraint staff_weekly_reports_submitted_has_time check (status not in ('submitted', 'reviewed') or submitted_at is not null),
  -- A reviewer always comes with a review time. The reviewer may later be null (their account was deleted), so the reverse is not required.
  constraint staff_weekly_reports_reviewed_pair check (reviewed_by is null or reviewed_at is not null)
);

comment on table public.staff_weekly_reports is
  'One weekly report per staff member or admin per week (Monday to Sunday, Lagos time): achievements, numbers (prefilled from the desks or typed), blockers, next week''s plan and proof. The form opens Saturday and is due Monday 12:00 Lagos time.';

-- One report per person per week. Orphaned (null author) rows are distinct from each other.
create unique index if not exists staff_weekly_reports_author_week_key
  on public.staff_weekly_reports (author_id, week_start);
create index if not exists staff_weekly_reports_week_idx on public.staff_weekly_reports (week_start desc);
create index if not exists staff_weekly_reports_status_idx on public.staff_weekly_reports (status);

create or replace function private.staff_weekly_reports_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists staff_weekly_reports_touch_updated_at on public.staff_weekly_reports;
create trigger staff_weekly_reports_touch_updated_at
  before update on public.staff_weekly_reports
  for each row execute function private.staff_weekly_reports_touch_updated_at();

alter table public.staff_weekly_reports enable row level security;
revoke all on table public.staff_weekly_reports from public, anon, authenticated;
grant select, insert, update on table public.staff_weekly_reports to authenticated;

drop policy if exists staff_weekly_reports_admin_read on public.staff_weekly_reports;
create policy staff_weekly_reports_admin_read on public.staff_weekly_reports
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_weekly_reports_admin_write on public.staff_weekly_reports;
create policy staff_weekly_reports_admin_write on public.staff_weekly_reports
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists staff_weekly_reports_admin_update on public.staff_weekly_reports;
create policy staff_weekly_reports_admin_update on public.staff_weekly_reports
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

-- The proof files' storage. Private, like `social-media-library`: no
-- storage.objects policy at all, so only the service role reads or writes it,
-- and the app signs a 10 minute URL when a report is opened. Images, PDFs and
-- short videos; the bucket ceiling is the video ceiling (100MB), and the app
-- holds images and PDFs to 10MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-report-proofs', 'staff-report-proofs', false, 104857600,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'application/pdf',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

-- Self-checks.
do $check$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'staff_weekly_reports' and column_name = 'week_start'
  ) then
    raise exception 'staff_weekly_reports: week_start column missing';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.staff_weekly_reports'::regclass
       and conname = 'staff_weekly_reports_week_is_monday'
  ) then
    raise exception 'staff_weekly_reports: week_is_monday check missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'staff-report-proofs' and public = false) then
    raise exception 'staff_weekly_reports: staff-report-proofs bucket missing or public';
  end if;
end
$check$;

notify pgrst, 'reload schema';

-- ==================================================================== PART 6 of 8: Schools directory: 490 institutions  (from roommates_schools_full_list_2026-11-10.sql)
-- VALLO ROOMMATES: THE FULL SCHOOLS DIRECTORY (10 November 2026).
--
-- Adds 490 Nigerian higher institutions to public.institutions on top of the 55
-- seeded by roommates_5_institutions.sql: 285 universities, 147 polytechnics and
-- monotechnics, 58 colleges of education. Together with the first seed the directory
-- covers all 329 universities found in the sources, including OAUSTECH
-- (Olusegun Agagu University of Science and Technology, Okitipupa, Ondo).
--
-- Sources (all read on 10 November 2026):
--   Universities: National Universities Commission lists of federal, state and
--   private universities (nuc.edu.ng/nigerian-univerisities/...: 77 federal, 69
--   state, 182 private), cross-checked with Wikipedia 'List of universities in
--   Nigeria' (state, town and acronym columns). Gombe State University of
--   Science and Technology, Kumo is on Wikipedia but not on the NUC page, so it
--   is included from Wikipedia alone. Renamed schools are listed under the
--   current name (for example Yusuf Maitama Sule University Kano, formerly
--   Northwest University Kano; Abiola Ajimobi Technical University, formerly
--   First Technical University).
--   Polytechnics: Wikipedia 'List of polytechnics in Nigeria' (federal, state
--   and private tables, with the schools' own web addresses). The NBTE site
--   (nbte.gov.ng) gives only totals, not a name list, so it could not be used.
--   Colleges of education: Wikipedia 'List of colleges of education in Nigeria'
--   (federal list and the state list; the state list has no towns, so towns
--   come from the colleges' own names).
--
-- Not covered: private colleges of education, nursing and health colleges, other
-- monotechnics and innovation enterprise institutions (no clear list), and the
-- about 60 private polytechnics on the Wikipedia list that could not be
-- placed with certainty. Short names are left empty (null) where no acronym
-- students use could be found. Students can still search by full name.
--
-- Email domains: only 144 are filled and switched on. Each was taken from the
-- school's own website address (the NUC list or the Wikipedia list, both link
-- the official site), then the home page was fetched on 10 November 2026 and its
-- title or text had to name the right institution on that same domain. All
-- others are '{}' and false, so those students verify by student ID until
-- staff confirm a domain. Where the site could not be reached or the page did
-- not clearly name the school, the domain was left empty.
--
-- State codes follow ISO 3166-2:NG as in public.states (note Kebbi is KE).
-- Additive and safe to run twice: on conflict (slug) do nothing, so existing
-- rows and staff edits are never overwritten. No two rows share a name, a slug
-- or a short name in the same state with the seeded rows.

insert into public.institutions (slug, name, short_name, kind, state_code, city, email_domains, email_verify_on) values
-- UNIVERSITIES (285; email domains confirmed from the school's own site: 80)
  ('amadeus-university-amizi', 'Amadeus University, Amizi', null, 'university', 'AB', 'Amizi', '{}', false),
  ('clifford-university-owerrinta', 'Clifford University, Owerrinta', null, 'university', 'AB', 'Owerrinta', '{}', false),
  ('gregory-university-uturu', 'Gregory University, Uturu', 'Gregory', 'university', 'AB', 'Uturu', '{}', false),
  ('lux-mundi-university-umuahia', 'Lux Mundi University, Umuahia', null, 'university', 'AB', 'Umuahia', '{}', false),
  ('nigerian-british-university-asa', 'Nigerian British University, Asa', null, 'university', 'AB', 'Asa', '{}', false),
  ('spiritan-university-nneochi', 'Spiritan University, Nneochi', null, 'university', 'AB', 'Nneochi', '{spiritanuniversity.edu.ng}', true),
  ('adamawa-state-university-mubi', 'Adamawa State University, Mubi', 'ADSU', 'university', 'AD', 'Mubi', '{}', false),
  ('american-university-of-nigeria-yola', 'American University of Nigeria, Yola', 'AUN', 'university', 'AD', 'Yola', '{aun.edu.ng}', true),
  ('federal-university-of-agriculture-mubi', 'Federal University of Agriculture, Mubi', 'FUAMB', 'university', 'AD', 'Mubi', '{}', false),
  ('akwa-ibom-state-university-ikot-akpaden', 'Akwa Ibom State University, Ikot Akpaden', 'AKSU', 'university', 'AK', 'Ikot Akpaden', '{aksu.edu.ng}', true),
  ('federal-university-of-agriculture-and-technology-obio-akpa', 'Federal University of Agriculture and Technology, Obio-Akpa', null, 'university', 'AK', 'Obio-Akpa', '{}', false),
  ('federal-university-of-technology-ikot-abasi', 'Federal University of Technology, Ikot Abasi', 'FUTIA', 'university', 'AK', 'Ikot Abasi', '{}', false),
  ('obong-university-obong-ntak', 'Obong University, Obong Ntak', null, 'university', 'AK', 'Obong Ntak', '{}', false),
  ('ritman-university-ikot-ekpene', 'Ritman University, Ikot Ekpene', null, 'university', 'AK', 'Ikot Ekpene', '{ritmanuniversity.edu.ng}', true),
  ('southern-atlantic-university-uyo', 'Southern Atlantic University, Uyo', null, 'university', 'AK', 'Uyo', '{}', false),
  ('topfaith-university-mkpatak', 'Topfaith University, Mkpatak', null, 'university', 'AK', 'Mkpatak', '{}', false),
  ('university-of-maritime-studies-oron', 'University of Maritime Studies, Oron', null, 'university', 'AK', 'Oron', '{}', false),
  ('chukwuemeka-odumegwu-ojukwu-university-uli', 'Chukwuemeka Odumegwu Ojukwu University, Uli', 'COOU', 'university', 'AN', 'Uli', '{coou.edu.ng}', true),
  ('legacy-university-okija', 'Legacy University, Okija', null, 'university', 'AN', 'Okija', '{legacyuniversity.edu.ng}', true),
  ('madonna-university-okija', 'Madonna University, Okija', 'Madonna', 'university', 'AN', 'Okija', '{madonnauniversity.edu.ng}', true),
  ('paul-university-awka', 'Paul University, Awka', 'Paul', 'university', 'AN', 'Awka', '{pauluniversity.edu.ng}', true),
  ('peter-university-achina-onneh', 'Peter University, Achina-Onneh', null, 'university', 'AN', 'Achina-Onneh', '{}', false),
  ('shanahan-university-onitsha', 'Shanahan University, Onitsha', null, 'university', 'AN', 'Onitsha', '{}', false),
  ('tansian-university-umunya', 'Tansian University, Umunya', null, 'university', 'AN', 'Umunya', '{}', false),
  ('transatlantic-university-of-medicine-and-health-sciences-umuchukwu', 'Transatlantic University of Medicine and Health Sciences, Umuchukwu', null, 'university', 'AN', 'Umuchukwu', '{}', false),
  ('university-on-the-niger-umunya', 'University on the Niger, Umunya', null, 'university', 'AN', 'Umunya', '{}', false),
  ('abubakar-tafawa-balewa-university-bauchi', 'Abubakar Tafawa Balewa University, Bauchi', 'ATBU', 'university', 'BA', 'Bauchi', '{}', false),
  ('bauchi-state-university-gadau', 'Bauchi State University, Gadau', 'BASUG', 'university', 'BA', 'Gadau', '{}', false),
  ('federal-university-of-health-sciences-azare', 'Federal University of Health Sciences, Azare', 'FUHSA', 'university', 'BA', 'Azare', '{}', false),
  ('benue-state-university-of-agriculture-science-and-technology-ihugh', 'Benue State University of Agriculture, Science and Technology, Ihugh', null, 'university', 'BE', 'Ihugh', '{}', false),
  ('federal-university-of-health-sciences-otukpo', 'Federal University of Health Sciences, Otukpo', null, 'university', 'BE', 'Otukpo', '{}', false),
  ('university-of-mkar-mkar', 'University of Mkar, Mkar', null, 'university', 'BE', 'Mkar', '{}', false),
  ('al-ansar-university-maiduguri', 'Al-Ansar University, Maiduguri', null, 'university', 'BO', 'Maiduguri', '{}', false),
  ('kashim-ibrahim-university-maiduguri', 'Kashim Ibrahim University, Maiduguri (formerly Borno State University)', 'BOSU', 'university', 'BO', 'Maiduguri', '{}', false),
  ('nigerian-army-university-biu', 'Nigerian Army University, Biu', 'NAUB', 'university', 'BO', 'Biu', '{}', false),
  ('bayelsa-medical-university', 'Bayelsa Medical University', 'BMU', 'university', 'BY', 'Yenagoa', '{bmu.edu.ng}', true),
  ('federal-university-of-agriculture-bassambiri', 'Federal University of Agriculture, Bassambiri', null, 'university', 'BY', 'Bassambiri', '{}', false),
  ('federal-university-otuoke', 'Federal University, Otuoke', 'FUOTUOKE', 'university', 'BY', 'Otuoke', '{fuotuoke.edu.ng}', true),
  ('hensard-university-toru-orua', 'Hensard University, Toru-Orua', null, 'university', 'BY', 'Toru-Orua', '{}', false),
  ('university-of-africa-toru-orua', 'University of Africa, Toru-Orua', 'UAT', 'university', 'BY', 'Toru-Orua', '{}', false),
  ('arthur-jarvis-university-akpabuyo', 'Arthur Jarvis University, Akpabuyo', 'AJU', 'university', 'CR', 'Akpabuyo', '{arthurjarvisuniversity.edu.ng}', true),
  ('british-canadian-university-obufu', 'British Canadian University, Obufu', null, 'university', 'CR', 'Obufu', '{}', false),
  ('cross-river-university-of-education-and-entrepreneurship-akampa', 'Cross River University of Education and Entrepreneurship, Akampa', null, 'university', 'CR', 'Akampa', '{}', false),
  ('havilla-university-nde-ikom', 'Havilla University, Nde-Ikom', null, 'university', 'CR', 'Nde-Ikom', '{havillauniversity.edu.ng}', true),
  ('pearl-university-calabar', 'Pearl University, Calabar', null, 'university', 'CR', 'Calabar', '{}', false),
  ('the-duke-medical-university-calabar', 'The Duke Medical University, Calabar', null, 'university', 'CR', 'Calabar', '{}', false),
  ('university-of-cross-river-state-calabar', 'University of Cross River State, Calabar', 'UNICROSS', 'university', 'CR', 'Calabar', '{}', false),
  ('admiralty-university-ibusa', 'Admiralty University, Ibusa', 'ADUN', 'university', 'DE', 'Ibusa', '{}', false),
  ('delta-state-university-of-science-and-technology-ozoro', 'Delta State University of Science and Technology, Ozoro', 'DSUST', 'university', 'DE', 'Ozoro', '{}', false),
  ('dennis-osadebay-university-asaba', 'Dennis Osadebay University, Asaba', 'DOU', 'university', 'DE', 'Asaba', '{}', false),
  ('edwin-clark-university-kiagbodo', 'Edwin Clark University, Kiagbodo', null, 'university', 'DE', 'Kiagbodo', '{edwinclarkuniversity.edu.ng}', true),
  ('federal-university-of-health-sciences-kwale', 'Federal University of Health Sciences, Kwale', null, 'university', 'DE', 'Kwale', '{}', false),
  ('federal-university-of-petroleum-resources-effurun', 'Federal University of Petroleum Resources, Effurun', 'FUPRE', 'university', 'DE', 'Effurun', '{}', false),
  ('godday-erewa-university-sapele', 'Godday Erewa University, Sapele', null, 'university', 'DE', 'Sapele', '{}', false),
  ('margaret-lawrence-university-umunede', 'Margaret Lawrence University, Umunede', null, 'university', 'DE', 'Umunede', '{}', false),
  ('michael-and-cecilia-ibru-university-agbara-otor', 'Michael and Cecilia Ibru University, Agbara-Otor', 'MCIU', 'university', 'DE', 'Agbara-Otor', '{mciu.edu.ng}', true),
  ('nigerian-maritime-university-okerenkoko', 'Nigerian Maritime University, Okerenkoko', 'NMU', 'university', 'DE', 'Okerenkoko', '{}', false),
  ('novena-university-ogume', 'Novena University, Ogume', null, 'university', 'DE', 'Ogume', '{novenauniversity.edu.ng}', true),
  ('sports-university-idumuje-ugboko', 'Sports University, Idumuje-Ugboko', null, 'university', 'DE', 'Idumuje-Ugboko', '{}', false),
  ('university-of-delta-agbor', 'University of Delta, Agbor', 'UNIDEL', 'university', 'DE', 'Agbor', '{}', false),
  ('western-delta-university-oghara', 'Western Delta University, Oghara', 'WDU', 'university', 'DE', 'Oghara', '{wdu.edu.ng}', true),
  ('alex-ekwueme-federal-university-ndufu-alike', 'Alex Ekwueme Federal University, Ndufu-Alike', 'AE-FUNAI', 'university', 'EB', 'Ndufu-Alike, Ikwo', '{funai.edu.ng}', true),
  ('david-umahi-federal-university-of-health-sciences-uburu', 'David Umahi Federal University of Health Sciences, Uburu', 'DUFUHS', 'university', 'EB', 'Uburu', '{kdums.edu.ng}', true),
  ('ebonyi-state-university-of-ict-science-and-technology-oferekpe', 'Ebonyi State University of ICT, Science and Technology, Oferekpe', null, 'university', 'EB', 'Oferekpe', '{}', false),
  ('ebonyi-state-university-abakaliki', 'Ebonyi State University, Abakaliki', 'EBSU', 'university', 'EB', 'Abakaliki', '{ebsu.edu.ng}', true),
  ('euston-university-abakaliki', 'Euston University, Abakaliki', null, 'university', 'EB', 'Abakaliki', '{}', false),
  ('evangel-university-akaeze', 'Evangel University, Akaeze', 'Evangel', 'university', 'EB', 'Akaeze', '{evangeluniversity.edu.ng}', true),
  ('university-of-aeronautics-and-aerospace-engineering-ezza', 'University of Aeronautics and Aerospace Engineering, Ezza', null, 'university', 'EB', 'Ezza', '{}', false),
  ('adeche-momoh-university-igarra', 'Adeche Momoh University, Igarra', null, 'university', 'ED', 'Igarra', '{}', false),
  ('benson-idahosa-university-benin-city', 'Benson Idahosa University, Benin City', 'BIU', 'university', 'ED', 'Benin City', '{biu.edu.ng}', true),
  ('edo-state-university-iyamho', 'Edo State University, Iyamho', 'EDSU', 'university', 'ED', 'Iyamho', '{edouniversity.edu.ng}', true),
  ('glorious-vision-university-ogwa', 'Glorious Vision University, Ogwa (formerly Samuel Adegboyega University)', 'GVU', 'university', 'ED', 'Ogwa', '{}', false),
  ('igbinedion-university-okada', 'Igbinedion University, Okada', 'IUO', 'university', 'ED', 'Okada', '{iuokada.edu.ng}', true),
  ('lighthouse-university-evbobanosa', 'Lighthouse University, Evbobanosa', null, 'university', 'ED', 'Evbobanosa', '{}', false),
  ('mudiame-university-irrua', 'Mudiame University, Irrua', null, 'university', 'ED', 'Irrua', '{}', false),
  ('tonine-iredia-university-of-communication-benin-city', 'Tonine Iredia University of Communication, Benin City', null, 'university', 'ED', 'Benin City', '{}', false),
  ('wellspring-university-evbuobanosa', 'Wellspring University, Evbuobanosa', null, 'university', 'ED', 'Evbuobanosa', '{}', false),
  ('afe-babalola-university-ado-ekiti', 'Afe Babalola University, Ado-Ekiti', 'ABUAD', 'university', 'EK', 'Ado-Ekiti', '{abuad.edu.ng}', true),
  ('bamidele-olumilua-university-of-education-science-and-technology-ikere', 'Bamidele Olumilua University of Education, Science and Technology, Ikere', 'BOUESTI', 'university', 'EK', 'Ikere-Ekiti', '{}', false),
  ('federal-university-of-technology-and-environmental-studies-iyin-ekiti', 'Federal University of Technology and Environmental Studies, Iyin-Ekiti', null, 'university', 'EK', 'Iyin-Ekiti', '{}', false),
  ('federal-university-oye-ekiti', 'Federal University, Oye-Ekiti', 'FUOYE', 'university', 'EK', 'Oye-Ekiti', '{}', false),
  ('high-flyers-university-ikere-ekiti', 'High Flyers University, Ikere-Ekiti', null, 'university', 'EK', 'Ikere-Ekiti', '{}', false),
  ('hillside-university-of-science-and-technology-okemisi', 'Hillside University of Science and Technology, Okemisi', null, 'university', 'EK', 'Okemisi', '{hust.edu.ng}', true),
  ('venite-university-iloro-ekiti', 'Venite University, Iloro-Ekiti', null, 'university', 'EK', 'Iloro-Ekiti', '{}', false),
  ('caritas-university-enugu', 'Caritas University, Enugu', null, 'university', 'EN', 'Enugu', '{caritasuni.edu.ng}', true),
  ('coal-city-university-enugu', 'Coal City University, Enugu', 'CCU', 'university', 'EN', 'Enugu', '{ccu.edu.ng}', true),
  ('federal-university-of-allied-health-sciences-enugu', 'Federal University of Allied Health Sciences, Enugu', 'FUAHSE', 'university', 'EN', 'Enugu', '{fuahse.edu.ng}', true),
  ('godfrey-okoye-university-enugu', 'Godfrey Okoye University, Enugu', 'GOUNI', 'university', 'EN', 'Ugwuomu-Nike, Enugu', '{}', false),
  ('kevin-eze-university-mgbowo', 'Kevin Eze University, Mgbowo', null, 'university', 'EN', 'Mgbowo', '{}', false),
  ('maduka-university-ekwegbe', 'Maduka University, Ekwegbe', null, 'university', 'EN', 'Ekwegbe', '{}', false),
  ('peaceland-university-enugu', 'PeaceLand University, Enugu', null, 'university', 'EN', 'Enugu', '{}', false),
  ('renaissance-university-enugu', 'Renaissance University, Enugu', 'RNU', 'university', 'EN', 'Ugbawka', '{rnu.edu.ng}', true),
  ('state-university-of-medical-and-applied-sciences-igbo-eno', 'State University of Medical and Applied Sciences, Igbo-Eno', null, 'university', 'EN', 'Igbo-Eno', '{}', false),
  ('african-aviation-and-aerospace-university', 'African Aviation and Aerospace University', 'AAAU', 'university', 'FC', 'Abuja', '{aaau.edu.ng}', true),
  ('african-university-of-economics-abuja', 'African University of Economics, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('african-university-of-science-and-technology-abuja', 'African University of Science and Technology, Abuja', 'AUST', 'university', 'FC', 'Abuja', '{}', false),
  ('al-muhibbah-open-university-abuja', 'Al-Muhibbah Open University, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('amaj-university-kwali', 'Amaj University, Kwali', null, 'university', 'FC', 'Kwali', '{}', false),
  ('canadian-university-of-nigeria-abuja', 'Canadian University of Nigeria, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('city-university-abuja', 'City University, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('cosmopolitan-university-abuja', 'Cosmopolitan University, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('eranova-university-abuja', 'Eranova University, Abuja', null, 'university', 'FC', 'Abuja', '{eranova.edu.ng}', true),
  ('european-university-of-nigeria-duboyi', 'European University of Nigeria, Duboyi', null, 'university', 'FC', 'Duboyi', '{}', false),
  ('leadership-university-abuja', 'Leadership University, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('miva-open-university-abuja', 'Miva Open University, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('national-open-university-of-nigeria', 'National Open University of Nigeria', 'NOUN', 'university', 'FC', 'Abuja', '{nou.edu.ng}', true),
  ('national-university-of-science-and-technology-abuja', 'National University of Science and Technology, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('philomath-university-kuje', 'Philomath University, Kuje', null, 'university', 'FC', 'Kuje', '{}', false),
  ('prime-university-kuje', 'Prime University, Kuje', null, 'university', 'FC', 'Kuje', '{}', false),
  ('ummah-university-of-nigeria-abuja', 'Ummah University of Nigeria, Abuja', null, 'university', 'FC', 'Abuja', '{}', false),
  ('federal-university-kashere', 'Federal University, Kashere', 'FUKASHERE', 'university', 'GO', 'Kashere', '{}', false),
  ('gombe-state-university', 'Gombe State University', 'GSU', 'university', 'GO', 'Gombe', '{}', false),
  ('gombe-state-university-of-science-and-technology-kumo', 'Gombe State University of Science and Technology, Kumo', 'GSUST', 'university', 'GO', 'Kumo', '{}', false),
  ('jewel-university-gombe', 'Jewel University, Gombe', null, 'university', 'GO', 'Gombe', '{}', false),
  ('north-eastern-university-gombe', 'North Eastern University, Gombe', null, 'university', 'GO', 'Gombe', '{}', false),
  ('alvan-ikoku-federal-university-of-education-owerri', 'Alvan Ikoku Federal University of Education, Owerri', 'AIFUE', 'university', 'IM', 'Owerri', '{}', false),
  ('azione-verde-university-amaigbo', 'Azione Verde University, Amaigbo', null, 'university', 'IM', 'Amaigbo', '{}', false),
  ('bridget-university-mbaise', 'Bridget University, Mbaise', null, 'university', 'IM', 'Okirika-Nweke', '{}', false),
  ('claretian-university-of-nigeria-nekede', 'Claretian University of Nigeria, Nekede', null, 'university', 'IM', 'Nekede', '{}', false),
  ('hezekiah-university-umudi', 'Hezekiah University, Umudi', null, 'university', 'IM', 'Umudi', '{hezekiah.edu.ng}', true),
  ('kingsley-ozumba-mbadiwe-university-ogboko', 'Kingsley Ozumba Mbadiwe University, Ogboko', 'KOMU', 'university', 'IM', 'Ogboko', '{komu.edu.ng}', true),
  ('maria-assumpta-university-owerri', 'Maria Assumpta University, Owerri', null, 'university', 'IM', 'Owerri', '{}', false),
  ('university-of-agriculture-and-environmental-sciences-umuagwo', 'University of Agriculture and Environmental Sciences, Umuagwo', 'UAES', 'university', 'IM', 'Umuagwo', '{uaes.edu.ng}', true),
  ('university-of-innovation-science-and-technology-omuma', 'University of Innovation, Science and Technology, Omuma', null, 'university', 'IM', 'Omuma', '{}', false),
  ('federal-university-of-technology-babura', 'Federal University of Technology, Babura', null, 'university', 'JI', 'Babura', '{}', false),
  ('federal-university-dutse', 'Federal University, Dutse', 'FUD', 'university', 'JI', 'Dutse', '{fud.edu.ng}', true),
  ('jigawa-state-university-of-medical-and-allied-health-sciences-majia', 'Jigawa State University of Medical and Allied Health Sciences, Majia', null, 'university', 'JI', 'Majia', '{}', false),
  ('sule-lamido-university-kafin-hausa', 'Sule Lamido University, Kafin Hausa', 'SLU', 'university', 'JI', 'Kafin Hausa', '{slu.edu.ng}', true),
  ('air-force-institute-of-technology-kaduna', 'Air Force Institute of Technology, Kaduna', 'AFIT', 'university', 'KD', 'Kaduna', '{}', false),
  ('college-of-petroleum-and-energy-studies-kaduna', 'College of Petroleum and Energy Studies, Kaduna', null, 'university', 'KD', 'Kaduna', '{}', false),
  ('federal-university-of-applied-sciences-kachia', 'Federal University of Applied Sciences, Kachia', 'FUASK', 'university', 'KD', 'Kachia', '{}', false),
  ('federal-university-of-education-zaria', 'Federal University of Education, Zaria', 'FUEZ', 'university', 'KD', 'Zaria', '{}', false),
  ('franco-british-international-university-kaduna', 'Franco British International University, Kaduna', null, 'university', 'KD', 'Kaduna', '{fbiu.edu.ng}', true),
  ('greenfield-university-kaduna', 'Greenfield University, Kaduna', 'GFU', 'university', 'KD', 'Kaduna', '{gfu.edu.ng}', true),
  ('nigerian-defence-academy', 'Nigerian Defence Academy', 'NDA', 'university', 'KD', 'Kaduna', '{}', false),
  ('omega-university-kaduna', 'Omega University, Kaduna', null, 'university', 'KD', 'Kaduna', '{}', false),
  ('tazkiyah-university-kaduna', 'Tazkiyah University, Kaduna', null, 'university', 'KD', 'Kaduna', '{}', false),
  ('federal-university-of-agriculture-zuru', 'Federal University of Agriculture, Zuru', 'FUAZ', 'university', 'KE', 'Zuru', '{}', false),
  ('federal-university-birnin-kebbi', 'Federal University, Birnin Kebbi', 'FUBK', 'university', 'KE', 'Birnin Kebbi', '{fubk.edu.ng}', true),
  ('kebbi-state-university-of-science-and-technology-aliero', 'Kebbi State University of Science and Technology, Aliero', 'KSUSTA', 'university', 'KE', 'Aliero', '{ksusta.edu.ng}', true),
  ('rayhaan-university-kebbi', 'Rayhaan University, Kebbi', null, 'university', 'KE', null, '{}', false),
  ('al-istiqama-university-sumaila', 'Al-Istiqama University, Sumaila', null, 'university', 'KN', 'Sumaila', '{}', false),
  ('aliko-dangote-university-of-science-and-technology-wudil', 'Aliko Dangote University of Science and Technology, Wudil', 'ADUSTECH', 'university', 'KN', 'Wudil', '{}', false),
  ('azman-university-kano', 'Azman University, Kano', null, 'university', 'KN', 'Kano', '{}', false),
  ('baba-ahmed-university-kano', 'Baba Ahmed University, Kano', null, 'university', 'KN', 'Kano', '{}', false),
  ('capital-city-university-kano', 'Capital City University, Kano', null, 'university', 'KN', 'Kano', '{}', false),
  ('elrazi-medical-university-yargaya', 'Elrazi Medical University, Yargaya', null, 'university', 'KN', 'Yargaya', '{}', false),
  ('federal-university-of-science-and-technology-kabo', 'Federal University of Science and Technology, Kabo', null, 'university', 'KN', 'Kabo', '{fustkabo.edu.ng}', true),
  ('khalifa-isiyaku-rabiu-university-kano', 'Khalifa Isiyaku Rabiu University, Kano', null, 'university', 'KN', 'Kano', '{}', false),
  ('maryam-abacha-american-university-of-nigeria-kano', 'Maryam Abacha American University of Nigeria, Kano', 'MAAUN', 'university', 'KN', 'Kano', '{maaun.edu.ng}', true),
  ('nigeria-police-academy-wudil', 'Nigeria Police Academy, Wudil', 'POLAC', 'university', 'KN', 'Wudil', '{polac.edu.ng}', true),
  ('skyline-university-nigeria-kano', 'Skyline University Nigeria, Kano', null, 'university', 'KN', 'Kano', '{sun.edu.ng}', true),
  ('yusuf-maitama-sule-federal-university-of-education-kano', 'Yusuf Maitama Sule Federal University of Education, Kano', 'YMSFUEK', 'university', 'KN', 'Kano', '{}', false),
  ('yusuf-maitama-sule-university-kano', 'Yusuf Maitama Sule University, Kano (formerly Northwest University Kano)', 'YUMSUK', 'university', 'KN', 'Kano', '{}', false),
  ('al-bayan-university-ankpa', 'Al-Bayan University, Ankpa', null, 'university', 'KO', 'Ankpa', '{}', false),
  ('confluence-university-of-science-and-technology-osara', 'Confluence University of Science and Technology, Osara', 'CUSTECH', 'university', 'KO', 'Osara', '{custech.edu.ng}', true),
  ('federal-university-lokoja', 'Federal University, Lokoja', 'FULOKOJA', 'university', 'KO', 'Lokoja', '{fulokoja.edu.ng}', true),
  ('kogi-state-university-kabba', 'Kogi State University, Kabba', null, 'university', 'KO', 'Kabba', '{}', false),
  ('prince-abubakar-audu-university-anyigba', 'Prince Abubakar Audu University, Anyigba', 'PAAU', 'university', 'KO', 'Anyigba', '{}', false),
  ('salem-university-lokoja', 'Salem University, Lokoja', null, 'university', 'KO', 'Lokoja', '{}', false),
  ('al-qalam-university-katsina', 'Al-Qalam University, Katsina', 'AUK', 'university', 'KT', 'Katsina', '{}', false),
  ('federal-university-of-health-sciences-katsina', 'Federal University of Health Sciences, Katsina', null, 'university', 'KT', 'Katsina', '{}', false),
  ('federal-university-of-transportation-daura', 'Federal University of Transportation, Daura', 'FUTD', 'university', 'KT', 'Daura', '{futd.edu.ng}', true),
  ('federal-university-dutsin-ma', 'Federal University, Dutsin-Ma', 'FUDMA', 'university', 'KT', 'Dutsin-Ma', '{}', false),
  ('umaru-musa-yaradua-university-katsina', 'Umaru Musa Yar''adua University, Katsina', 'UMYU', 'university', 'KT', 'Katsina', '{umyu.edu.ng}', true),
  ('abdulrasaq-abubakar-toyin-university-oke-ogba-ilorin', 'Abdulrasaq Abubakar Toyin University, Oke-Ogba, Ilorin', null, 'university', 'KW', 'Ilorin', '{}', false),
  ('ahman-pategi-university-pategi', 'Ahman Pategi University, Pategi', null, 'university', 'KW', 'Pategi', '{}', false),
  ('al-hikmah-university-ilorin', 'Al-Hikmah University, Ilorin', 'Al-Hikmah', 'university', 'KW', 'Ilorin', '{}', false),
  ('jimoh-babalola-university-ilorin', 'Jimoh Babalola University, Ilorin', null, 'university', 'KW', 'Ilorin', '{}', false),
  ('kwara-state-university-of-education-ilorin', 'Kwara State University of Education, Ilorin', null, 'university', 'KW', 'Ilorin', '{}', false),
  ('kwara-state-university-malete', 'Kwara State University, Malete', 'KWASU', 'university', 'KW', 'Malete', '{}', false),
  ('landmark-university-omu-aran', 'Landmark University, Omu-Aran', 'LMU', 'university', 'KW', 'Omu-Aran', '{}', false),
  ('lens-university-ilemona', 'Lens University, Ilemona', null, 'university', 'KW', 'Ilemona', '{}', false),
  ('muhammad-kamalud-university-kwara', 'Muhammad Kamalud University, Kwara', null, 'university', 'KW', null, '{}', false),
  ('ojaja-university-eiyenkorin', 'Ojaja University, Eiyenkorin', null, 'university', 'KW', 'Eiyenkorin', '{}', false),
  ('summit-university-offa', 'Summit University, Offa', null, 'university', 'KW', 'Offa', '{summituniversity.edu.ng}', true),
  ('thomas-adewumi-university-oko-irese', 'Thomas Adewumi University, Oko-Irese', 'TAU', 'university', 'KW', 'Oko-Irese', '{tau.edu.ng}', true),
  ('university-of-offa', 'University of Offa', null, 'university', 'KW', 'Offa', '{}', false),
  ('anchor-university-ayobo', 'Anchor University, Ayobo', 'AUL', 'university', 'LA', 'Ayobo', '{}', false),
  ('augustine-university-ilara-epe', 'Augustine University, Ilara-Epe', 'Augustine', 'university', 'LA', 'Ilara-Epe', '{augustineuniversity.edu.ng}', true),
  ('eko-university-of-medical-and-health-sciences-ijanikin', 'Eko University of Medical and Health Sciences, Ijanikin', null, 'university', 'LA', 'Ijanikin', '{}', false),
  ('federal-university-of-science-and-technology-epe', 'Federal University of Science and Technology, Epe', null, 'university', 'LA', 'Epe', '{}', false),
  ('isaac-balami-university-of-aeronautics-and-management-lagos', 'Isaac Balami University of Aeronautics and Management, Lagos', null, 'university', 'LA', null, '{}', false),
  ('james-hope-university-lagos', 'James Hope University, Lagos', 'JHU', 'university', 'LA', 'Lekki', '{jhu.edu.ng}', true),
  ('lagos-state-university-of-education-ijanikin', 'Lagos State University of Education, Ijanikin', 'LASUED', 'university', 'LA', 'Ijanikin', '{}', false),
  ('maranatha-university-lagos', 'Maranatha University, Lagos', null, 'university', 'LA', null, '{}', false),
  ('nigerian-university-of-technology-and-management-apapa', 'Nigerian University of Technology and Management, Apapa', 'NUTM', 'university', 'LA', 'Apapa', '{}', false),
  ('regnum-medical-university-lagos', 'Regnum Medical University, Lagos', null, 'university', 'LA', null, '{}', false),
  ('unique-open-university-ojo', 'Unique Open University, Ojo', null, 'university', 'LA', 'Ojo', '{}', false),
  ('ave-maria-university-piyanko', 'Ave Maria University, Piyanko', null, 'university', 'NA', 'Piyanko', '{}', false),
  ('bingham-university-karu', 'Bingham University, Karu', 'Bingham', 'university', 'NA', 'Karu', '{binghamuni.edu.ng}', true),
  ('federal-university-lafia', 'Federal University, Lafia', 'FULAFIA', 'university', 'NA', 'Lafia', '{fulafia.edu.ng}', true),
  ('mewar-international-university-masaka', 'Mewar International University, Masaka', null, 'university', 'NA', 'Masaka', '{}', false),
  ('nasarawa-state-university-keffi', 'Nasarawa State University, Keffi', 'NSUK', 'university', 'NA', 'Keffi', '{nsuk.edu.ng}', true),
  ('phoenix-university-agwada', 'Phoenix University, Agwada', null, 'university', 'NA', 'Agwada', '{}', false),
  ('abdulkadir-kure-university-minna', 'Abdulkadir Kure University, Minna', 'AKUM', 'university', 'NI', 'Minna', '{}', false),
  ('abdulsalam-abubakar-university-of-agriculture-and-climate-action-mokwa', 'Abdulsalam Abubakar University of Agriculture and Climate Action, Mokwa', null, 'university', 'NI', 'Mokwa', '{}', false),
  ('edusoko-university-bida', 'Edusoko University, Bida', null, 'university', 'NI', 'Bida', '{}', false),
  ('el-amin-university-minna', 'El-Amin University, Minna', null, 'university', 'NI', 'Minna', '{}', false),
  ('federal-university-of-education-kontagora', 'Federal University of Education, Kontagora', null, 'university', 'NI', 'Kontagora', '{}', false),
  ('ibrahim-badamasi-babangida-university-lapai', 'Ibrahim Badamasi Babangida University, Lapai', 'IBBU', 'university', 'NI', 'Lapai', '{}', false),
  ('jefap-university-suleja', 'JEFAP University, Suleja', null, 'university', 'NI', 'Suleja', '{}', false),
  ('newgate-university-minna', 'Newgate University, Minna', null, 'university', 'NI', 'Minna', '{}', false),
  ('sani-bello-university-kontagora', 'Sani Bello University, Kontagora', null, 'university', 'NI', 'Kontagora', '{}', false),
  ('abdulfattah-durojaiye-university-abeokuta', 'Abdulfattah Durojaiye University, Abeokuta', null, 'university', 'OG', 'Abeokuta', '{}', false),
  ('aletheia-university-ago-iwoye', 'Aletheia University, Ago-Iwoye', null, 'university', 'OG', 'Ago-Iwoye', '{}', false),
  ('american-open-university-abeokuta', 'American Open University, Abeokuta', null, 'university', 'OG', 'Abeokuta', '{}', false),
  ('bells-university-of-technology-ota', 'Bells University of Technology, Ota', 'Bells', 'university', 'OG', 'Ota', '{}', false),
  ('chrisland-university-abeokuta', 'Chrisland University, Abeokuta', 'Chrisland', 'university', 'OG', 'Abeokuta', '{}', false),
  ('christopher-university-mowe', 'Christopher University, Mowe', 'Christopher', 'university', 'OG', 'Mowe', '{}', false),
  ('crawford-university-igbesa', 'Crawford University, Igbesa', 'Crawford', 'university', 'OG', 'Igbesa', '{crawforduniversity.edu.ng}', true),
  ('crescent-university-abeokuta', 'Crescent University, Abeokuta', 'Crescent', 'university', 'OG', 'Abeokuta', '{}', false),
  ('federal-university-of-medicine-and-medical-sciences-abeokuta', 'Federal University of Medicine and Medical Sciences, Abeokuta', 'FUMMSA', 'university', 'OG', 'Abeokuta', '{}', false),
  ('gerar-university-of-medical-science-imope-ijebu', 'Gerar University of Medical Science, Imope Ijebu', null, 'university', 'OG', 'Imope Ijebu', '{}', false),
  ('hallmark-university-ijebi-itele', 'Hallmark University, Ijebi Itele', null, 'university', 'OG', 'Ijebi Itele', '{}', false),
  ('mcpherson-university-seriki-sotayo', 'McPherson University, Seriki Sotayo', 'MCU', 'university', 'OG', 'Seriki Sotayo, Ajebo', '{}', false),
  ('mercy-medical-university-iwo', 'Mercy Medical University, Iwo', null, 'university', 'OG', null, '{}', false),
  ('monarch-university-iyesi-ota', 'Monarch University, Iyesi-Ota', null, 'university', 'OG', 'Iyesi-Ota', '{}', false),
  ('moshood-abiola-university-of-science-and-technology-abeokuta', 'Moshood Abiola University of Science and Technology, Abeokuta', 'MAUSTECH', 'university', 'OG', 'Abeokuta', '{}', false),
  ('mountain-top-university-ibafo', 'Mountain Top University, Ibafo', 'MTU', 'university', 'OG', 'Ibafo', '{}', false),
  ('new-city-university-ayetoro', 'New City University, Ayetoro', null, 'university', 'OG', 'Ayetoro', '{}', false),
  ('southwestern-university-oku-owa', 'Southwestern University, Oku Owa', null, 'university', 'OG', 'Oku Owa', '{}', false),
  ('tai-solarin-federal-university-of-education-ijagun', 'Tai Solarin Federal University of Education, Ijagun', 'TASFUED', 'university', 'OG', 'Ijebu-Ode', '{}', false),
  ('trinity-university-ogun-state', 'Trinity University, Ogun State', null, 'university', 'OG', null, '{}', false),
  ('vision-university-ikogbo', 'Vision University, Ikogbo', null, 'university', 'OG', 'Ikogbo', '{}', false),
  ('achievers-university-owo', 'Achievers University, Owo', 'Achievers', 'university', 'ON', 'Owo', '{achievers.edu.ng}', true),
  ('adekunle-ajasin-university-akungba-akoko', 'Adekunle Ajasin University, Akungba-Akoko', 'AAUA', 'university', 'ON', 'Akungba-Akoko', '{}', false),
  ('adeyemi-federal-university-of-education-ondo', 'Adeyemi Federal University of Education, Ondo', 'AFUED', 'university', 'ON', 'Ondo', '{}', false),
  ('elizade-university-ilara-mokin', 'Elizade University, Ilara-Mokin', 'Elizade', 'university', 'ON', 'Ilara-Mokin', '{elizadeuniversity.edu.ng}', true),
  ('millenium-crest-university-ikare-akoko', 'Millenium Crest University, Ikare-Akoko', null, 'university', 'ON', 'Ikare-Akoko', '{}', false),
  ('olusegun-agagu-university-of-science-and-technology-okitipupa', 'Olusegun Agagu University of Science and Technology, Okitipupa', 'OAUSTECH', 'university', 'ON', 'Okitipupa', '{}', false),
  ('sam-maris-university-supare', 'Sam Maris University, Supare', null, 'university', 'ON', 'Supare', '{}', false),
  ('university-of-fortune-igbotako', 'University of Fortune, Igbotako', null, 'university', 'ON', 'Igbotako', '{}', false),
  ('university-of-medical-sciences-ondo', 'University of Medical Sciences, Ondo', 'UNIMED', 'university', 'ON', 'Ondo', '{}', false),
  ('wesley-university-ondo', 'Wesley University, Ondo', 'Wesley', 'university', 'ON', 'Ondo', '{wesleyuni.edu.ng}', true),
  ('adeleke-university-ede', 'Adeleke University, Ede', 'Adeleke', 'university', 'OS', 'Ede', '{adelekeuniversity.edu.ng}', true),
  ('bowen-university-iwo', 'Bowen University, Iwo', 'Bowen', 'university', 'OS', 'Iwo', '{bowen.edu.ng}', true),
  ('federal-university-of-agriculture-and-developmental-studies-iragbuji', 'Federal University of Agriculture and Developmental Studies, Iragbuji', null, 'university', 'OS', 'Iragbuji', '{}', false),
  ('federal-university-of-health-sciences-ila-orangun', 'Federal University of Health Sciences, Ila Orangun', null, 'university', 'OS', 'Ila Orangun', '{}', false),
  ('fountain-university-osogbo', 'Fountain University, Osogbo', 'Fountain', 'university', 'OS', 'Osogbo', '{fuo.edu.ng}', true),
  ('joseph-ayo-babalola-university-ikeji-arakeji', 'Joseph Ayo Babalola University, Ikeji-Arakeji', 'JABU', 'university', 'OS', 'Ikeji-Arakeji', '{}', false),
  ('kings-university-ode-omu', 'Kings University, Ode Omu', 'Kings', 'university', 'OS', 'Ode Omu', '{kingsuniversity.edu.ng}', true),
  ('minaret-university-ikirun', 'Minaret University, Ikirun', null, 'university', 'OS', 'Ikirun', '{}', false),
  ('oduduwa-university-ipetumodu', 'Oduduwa University, Ipetumodu', 'Oduduwa', 'university', 'OS', 'Ipetumodu', '{}', false),
  ('osun-state-university-osogbo', 'Osun State University, Osogbo', 'UNIOSUN', 'university', 'OS', 'Osogbo', '{uniosun.edu.ng}', true),
  ('owolabi-university-oke-ila-orangun', 'Owolabi University, Oke-Ila Orangun', null, 'university', 'OS', 'Oke-Ila Orangun', '{}', false),
  ('redeemers-university-ede', 'Redeemer''s University, Ede', 'RUN', 'university', 'OS', 'Ede', '{}', false),
  ('university-of-ilesa', 'University of Ilesa', 'UNILESA', 'university', 'OS', 'Ilesa', '{}', false),
  ('westland-university-iwo', 'Westland University, Iwo', null, 'university', 'OS', 'Iwo', '{}', false),
  ('abiola-ajimobi-technical-university-ibadan', 'Abiola Ajimobi Technical University, Ibadan (formerly First Technical University)', 'TECH-U', 'university', 'OY', 'Ibadan', '{tech-u.edu.ng}', true),
  ('ajayi-crowther-university-ibadan', 'Ajayi Crowther University, Ibadan', 'ACU', 'university', 'OY', 'Oyo', '{}', false),
  ('atiba-university-oyo', 'Atiba University, Oyo', null, 'university', 'OY', 'Oyo', '{}', false),
  ('dominican-university-ibadan', 'Dominican University, Ibadan', 'DUI', 'university', 'OY', 'Ibadan', '{dui.edu.ng}', true),
  ('dominion-university-ibadan', 'Dominion University, Ibadan', null, 'university', 'OY', 'Ibadan', '{dominionuniversity.edu.ng}', true),
  ('emmanuel-alayande-university-of-education-oyo', 'Emmanuel Alayande University of Education, Oyo', 'EAUED', 'university', 'OY', 'Oyo', '{}', false),
  ('federal-university-of-agriculture-and-technology-okeho', 'Federal University of Agriculture and Technology, Okeho', null, 'university', 'OY', 'Okeho', '{}', false),
  ('kola-daisi-university-ibadan', 'Kola Daisi University, Ibadan', 'KDU', 'university', 'OY', 'Ibadan', '{koladaisiuniversity.edu.ng}', true),
  ('lead-city-university-ibadan', 'Lead City University, Ibadan', 'LCU', 'university', 'OY', 'Ibadan', '{lcu.edu.ng}', true),
  ('precious-cornerstone-university-ibadan', 'Precious Cornerstone University, Ibadan', 'PCU', 'university', 'OY', 'Ibadan', '{}', false),
  ('west-midlands-open-university-ibadan', 'West Midlands Open University, Ibadan', null, 'university', 'OY', 'Ibadan', '{}', false),
  ('anan-university-kwall', 'Anan University, Kwall', null, 'university', 'PL', 'Kwall', '{}', false),
  ('federal-university-of-education-pankshin', 'Federal University of Education, Pankshin', 'FUEP', 'university', 'PL', 'Pankshin', '{}', false),
  ('karl-kumm-university-vom', 'Karl-Kumm University, Vom', null, 'university', 'PL', 'Vom', '{}', false),
  ('plateau-state-university-bokkos', 'Plateau State University, Bokkos', 'PLASU', 'university', 'PL', 'Bokkos', '{plasu.edu.ng}', true),
  ('federal-university-of-environment-and-technology-tai', 'Federal University of Environment and Technology, Tai', null, 'university', 'RI', 'Tai, Ogoniland', '{}', false),
  ('ignatius-ajuru-university-of-education-rumuolumeni', 'Ignatius Ajuru University of Education, Rumuolumeni', 'IAUE', 'university', 'RI', 'Rumuolumeni, Port Harcourt', '{iaue.edu.ng}', true),
  ('pamo-university-of-medical-sciences-port-harcourt', 'PAMO University of Medical Sciences, Port Harcourt', 'PUMS', 'university', 'RI', 'Port Harcourt', '{pums.edu.ng}', true),
  ('rhema-university-obeama-asa', 'Rhema University, Obeama-Asa', null, 'university', 'RI', 'Obeama-Asa', '{rhemauniversity.edu.ng}', true),
  ('wigwe-university-isiokpo', 'Wigwe University, Isiokpo', null, 'university', 'RI', 'Isiokpo', '{wigweuniversity.edu.ng}', true),
  ('iconic-open-university-sokoto', 'Iconic Open University, Sokoto', null, 'university', 'SO', 'Sokoto', '{}', false),
  ('northwest-university-sokoto', 'Northwest University, Sokoto', null, 'university', 'SO', 'Sokoto', '{nwus.edu.ng}', true),
  ('saisa-university-of-medical-sciences-and-technology-sokoto', 'Saisa University of Medical Sciences and Technology, Sokoto', null, 'university', 'SO', 'Sokoto', '{}', false),
  ('shehu-shagari-university-of-education-sokoto', 'Shehu Shagari University of Education, Sokoto', null, 'university', 'SO', 'Sokoto', '{}', false),
  ('sokoto-state-university', 'Sokoto State University', 'SSU', 'university', 'SO', 'Sokoto', '{ssu.edu.ng}', true),
  ('federal-university-wukari', 'Federal University, Wukari', 'FUWUKARI', 'university', 'TA', 'Wukari', '{}', false),
  ('greenland-university-jalingo', 'Greenland University, Jalingo', null, 'university', 'TA', 'Jalingo', '{}', false),
  ('kwararafa-university-wukari', 'Kwararafa University, Wukari', null, 'university', 'TA', 'Wukari', '{}', false),
  ('taraba-state-university-of-tropical-agriculture-and-climate-action-gembu', 'Taraba State University of Tropical Agriculture, Science, Technology and Climate Action, Gembu', null, 'university', 'TA', 'Gembu', '{}', false),
  ('taraba-state-university-jalingo', 'Taraba State University, Jalingo', 'TSU', 'university', 'TA', 'Jalingo', '{tsuniversity.edu.ng}', true),
  ('federal-university-gashua', 'Federal University, Gashua', 'FUGA', 'university', 'YO', 'Gashua', '{fugashua.edu.ng}', true),
  ('yobe-state-university-damaturu', 'Yobe State University, Damaturu', 'YSU', 'university', 'YO', 'Damaturu', '{ysu.edu.ng}', true),
  ('federal-university-of-health-science-and-technology-tsafe', 'Federal University of Health Science and Technology, Tsafe', null, 'university', 'ZA', 'Tsafe', '{}', false),
  ('federal-university-gusau', 'Federal University, Gusau', 'FUGUS', 'university', 'ZA', 'Gusau', '{}', false),
  ('huda-university-gusau', 'Huda University, Gusau', null, 'university', 'ZA', 'Gusau', '{}', false),
  ('zamfara-state-university-talata-mafara', 'Zamfara State University, Talata Mafara', 'ZSU', 'university', 'ZA', 'Talata Mafara', '{}', false),
-- POLYTECHNICS AND MONOTECHNICS (147; email domains confirmed from the school's own site: 64)
  ('covenant-polytechnic-aba', 'Covenant Polytechnic, Aba', null, 'polytechnic', 'AB', 'Aba', '{}', false),
  ('federal-polytechnic-ngodo-isuochi', 'Federal Polytechnic, Ngodo Isuochi', null, 'polytechnic', 'AB', 'Ngodo Isuochi', '{}', false),
  ('iheachukwu-madubuike-institute-of-technology-umunneochi', 'Iheachukwu Madubuike Institute of Technology, Umunneochi', null, 'polytechnic', 'AB', 'Umunneochi', '{imit.edu.ng}', true),
  ('madonna-college-of-health-technology', 'Madonna College of Health Technology', null, 'polytechnic', 'AB', 'Umuahia', '{macohtech.edu.ng}', true),
  ('ogbonnaya-onu-polytechnic-aba', 'Ogbonnaya Onu Polytechnic, Aba (Abia State Polytechnic)', 'ABIAPOLY', 'polytechnic', 'AB', 'Aba', '{}', false),
  ('temple-gate-polytechnic-aba', 'Temple Gate Polytechnic, Aba', null, 'polytechnic', 'AB', 'Aba', '{tgp.edu.ng}', true),
  ('adamawa-state-polytechnic-yola', 'Adamawa State Polytechnic, Yola', null, 'polytechnic', 'AD', 'Yola', '{adamawapoly.edu.ng}', true),
  ('federal-polytechnic-mubi', 'Federal Polytechnic, Mubi', 'FPMUBI', 'polytechnic', 'AD', 'Mubi', '{}', false),
  ('akwa-ibom-state-college-of-arts-and-science-nung-ukim', 'Akwa Ibom State College of Arts and Science, Nung Ukim', null, 'polytechnic', 'AK', 'Ikono', '{}', false),
  ('akwa-ibom-state-polytechnic-ikot-osurua', 'Akwa Ibom State Polytechnic, Ikot Osurua', null, 'polytechnic', 'AK', 'Ikot Ekpene', '{akwaibompoly.edu.ng}', true),
  ('brainfill-polytechnic-ikot-ekpene', 'Brainfill Polytechnic, Ikot Ekpene', null, 'polytechnic', 'AK', 'Ikot Ekpene', '{brainfillpolytechnic.edu.ng}', true),
  ('el-thomp-polytechnic-abak', 'El-Thomp Polytechnic, Abak', null, 'polytechnic', 'AK', 'Abak', '{}', false),
  ('federal-polytechnic-ukana', 'Federal Polytechnic, Ukana', 'FEDPOLYUKANA', 'polytechnic', 'AK', 'Ukana', '{fedpolyukana.edu.ng}', true),
  ('foundation-polytechnic-ikot-ekpene', 'Foundation Polytechnic, Ikot Ekpene', null, 'polytechnic', 'AK', 'Ikot Ekpene', '{}', false),
  ('heritage-polytechnic-eket', 'Heritage Polytechnic, Eket', null, 'polytechnic', 'AK', 'Eket', '{}', false),
  ('ibom-metropolitan-polytechnic-atan-offot', 'Ibom Metropolitan Polytechnic, Atan Offot', null, 'polytechnic', 'AK', 'Atan Offot', '{}', false),
  ('loam-polytechnic', 'Loam Polytechnic', null, 'polytechnic', 'AK', 'Ikono', '{loampolytechnic.edu.ng}', true),
  ('maritime-academy-of-nigeria-oron', 'Maritime Academy of Nigeria, Oron', 'MAN Oron', 'polytechnic', 'AK', 'Oron', '{}', false),
  ('sure-foundation-polytechnic-ikot-akai', 'Sure Foundation Polytechnic, Ikot Akai', null, 'polytechnic', 'AK', 'Ikot Akai', '{}', false),
  ('trinity-polytechnic-uyo', 'Trinity Polytechnic, Uyo', null, 'polytechnic', 'AK', 'Uyo', '{trinitypoly.edu.ng}', true),
  ('anambra-state-polytechnic-mgbakwu', 'Anambra State Polytechnic, Mgbakwu', null, 'polytechnic', 'AN', 'Mgbakwu', '{anspoly.edu.ng}', true),
  ('federal-polytechnic-oko', 'Federal Polytechnic, Oko', 'FEDERALPOLYOKO', 'polytechnic', 'AN', 'Oko', '{federalpolyoko.edu.ng}', true),
  ('gozie-anyachebelu-oragram-polytechnic-oraukwu', 'Gozie Anyachebelu Oragram Polytechnic, Oraukwu', null, 'polytechnic', 'AN', 'Oraukwu', '{}', false),
  ('grundtvig-polytechnic-oba', 'Grundtvig Polytechnic, Oba', null, 'polytechnic', 'AN', 'Oba', '{}', false),
  ('abubakar-tatari-ali-polytechnic-bauchi', 'Abubakar Tatari Ali Polytechnic, Bauchi', 'ATAPOLY', 'polytechnic', 'BA', 'Bauchi', '{}', false),
  ('federal-polytechnic-bauchi', 'Federal Polytechnic, Bauchi', 'FPTB', 'polytechnic', 'BA', 'Bauchi', '{fptb.edu.ng}', true),
  ('akawe-torkula-polytechnic-makurdi', 'Akawe Torkula Polytechnic, Makurdi', null, 'polytechnic', 'BE', 'Makurdi', '{}', false),
  ('bellarks-polytechnic-kwale', 'Bellarks Polytechnic, Kwale', null, 'polytechnic', 'BE', 'Kwale', '{bellarkspoly.edu.ng}', true),
  ('benue-state-polytechnic-ugbokolo', 'Benue State Polytechnic, Ugbokolo', null, 'polytechnic', 'BE', 'Ugbokolo', '{}', false),
  ('federal-polytechnic-wannune', 'Federal Polytechnic, Wannune', 'FEDPOLYWANNUNE', 'polytechnic', 'BE', 'Wannune', '{}', false),
  ('gboko-polytechnic', 'Gboko Polytechnic', null, 'polytechnic', 'BE', 'Gboko', '{gbokopoly.edu.ng}', true),
  ('intercontinental-college-of-technology-makurdi', 'Intercontinental College of Technology, Makurdi', null, 'polytechnic', 'BE', 'Makurdi', '{}', false),
  ('nigerian-army-college-of-environmental-science-and-technology-makurdi', 'Nigerian Army College of Environmental Science and Technology, Makurdi', null, 'polytechnic', 'BE', 'Makurdi', '{}', false),
  ('federal-polytechnic-monguno', 'Federal Polytechnic, Monguno', 'FEDPOLYMONGUNO', 'polytechnic', 'BO', 'Monguno', '{fedpolymonguno.edu.ng}', true),
  ('ramat-polytechnic-maiduguri', 'Ramat Polytechnic, Maiduguri', null, 'polytechnic', 'BO', 'Maiduguri', '{}', false),
  ('bayelsa-state-polytechnic-aguobiri', 'Bayelsa State Polytechnic, Aguobiri', null, 'polytechnic', 'BY', 'Aguobiri', '{bayelsastatepoly.edu.ng}', true),
  ('federal-polytechnic-ekowe', 'Federal Polytechnic, Ekowe', 'FEDPOLYEKOWE', 'polytechnic', 'BY', 'Ekowe', '{}', false),
  ('cross-river-institute-of-technology-and-management-ugep', 'Cross River Institute of Technology and Management, Ugep', null, 'polytechnic', 'CR', 'Ugep', '{}', false),
  ('federal-polytechnic-ugep', 'Federal Polytechnic, Ugep', 'FEDPOLYUGEP', 'polytechnic', 'CR', 'Ugep', '{fedpolyugep.edu.ng}', true),
  ('calvary-polytechnic', 'Calvary Polytechnic', null, 'polytechnic', 'DE', 'Ika North East', '{}', false),
  ('delta-state-maritime-polytechnic-burutu', 'Delta State Maritime Polytechnic, Burutu', null, 'polytechnic', 'DE', 'Burutu', '{}', false),
  ('delta-state-polytechnic-ogwashi-uku', 'Delta State Polytechnic, Ogwashi-Uku', 'DSPG', 'polytechnic', 'DE', 'Ogwashi-Uku', '{mydspg.edu.ng}', true),
  ('delta-state-polytechnic-otefe-oghara', 'Delta State Polytechnic, Otefe-Oghara', 'DELTAPOLY', 'polytechnic', 'DE', 'Oghara', '{}', false),
  ('federal-polytechnic-orogun', 'Federal Polytechnic, Orogun', 'FEPO', 'polytechnic', 'DE', 'Orogun', '{}', false),
  ('nation-builders-polytechnic-asaba', 'Nation Builders Polytechnic, Asaba', null, 'polytechnic', 'DE', 'Asaba', '{nabcotech.edu.ng}', true),
  ('petroleum-training-institute-effurun', 'Petroleum Training Institute, Effurun', 'PTI', 'polytechnic', 'DE', 'Effurun', '{pti.edu.ng}', true),
  ('akanu-ibiam-federal-polytechnic-unwana', 'Akanu Ibiam Federal Polytechnic, Unwana', 'AIFPU', 'polytechnic', 'EB', 'Unwana', '{}', false),
  ('edo-state-polytechnic-usen', 'Edo State Polytechnic, Usen', 'EDOPOLY', 'polytechnic', 'ED', 'Usen', '{edopoly.edu.ng}', true),
  ('global-polytechnic-benin-city', 'Global Polytechnic, Benin City', null, 'polytechnic', 'ED', 'Benin City', '{theglobalpolytechnic.edu.ng}', true),
  ('kings-polytechnic-ubiaja', 'Kings Polytechnic, Ubiaja', null, 'polytechnic', 'ED', 'Ubiaja', '{}', false),
  ('national-institute-of-construction-technology-and-management-uromi', 'National Institute of Construction Technology and Management, Uromi', 'NICTM', 'polytechnic', 'ED', 'Uromi', '{nict.edu.ng}', true),
  ('shaka-polytechnic-benin-city', 'Shaka Polytechnic, Benin City', null, 'polytechnic', 'ED', 'Benin City', '{}', false),
  ('ajayi-polytechnic-ikere-ekiti', 'Ajayi Polytechnic, Ikere-Ekiti', null, 'polytechnic', 'EK', 'Ikere-Ekiti', '{ajayipolytechnic.edu.ng}', true),
  ('crown-polytechnic-ado-ekiti', 'Crown Polytechnic, Ado-Ekiti', null, 'polytechnic', 'EK', 'Ado-Ekiti', '{}', false),
  ('ekiti-city-polytechnic', 'Ekiti City Polytechnic', null, 'polytechnic', 'EK', 'Umuooke', '{}', false),
  ('ekiti-state-college-of-agriculture-and-technology-isan-ekiti', 'Ekiti State College of Agriculture and Technology, Isan-Ekiti', 'EKSCOTECH', 'polytechnic', 'EK', 'Isan-Ekiti', '{}', false),
  ('federal-polytechnic-ado-ekiti', 'Federal Polytechnic, Ado-Ekiti', 'FEDPOLYADO', 'polytechnic', 'EK', 'Ado-Ekiti', '{}', false),
  ('montgomery-polytechnic-ikere-ekiti', 'Montgomery Polytechnic, Ikere-Ekiti', null, 'polytechnic', 'EK', 'Ikere-Ekiti', '{montgomerypolytechnic.edu.ng}', true),
  ('federal-polytechnic-ohodo', 'Federal Polytechnic, Ohodo', 'FEDPOD', 'polytechnic', 'EN', 'Ohodo', '{fedpod.edu.ng}', true),
  ('mater-dei-polytechnic', 'Mater Dei Polytechnic', null, 'polytechnic', 'EN', 'Ugwuoba', '{}', false),
  ('our-saviour-institute-of-science-and-technology-enugu', 'Our Saviour Institute of Science and Technology, Enugu', null, 'polytechnic', 'EN', 'Enugu', '{}', false),
  ('citi-polytechnic-bwari', 'Citi Polytechnic, Bwari', null, 'polytechnic', 'FC', 'Bwari', '{}', false),
  ('dorben-polytechnic-bwari', 'Dorben Polytechnic, Bwari', null, 'polytechnic', 'FC', 'Bwari', '{dorbenpolytechnic.edu.ng}', true),
  ('federal-polytechnic-kaltungo', 'Federal Polytechnic, Kaltungo', 'FEDPOLYKLT', 'polytechnic', 'GO', 'Kaltungo', '{}', false),
  ('gombe-state-polytechnic-bajoga', 'Gombe State Polytechnic, Bajoga', 'GSPB', 'polytechnic', 'GO', 'Bajoga', '{}', false),
  ('imo-state-polytechnic-umuagwo', 'Imo State Polytechnic, Umuagwo', 'IMOPOLY', 'polytechnic', 'IM', 'Umuagwo', '{}', false),
  ('binyaminu-usman-polytechnic-hadejia', 'Binyaminu Usman Polytechnic, Hadejia', 'BUPOLY', 'polytechnic', 'JI', 'Hadejia', '{}', false),
  ('hussaini-adamu-federal-polytechnic-kazaure', 'Hussaini Adamu Federal Polytechnic, Kazaure', 'HAFEDPOLY', 'polytechnic', 'JI', 'Kazaure', '{hafedpoly.edu.ng}', true),
  ('jigawa-state-polytechnic-dutse', 'Jigawa State Polytechnic, Dutse', 'JIGPOLY', 'polytechnic', 'JI', 'Dutse', '{jigpoly.edu.ng}', true),
  ('nigerian-college-of-aviation-technology-zaria', 'Nigerian College of Aviation Technology, Zaria', 'NCAT', 'polytechnic', 'KD', 'Zaria', '{}', false),
  ('nuhu-bamalli-polytechnic-zaria', 'Nuhu Bamalli Polytechnic, Zaria', 'NUBAPOLY', 'polytechnic', 'KD', 'Zaria', '{}', false),
  ('kebbi-state-polytechnic-dakingari', 'Kebbi State Polytechnic, Dakingari', 'KESPODAK', 'polytechnic', 'KE', 'Dakingari', '{}', false),
  ('waziri-umaru-federal-polytechnic-birnin-kebbi', 'Waziri Umaru Federal Polytechnic, Birnin Kebbi', 'WUFPBK', 'polytechnic', 'KE', 'Birnin Kebbi', '{wufpbk.edu.ng}', true),
  ('federal-polytechnic-kabo', 'Federal Polytechnic, Kabo', null, 'polytechnic', 'KN', 'Kabo', '{fedpolykabo.edu.ng}', true),
  ('kano-state-polytechnic', 'Kano State Polytechnic', 'KANOPOLY', 'polytechnic', 'KN', 'Kano', '{kanopoly.edu.ng}', true),
  ('mustibrah-polytechnic-kano', 'Mustibrah Polytechnic, Kano', null, 'polytechnic', 'KN', 'Kano', '{}', false),
  ('federal-polytechnic-idah', 'Federal Polytechnic, Idah', 'FEPODA', 'polytechnic', 'KO', 'Idah', '{}', false),
  ('kogi-state-polytechnic-lokoja', 'Kogi State Polytechnic, Lokoja', 'KOGIPOLY', 'polytechnic', 'KO', 'Lokoja', '{kogistatepolytechnic.edu.ng}', true),
  ('federal-polytechnic-daura', 'Federal Polytechnic, Daura', 'FEDPOLYDAURA', 'polytechnic', 'KT', 'Daura', '{}', false),
  ('hassan-usman-katsina-polytechnic', 'Hassan Usman Katsina Polytechnic', 'HUKPOLY', 'polytechnic', 'KT', 'Katsina', '{}', false),
  ('katsina-institute-of-technology-and-management', 'Katsina Institute of Technology and Management', 'KSITM', 'polytechnic', 'KT', 'Katsina', '{ksitm.edu.ng}', true),
  ('federal-polytechnic-offa', 'Federal Polytechnic, Offa', 'FEDPOFFA', 'polytechnic', 'KW', 'Offa', '{fedpoffaonline.edu.ng}', true),
  ('harvard-polytechnic-ilorin', 'Harvard Polytechnic, Ilorin', null, 'polytechnic', 'KW', 'Ilorin', '{harvardpolytechnic.edu.ng}', true),
  ('lens-polytechnic-offa', 'Lens Polytechnic, Offa', null, 'polytechnic', 'KW', 'Offa', '{}', false),
  ('newland-polytechnic-ilorin', 'Newland Polytechnic, Ilorin', null, 'polytechnic', 'KW', 'Ilorin', '{newlandpolytechnic.edu.ng}', true),
  ('the-polytechnic-igbo-owu', 'The Polytechnic, Igbo-Owu', null, 'polytechnic', 'KW', 'Igbo-Owu', '{thepolytechnicigboowu.edu.ng}', true),
  ('coastal-polytechnic-badagry', 'Coastal Polytechnic, Badagry', null, 'polytechnic', 'LA', 'Badagry', '{}', false),
  ('eko-college-of-management-and-technology-ikotun', 'Eko College of Management and Technology (Ekocity), Ikotun', null, 'polytechnic', 'LA', 'Ikotun', '{}', false),
  ('enville-polytechnic-ikeja', 'Enville Polytechnic, Ikeja', null, 'polytechnic', 'LA', 'Ikeja', '{envillepoly.edu.ng}', true),
  ('inspire-polytechnic-yaba', 'Inspire Polytechnic, Yaba', null, 'polytechnic', 'LA', 'Yaba', '{inspirepolytechnic.edu.ng}', true),
  ('oduduwa-polytechnic-idimu', 'Oduduwa Polytechnic, Idimu', null, 'polytechnic', 'LA', 'Idimu', '{}', false),
  ('paramount-polytechnic-ejigbo', 'Paramount Polytechnic, Ejigbo', null, 'polytechnic', 'LA', 'Ejigbo', '{paramountpolytechnic.edu.ng}', true),
  ('ronik-polytechnic-ejigbo', 'Ronik Polytechnic, Ejigbo', null, 'polytechnic', 'LA', 'Ejigbo', '{ronikpolytechnic.edu.ng}', true),
  ('timeon-kairos-polytechnic-agege', 'TimeOn Kairos Polytechnic, Agege', null, 'polytechnic', 'LA', 'Agege', '{}', false),
  ('college-of-agriculture-science-and-technology-lafia', 'College of Agriculture, Science and Technology, Lafia', 'COAST Lafia', 'polytechnic', 'NA', 'Lafia', '{coastlafia.edu.ng}', true),
  ('federal-polytechnic-nasarawa', 'Federal Polytechnic, Nasarawa', 'FPN', 'polytechnic', 'NA', 'Nasarawa', '{}', false),
  ('isa-mustapha-agwai-i-polytechnic-lafia', 'Isa Mustapha Agwai I Polytechnic, Lafia', 'IMAP', 'polytechnic', 'NA', 'Lafia', '{}', false),
  ('nacabs-polytechnic-akwanga', 'NACABS Polytechnic, Akwanga', null, 'polytechnic', 'NA', 'Akwanga', '{nacabspoly.edu.ng}', true),
  ('vineyard-polytechnic-karu', 'Vineyard Polytechnic, Karu', null, 'polytechnic', 'NA', 'Karu', '{}', false),
  ('federal-polytechnic-bida', 'Federal Polytechnic, Bida', 'FEDPOLYBIDA', 'polytechnic', 'NI', 'Bida', '{fedpolybida.edu.ng}', true),
  ('niger-state-polytechnic-zungeru', 'Niger State Polytechnic, Zungeru', 'NIGERPOLY', 'polytechnic', 'NI', 'Zungeru', '{}', false),
  ('abraham-adesanya-polytechnic-ijebu-igbo', 'Abraham Adesanya Polytechnic, Ijebu-Igbo', 'AAPOLY', 'polytechnic', 'OG', 'Ijebu-Igbo', '{aapoly.edu.ng}', true),
  ('d-s-adegbenro-ict-polytechnic-itori', 'D.S. Adegbenro ICT Polytechnic, Itori', 'DSAPOLY', 'polytechnic', 'OG', 'Itori, Ewekoro', '{}', false),
  ('first-city-polytechnic-abeokuta', 'First City Polytechnic, Abeokuta', null, 'polytechnic', 'OG', 'Abeokuta', '{firstcitypoly.edu.ng}', true),
  ('gateway-polytechnic-saapade', 'Gateway Polytechnic, Saapade', 'GAPOSA', 'polytechnic', 'OG', 'Saapade', '{gaposa.edu.ng}', true),
  ('landmark-polytechnic-aiyetoro', 'Landmark Polytechnic, Aiyetoro', null, 'polytechnic', 'OG', 'Aiyetoro', '{landmarkpolytechnic.edu.ng}', true),
  ('moshood-abiola-polytechnic-abeokuta', 'Moshood Abiola Polytechnic, Abeokuta', 'MAPOLY', 'polytechnic', 'OG', 'Abeokuta', '{mapoly.edu.ng}', true),
  ('ogun-state-institute-of-technology-igbesa', 'Ogun State Institute of Technology, Igbesa', 'OGITECH', 'polytechnic', 'OG', 'Igbesa', '{}', false),
  ('stars-polytechnic-ota', 'Stars Polytechnic, Ota', null, 'polytechnic', 'OG', 'Ota', '{starspoly.edu.ng}', true),
  ('best-solution-polytechnic-akure', 'Best Solution Polytechnic, Akure', null, 'polytechnic', 'ON', 'Akure', '{bestpotech.edu.ng}', true),
  ('british-transatlantic-polytechnic-akure', 'British Transatlantic Polytechnic, Akure', null, 'polytechnic', 'ON', 'Akure', '{britishpoly.edu.ng}', true),
  ('federal-polytechnic-ile-oluji', 'Federal Polytechnic, Ile-Oluji', 'FEDPOLEL', 'polytechnic', 'ON', 'Ile-Oluji', '{}', false),
  ('rufus-giwa-polytechnic-owo', 'Rufus Giwa Polytechnic, Owo', 'RUGIPO', 'polytechnic', 'ON', 'Owo', '{}', false),
  ('daboss-polytechnic', 'Daboss Polytechnic', null, 'polytechnic', 'OS', 'Idominasi', '{dabosspolytechnic.edu.ng}', true),
  ('distinct-polytechnic', 'Distinct Polytechnic', null, 'polytechnic', 'OS', 'Ekosin', '{}', false),
  ('federal-polytechnic-ede', 'Federal Polytechnic, Ede', 'FEDPOLYEDE', 'polytechnic', 'OS', 'Ede', '{}', false),
  ('i-con-universal-polytechnic-osogbo', 'I-Con Universal Polytechnic, Osogbo', null, 'polytechnic', 'OS', 'Osogbo', '{}', false),
  ('igbajo-polytechnic', 'Igbajo Polytechnic', null, 'polytechnic', 'OS', 'Igbajo', '{}', false),
  ('interlink-polytechnic-ijebu-jesa', 'Interlink Polytechnic, Ijebu-Jesa', null, 'polytechnic', 'OS', 'Ijebu-Jesa', '{}', false),
  ('iwo-city-polytechnic', 'Iwo City Polytechnic', null, 'polytechnic', 'OS', 'Iwo', '{}', false),
  ('osun-state-college-of-technology-esa-oke', 'Osun State College of Technology, Esa-Oke', 'OSCOTECH', 'polytechnic', 'OS', 'Esa-Oke', '{oscotechesaoke.edu.ng}', true),
  ('osun-state-polytechnic-iree', 'Osun State Polytechnic, Iree', 'OSPOLY', 'polytechnic', 'OS', 'Iree', '{}', false),
  ('saf-polytechnic-iseyin', 'SAF Polytechnic, Iseyin', null, 'polytechnic', 'OS', 'Iseyin', '{}', false),
  ('the-polytechnic-iresi', 'The Polytechnic, Iresi', null, 'polytechnic', 'OS', 'Iresi', '{thepolytechniciresi.edu.ng}', true),
  ('adeseun-ogundoyin-polytechnic-eruwa', 'Adeseun Ogundoyin Polytechnic, Eruwa', 'AOPE', 'polytechnic', 'OY', 'Eruwa', '{aope.edu.ng}', true),
  ('american-polytechnic-wasimi', 'American Polytechnic, Wasimi', null, 'polytechnic', 'OY', 'Wasimi', '{}', false),
  ('bolmor-polytechnic-ibadan', 'Bolmor Polytechnic, Ibadan', null, 'polytechnic', 'OY', 'Ibadan', '{bpi.edu.ng}', true),
  ('federal-polytechnic-ayede', 'Federal Polytechnic, Ayede', null, 'polytechnic', 'OY', 'Ayede', '{}', false),
  ('ibadan-city-polytechnic', 'Ibadan City Polytechnic', null, 'polytechnic', 'OY', 'Ibadan', '{icp.edu.ng}', true),
  ('oyo-state-college-of-agriculture-and-technology-igboora', 'Oyo State College of Agriculture and Technology, Igboora', 'OYSCATECH', 'polytechnic', 'OY', 'Igboora', '{oyscatech.edu.ng}', true),
  ('the-oke-ogun-polytechnic-saki', 'The Oke-Ogun Polytechnic, Saki', 'TOPS', 'polytechnic', 'OY', 'Saki', '{tops.edu.ng}', true),
  ('federal-polytechnic-nyak-shendam', 'Federal Polytechnic, Nyak Shendam', 'FEDPOLYSHENDAM', 'polytechnic', 'PL', 'Shendam', '{}', false),
  ('plateau-state-polytechnic-barkin-ladi', 'Plateau State Polytechnic, Barkin Ladi', 'PLAPOLY', 'polytechnic', 'PL', 'Barkin Ladi', '{}', false),
  ('united-polytechnic-jos', 'United Polytechnic, Jos', null, 'polytechnic', 'PL', 'Jos', '{}', false),
  ('captain-elechi-amadi-polytechnic-port-harcourt', 'Captain Elechi Amadi Polytechnic, Port Harcourt', 'CEAPOLY', 'polytechnic', 'RI', 'Port Harcourt', '{}', false),
  ('eastern-polytechnic-port-harcourt', 'Eastern Polytechnic, Port Harcourt', null, 'polytechnic', 'RI', 'Port Harcourt', '{}', false),
  ('federal-polytechnic-of-oil-and-gas-bonny', 'Federal Polytechnic of Oil and Gas, Bonny', 'FEDPOLYBONNY', 'polytechnic', 'RI', 'Bonny', '{fedpolybonny.edu.ng}', true),
  ('kenule-beeson-saro-wiwa-polytechnic-bori', 'Kenule Beeson Saro-Wiwa Polytechnic, Bori', 'KENPOLY', 'polytechnic', 'RI', 'Bori', '{}', false),
  ('umaru-ali-shinkafi-polytechnic-sokoto', 'Umaru Ali Shinkafi Polytechnic, Sokoto', 'UASPOLY', 'polytechnic', 'SO', 'Sokoto', '{uasp.edu.ng}', true),
  ('federal-polytechnic-bali', 'Federal Polytechnic, Bali', 'FEDPOLYBALI', 'polytechnic', 'TA', 'Bali', '{}', false),
  ('taraba-state-polytechnic-suntai', 'Taraba State Polytechnic, Suntai', 'TARABAPOLY', 'polytechnic', 'TA', 'Suntai', '{}', false),
  ('college-of-administration-management-and-technology-potiskum', 'College of Administration, Management and Technology, Potiskum', null, 'polytechnic', 'YO', 'Potiskum', '{}', false),
  ('college-of-agriculture-science-and-technology-gujba', 'College of Agriculture, Science and Technology, Gujba', null, 'polytechnic', 'YO', 'Gujba', '{}', false),
  ('federal-polytechnic-damaturu', 'Federal Polytechnic, Damaturu', 'FEDPODAM', 'polytechnic', 'YO', 'Damaturu', '{}', false),
  ('mai-idris-alooma-polytechnic-geidam', 'Mai Idris Alooma Polytechnic, Geidam', 'MIAPOLY', 'polytechnic', 'YO', 'Geidam', '{miapoly.edu.ng}', true),
  ('abdu-gusau-polytechnic-talata-mafara', 'Abdu Gusau Polytechnic, Talata Mafara', 'AGPOLY', 'polytechnic', 'ZA', 'Talata Mafara', '{}', false),
  ('federal-polytechnic-kaura-namoda', 'Federal Polytechnic, Kaura Namoda', 'FEDPONAM', 'polytechnic', 'ZA', 'Kaura Namoda', '{}', false),
-- COLLEGES OF EDUCATION (58; no email domains: none checked, so all verify by student ID)
  ('abia-state-college-of-education-arochukwu', 'Abia State College of Education (Technical), Arochukwu', null, 'college', 'AB', 'Arochukwu', '{}', false),
  ('adamawa-state-college-of-education-hong', 'Adamawa State College of Education, Hong', null, 'college', 'AD', 'Hong', '{}', false),
  ('federal-college-of-education-yola', 'Federal College of Education, Yola', 'FCE Yola', 'college', 'AD', 'Yola', '{}', false),
  ('akwa-ibom-state-college-of-education-afaha-nsit', 'Akwa Ibom State College of Education, Afaha Nsit', null, 'college', 'AK', 'Afaha Nsit', '{}', false),
  ('federal-college-of-education-ididep', 'Federal College of Education, Ididep', null, 'college', 'AK', 'Ididep', '{}', false),
  ('federal-college-of-education-umunze', 'Federal College of Education (Technical), Umunze', 'FCET Umunze', 'college', 'AN', 'Umunze', '{}', false),
  ('nwafor-orizu-college-of-education-nsugbe', 'Nwafor Orizu College of Education, Nsugbe', null, 'college', 'AN', 'Nsugbe', '{}', false),
  ('a-d-rufai-college-of-education-legal-and-general-studies-misau', 'A.D. Rufa''i College of Education, Legal and General Studies, Misau', null, 'college', 'BA', 'Misau', '{}', false),
  ('adamu-tafawa-balewa-college-of-education-kangere', 'Adamu Tafawa Balewa College of Education, Kangere', null, 'college', 'BA', 'Kangere', '{}', false),
  ('aminu-saleh-college-of-education-azare', 'Aminu Saleh College of Education, Azare', null, 'college', 'BA', 'Azare', '{}', false),
  ('college-of-education-katsina-ala', 'College of Education, Katsina-Ala', null, 'college', 'BE', 'Katsina-Ala', '{}', false),
  ('college-of-education-oju', 'College of Education, Oju', null, 'college', 'BE', 'Oju', '{}', false),
  ('college-of-education-waka-biu', 'College of Education, Waka-Biu', null, 'college', 'BO', 'Waka-Biu', '{}', false),
  ('kashim-ibrahim-college-of-education-maiduguri', 'Kashim Ibrahim College of Education, Maiduguri', null, 'college', 'BO', 'Maiduguri', '{}', false),
  ('mohammed-goni-college-of-legal-and-islamic-studies-maiduguri', 'Mohammed Goni College of Legal and Islamic Studies, Maiduguri', null, 'college', 'BO', 'Maiduguri', '{}', false),
  ('college-of-education-akamkpa', 'College of Education, Akamkpa', null, 'college', 'CR', 'Akamkpa', '{}', false),
  ('federal-college-of-education-obudu', 'Federal College of Education, Obudu', 'FCE Obudu', 'college', 'CR', 'Obudu', '{}', false),
  ('college-of-education-warri', 'College of Education, Warri', null, 'college', 'DE', 'Warri', '{}', false),
  ('federal-college-of-education-asaba', 'Federal College of Education (Technical), Asaba', 'FCET Asaba', 'college', 'DE', 'Asaba', '{}', false),
  ('ebonyi-state-college-of-education-ikwo', 'Ebonyi State College of Education, Ikwo', null, 'college', 'EB', 'Ikwo', '{}', false),
  ('college-of-education-ekiadolor', 'College of Education, Ekiadolor', null, 'college', 'ED', 'Ekiadolor', '{}', false),
  ('enugu-state-college-of-education-enugu', 'Enugu State College of Education (Technical), Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('federal-college-of-education-eha-amufu', 'Federal College of Education, Eha-Amufu', 'FCE Eha-Amufu', 'college', 'EN', 'Eha-Amufu', '{}', false),
  ('fct-college-of-education-zuba', 'FCT College of Education, Zuba', null, 'college', 'FC', 'Zuba', '{}', false),
  ('college-of-education-billiri', 'College of Education, Billiri', null, 'college', 'GO', 'Billiri', '{}', false),
  ('federal-college-of-education-gombe', 'Federal College of Education (Technical), Gombe', 'FCET Gombe', 'college', 'GO', 'Gombe', '{}', false),
  ('bilyaminu-othman-college-of-education-dutse', 'Bilyaminu Othman College of Education, Dutse', null, 'college', 'JI', 'Dutse', '{}', false),
  ('jigawa-state-college-of-education-and-legal-studies-ringim', 'Jigawa State College of Education and Legal Studies, Ringim', null, 'college', 'JI', 'Ringim', '{}', false),
  ('jigawa-state-college-of-education-gumel', 'Jigawa State College of Education, Gumel', null, 'college', 'JI', 'Gumel', '{}', false),
  ('kaduna-state-college-of-education-gidan-waya', 'Kaduna State College of Education, Gidan Waya', null, 'college', 'KD', 'Gidan Waya', '{}', false),
  ('adamu-augie-college-of-education-argungu', 'Adamu Augie College of Education, Argungu', null, 'college', 'KE', 'Argungu', '{}', false),
  ('federal-college-of-education-bichi', 'Federal College of Education (Technical), Bichi', 'FCET Bichi', 'college', 'KN', 'Bichi', '{}', false),
  ('saadatu-rimi-college-of-education-kumbotso', 'Sa''adatu Rimi College of Education, Kumbotso', null, 'college', 'KN', 'Kumbotso', '{}', false),
  ('federal-college-of-education-okene', 'Federal College of Education, Okene', 'FCE Okene', 'college', 'KO', 'Okene', '{}', false),
  ('kogi-state-college-of-education-kabba', 'Kogi State College of Education (Technical), Kabba', null, 'college', 'KO', 'Kabba', '{}', false),
  ('kogi-state-college-of-education-ankpa', 'Kogi State College of Education, Ankpa', null, 'college', 'KO', 'Ankpa', '{}', false),
  ('federal-college-of-education-katsina', 'Federal College of Education, Katsina', 'FCE Katsina', 'college', 'KT', 'Katsina', '{}', false),
  ('isa-kaita-college-of-education-dutsin-ma', 'Isa Kaita College of Education, Dutsin-Ma', null, 'college', 'KT', 'Dutsin-Ma', '{}', false),
  ('yusuf-bala-usman-college-of-legal-and-general-studies-daura', 'Yusuf Bala Usman College of Legal and General Studies, Daura', null, 'college', 'KT', 'Daura', '{}', false),
  ('kwara-state-college-of-education-lafiagi', 'Kwara State College of Education (Technical), Lafiagi', null, 'college', 'KW', 'Lafiagi', '{}', false),
  ('kwara-state-college-of-education-ilorin', 'Kwara State College of Education, Ilorin', null, 'college', 'KW', 'Ilorin', '{}', false),
  ('kwara-state-college-of-education-oro', 'Kwara State College of Education, Oro', null, 'college', 'KW', 'Oro', '{}', false),
  ('michael-otedola-college-of-primary-education-noforija-epe', 'Michael Otedola College of Primary Education, Noforija-Epe', 'MOCPED', 'college', 'LA', 'Noforija, Epe', '{}', false),
  ('college-of-education-akwanga', 'College of Education, Akwanga', null, 'college', 'NA', 'Akwanga', '{}', false),
  ('niger-state-college-of-education-minna', 'Niger State College of Education, Minna', null, 'college', 'NI', 'Minna', '{}', false),
  ('federal-college-of-education-osiele-abeokuta', 'Federal College of Education, Osiele, Abeokuta', 'FCE Osiele', 'college', 'OG', 'Osiele, Abeokuta', '{}', false),
  ('federal-college-of-education-iwo', 'Federal College of Education, Iwo', 'FCE Iwo', 'college', 'OS', 'Iwo', '{}', false),
  ('osun-state-college-of-education-ilesa', 'Osun State College of Education, Ilesa', null, 'college', 'OS', 'Ilesa', '{}', false),
  ('college-of-education-lanlate', 'College of Education, Lanlate', null, 'college', 'OY', 'Lanlate', '{}', false),
  ('federal-college-of-education-oyo', 'Federal College of Education (Special), Oyo', 'FCE Special Oyo', 'college', 'OY', 'Oyo', '{}', false),
  ('college-of-education-gindiri', 'College of Education, Gindiri', null, 'college', 'PL', 'Gindiri', '{}', false),
  ('federal-college-of-education-omoku', 'Federal College of Education (Technical), Omoku', 'FCET Omoku', 'college', 'RI', 'Omoku', '{}', false),
  ('shehu-shagari-college-of-education-sokoto', 'Shehu Shagari College of Education, Sokoto', null, 'college', 'SO', 'Sokoto', '{}', false),
  ('college-of-education-and-legal-studies-nguru', 'College of Education and Legal Studies, Nguru', null, 'college', 'YO', 'Nguru', '{}', false),
  ('federal-college-of-education-potiskum', 'Federal College of Education (Technical), Potiskum', 'FCET Potiskum', 'college', 'YO', 'Potiskum', '{}', false),
  ('umar-suleiman-college-of-education-gashua', 'Umar Suleiman College of Education, Gashua', null, 'college', 'YO', 'Gashua', '{}', false),
  ('federal-college-of-education-gusau', 'Federal College of Education (Technical), Gusau', 'FCET Gusau', 'college', 'ZA', 'Gusau', '{}', false),
  ('zamfara-state-college-of-education-maru', 'Zamfara State College of Education, Maru', null, 'college', 'ZA', 'Maru', '{}', false)
on conflict (slug) do nothing;

do $check$
declare
  have int;
begin
  select count(*) into have from public.institutions;
  -- 55 from roommates_5 plus 490 here; allow 10 for rows staff removed or renamed.
  if have < 535 then
    raise exception 'schools directory incomplete: % rows, expected at least 535', have;
  end if;
end
$check$;

-- ==================================================================== PART 7 of 8: Schools directory: 239 more (nursing schools, colleges, polytechnics)  (from roommates_schools_more_2026-11-10.sql)
-- VALLO ROOMMATES: MORE SCHOOLS (10 November 2026).
--
-- Adds 239 institutions to public.institutions that the first directory left out:
-- 194 colleges (nursing and midwifery colleges, private colleges of education),
-- 23 polytechnics (private polytechnics the first list could not place),
-- 20 schools of nursing and midwifery, 2 universities
-- (the Wikipedia-only ones the NUC page does not list).
--
-- DEPENDS ON roommates_5_institutions.sql AND roommates_schools_full_list_2026-11-10.sql
-- being applied first (it skips any slug they already created, and the final check
-- counts their rows too). Not run against live or a local copy.
--
-- Sources, all read on 10 November 2026:
--   Nursing and midwifery: Nursing and Midwifery Council of Nigeria, "Updated list of
--   approved colleges of nursing and departments of nursing with their accreditation
--   status, December 2025" (nmcn.gov.ng/docs/New_List_of_Approved_Schools_Dec_2025.pdf).
--   Schools with accreditation withdrawn, departments inside a university, and entries
--   whose name could not be read cleanly from the PDF layout were left out.
--   Private polytechnics and private colleges of education: Wikipedia, List of
--   polytechnics in Nigeria and List of colleges of education in Nigeria (private
--   colleges table), the rows the first list could not place.
--   Universities: Wikipedia, List of universities in Nigeria.
--   NBTE (nbte.gov.ng) and NCCE (ncceonline.edu.ng) were tried: the NBTE institution
--   list page is not published and the NCCE site is not reachable from our network, so
--   neither could be a name list.
--
-- Rules as before: additive, on conflict (slug) do nothing, so staff edits and earlier
-- rows are never overwritten; safe to run twice. State codes follow public.states
-- (Kebbi is KE). kind is only from the table's check (university, polytechnic, college,
-- other). short_name is null because no acronym students use was confirmed. Email
-- domains are empty and email_verify_on false except where the school's own home page
-- was fetched on 10 November 2026 and named the school (see
-- docs/handoff/SCHOOLS_DIRECTORY_SOURCES.md). Everything was checked by script for
-- duplicate slugs, names and (short name, state) against all 545 earlier rows.

insert into public.institutions (slug, name, short_name, kind, state_code, city, email_domains, email_verify_on) values
  ('al-hikma-polytechnic-karu', 'Al-Hikma Polytechnic, Karu', null, 'polytechnic', 'NA', 'Karu', '{alhikma.edu.ng}', true),
  ('allover-central-polytechnic-sango-ota', 'Allover Central Polytechnic, Sango-Ota', null, 'polytechnic', 'OG', 'Sango-Ota', '{}', false),
  ('ashi-polytechnic-anyin', 'Ashi Polytechnic, Anyin', null, 'polytechnic', 'BE', 'Anyin', '{}', false),
  ('edward-olaseni-polytechnic-akoko', 'Edward Olaseni Polytechnic, Akoko', null, 'polytechnic', 'ON', 'Akoko', '{}', false),
  ('fidei-polytechnic-gboko', 'Fidei Polytechnic, Gboko', null, 'polytechnic', 'BE', 'Gboko', '{}', false),
  ('gloryland-polytechnic-ankpa', 'Gloryland Polytechnic, Ankpa', null, 'polytechnic', 'KO', 'Ankpa', '{}', false),
  ('grace-polytechnic-surulere', 'Grace Polytechnic, Surulere', null, 'polytechnic', 'LA', 'Surulere', '{}', false),
  ('graceland-polytechnic-offa', 'Graceland Polytechnic, Offa', null, 'polytechnic', 'KW', 'Offa', '{}', false),
  ('harry-pass-polytechnic-mkar', 'Harry Pass Polytechnic, Mkar', null, 'polytechnic', 'BE', 'Mkar', '{}', false),
  ('hope-polytechnic-ikono', 'Hope Polytechnic, Ikono', null, 'polytechnic', 'AK', 'Ikono', '{}', false),
  ('lagos-city-polytechnic-ikeja', 'Lagos City Polytechnic, Ikeja', null, 'polytechnic', 'LA', 'Ikeja', '{}', false),
  ('lighthouse-polytechnic-orhionmwon', 'Lighthouse Polytechnic, Orhionmwon', null, 'polytechnic', 'ED', 'Orhionmwon', '{}', false),
  ('marist-polytechnic-enugu', 'Marist Polytechnic, Enugu', null, 'polytechnic', 'EN', 'Enugu', '{}', false),
  ('nogak-polytechnic-ikom', 'NOGAK Polytechnic, Ikom', null, 'polytechnic', 'CR', 'Ikom', '{}', false),
  ('novelty-polytechnic-kishi', 'Novelty Polytechnic, Kishi', null, 'polytechnic', 'OY', 'Kishi', '{}', false),
  ('odaji-agbo-polytechnic-ayeko-yala', 'Odaji Agbo Polytechnic, Ayeko-Yala', null, 'polytechnic', 'CR', 'Ayeko-Yala', '{}', false),
  ('prime-polytechnic-ajaokuta', 'Prime Polytechnic, Ajaokuta', null, 'polytechnic', 'KO', 'Ajaokuta', '{}', false),
  ('raindrops-institute-of-management-and-technology-orsu', 'Raindrops Institute of Management and Technology, Orsu', null, 'polytechnic', 'IM', 'Orsu', '{}', false),
  ('the-polytechnic-adoka', 'The Polytechnic, Adoka', null, 'polytechnic', 'BE', 'Adoka', '{}', false),
  ('ultra-excellence-polytechnic-ikono', 'Ultra Excellence Polytechnic, Ikono', null, 'polytechnic', 'AK', 'Ikono', '{}', false),
  ('unique-college-of-management-and-technology-ikotun', 'Unique College of Management and Technology, Ikotun', null, 'polytechnic', 'LA', 'Ikotun', '{}', false),
  ('villanova-polytechnic-obokun', 'Villanova Polytechnic, Obokun', null, 'polytechnic', 'OS', 'Obokun', '{}', false),
  ('westland-polytechnic-ilobu', 'Westland Polytechnic, Ilobu', null, 'polytechnic', 'OS', 'Ilobu', '{}', false),
  ('a-b-na-ibi-college-of-nursing-sciences-lau', 'A.B Na’ibi College of Nursing Sciences, Lau', null, 'college', 'TA', 'Lau', '{}', false),
  ('piaget-college-of-education-abeokuta', 'Piaget College of Education, Abeokuta', null, 'college', 'OG', 'Abeokuta', '{}', false),
  ('st-augustine-college-of-education-akoka', 'St. Augustine College of Education, Akoka', null, 'college', 'LA', 'Akoka', '{}', false),
  ('delar-college-of-education-ibadan', 'Delar College of Education, Ibadan', null, 'college', 'OY', 'Ibadan', '{}', false),
  ('yewa-central-college-of-education-ayetoro', 'Yewa Central College of Education, Ayetoro', null, 'college', 'OG', 'Ayetoro', '{}', false),
  ('institute-of-ecumenical-education-thinkers-corner-enugu', 'Institute of Ecumenical Education, Thinkers Corner, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('ansar-ud-deen-college-of-education-isolo', 'Ansar-Ud-Deen College of Education, Isolo', null, 'college', 'LA', 'Isolo', '{}', false),
  ('african-thinkers-community-of-inquiry-college-of-education-enugu', 'African Thinkers Community of Inquiry College of Education, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('city-college-of-education-mararaba', 'City College of Education, Mararaba', null, 'college', 'NA', 'Mararaba Gurku', '{}', false),
  ('muftau-olanihun-college-of-education-ibadan', 'Muftau Olanihun College of Education, Ibadan', null, 'college', 'OY', 'Ibadan', '{}', false),
  ('havard-wilson-college-of-education-aba', 'Havard Wilson College of Education, Aba', null, 'college', 'AB', 'Aba', '{}', false),
  ('college-of-education-ilemona', 'College of Education, Ilemona', null, 'college', 'KW', 'Ilemona', '{}', false),
  ('nigerian-army-school-of-education-ilorin', 'Nigerian Army School of Education, Ilorin', null, 'college', 'KW', 'Ilorin', '{}', false),
  ('nana-aishat-memorial-college-of-education-ilorin', 'Nana Aishat Memorial College of Education, Ilorin', null, 'college', 'KW', 'Ilorin', '{}', false),
  ('ajetunmobi-college-of-education-irra', 'Ajetunmobi College of Education, Irra', null, 'college', 'KW', 'Irra', '{}', false),
  ('college-of-nursing-umuahia', 'College of Nursing, Umuahia', null, 'college', 'AB', 'Umuahia', '{}', false),
  ('college-of-nursing-amachara', 'College of Nursing, Amachara', null, 'college', 'AB', 'Amachara', '{}', false),
  ('school-of-post-basic-midwifery-abiriba', 'School of Post Basic Midwifery, Abiriba', null, 'other', 'AB', 'Abiriba', '{}', false),
  ('archbishop-charles-heerey-memorial-college-of-nursing-science-ogbor-hill-aba', 'Archbishop Charles Heerey Memorial College of Nursing Science, Ogbor-Hill, Aba', null, 'college', 'AB', 'Aba', '{}', false),
  ('college-of-nursing-sciences-obohia-ndoki', 'College of Nursing Sciences, Obohia-Ndoki', null, 'college', 'AB', 'Obohia-Ndoki', '{}', false),
  ('st-anthony-college-of-nursing-sciences-aba', 'St. Anthony College of Nursing Sciences, Aba', null, 'college', 'AB', 'Aba', '{}', false),
  ('janet-frank-college-of-nursing', 'Janet Frank College of Nursing', null, 'college', 'AB', null, '{}', false),
  ('adamawa-state-college-of-nursing-science', 'Adamawa State College of Nursing Science', null, 'college', 'AD', null, '{}', false),
  ('college-of-nursing-sciences-modibbo-adama-university-teaching-hospital-yola', 'College of Nursing Sciences, Modibbo Adama University Teaching Hospital, Yola', null, 'college', 'AD', 'Yola', '{}', false),
  ('college-of-nursing-anua-uyo', 'College of Nursing, Anua, Uyo', null, 'college', 'AK', 'Uyo', '{}', false),
  ('college-of-nursing-eket', 'College of Nursing, Eket', null, 'college', 'AK', 'Eket', '{}', false),
  ('college-of-nursing-ikot-ekpene', 'College of Nursing, Ikot-Ekpene', null, 'college', 'AK', 'Ikot-Ekpene', '{}', false),
  ('college-of-nursing-ituk-mbang', 'College of Nursing, Ituk-Mbang', null, 'college', 'AK', 'Ituk-Mbang', '{}', false),
  ('college-of-nursing-iquita-oron', 'College of Nursing, Iquita-Oron', null, 'college', 'AK', 'Iquita-Oron', '{}', false),
  ('maurid-college-of-nursing', 'Maurid College of Nursing', null, 'college', 'AK', null, '{}', false),
  ('sure-foundation-college-of-nursing-sciences-ikot-akai', 'Sure Foundation College of Nursing Sciences, Ikot Akai', null, 'college', 'AK', 'Ikot Akai', '{}', false),
  ('college-of-nursing-sciences-ihiala', 'College of Nursing Sciences, Ihiala', null, 'college', 'AN', 'Ihiala', '{}', false),
  ('college-of-nursing-sciences-iyi-enu', 'College of Nursing Sciences, Iyi-Enu', null, 'college', 'AN', 'Iyi-Enu', '{}', false),
  ('college-of-nursing-sciences-nnamdi-azikiwe-university-teaching-hospital-nnewi', 'College of Nursing Sciences, Nnamdi Azikiwe University Teaching Hospital, Nnewi', null, 'college', 'AN', 'Nnewi', '{}', false),
  ('college-of-nursing-sciences-adazi-nnukwu', 'College of Nursing Sciences, Adazi-Nnukwu', null, 'college', 'AN', 'Adazi-Nnukwu', '{}', false),
  ('college-of-nursing-sciences-diocesan-hospital-amichi', 'College of Nursing Sciences, Diocesan Hospital, Amichi', null, 'college', 'AN', 'Amichi', '{}', false),
  ('college-of-nursing-st-charles-borromeo-hospital-onitsha', 'College of Nursing, St. Charles Borromeo Hospital, Onitsha', null, 'college', 'AN', 'Onitsha', '{}', false),
  ('millennium-college-of-nursing-sciences-awka', 'Millennium College of Nursing Sciences, Awka', null, 'college', 'AN', 'Awka', '{}', false),
  ('college-of-nursing-sciences-alor', 'College of Nursing Sciences, Alor', null, 'college', 'AN', 'Alor', '{}', false),
  ('margaret-college-of-nursing-sciences-amichi', 'Margaret College of Nursing Sciences, Amichi', null, 'college', 'AN', 'Amichi', '{}', false),
  ('apex-college-of-nursing-sciences-igbo-ukwu', 'Apex College of Nursing Sciences, Igbo-Ukwu', null, 'college', 'AN', 'Igbo-Ukwu', '{}', false),
  ('college-of-nursing-sciences-abubakar-tafawa-balewa-university-teaching-hospital', 'College of Nursing Sciences, Abubakar Tafawa Balewa University Teaching Hospital, Bauchi', null, 'college', 'BA', 'Bauchi', '{}', false),
  ('adamu-adamu-college-of-nursing-sciences-azare', 'Adamu Adamu College of Nursing Sciences, Azare', null, 'college', 'BA', 'Azare', '{}', false),
  ('sa-ad-zungur-college-of-nursing-sciences-dass', 'Sa’ad Zungur College of Nursing Sciences, Dass', null, 'college', 'BA', 'Dass', '{}', false),
  ('al-huda-college-of-nursing-bauchi', 'Al-huda College of Nursing, Bauchi', null, 'college', 'BA', 'Bauchi', '{}', false),
  ('mama-yelwa-college-of-nursing-sciences-misau', 'Mama Yelwa College of Nursing Sciences, Misau', null, 'college', 'BA', 'Misau', '{}', false),
  ('makurdi-college-of-nursing-sciences', 'Makurdi College of Nursing Sciences', null, 'college', 'BE', 'Makurdi', '{}', false),
  ('nkst-college-of-nursing-sciences-mkar', 'NKST College of Nursing Sciences, Mkar', null, 'college', 'BE', 'Mkar', '{}', false),
  ('benue-state-college-of-nursing-sciences-makurdi', 'Benue State College of Nursing Sciences, Makurdi', null, 'college', 'BE', 'Makurdi', '{}', false),
  ('zenith-college-of-nursing-sciences-maiduguri', 'Zenith College of Nursing Sciences, Maiduguri', null, 'college', 'BO', 'Maiduguri', '{}', false),
  ('mustapha-umar-college-of-nursing-sciences-biu', 'Mustapha Umar College of Nursing Sciences, Biu', null, 'college', 'BO', 'Biu', '{}', false),
  ('college-of-nursing-sciences-monguno', 'College of Nursing Sciences, Monguno', null, 'college', 'BO', 'Monguno', '{}', false),
  ('college-of-nursing-sciences-gwoza', 'College of Nursing Sciences, Gwoza', null, 'college', 'BO', 'Gwoza', '{}', false),
  ('cross-river-state-college-of-nursing-sciences', 'Cross River State College of Nursing Sciences', null, 'college', 'CR', null, '{}', false),
  ('college-of-nursing-sciences-itigidi', 'College of Nursing Sciences, Itigidi', null, 'college', 'CR', 'Itigidi', '{}', false),
  ('college-of-nursing-sciences-obudu', 'College of Nursing Sciences, Obudu', null, 'college', 'CR', 'Obudu', '{}', false),
  ('college-of-nursing-sciences-calabar', 'College of Nursing Sciences, Calabar', null, 'college', 'CR', 'Calabar', '{}', false),
  ('school-of-psychiatric-nursing-federal-neuropsychiatric-hospital-calabar', 'School of Psychiatric Nursing, Federal Neuropsychiatric Hospital, Calabar', null, 'other', 'CR', 'Calabar', '{}', false),
  ('delta-state-college-of-nursing-sciences', 'Delta State College of Nursing Sciences', null, 'college', 'DE', null, '{}', false),
  ('college-of-nursing-agbor', 'College of Nursing, Agbor', null, 'college', 'DE', 'Agbor', '{}', false),
  ('college-of-nursing-asaba', 'College of Nursing, Asaba', null, 'college', 'DE', 'Asaba', '{}', false),
  ('college-of-nursing-sapele', 'College of Nursing, Sapele', null, 'college', 'DE', 'Sapele', '{}', false),
  ('college-of-nursing-sciences-eku', 'College of Nursing Sciences, Eku', null, 'college', 'DE', 'Eku', '{}', false),
  ('college-of-nursing-sciences-warri', 'College of Nursing Sciences, Warri', null, 'college', 'DE', 'Warri', '{}', false),
  ('mary-martha-college-of-nursing-sciences-oleh', 'Mary Martha College of Nursing Sciences, Oleh', null, 'college', 'DE', 'Oleh', '{}', false),
  ('anchor-college-of-nursing-sciences-asaba', 'Anchor College of Nursing Sciences, Asaba', null, 'college', 'DE', 'Asaba', '{}', false),
  ('soarstar-college-of-nursing-sciences-abah-unor', 'Soarstar College of Nursing Sciences, Abah-Unor', null, 'college', 'DE', 'Abah-Unor', '{}', false),
  ('lily-college-of-nursing-sciences-warri', 'Lily College of Nursing Sciences, Warri', null, 'college', 'DE', 'Warri', '{}', false),
  ('st-francis-college-of-nursing-sciences-asaba', 'St. Francis College of Nursing Sciences, Asaba', null, 'college', 'DE', 'Asaba', '{}', false),
  ('royal-mira-college-of-nursing-agbor', 'Royal Mira College of Nursing, Agbor', null, 'college', 'DE', 'Agbor', '{}', false),
  ('st-pio-college-of-nursing-asaba', 'St Pio College of Nursing, Asaba', null, 'college', 'DE', 'Asaba', '{}', false),
  ('college-of-nursing-sciences-alex-ekwueme-federal-university-teaching-hospital-ab', 'College of Nursing Sciences, Alex Ekwueme Federal University Teaching Hospital, Abakaliki', null, 'college', 'EB', 'Abakaliki', '{}', false),
  ('college-of-nursing-sciences-afikpo', 'College of Nursing Sciences, Afikpo', null, 'college', 'EB', 'Afikpo', '{}', false),
  ('college-of-nursing-sciences-uburu', 'College of Nursing Sciences, Uburu', null, 'college', 'EB', 'Uburu', '{}', false),
  ('royal-college-of-nursing-sciences', 'Royal College of Nursing Sciences', null, 'college', 'EB', null, '{}', false),
  ('blessed-martins-college-of-nursing-sciences', 'Blessed Martins College of Nursing Sciences', null, 'college', 'EB', null, '{}', false),
  ('eastern-oak-college-of-nursing-sciences-ebonyi', 'Eastern Oak College of Nursing Sciences, Ebonyi', null, 'college', 'EB', 'Ebonyi', '{}', false),
  ('edo-state-college-of-nursing-sciences-benin', 'Edo State College of Nursing Sciences, Benin', null, 'college', 'ED', 'Benin', '{}', false),
  ('college-of-nursing-sciences-university-of-benin-teaching-hospital', 'College of Nursing Sciences, University of Benin Teaching Hospital', null, 'college', 'ED', 'Benin City', '{}', false),
  ('college-of-nursing-sciences-igbinedion-university-teaching-hospital-okada', 'College of Nursing Sciences, Igbinedion University Teaching Hospital, Okada', null, 'college', 'ED', 'Okada', '{}', false),
  ('st-philomenas-college-of-nursing-sciences-benin-city', 'St. Philomenas, College of Nursing Sciences, Benin-City', null, 'college', 'ED', 'Benin-City', '{}', false),
  ('college-of-nursing-sciences-st-camillus-hospital-uromi', 'College of Nursing Sciences, St. Camillus Hospital, Uromi', null, 'college', 'ED', 'Uromi', '{}', false),
  ('school-of-basic-midwifery-zuma-memorial-hospital-irrrua', 'School of Basic Midwifery, Zuma Memorial Hospital, Irrrua', null, 'other', 'ED', 'Irrrua', '{}', false),
  ('sancta-maria-college-of-nursing-sciences-auchi', 'Sancta Maria College of Nursing Sciences, Auchi', null, 'college', 'ED', 'Auchi', '{}', false),
  ('kezia-college-of-nursing-sciences', 'Kezia College of Nursing Sciences', null, 'college', 'ED', null, '{}', false),
  ('st-mathew-college-of-nursing-sciences-irrua', 'St Mathew College of Nursing Sciences, Irrua', null, 'college', 'ED', 'Irrua', '{}', false),
  ('college-of-nursing-sciences-bishop-shanahan-hospital-nsukka', 'College of Nursing Sciences, Bishop Shanahan Hospital, Nsukka', null, 'college', 'EN', 'Nsukka', '{}', false),
  ('enugu-state-college-of-nursing-sciences', 'Enugu State College of Nursing Sciences', null, 'college', 'EN', 'Enugu', '{}', false),
  ('college-of-nursing-sciences-national-orthopaedic-hospital-enugu', 'College of Nursing Sciences, National Orthopaedic Hospital, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('gold-vida-college-of-nursing-sciences-enugu', 'Gold-vida College of Nursing Sciences, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('ezzy-college-of-nursing-sciences', 'Ezzy College of Nursing Sciences', null, 'college', 'EN', null, '{}', false),
  ('la-vera-college-of-nursing-sciences-enugu', 'La-Vera College of Nursing Sciences, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('school-of-psychiatric-nursing-federal-neuropsychiatric-hospital-enugu', 'School of Psychiatric Nursing, Federal Neuropsychiatric Hospital, Enugu', null, 'other', 'EN', 'Enugu', '{}', false),
  ('peaceland-college-of-nursing-sciences-enugu', 'Peaceland College of Nursing Sciences, Enugu', null, 'college', 'EN', 'Enugu', '{}', false),
  ('college-of-nursing-sciences-gombe', 'College of Nursing Sciences, Gombe', null, 'college', 'GO', 'Gombe', '{}', false),
  ('adamu-fura-college-of-nursing-sciences-gombe', 'Adamu Fura College of Nursing Sciences, Gombe', null, 'college', 'GO', 'Gombe', '{}', false),
  ('jewel-college-of-nursing-sciences-gombe', 'Jewel College of Nursing Sciences, Gombe', null, 'college', 'GO', 'Gombe', '{}', false),
  ('college-of-nursing-st-mary-s-joint-hospital-amaigbo', 'College of Nursing, St. Mary’s Joint Hospital, Amaigbo', null, 'college', 'IM', 'Amaigbo', '{}', false),
  ('college-of-nursing-sciences-emekuku', 'College of Nursing Sciences, Emekuku', null, 'college', 'IM', 'Emekuku', '{}', false),
  ('college-of-nursing-sciences-joint-hospital-mbano', 'College of Nursing Sciences, Joint Hospital, Mbano', null, 'college', 'IM', 'Mbano', '{}', false),
  ('college-of-nursing-sciences-our-lady-of-mercy-hospital-umulogho-obowo', 'College of Nursing Sciences, Our Lady of Mercy Hospital, Umulogho Obowo', null, 'college', 'IM', 'Umulogho Obowo', '{}', false),
  ('imo-state-college-of-nursing-sciences-orlu', 'Imo State College of Nursing Sciences, Orlu', null, 'college', 'IM', 'Orlu', '{}', false),
  ('ezeala-college-of-nursing-umuseke-okwudor-njaba', 'Ezeala College of Nursing, Umuseke Okwudor, Njaba', null, 'college', 'IM', 'Njaba', '{}', false),
  ('merit-college-of-nursing-sciences-orlu', 'Merit College of Nursing Sciences, Orlu', null, 'college', 'IM', 'Orlu', '{}', false),
  ('school-of-basic-midwifery-aboh-mbaise', 'School of Basic Midwifery, Aboh Mbaise', null, 'other', 'IM', 'Aboh Mbaise', '{}', false),
  ('school-of-post-basic-midwifery-awo-omamma', 'School of Post Basic Midwifery, Awo-Omamma', null, 'other', 'IM', 'Awo-Omamma', '{}', false),
  ('princess-college-of-nursing-sciences-mgbirichi', 'Princess College of Nursing Sciences, Mgbirichi', null, 'college', 'IM', 'Mgbirichi', '{}', false),
  ('international-christian-college-of-nursing-sciences-owerri', 'International Christian College of Nursing Sciences, Owerri', null, 'college', 'IM', 'Owerri', '{}', false),
  ('st-joseph-college-of-nursing-sciences-mbaise', 'St. Joseph College of Nursing Sciences, Mbaise', null, 'college', 'IM', 'Mbaise', '{}', false),
  ('kings-college-of-nursing-sciences-owerri', 'Kings College of Nursing Sciences, Owerri', null, 'college', 'IM', 'Owerri', '{}', false),
  ('college-of-nursing-sciences-hadejia', 'College of Nursing Sciences, Hadejia', null, 'college', 'JI', 'Hadejia', '{}', false),
  ('iqra-college-of-nursing-sciences-dutse', 'Iqra College of Nursing Sciences, Dutse', null, 'college', 'JI', 'Dutse', '{}', false),
  ('college-of-nursing-sciences-babura', 'College of Nursing Sciences, Babura', null, 'college', 'JI', 'Babura', '{}', false),
  ('college-of-nursing-sciences-kazaure', 'College of Nursing Sciences, Kazaure', null, 'college', 'JI', 'Kazaure', '{}', false),
  ('ameenatu-college-of-nursing-sciences', 'Ameenatu College of Nursing Sciences', null, 'college', 'JI', null, '{}', false),
  ('belba-college-of-nursing-sciences', 'Belba College of Nursing Sciences', null, 'college', 'JI', null, '{}', false),
  ('college-of-nursing-sciences-st-gerard-s-catholic-hospital-kakuri-kaduna', 'College of Nursing Sciences, St. Gerard’s Catholic Hospital, Kakuri, Kaduna', null, 'college', 'KD', 'Kaduna', '{}', false),
  ('college-of-nursing-sciences-st-luke-s-anglican-hospital-wusasa-zaria', 'College of Nursing Sciences, St. Luke’s Anglican Hospital, Wusasa, Zaria', null, 'college', 'KD', 'Zaria', '{}', false),
  ('college-of-nursing-sciences-st-louis-hospital-zonkwa', 'College of Nursing Sciences, St. Louis Hospital, Zonkwa', null, 'college', 'KD', 'Zonkwa', '{}', false),
  ('college-of-nursing-sciences-ahmadu-bello-university-teaching-hospital-zaria', 'College of Nursing Sciences, Ahmadu Bello University Teaching Hospital, Zaria', null, 'college', 'KD', 'Zaria', '{}', false),
  ('school-of-psychiatric-nursing-federal-neuropsychiatric-hospital-barnawa-kaduna', 'School of Psychiatric Nursing, Federal Neuropsychiatric Hospital, Barnawa, Kaduna', null, 'other', 'KD', 'Kaduna', '{}', false),
  ('nigerian-air-force-college-of-nursing-sciences-air-force-base-kaduna', 'Nigerian Air Force College of Nursing Sciences, Air Force Base, Kaduna', null, 'college', 'KD', 'Kaduna', '{}', false),
  ('al-madinah-college-of-nursing-sciences-zaria', 'Al-Madinah College of Nursing Sciences, Zaria', null, 'college', 'KD', 'Zaria', '{}', false),
  ('muhammad-bn-el-barau-college-of-nursing-sciences-zaria', 'Muhammad Bn El-barau College of Nursing Sciences, Zaria', null, 'college', 'KD', 'Zaria', '{}', false),
  ('nana-fatima-umar-college-of-nursing-sciences', 'Nana Fatima Umar College of Nursing Sciences', null, 'college', 'KD', null, '{}', false),
  ('dankoli-abdulrashid-college-of-nursing-kaduna', 'Dankoli Abdulrashid College of Nursing, Kaduna', null, 'college', 'KD', 'Kaduna', '{}', false),
  ('college-of-nursing-sciences-kano', 'College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('nafisatu-college-of-nursing-sciences-kwankwaso', 'Nafisatu College of Nursing Sciences, Kwankwaso', null, 'college', 'KN', 'Kwankwaso', '{}', false),
  ('dansharif-college-of-nursing-sciences-kano', 'Dansharif College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('aminu-dabo-college-of-nursing-sciences-kano', 'Aminu Dabo College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('emirate-college-of-nursing-sciences-kano', 'Emirate College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('hamdala-college-of-nursing-science-kano', 'Hamdala College of Nursing Science, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('sudawa-college-of-nursing-sciences', 'Sudawa College of Nursing Sciences', null, 'college', 'KN', null, '{}', false),
  ('flagship-college-of-nursing-sciences-kano', 'Flagship College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('iman-college-of-nursing-sciences-kano', 'Iman College of Nursing Sciences, Kano', null, 'college', 'KN', 'Kano', '{}', false),
  ('college-of-nursing-sciences-katsina', 'College of Nursing Sciences, Katsina', null, 'college', 'KT', 'Katsina', '{}', false),
  ('cherish-college-of-nursing-sciences-batsari', 'Cherish College of Nursing Sciences, Batsari', null, 'college', 'KT', 'Batsari', '{}', false),
  ('north-west-college-of-nursing-science-katsina', 'North West College of Nursing Science, Katsina', null, 'college', 'KT', 'Katsina', '{}', false),
  ('essemm-college-of-nursing-sciences-katsina', 'EssEMM College of Nursing Sciences, Katsina', null, 'college', 'KT', 'Katsina', '{}', false),
  ('bawo-college-of-nursing-sciences-daura', 'Bawo College of Nursing Sciences, Daura', null, 'college', 'KT', 'Daura', '{}', false),
  ('umar-farouq-bilingual-college-of-nursing-sciences-daura', 'Umar Farouq Bilingual College of Nursing Sciences, Daura', null, 'college', 'KT', 'Daura', '{}', false),
  ('college-of-nursing-sciences-birnin-kebbi', 'College of Nursing Sciences, Birnin-Kebbi', null, 'college', 'KE', 'Birnin-Kebbi', '{}', false),
  ('sajo-college-of-nursing-sciences-birnin-kebbi', 'Sajo College of Nursing Sciences, Birnin-Kebbi', null, 'college', 'KE', 'Birnin-Kebbi', '{}', false),
  ('malami-bunza-college-of-nursing-sciences-birnin-kebbi', 'Malami Bunza College of Nursing Sciences, Birnin-Kebbi', null, 'college', 'KE', 'Birnin-Kebbi', '{}', false),
  ('manga-college-of-nursing-sciences-zuru', 'Manga College of Nursing Sciences, Zuru', null, 'college', 'KE', 'Zuru', '{}', false),
  ('grimard-college-of-nursing-sciences-anyigba', 'Grimard College of Nursing Sciences, Anyigba', null, 'college', 'KO', 'Anyigba', '{}', false),
  ('nana-college-of-nursing-sciences-anyingba', 'Nana College of Nursing Sciences, Anyingba', null, 'college', 'KO', 'Anyingba', '{}', false),
  ('college-of-nursing-sciences-okunland', 'College of Nursing Sciences, Okunland', null, 'college', 'KO', 'Okunland', '{}', false),
  ('college-of-nursing-sciences-ilorin', 'College of Nursing Sciences, Ilorin', null, 'college', 'KW', 'Ilorin', '{}', false),
  ('college-of-nursing-sciences-oke-ode', 'College of Nursing Sciences, Oke-Ode', null, 'college', 'KW', 'Oke-Ode', '{}', false),
  ('heart-savers-college-of-nursing-sciences-ilorin', 'Heart Savers College of Nursing Sciences, Ilorin', null, 'college', 'KW', 'Ilorin', '{}', false),
  ('kwara-state-college-of-health-technology-offa', 'Kwara State College of Health Technology, Offa', null, 'college', 'KW', 'Offa', '{}', false),
  ('lagos-state-college-of-nursing-and-midwifery-igando', 'Lagos State College of Nursing and Midwifery, Igando', null, 'college', 'LA', 'Igando', '{}', false),
  ('nigerian-army-college-of-nursing-yaba', 'Nigerian Army College of Nursing, Yaba', null, 'college', 'LA', 'Yaba', '{}', false),
  ('college-of-nursing-sciences-lagos-university-teaching-hospital-idi-araba', 'College of Nursing Sciences, Lagos University Teaching Hospital, Idi-Araba', null, 'college', 'LA', 'Idi-Araba', '{}', false),
  ('college-of-nursing-sciences-national-orthopaedic-hospital-igbobi', 'College of Nursing Sciences, National Orthopaedic Hospital, Igbobi', null, 'college', 'LA', 'Igbobi', '{}', false),
  ('school-of-psychiatric-nursing-federal-neuropsychiatric-hospital-yaba', 'School of Psychiatric Nursing, Federal Neuropsychiatric Hospital, Yaba', null, 'other', 'LA', 'Yaba', '{}', false),
  ('unique-college-of-nursing-sciences', 'Unique College of Nursing Sciences', null, 'college', 'LA', null, '{}', false),
  ('college-of-nursing-sciences-lafia', 'College of Nursing Sciences, Lafia', null, 'college', 'NA', 'Lafia', '{}', false),
  ('kariyoma-college-of-nursing-sciences-lafia', 'Kariyoma College of Nursing Sciences, Lafia', null, 'college', 'NA', 'Lafia', '{}', false),
  ('niger-state-college-of-nursing-sciences-minna', 'Niger State College of Nursing Sciences, Minna', null, 'college', 'NI', 'Minna', '{}', false),
  ('dako-college-of-nursing-and-midwifery-suleja', 'Dako College of Nursing and Midwifery, Suleja', null, 'college', 'NI', 'Suleja', '{}', false),
  ('standard-college-of-nursing-minna', 'Standard College of Nursing, Minna', null, 'college', 'NI', 'Minna', '{}', false),
  ('galaxy-college-of-nursing-minna', 'Galaxy College of Nursing, Minna', null, 'college', 'NI', 'Minna', '{}', false),
  ('school-of-nursing-abeokuta', 'School of Nursing, Abeokuta', null, 'other', 'OG', 'Abeokuta', '{}', false),
  ('school-of-nursing-ijebu-ode', 'School of Nursing, Ijebu-Ode', null, 'other', 'OG', 'Ijebu-Ode', '{}', false),
  ('school-of-nursing-ilaro', 'School of Nursing, Ilaro', null, 'other', 'OG', 'Ilaro', '{}', false),
  ('oba-ademola-ii-school-of-basic-midwifery-abeokuta', 'Oba Ademola II School of Basic Midwifery, Abeokuta', null, 'other', 'OG', 'Abeokuta', '{}', false),
  ('school-of-basic-midwifery-ijebu-ode', 'School of Basic Midwifery, Ijebu-Ode', null, 'other', 'OG', 'Ijebu-Ode', '{}', false),
  ('chep-college-of-nursing-sciences-ota', 'Chep College of Nursing Sciences, Ota', null, 'college', 'OG', 'Ota', '{}', false),
  ('achievers-college-of-nursing-sciences-owo', 'Achievers College of Nursing Sciences, Owo', null, 'college', 'ON', 'Owo', '{}', false),
  ('college-of-nursing-sciences-obafemi-awolowo-university-teaching-hospitals-comple', 'College of Nursing Sciences, Obafemi Awolowo University Teaching Hospitals Complex', null, 'college', 'OS', 'Ile-Ife', '{}', false),
  ('school-of-nursing-osogbo', 'School of Nursing, Osogbo', null, 'other', 'OS', 'Osogbo', '{}', false),
  ('school-of-nursing-seventh-day-adventist-hospital-ile-ife', 'School of Nursing, Seventh Day Adventist Hospital, Ile-Ife', null, 'other', 'OS', 'Ile-Ife', '{}', false),
  ('mercy-college-of-nursing-ido-osun-osogbo', 'Mercy College of Nursing, Ido-Osun, Osogbo', null, 'college', 'OS', 'Osogbo', '{}', false),
  ('premier-college-of-nursing-sciences-ejigbo', 'Premier College of Nursing Sciences, Ejigbo', null, 'college', 'OS', 'Ejigbo', '{}', false),
  ('college-of-nursing-baptist-medical-centre-saki', 'College of Nursing, Baptist Medical Centre, Saki', null, 'college', 'OY', 'Saki', '{}', false),
  ('school-of-nursing-bowen-university-teaching-hospital-ogbomosho', 'School of Nursing, Bowen University Teaching Hospital, Ogbomosho', null, 'other', 'OY', 'Ogbomosho', '{}', false),
  ('oyo-state-college-of-nursing-sciences', 'Oyo State College of Nursing Sciences', null, 'college', 'OY', null, '{}', false),
  ('college-of-nursing-sciences-saki', 'College of Nursing Sciences, Saki', null, 'college', 'OY', 'Saki', '{}', false),
  ('oluyoro-catholic-college-of-nursing-sciences-ibadan', 'Oluyoro Catholic College of Nursing Sciences, Ibadan', null, 'college', 'OY', 'Ibadan', '{}', false),
  ('college-of-nursing-sciences-lautech-teaching-hospital-ogbomoso', 'College of Nursing Sciences, LAUTECH Teaching Hospital, Ogbomoso', null, 'college', 'OY', 'Ogbomoso', '{}', false),
  ('adeniyi-college-of-nursing-sciences-igbope', 'Adeniyi College of Nursing Sciences, Igbope', null, 'college', 'OY', 'Igbope', '{}', false),
  ('college-of-nursing-sciences-our-lady-of-apostles-hospital-jos', 'College of Nursing Sciences Our Lady of Apostles Hospital, Jos', null, 'college', 'PL', 'Jos', '{}', false),
  ('hill-college-of-nursing-science-jos', 'Hill College of Nursing Science, Jos', null, 'college', 'PL', 'Jos', '{}', false),
  ('jibape-memorial-college-of-nursing-sciences-jengre', 'Jibape Memorial College of Nursing Sciences, Jengre', null, 'college', 'PL', 'Jengre', '{}', false),
  ('adventist-college-of-nursing-sciences-jengre', 'Adventist College of Nursing Sciences, Jengre', null, 'college', 'PL', 'Jengre', '{}', false),
  ('florence-nightingale-college-of-nursing-jos', 'Florence Nightingale College of Nursing, Jos', null, 'college', 'PL', 'Jos', '{}', false),
  ('rivers-state-college-of-nursing-sciences-port-harcourt', 'Rivers State College of Nursing Sciences, Port Harcourt', null, 'college', 'RI', 'Port Harcourt', '{}', false),
  ('college-of-nursing-sciences-university-of-port-harcourt-teaching-hospital', 'College of Nursing Sciences, University of Port Harcourt Teaching Hospital', null, 'college', 'RI', 'Port Harcourt', '{}', false),
  ('yitzhak-college-of-nursing-sciences-port-harcourt', 'Yitzhak College of Nursing Sciences, Port Harcourt', null, 'college', 'RI', 'Port Harcourt', '{}', false),
  ('gateway-college-of-nursing-sciences-port-harcourt', 'Gateway College of Nursing Sciences, Port Harcourt', null, 'college', 'RI', 'Port Harcourt', '{}', false),
  ('st-anna-college-of-nursing-port-harcourt', 'St Anna College of Nursing, Port Harcourt', null, 'college', 'RI', 'Port Harcourt', '{}', false),
  ('college-of-nursing-science-sokoto', 'College of Nursing Science, Sokoto', null, 'college', 'SO', 'Sokoto', '{}', false),
  ('college-of-nursing-sciences-tambuwal', 'College of Nursing Sciences, Tambuwal', null, 'college', 'SO', 'Tambuwal', '{}', false),
  ('school-of-psychiatric-nursing-federal-neuropsychiatric-hospital-kware', 'School of Psychiatric Nursing, Federal Neuropsychiatric Hospital, Kware', null, 'other', 'SO', 'Kware', '{}', false),
  ('fatima-college-of-nursing-sciences-sifawa', 'Fatima College of Nursing Sciences, Sifawa', null, 'college', 'SO', 'Sifawa', '{}', false),
  ('gamji-college-of-nursing-sciences-kware', 'Gamji College of Nursing Sciences, Kware', null, 'college', 'SO', 'Kware', '{}', false),
  ('school-of-basic-midwifery-jalingo', 'School of Basic Midwifery, Jalingo', null, 'other', 'TA', 'Jalingo', '{}', false),
  ('ideal-college-of-nursing-sciences-jalingo', 'Ideal College of Nursing Sciences, Jalingo', null, 'college', 'TA', 'Jalingo', '{}', false),
  ('college-of-nursing-sciences-damaturu', 'College of Nursing Sciences, Damaturu', null, 'college', 'YO', 'Damaturu', '{}', false),
  ('college-of-nursing-sciences-federal-medical-centre-nguru', 'College of Nursing Sciences, Federal Medical Centre, Nguru', null, 'college', 'YO', 'Nguru', '{}', false),
  ('school-of-nursing-gusau', 'School of Nursing, Gusau', null, 'other', 'ZA', 'Gusau', '{}', false),
  ('school-of-basic-midwifery-gusau', 'School of Basic Midwifery, Gusau', null, 'other', 'ZA', 'Gusau', '{}', false),
  ('umar-bin-khaddabi-college-of-nursing-sciences-kaura-namoda', 'Umar Bin Khaddabi College of Nursing Sciences, Kaura, Namoda', null, 'college', 'ZA', 'Namoda', '{}', false),
  ('ummul-khair-college-of-nursing-sciences', 'Ummul-Khair College of Nursing Sciences', null, 'college', 'ZA', null, '{}', false),
  ('ba-illa-college-of-nursing-sciences-kaura-namoda', 'Ba’illa College of Nursing Sciences, Kaura-Namoda', null, 'college', 'ZA', 'Kaura-Namoda', '{}', false),
  ('fct-college-of-nursing-sciences-gwagwalada', 'FCT College of Nursing Sciences, Gwagwalada', null, 'college', 'FC', 'Gwagwalada', '{}', false),
  ('unity-college-of-nursing-sciences-bwari', 'Unity College of Nursing Sciences, Bwari', null, 'college', 'FC', 'Bwari', '{}', false),
  ('yagongwo-college-of-nursing-sciences-kuje', 'Yagongwo College of Nursing Sciences, Kuje', null, 'college', 'FC', 'Kuje', '{}', false),
  ('horizon-college-of-nursing-sciences', 'Horizon College of Nursing Sciences', null, 'college', 'FC', null, '{}', false),
  ('sahad-college-of-nursing-sciences-abuja', 'Sahad College of Nursing Sciences, Abuja', null, 'college', 'FC', 'Abuja', '{}', false),
  ('oasis-college-of-nursing-sciences-kuje', 'Oasis College of Nursing Sciences, Kuje', null, 'college', 'FC', 'Kuje', '{}', false),
  ('college-of-nursing-sciences-jahi', 'College of Nursing Sciences, Jahi', null, 'college', 'FC', 'Jahi', '{}', false),
  ('cetep-city-university-yaba', 'CETEP City University, Yaba', null, 'university', 'LA', 'Yaba', '{}', false),
  ('khadija-university-majia', 'Khadija University, Majia', null, 'university', 'JI', 'Majia', '{}', false)
on conflict (slug) do nothing;

do $check$
declare
  have int;
begin
  select count(*) into have from public.institutions;
  -- 545 earlier rows plus 239 here; allow 10 for rows staff removed or renamed.
  if have < 774 then
    raise exception 'more schools incomplete: % rows, expected at least 774', have;
  end if;
end
$check$;

-- ==================================================================== PART 8 of 8: School logos, aliases and the updated school read function  (from institutions_logos_and_aliases_2026-11-10.sql)
-- VALLO ROOMMATES: SCHOOL LOGOS AND SEARCH ALIASES (10 November 2026).
--
-- DEPENDS ON roommates_5_institutions.sql, roommates_schools_full_list_2026-11-10.sql and
-- roommates_schools_more_2026-11-10.sql being applied first (logos and aliases are set by
-- slug, so a school that is not there yet is simply skipped, and a later run fills it).
-- Not run against live or a local copy. Additive and safe to run twice.
--
-- 1. Three new columns on public.institutions: logo_url, logo_source, aliases.
--    The table's grants (select to anon and authenticated, staff-only write through
--    RLS, roommates_1_core.sql) are table level, so the new columns are readable exactly
--    like the existing ones and no grant changes.
-- 2. 27 logos, found on the English Wikipedia article for each school (the file
--    its page uses for the logo, seal or crest), recorded as a 128px thumbnail on
--    upload.wikimedia.org and the file's description page as logo_source. Each address
--    was fetched on 10 November 2026 and answered HTTP 200 with an image content type.
--    Schools with no verified logo keep logo_url null and the app draws a neutral
--    school icon. Never overwrites a logo staff set (where logo_url is null).
--    LICENSING: a school's logo is its trademark. Recording the address to identify the
--    school in a picker is ordinary use, but many of these files are non-free and hosted
--    on en.wikipedia, not Commons, with their own file page terms. The founder should
--    review licensing, and may prefer to copy the files into a Vallo storage bucket and
--    repoint logo_url (the app's image policy already trusts the Vallo bucket).
-- 3. 41 schools get aliases people type ('OAU Ife', 'Unilag Akoka', 'FUTA Akure',
--    'Poly Ibadan', 'Ife', 'Ibadan'). Existing aliases are kept; new ones are added.
-- 4. private.rm_institution (the small institution object inside roommate and room
--    cards) is replaced with create or replace to add logoUrl; same signature, so its
--    grants stay.

alter table public.institutions
  add column if not exists logo_url text check (logo_url is null or (logo_url like 'https://%' and char_length(logo_url) <= 500)),
  add column if not exists logo_source text check (logo_source is null or (logo_source like 'https://%' and char_length(logo_source) <= 500)),
  add column if not exists aliases text[] not null default '{}' check (cardinality(aliases) <= 20);

create or replace function private.rm_institution(p_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'name', i.name, 'shortName', i.short_name, 'kind', i.kind, 'stateCode', i.state_code, 'city', i.city, 'logoUrl', i.logo_url)
    from public.institutions i where i.id = p_id;
$$;

update public.institutions i
   set logo_url = v.logo_url, logo_source = v.logo_source
  from (values
  ('abia-state-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Abia_State_University_logo.svg/120px-Abia_State_University_logo.svg.png', 'https://en.wikipedia.org/wiki/File:Abia_State_University_logo.svg'),
  ('abubakar-tafawa-balewa-university-bauchi', 'https://upload.wikimedia.org/wikipedia/en/6/6e/Abubakar_Tafawa_Balewa_University_%28crest%29.png', 'https://en.wikipedia.org/wiki/File:Abubakar_Tafawa_Balewa_University_(crest).png'),
  ('adeleke-university-ede', 'https://upload.wikimedia.org/wikipedia/en/0/04/Logo_of_Adeleke_University.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Adeleke_University.png'),
  ('ahmadu-bello-university', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/ABU_Zaria_logo.jpg/120px-ABU_Zaria_logo.jpg', 'https://commons.wikimedia.org/wiki/File:ABU_Zaria_logo.jpg'),
  ('akwa-ibom-state-university-ikot-akpaden', 'https://upload.wikimedia.org/wikipedia/en/1/1f/Akwa_Ibom_State_University_Logo.jpg', 'https://en.wikipedia.org/wiki/File:Akwa_Ibom_State_University_Logo.jpg'),
  ('babcock-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ea/Babcock_University_Logo.jpg/120px-Babcock_University_Logo.jpg', 'https://en.wikipedia.org/wiki/File:Babcock_University_Logo.jpg'),
  ('bayero-university-kano', 'https://upload.wikimedia.org/wikipedia/en/0/04/Bayerouniversitylogo.jpg', 'https://en.wikipedia.org/wiki/File:Bayerouniversitylogo.jpg'),
  ('baze-university', 'https://upload.wikimedia.org/wikipedia/en/d/d9/Logo_of_Baze_University_Abuja%2C_Nigeri.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Baze_University_Abuja%2C_Nigeri.png'),
  ('clifford-university-owerrinta', 'https://upload.wikimedia.org/wikipedia/en/0/0a/Logo_of_Clifford_University.jpg', 'https://en.wikipedia.org/wiki/File:Logo_of_Clifford_University.jpg'),
  ('federal-college-of-education-technical-akoka', 'https://upload.wikimedia.org/wikipedia/en/2/28/FCE%2C_Akoka_logo.png', 'https://en.wikipedia.org/wiki/File:FCE,_Akoka_logo.png'),
  ('federal-polytechnic-offa', 'https://upload.wikimedia.org/wikipedia/en/9/9d/Federal_Polytechnic%2C_Offa_%28logo%29.png', 'https://en.wikipedia.org/wiki/File:Federal_Polytechnic,_Offa_(logo).png'),
  ('federal-university-of-agriculture-abeokuta', 'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/FUNAAB_Logo.jpg/120px-FUNAAB_Logo.jpg', 'https://en.wikipedia.org/wiki/File:FUNAAB_Logo.jpg'),
  ('federal-university-of-technology-owerri', 'https://upload.wikimedia.org/wikipedia/en/thumb/1/16/FUTO_logo.png/120px-FUTO_logo.png', 'https://en.wikipedia.org/wiki/File:FUTO_logo.png'),
  ('glorious-vision-university-ogwa', 'https://upload.wikimedia.org/wikipedia/en/8/8e/Samuel_Adegboyega_University_%28emblem%29.png', 'https://en.wikipedia.org/wiki/File:Samuel_Adegboyega_University_(emblem).png'),
  ('godfrey-okoye-university-enugu', 'https://upload.wikimedia.org/wikipedia/en/a/ab/GOUniversity_logo.jpg', 'https://en.wikipedia.org/wiki/File:GOUniversity_logo.jpg'),
  ('kwara-state-polytechnic', 'https://upload.wikimedia.org/wikipedia/en/thumb/3/32/Kwara_State_Polytechnic_%28logo%29.jpg/120px-Kwara_State_Polytechnic_%28logo%29.jpg', 'https://en.wikipedia.org/wiki/File:Kwara_State_Polytechnic_%28logo%29.jpg'),
  ('lagos-state-university', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Lagos_State_University_logo.png/120px-Lagos_State_University_logo.png', 'https://commons.wikimedia.org/wiki/File:Lagos_State_University_logo.png'),
  ('mcpherson-university-seriki-sotayo', 'https://upload.wikimedia.org/wikipedia/en/a/a8/The_McPherson_University_logo.png', 'https://en.wikipedia.org/wiki/File:The_McPherson_University_logo.png'),
  ('michael-okpara-university-of-agriculture', 'https://upload.wikimedia.org/wikipedia/en/5/5a/Moua_logo.jpg', 'https://en.wikipedia.org/wiki/File:Moua_logo.jpg'),
  ('nile-university-of-nigeria', 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Logo_of_Nile_University_Abuja_Nigeria.svg/120px-Logo_of_Nile_University_Abuja_Nigeria.svg.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Nile_University_Abuja_Nigeria.svg'),
  ('nnamdi-azikiwe-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Badge_of_Nnamdi_Azikiwe_University.png/120px-Badge_of_Nnamdi_Azikiwe_University.png', 'https://en.wikipedia.org/wiki/File:Badge_of_Nnamdi_Azikiwe_University.png'),
  ('pan-atlantic-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/6/66/Logo_of_Pan-Atlantic_University.png/120px-Logo_of_Pan-Atlantic_University.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Pan-Atlantic_University.png'),
  ('paul-university-awka', 'https://upload.wikimedia.org/wikipedia/en/2/25/Paul_University%2C_Awka_school_logo.jpg', 'https://en.wikipedia.org/wiki/File:Paul_University,_Awka_school_logo.jpg'),
  ('renaissance-university-enugu', 'https://upload.wikimedia.org/wikipedia/en/8/8b/Renaissance_University_logo.png', 'https://en.wikipedia.org/wiki/File:Renaissance_University_logo.png'),
  ('university-of-abuja', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ec/Logo_of_the_University_of_Abuja%2C_Nigeria.png/120px-Logo_of_the_University_of_Abuja%2C_Nigeria.png', 'https://en.wikipedia.org/wiki/File:Logo_of_the_University_of_Abuja%2C_Nigeria.png'),
  ('university-of-ibadan', 'https://upload.wikimedia.org/wikipedia/en/7/7e/University_of_Ibadan_logo.jpeg', 'https://en.wikipedia.org/wiki/File:University_of_Ibadan_logo.jpeg'),
  ('university-of-jos', 'https://upload.wikimedia.org/wikipedia/en/e/ef/University_of_Jos_logo.jpg', 'https://en.wikipedia.org/wiki/File:University_of_Jos_logo.jpg')
  ) as v(slug, logo_url, logo_source)
 where i.slug = v.slug and i.logo_url is null;

update public.institutions i
   set aliases = (select coalesce(array_agg(distinct a), '{}') from unnest(i.aliases || v.aliases) as a)
  from (values
  ('abubakar-tafawa-balewa-university-bauchi', array['ATBU Bauchi', 'Tafawa Balewa University']::text[]),
  ('afe-babalola-university-ado-ekiti', array['ABUAD Ado-Ekiti']::text[]),
  ('ahmadu-bello-university', array['ABU Zaria', 'Zaria']::text[]),
  ('ambrose-alli-university', array['AAU Ekpoma', 'Ekpoma']::text[]),
  ('auchi-polytechnic', array['Auchi']::text[]),
  ('bayero-university-kano', array['BUK Kano']::text[]),
  ('covenant-university', array['CU Ota', 'Covenant Ota']::text[]),
  ('delta-state-university', array['DELSU Abraka', 'Abraka']::text[]),
  ('ekiti-state-university', array['EKSU Ado-Ekiti', 'Ado Ekiti']::text[]),
  ('federal-polytechnic-ilaro', array['Fedpolyilaro']::text[]),
  ('federal-polytechnic-nekede', array['Nekede', 'Fedpolynekede']::text[]),
  ('federal-university-of-agriculture-abeokuta', array['FUNAAB Abeokuta', 'Abeokuta']::text[]),
  ('federal-university-of-petroleum-resources-effurun', array['FUPRE Effurun', 'Effurun']::text[]),
  ('federal-university-of-technology-akure', array['FUTA Akure', 'Akure']::text[]),
  ('federal-university-of-technology-minna', array['FUT Minna', 'Gidan Kwano']::text[]),
  ('federal-university-of-technology-owerri', array['FUT Owerri']::text[]),
  ('federal-university-oye-ekiti', array['FUOYE Oye']::text[]),
  ('joseph-ayo-babalola-university-ikeji-arakeji', array['JABU Ikeji']::text[]),
  ('kwara-state-polytechnic', array['Kwarapoly']::text[]),
  ('ladoke-akintola-university-of-technology', array['LAUTECH Ogbomoso', 'Ogbomoso', 'Ladoke Akintola']::text[]),
  ('lagos-state-university', array['LASU Ojo', 'Ojo']::text[]),
  ('michael-okpara-university-of-agriculture', array['MOUAU Umudike', 'Umudike']::text[]),
  ('moshood-abiola-polytechnic-abeokuta', array['MAPOLY Abeokuta']::text[]),
  ('nigerian-defence-academy', array['NDA Kaduna']::text[]),
  ('nnamdi-azikiwe-university', array['Unizik Awka', 'Awka', 'Nnamdi Azikiwe']::text[]),
  ('obafemi-awolowo-university', array['OAU Ife', 'Ife', 'Ile-Ife', 'Awolowo University', 'Obafemi Awolowo']::text[]),
  ('olabisi-onabanjo-university', array['OOU Ago-Iwoye', 'Ago Iwoye']::text[]),
  ('olusegun-agagu-university-of-science-and-technology-okitipupa', array['OAUSTECH Okitipupa', 'Okitipupa']::text[]),
  ('redeemers-university-ede', array['RUN Ede', 'Redeemers']::text[]),
  ('rivers-state-university', array['RSU Port Harcourt', 'Rivers State University of Science and Technology']::text[]),
  ('the-polytechnic-ibadan', array['Ibadan Poly', 'Ibadan Polytechnic', 'Poly Ibadan']::text[]),
  ('university-of-benin', array['UNIBEN Benin', 'Ugbowo', 'Benin University']::text[]),
  ('university-of-calabar', array['Unical Calabar']::text[]),
  ('university-of-ibadan', array['Ibadan', 'UI Ibadan', 'Ibadan University']::text[]),
  ('university-of-ilorin', array['Unilorin Ilorin']::text[]),
  ('university-of-lagos', array['Unilag Akoka', 'Lagos University', 'Akoka']::text[]),
  ('university-of-maiduguri', array['Unimaid']::text[]),
  ('university-of-nigeria-nsukka', array['UNN Nsukka', 'Nsukka']::text[]),
  ('university-of-port-harcourt', array['Uniport Choba', 'UPH', 'Choba']::text[]),
  ('usmanu-danfodiyo-university', array['UDUS Sokoto', 'Sokoto University', 'UDU']::text[]),
  ('yaba-college-of-technology', array['Yaba Tech', 'Yaba Poly']::text[])
  ) as v(slug, aliases)
 where i.slug = v.slug and not (i.aliases @> v.aliases);

do $check$
declare
  bad int;
begin
  select count(*) into bad from public.institutions where logo_url is not null and logo_url not like 'https://%';
  if bad > 0 then
    raise exception 'logo_url must be https: % rows are not', bad;
  end if;
end
$check$;

-- ==================================================================== CHECK (read this row after running)
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name in
     ('staff_tasks','staff_task_comments','staff_announcements','staff_announcement_reads',
      'social_posts','bd_prospects','bd_prospect_activity','coo_escalations',
      'staff_access_recommendations','staff_weekly_reports'))                                         as new_tables_expect_10,
  (select count(*) from storage.buckets where id in ('social-media-library','staff-report-proofs'))  as new_buckets_expect_2,
  (select count(*) from public.institutions)                                                         as schools_total_expect_about_784,
  (select count(*) from public.institutions where logo_url is not null)                              as schools_with_logo_expect_27;

commit;
