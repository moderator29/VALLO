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
