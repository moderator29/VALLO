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
