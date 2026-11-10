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
