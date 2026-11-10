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
