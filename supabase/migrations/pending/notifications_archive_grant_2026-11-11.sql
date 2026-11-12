-- ACTIVITY CENTRE: ARCHIVING HAS NEVER WORKED, AND TWO THINGS BESIDE IT.
--
-- Backend audit, 11 November 2026. Safe to run twice. No row is changed.
--
-- All three come from one migration, `20261108115654_notification_archive.sql`,
-- and all three were confirmed against the live database before this was
-- written (read only: has_column_privilege, pg_policies, pg_proc.proconfig).
--
-- 1. ARCHIVING IS REFUSED FOR EVERY MEMBER, EVERY TIME.
--
--    That migration added `notifications.archived_at` and says in its own
--    comment: "the existing update policy grants the owner write access to
--    read_at only. Widen it to include archived_at". An RLS policy has no
--    column granularity; the column restriction is a GRANT, and the grant was
--    never widened. Live today:
--
--      has_column_privilege('authenticated','public.notifications','read_at','UPDATE')      -> true
--      has_column_privilege('authenticated','public.notifications','archived_at','UPDATE')  -> false
--
--    `archiveNotifications`, `archiveAllNotifications` and
--    `unarchiveNotifications` (apps/web/src/lib/notify/centre-actions.ts) all
--    write `archived_at` through the member's own RLS client, so Postgres
--    refuses each one with 42501. The Activity Centre's Archive and Archive
--    all buttons (app/(app)/notifications/LiveNotifications.tsx) remove the
--    row on screen, get the refusal, put it back and show an error banner.
--    Marking read still works, because that column IS granted, which is why
--    this never looked like a dead feature.
--
--    AND THE TABLE SAYS SO ITSELF. On 11 November 2026 the live database held
--    268 notifications and exactly 0 with `archived_at` set. Not one archive
--    has ever succeeded, which is the same kind of proof the wallet incident
--    turned on: a table that has never received the row proves the write was
--    never made, rather than made and lost.
--
-- 2. THE UPDATE POLICY LOST ITS INITPLAN.
--
--    The same migration dropped and recreated `notifications_update_own` with
--    a bare `user_id = auth.uid()`. The two policies it did not touch read
--    `(select auth.uid()) = user_id`, which Postgres evaluates once per
--    statement; the bare form is evaluated once per candidate row. "Archive
--    all" is a single UPDATE across a member's whole unarchived inbox, which
--    is exactly the shape that pays for it. This is the Supabase advisor's
--    only `auth_rls_initplan` warning on the project. The predicate is
--    unchanged.
--
-- 3. `notification_category_counts` HAS A MUTABLE SEARCH PATH.
--
--    Created in the same migration with no `set search_path`, which is the
--    advisor's only `function_search_path_mutable` warning. It is SECURITY
--    INVOKER, so this is hardening and house style rather than a hole: every
--    other function on this project is pinned. The body is unchanged except
--    for schema-qualifying what it reads, which an empty search path needs.

set lock_timeout = '5s';

begin;

-- 1. The column the member is allowed to write when they archive. Nothing
--    else is added: the table-level UPDATE grant stays absent, so a member
--    still cannot touch a title, a body or another person's row, and the
--    policy still binds every statement to their own rows.
grant update (archived_at) on table public.notifications to authenticated;

-- 2. Evaluate auth.uid() once per statement, as the other two policies do.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Pin the search path. Same rows, same order, same counts.
create or replace function public.notification_category_counts()
returns table (kind public.notification_kind, total bigint, unread bigint)
language sql
stable
set search_path = ''
as $$
  select
    n.kind,
    count(*)::bigint as total,
    count(*) filter (where n.read_at is null)::bigint as unread
  from public.notifications n
  where n.user_id = (select auth.uid())
    and n.archived_at is null
  group by n.kind
  order by count(*) desc;
$$;

commit;

-- Verification, read only.
--   select has_column_privilege('authenticated','public.notifications','archived_at','UPDATE');
--     -- expect true
--   select policyname, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename = 'notifications';
--     -- expect all three to read (select auth.uid())
--   select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'notification_category_counts';
--     -- expect {"search_path="}
