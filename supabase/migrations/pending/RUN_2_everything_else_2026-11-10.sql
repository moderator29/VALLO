-- RUN 2 OF 2. Run RUN_1 first and let it finish. One paste, one Run.
-- Includes the Payluk removal (drops an empty table; aborts if it has rows).

-- ===== staff_roles_step2_2026-11-10.sql =====
-- STAFF ROLES, STEP 2 OF 2: FOUR NEW POSITIONS AND THEIR DESKS' TABLES
-- (founder, 10 November 2026). Marketing Manager, Content Manager, Technical
-- Administrator, Customer Support Lead.
--
-- NOT APPLIED. STEP 1 (`staff_roles_step1_enum_2026-11-10.sql`) MUST HAVE BEEN
-- RUN AND FINISHED BEFORE THIS FILE: the four new `staff_scope` values it adds
-- are used below, and a new enum value is usable only after it has committed.
-- Also depends on `staff_business_dev_social_media_2026-11-10.sql` (the
-- position check and the three private functions this file replaces).
--
-- This follows the Business Development and Social Media step exactly: a super
-- admin grants a position, which sets a scope bundle; nothing here changes who
-- may grant it or how. Every existing position and scope keeps its exact
-- title, bundle and words (copied unchanged below); only the four new ones are
-- added.
--
--   marketing_manager        -> marketing
--   content_manager          -> content
--   technical_administrator  -> technical
--   customer_support_lead    -> support, support_lead
--
-- THE TABLES (all additive). Every reference to auth.users is nullable with
-- ON DELETE SET NULL, and no check requires a user id to stay non-null, so
-- deleting an account never deletes or blocks a record. RLS is admin and super
-- admin only through private.has_role((select auth.uid()), ...), the
-- social_posts_2026-11-10.sql shape (never private.staff_can inside a policy);
-- the people who hold the new scopes reach the tables through the service
-- client requireAdmin hands out, and every server action re-checks scope and
-- ownership itself. No delete grant anywhere: a result is voided, an incident
-- is resolved, a note is retired.
--
--   marketing_campaigns, marketing_campaign_results   (/admin/marketing)
--   content_items                                     (/admin/content)
--   tech_incidents, tech_incident_updates             (/admin/technical)
--   support_qa_reviews, support_policy_notes          (/admin/support-lead)
--   staff_desk_entries  (the smaller tools of all four desks: segment and
--     market notes, creative briefs, A/B test log, monthly reports; content
--     requests, style notes, SEO and publishing checklists, translation
--     status, staff announcement drafts; runbooks, on-call notes, release
--     notes, status page drafts, expiry reminders, post-incident reviews;
--     macros, rota notes, escalation matrix rows, coaching notes, knowledge
--     base gaps). One row shape, a `desk` and a `kind`, validated per kind by
--     the app; a small closed `fields` object holds the kind's own fields.
--
-- No secret, key, credential or platform token is stored by any of them.

begin;
set local lock_timeout = '5s';

-- ------------------------------------------------------------ positions

alter table public.staff_grants drop constraint if exists staff_grants_position_known;
alter table public.staff_grants add constraint staff_grants_position_known check (
  position is null or position in (
    'moderator', 'support_agent', 'kyc_reviewer', 'listings_reviewer', 'agreements_officer',
    'trust_safety_lead', 'compliance_officer', 'finance_officer', 'operations_manager',
    'cfo', 'coo', 'ceo', 'business_development_executive', 'social_media_manager',
    'marketing_manager', 'content_manager', 'technical_administrator', 'customer_support_lead'));

create or replace function private.staff_position_title(p_position text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_position
    when 'moderator' then 'Moderator'
    when 'support_agent' then 'Support Agent'
    when 'kyc_reviewer' then 'KYC Reviewer'
    when 'listings_reviewer' then 'Listings Reviewer'
    when 'agreements_officer' then 'Agreements Officer'
    when 'trust_safety_lead' then 'Head of Trust and Safety'
    when 'compliance_officer' then 'Compliance Officer'
    when 'finance_officer' then 'Finance Officer'
    when 'operations_manager' then 'Operations Manager'
    when 'cfo' then 'Chief Financial Officer'
    when 'coo' then 'Chief Operating Officer'
    when 'ceo' then 'Chief Executive Officer'
    when 'business_development_executive' then 'Business Development Director'
    when 'social_media_manager' then 'Social Media Manager'
    when 'marketing_manager' then 'Marketing Manager'
    when 'content_manager' then 'Content Manager'
    when 'technical_administrator' then 'Technical Administrator'
    when 'customer_support_lead' then 'Customer Support Lead'
  end;
$function$;

create or replace function private.staff_position_scopes(p_position text)
returns public.staff_scope[]
language sql
immutable
set search_path to ''
as $function$
  select case p_position
    when 'moderator' then array['moderation']::public.staff_scope[]
    when 'support_agent' then array['support']::public.staff_scope[]
    when 'kyc_reviewer' then array['kyc_review']::public.staff_scope[]
    when 'listings_reviewer' then array['listing_approval']::public.staff_scope[]
    when 'agreements_officer' then array['agreements', 'guarantee']::public.staff_scope[]
    when 'trust_safety_lead' then array['listing_approval', 'kyc_review', 'moderation', 'support']::public.staff_scope[]
    when 'compliance_officer' then array['kyc_review', 'compliance']::public.staff_scope[]
    when 'finance_officer' then array['guarantee', 'finance']::public.staff_scope[]
    when 'operations_manager' then array['support', 'agreements', 'operations']::public.staff_scope[]
    when 'cfo' then array['agreements', 'guarantee', 'finance', 'compliance']::public.staff_scope[]
    when 'coo' then array['listing_approval', 'moderation', 'support', 'agreements', 'operations']::public.staff_scope[]
    when 'ceo' then array['listing_approval', 'kyc_review', 'moderation', 'support', 'agreements', 'guarantee',
                          'finance', 'compliance', 'operations']::public.staff_scope[]
    when 'business_development_executive' then array['business_development', 'listing_approval']::public.staff_scope[]
    when 'social_media_manager' then array['social_media']::public.staff_scope[]
    when 'marketing_manager' then array['marketing']::public.staff_scope[]
    when 'content_manager' then array['content']::public.staff_scope[]
    when 'technical_administrator' then array['technical']::public.staff_scope[]
    when 'customer_support_lead' then array['support', 'support_lead']::public.staff_scope[]
  end;
$function$;

create or replace function private.staff_scope_words(p_scopes public.staff_scope[])
returns text
language sql
immutable
set search_path to ''
as $function$
  select string_agg(case s
      when 'listing_approval' then 'Listing approval'
      when 'kyc_review' then 'KYC review'
      when 'moderation' then 'Reports and moderation'
      when 'support' then 'Support'
      when 'agreements' then 'Agreement approval'
      when 'guarantee' then 'Guarantee claims'
      when 'finance' then 'Finance'
      when 'compliance' then 'Compliance'
      when 'operations' then 'Operations'
      when 'trust_safety' then 'Trust and Safety'
      when 'roommates' then 'Roommates moderation'
      when 'circle' then 'Circle moderation'
      when 'analyst' then 'Read-only analyst'
      when 'business_development' then 'Business development'
      when 'social_media' then 'Social media'
      when 'marketing' then 'Marketing'
      when 'content' then 'Content'
      when 'technical' then 'Technical'
      when 'support_lead' then 'Support lead'
    end, ', ' order by s)
  from unnest(p_scopes) s;
$function$;

revoke all on function private.staff_position_title(text) from public, anon, authenticated;
revoke all on function private.staff_position_scopes(text) from public, anon, authenticated;
revoke all on function private.staff_scope_words(public.staff_scope[]) from public, anon, authenticated;

-- ------------------------------------------------------------ shared trigger

create or replace function private.staff_desks_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- ------------------------------------------------------------ marketing

create table if not exists public.marketing_campaigns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  objective      text not null default '',
  channel        text not null default 'other',
  audience       text not null default '',
  starts_on      date,
  ends_on        date,
  budget_kobo    bigint,
  status         text not null default 'draft',
  approval       text not null default 'none',
  approval_note  text,
  approved_by    uuid references auth.users (id) on delete set null,
  approved_at    timestamptz,
  owner_id       uuid references auth.users (id) on delete set null,
  utm_base       text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  notes          text not null default '',
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint marketing_campaigns_name_len check (char_length(btrim(name)) between 1 and 140),
  constraint marketing_campaigns_objective_len check (char_length(objective) <= 1000),
  constraint marketing_campaigns_audience_len check (char_length(audience) <= 500),
  constraint marketing_campaigns_notes_len check (char_length(notes) <= 4000),
  constraint marketing_campaigns_channel_check check (channel in
    ('social', 'email', 'sms', 'referral', 'partnership', 'events', 'paid', 'other')),
  constraint marketing_campaigns_status_check check (status in
    ('draft', 'planned', 'live', 'paused', 'ended', 'cancelled')),
  constraint marketing_campaigns_approval_check check (approval in
    ('none', 'submitted', 'approved', 'sent_back')),
  constraint marketing_campaigns_budget_check check (budget_kobo is null or budget_kobo >= 0),
  constraint marketing_campaigns_dates_check check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint marketing_campaigns_approved_pair check (approved_by is null or approved_at is not null),
  constraint marketing_campaigns_utm_len check (
    coalesce(char_length(utm_base), 0) <= 300 and coalesce(char_length(utm_source), 0) <= 80
    and coalesce(char_length(utm_medium), 0) <= 80 and coalesce(char_length(utm_campaign), 0) <= 120
    and coalesce(char_length(utm_content), 0) <= 120 and coalesce(char_length(utm_term), 0) <= 120)
);
comment on table public.marketing_campaigns is
  'The Marketing Manager''s campaigns: plan, UTM tags, budget (kobo, visible to the marketing desk and admins only) and the approval record. Planning only; no ad platform is connected.';
create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns (status, starts_on);
create index if not exists marketing_campaigns_owner_idx on public.marketing_campaigns (owner_id);

create table if not exists public.marketing_campaign_results (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.marketing_campaigns (id) on delete cascade,
  recorded_on  date not null,
  metric       text not null,
  value        numeric not null,
  note         text not null default '',
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id) on delete set null,
  recorded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint marketing_results_metric_check check (metric in
    ('spend_kobo', 'impressions', 'clicks', 'signups', 'listings_created', 'referrals', 'other')),
  constraint marketing_results_value_check check (value >= 0),
  constraint marketing_results_note_len check (char_length(note) <= 500)
);
comment on table public.marketing_campaign_results is
  'Numbers a person logs by hand against a campaign (spend in kobo, clicks, sign-ups and so on). Voided, never deleted.';
create index if not exists marketing_results_campaign_idx on public.marketing_campaign_results (campaign_id, recorded_on);

-- ------------------------------------------------------------ content

create table if not exists public.content_items (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'other',
  title         text not null,
  summary       text not null default '',
  body          text not null default '',
  status        text not null default 'draft',
  planned_for   date,
  owner_id      uuid references auth.users (id) on delete set null,
  approver_id   uuid references auth.users (id) on delete set null,
  approved_at   timestamptz,
  review_note   text,
  link_url      text,
  published_url text,
  published_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint content_items_kind_check check (kind in
    ('guide', 'announcement', 'article', 'brand_asset', 'campaign_copy', 'other')),
  constraint content_items_status_check check (status in
    ('draft', 'in_review', 'approved', 'published', 'retired')),
  constraint content_items_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint content_items_summary_len check (char_length(summary) <= 1000),
  constraint content_items_body_len check (char_length(body) <= 20000),
  constraint content_items_review_note_len check (review_note is null or char_length(review_note) <= 1000),
  constraint content_items_link_len check (link_url is null or char_length(link_url) <= 2000),
  constraint content_items_published_len check (published_url is null or char_length(published_url) <= 2000),
  constraint content_items_approved_pair check (approver_id is null or approved_at is not null),
  constraint content_items_published_needs_approval check (status <> 'published' or (approved_at is not null and published_at is not null))
);
comment on table public.content_items is
  'The Content Manager''s editorial items: guides, announcements, articles, brand notes and campaign copy, with the approval record. Media files live in the social media library; this table holds text and links only.';
create index if not exists content_items_status_idx on public.content_items (status, planned_for);
create index if not exists content_items_kind_idx on public.content_items (kind);

-- ------------------------------------------------------------ technical

create table if not exists public.tech_incidents (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  severity           text not null,
  status             text not null default 'open',
  started_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  summary            text not null default '',
  resolution_summary text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint tech_incidents_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint tech_incidents_severity_check check (severity in ('sev1', 'sev2', 'sev3', 'sev4')),
  constraint tech_incidents_status_check check (status in ('open', 'investigating', 'mitigated', 'resolved')),
  constraint tech_incidents_summary_len check (char_length(summary) <= 4000),
  constraint tech_incidents_resolution_len check (resolution_summary is null or char_length(resolution_summary) <= 4000),
  constraint tech_incidents_resolved_needs_summary check (
    status <> 'resolved' or (resolved_at is not null and resolution_summary is not null and char_length(btrim(resolution_summary)) > 0))
);
comment on table public.tech_incidents is
  'Technical incidents declared by the Technical Administrator: severity, status, timeline and the resolution summary. A record only; it holds no credential, key or log payload.';
create index if not exists tech_incidents_status_idx on public.tech_incidents (status, started_at desc);

create table if not exists public.tech_incident_updates (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references public.tech_incidents (id) on delete cascade,
  body         text not null,
  status_after text,
  author_id    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint tech_incident_updates_body_len check (char_length(btrim(body)) between 1 and 4000),
  constraint tech_incident_updates_status_check check (status_after is null or status_after in ('open', 'investigating', 'mitigated', 'resolved'))
);
create index if not exists tech_incident_updates_incident_idx on public.tech_incident_updates (incident_id, created_at);

-- ------------------------------------------------------------ support lead

create table if not exists public.support_qa_reviews (
  id             uuid primary key default gen_random_uuid(),
  ticket_ref     text not null,
  reviewed_agent uuid references auth.users (id) on delete set null,
  reviewer_id    uuid references auth.users (id) on delete set null,
  tone           smallint not null,
  accuracy       smallint not null,
  speed          smallint not null,
  policy         smallint not null,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  constraint support_qa_ticket_ref_len check (char_length(btrim(ticket_ref)) between 1 and 64),
  constraint support_qa_tone_check check (tone between 1 and 5),
  constraint support_qa_accuracy_check check (accuracy between 1 and 5),
  constraint support_qa_speed_check check (speed between 1 and 5),
  constraint support_qa_policy_check check (policy between 1 and 5),
  constraint support_qa_notes_len check (char_length(notes) <= 2000)
);
comment on table public.support_qa_reviews is
  'Quality reviews of answered tickets by the Customer Support Lead: four scores from 1 to 5. The ticket is named by its reference only; no message text is copied here.';
create index if not exists support_qa_agent_idx on public.support_qa_reviews (reviewed_agent, created_at desc);

create table if not exists public.support_policy_notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  status      text not null default 'draft',
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint support_policy_notes_title_len check (char_length(btrim(title)) between 1 and 160),
  constraint support_policy_notes_body_len check (char_length(body) <= 8000),
  constraint support_policy_notes_status_check check (status in ('draft', 'approved', 'retired')),
  constraint support_policy_notes_approved_pair check (approved_by is null or approved_at is not null),
  constraint support_policy_notes_approved_needs_time check (status <> 'approved' or approved_at is not null)
);
comment on table public.support_policy_notes is
  'Support policy notes: written by the Customer Support Lead, approved by the COO or an admin, read by the support team.';
create index if not exists support_policy_notes_status_idx on public.support_policy_notes (status, updated_at desc);

create table if not exists public.staff_desk_entries (
  id           uuid primary key default gen_random_uuid(),
  desk         text not null,
  kind         text not null,
  title        text not null,
  body         text not null default '',
  status       text not null default 'open',
  due_on       date,
  link_url     text,
  subject_user uuid references auth.users (id) on delete set null,
  fields       jsonb not null default '{}'::jsonb,
  review_note  text,
  approved_by  uuid references auth.users (id) on delete set null,
  approved_at  timestamptz,
  owner_id     uuid references auth.users (id) on delete set null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint staff_desk_entries_desk_check check (desk in ('marketing', 'content', 'technical', 'support_lead')),
  constraint staff_desk_entries_kind_check check (kind ~ '^[a-z][a-z_]{1,39}$'),
  constraint staff_desk_entries_status_check check (status in ('open', 'done', 'draft', 'submitted', 'approved', 'sent_back', 'retired')),
  constraint staff_desk_entries_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint staff_desk_entries_body_len check (char_length(body) <= 20000),
  constraint staff_desk_entries_link_len check (link_url is null or char_length(link_url) <= 2000),
  constraint staff_desk_entries_review_len check (review_note is null or char_length(review_note) <= 1000),
  constraint staff_desk_entries_fields_shape check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) <= 6000),
  constraint staff_desk_entries_approved_pair check (approved_by is null or approved_at is not null)
);
comment on table public.staff_desk_entries is
  'The smaller tools of the Marketing, Content, Technical and Support Lead desks (notes, briefs, checklists, runbooks, reminders, macros, coaching notes). The desk and kind decide what a row means; the app validates each kind. Never holds a secret, a credential, a message from a member or a payment detail.';
create index if not exists staff_desk_entries_desk_idx on public.staff_desk_entries (desk, kind, status, due_on);
create index if not exists staff_desk_entries_subject_idx on public.staff_desk_entries (subject_user) where subject_user is not null;

-- ------------------------------------------------------------ triggers, RLS, grants

do $apply$
declare
  t text;
begin
  foreach t in array array['marketing_campaigns', 'content_items', 'tech_incidents', 'support_policy_notes', 'staff_desk_entries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.staff_desks_touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;

  -- Tables a person may read, add to and change.
  foreach t in array array['marketing_campaigns', 'marketing_campaign_results', 'content_items', 'tech_incidents', 'support_policy_notes', 'staff_desk_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (private.has_role((select auth.uid()), 'admin'::public.app_role)
             or private.has_role((select auth.uid()), 'super_admin'::public.app_role))$p$, t || '_admin_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
                  or private.has_role((select auth.uid()), 'super_admin'::public.app_role))$p$, t || '_admin_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (private.has_role((select auth.uid()), 'admin'::public.app_role)
             or private.has_role((select auth.uid()), 'super_admin'::public.app_role))
      with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
                  or private.has_role((select auth.uid()), 'super_admin'::public.app_role))$p$, t || '_admin_update', t);
  end loop;

  -- Append-only tables: read and add, never change.
  foreach t in array array['tech_incident_updates', 'support_qa_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (private.has_role((select auth.uid()), 'admin'::public.app_role)
             or private.has_role((select auth.uid()), 'super_admin'::public.app_role))$p$, t || '_admin_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
                  or private.has_role((select auth.uid()), 'super_admin'::public.app_role))$p$, t || '_admin_write', t);
  end loop;
end
$apply$;

-- ------------------------------------------------------------ self-checks

do $check$
begin
  if private.staff_position_title('marketing_manager') is distinct from 'Marketing Manager'
     or private.staff_position_title('content_manager') is distinct from 'Content Manager'
     or private.staff_position_title('technical_administrator') is distinct from 'Technical Administrator'
     or private.staff_position_title('customer_support_lead') is distinct from 'Customer Support Lead' then
    raise exception 'staff_roles: a new position title is wrong';
  end if;
  if private.staff_position_scopes('marketing_manager') is distinct from array['marketing']::public.staff_scope[]
     or private.staff_position_scopes('content_manager') is distinct from array['content']::public.staff_scope[]
     or private.staff_position_scopes('technical_administrator') is distinct from array['technical']::public.staff_scope[]
     or private.staff_position_scopes('customer_support_lead') is distinct from array['support', 'support_lead']::public.staff_scope[] then
    raise exception 'staff_roles: a new position bundle is wrong';
  end if;
  -- Every EXISTING bundle is unchanged.
  if private.staff_position_scopes('ceo') is distinct from
     array['listing_approval', 'kyc_review', 'moderation', 'support', 'agreements', 'guarantee',
           'finance', 'compliance', 'operations']::public.staff_scope[]
     or private.staff_position_scopes('business_development_executive') is distinct from
        array['business_development', 'listing_approval']::public.staff_scope[]
     or private.staff_position_scopes('social_media_manager') is distinct from array['social_media']::public.staff_scope[] then
    raise exception 'staff_roles: an existing bundle changed';
  end if;
  if private.staff_scope_words(array['marketing', 'content', 'technical', 'support_lead']::public.staff_scope[])
     is distinct from 'Marketing, Content, Technical, Support lead' then
    raise exception 'staff_roles: scope words wrong';
  end if;
  if (select count(*) from information_schema.tables
       where table_schema = 'public'
         and table_name in ('marketing_campaigns', 'marketing_campaign_results', 'content_items',
                            'tech_incidents', 'tech_incident_updates', 'support_qa_reviews', 'support_policy_notes',
                            'staff_desk_entries')) <> 8 then
    raise exception 'staff_roles: a table is missing';
  end if;
end
$check$;

notify pgrst, 'reload schema';

commit;

-- ===== feed_listing_shares_2026-11-10.sql =====
begin;
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
commit;

-- ===== circle_roommate_card_2026-11-10.sql =====
begin;
-- A ROOMMATES CARD ON A CIRCLE POST (founder, 10 November 2026: "sharing a
-- Roommates link into a Circle"). A member can share a Roommates room post or
-- a person's Roommates profile into a community they belong to; the Circle
-- post carries a small card and a link to the real page.
--
-- NOT APPLIED. Additive only: one nullable column on `public.posts`, one
-- index, two functions and two triggers. Nothing existing is dropped, narrowed
-- or rewritten. Safe to run twice. Depends on `roommates_3_integrations.sql`
-- (APPLIED: it added `posts.roommate_listing_id`, which the room card also
-- sets) and on the Circle core (applied). The app degrades to "Sharing to a
-- Circle is not open yet" until this is run.
--
-- WHAT THE CARD IS. `posts.roommate_card` is a closed jsonb object:
--   { v: 1, kind: 'room' | 'person', ref: <uuid>, title, place, summary }
-- built on the server by `lib/features/circle/roommate-card.ts` from the page
-- the sharer can already see: a room post's title, area and city, kind and
-- price; or a person's FIRST NAME, school and area, and what they are here
-- for. No phone, email, handle, photograph, street address, workplace, gender
-- or budget. The link is built from `ref` at read time and never stored.
--
-- NO auth.users COLUMN. `ref` is an id inside jsonb, not a foreign key, so
-- there is nothing to cascade. The card lives and dies with its post: a
-- removed post is a tombstone (`status = 'REMOVED'`) and is not listed.
--
-- WHY A TRIGGER AND NOT ONLY THE APP. The app builds the card, but a member
-- can call the posts API directly. The guard below refuses a card with an
-- unknown key, a wrong shape, an over-long text, a text that looks like a
-- contact detail (an at sign, a link, a run of seven or more digits), a card
-- outside a community, or a card on a reply. RLS is unchanged:
-- `posts_insert_self` and `circle_place_post` (an active member of a live
-- community) still decide who may post and where, and the content scanner,
-- the rate limits, holds and reports apply to the post exactly as to any
-- other Circle post.

set lock_timeout = '5s';

alter table public.posts add column if not exists roommate_card jsonb;

alter table public.posts drop constraint if exists posts_roommate_card_size;
alter table public.posts add constraint posts_roommate_card_size
  check (roommate_card is null or (jsonb_typeof(roommate_card) = 'object' and pg_column_size(roommate_card) <= 1500));

create index if not exists posts_roommate_card_ref_idx
  on public.posts (author_id, community_id, (roommate_card ->> 'ref'))
  where roommate_card is not null;

-- True when the text carries no contact detail.
create or replace function private.circle_card_text_ok(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
begin
  if p_text is null then return false; end if;
  if p_text ~* '(@|https?:|www\.)' then return false; end if;
  for m in select regexp_matches(p_text, '[0-9][0-9 ().+-]*[0-9]', 'g') loop
    if char_length(regexp_replace(m[1], '[^0-9]', '', 'g')) >= 7 then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.circle_roommate_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if tg_op = 'UPDATE' then
    -- A card is written once with its post. Nobody edits it afterwards.
    if pg_trigger_depth() <= 1 then new.roommate_card := old.roommate_card; end if;
    return new;
  end if;

  if new.roommate_card is null then return new; end if;

  if new.community_id is null or new.parent_id is not null then
    raise exception 'A Roommates card goes on a Circle post, not on a reply or a feed post.' using errcode = 'RM340';
  end if;
  if jsonb_typeof(new.roommate_card) <> 'object' then
    raise exception 'That Roommates card could not be read.' using errcode = 'RM341';
  end if;
  for k in select jsonb_object_keys(new.roommate_card) loop
    if k not in ('v', 'kind', 'ref', 'title', 'place', 'summary') then
      raise exception 'That Roommates card holds more than it may.' using errcode = 'RM342';
    end if;
  end loop;
  if (new.roommate_card ->> 'v') is distinct from '1'
     or (new.roommate_card ->> 'kind') not in ('room', 'person')
     or (new.roommate_card ->> 'ref') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(new.roommate_card -> 'title') <> 'string'
     or jsonb_typeof(new.roommate_card -> 'place') <> 'string'
     or jsonb_typeof(new.roommate_card -> 'summary') <> 'string' then
    raise exception 'That Roommates card could not be read.' using errcode = 'RM341';
  end if;
  if char_length(btrim(new.roommate_card ->> 'title')) = 0
     or char_length(new.roommate_card ->> 'title') > 140
     or char_length(new.roommate_card ->> 'place') > 160
     or char_length(new.roommate_card ->> 'summary') > 200 then
    raise exception 'That Roommates card is too long.' using errcode = 'RM343';
  end if;
  if not (private.circle_card_text_ok(new.roommate_card ->> 'title')
          and private.circle_card_text_ok(new.roommate_card ->> 'place')
          and private.circle_card_text_ok(new.roommate_card ->> 'summary')) then
    raise exception 'A Roommates card never carries contact details.' using errcode = 'RM344';
  end if;
  return new;
end;
$$;

revoke all on function private.circle_card_text_ok(text) from public, anon, authenticated;
revoke all on function private.circle_roommate_card_guard() from public, anon, authenticated;

drop trigger if exists posts_roommate_card_guard on public.posts;
create trigger posts_roommate_card_guard
  before insert or update of roommate_card on public.posts
  for each row execute function private.circle_roommate_card_guard();

-- Self-checks.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'posts' and column_name = 'roommate_card') then
    raise exception 'posts.roommate_card was not added';
  end if;
  if private.circle_card_text_ok('call 08031234567') then raise exception 'phone number was let through'; end if;
  if private.circle_card_text_ok('mail me a@b.co') then raise exception 'email was let through'; end if;
  if not private.circle_card_text_ok('Roommate wanted · ₦1,500,000/year') then raise exception 'a price was refused'; end if;
end $$;
commit;

-- ===== copilot_proposals_2026-11-10.sql =====
begin;
-- THE COPILOT'S SINGLE-USE RECORD (founder, 10 November 2026). One row per
-- confirmed copilot proposal, so that "a confirmed proposal works once" is
-- decided by the database and not by a memory that can be lost.
--
-- NOT APPLIED. Additive only: one new table. Nothing existing is touched,
-- dropped or narrowed. Safe to run twice (every statement is `if not exists`,
-- `create or replace` or `drop ... if exists` before `create`).
--
-- HOW IT IS USED. `app/api/admin/copilot/act/route.ts` calls
-- `confirmProposal` (`lib/admin/copilot/act.ts`), which, BEFORE the desk's
-- own server action runs, inserts one row with the signed proposal's nonce
-- through the service client, as a single atomic statement:
--   insert ... on conflict (nonce) do nothing returning nonce
-- A row back means this call won the claim; no row back means the nonce was
-- already used, so the action does not run. If the claim cannot be recorded
-- at all, the action does not run either (it fails closed). Until this table
-- exists the code falls back to its older guard (in-process memory, a
-- rate-limit counter and an audit-log lookup) and logs that it did.
--
-- NO CONTENT. The row holds the tool name and the action kind only: never the
-- proposal's arguments, never a message body, never anything a person typed.
--
-- RETENTION. A nonce only matters until its proposal expires (15 minutes), so
-- rows older than 7 days carry no protection and may be deleted. The function
-- `private.copilot_proposals_cleanup()` below does that; run it by hand or
-- from a scheduled job, it is not scheduled here.
--
-- RLS. The route reaches this table with the service client. RLS is the same
-- admin-role shape as `social_posts_2026-11-10.sql`: read for an
-- admin or super admin on their own session; no insert, update or delete grant
-- for any signed-in role, no other caller. No `private.staff_can` in a policy.

create table if not exists public.copilot_proposals (
  nonce      text primary key,
  user_id    uuid references auth.users (id) on delete set null,
  tool       text not null,
  action     text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  constraint copilot_proposals_nonce_len check (char_length(nonce) between 8 and 200),
  constraint copilot_proposals_tool_len check (char_length(tool) between 1 and 100),
  constraint copilot_proposals_action_len check (char_length(action) between 1 and 100),
  constraint copilot_proposals_expiry_after_creation check (expires_at >= created_at)
);

comment on table public.copilot_proposals is
  'One row per confirmed copilot proposal, claimed with an atomic insert before the action runs so a proposal works once. Holds the tool and action kind only, never arguments. Rows older than 7 days may be deleted (private.copilot_proposals_cleanup()).';

create index if not exists copilot_proposals_expires_at_idx on public.copilot_proposals (expires_at);
create index if not exists copilot_proposals_user_id_idx on public.copilot_proposals (user_id);

alter table public.copilot_proposals enable row level security;
revoke all on table public.copilot_proposals from public, anon, authenticated;
-- Read only for an admin session. Writes are the service client's alone (no insert grant), so db-06's write allowlist needs no entry.
grant select on table public.copilot_proposals to authenticated;

drop policy if exists copilot_proposals_admin_read on public.copilot_proposals;
create policy copilot_proposals_admin_read on public.copilot_proposals
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists copilot_proposals_admin_insert on public.copilot_proposals;

create or replace function private.copilot_proposals_cleanup()
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  removed integer;
begin
  delete from public.copilot_proposals where created_at < now() - interval '7 days';
  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke all on function private.copilot_proposals_cleanup() from public, anon, authenticated;

-- Self-checks.
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'copilot_proposals' and c.relrowsecurity) then
    raise exception 'copilot_proposals: row level security is not on';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'copilot_proposals') <> 1 then
    raise exception 'copilot_proposals: expected exactly one policy';
  end if;
end $$;
commit;

-- ===== roommates_8_listing_review_2026-11-10.sql =====
-- ROOMMATES 8: A ROOM OFFER GOES LIVE ONLY AFTER REVIEW, AND THE FEED GETS A BUDGET RANGE.
--
-- Founder, 10 Nov 2026: a person can list a house or room for roommates like a
-- normal listing, but it must go through verification and review, and only
-- when APPROVED does it show in the Vallo Roommates feed (never the main feed:
-- roommate_listings is its own table, and the main search reads `listings`).
--
-- ONE SOURCE OF TRUTH: `roommate_listings.status` stays the single state.
-- `live` already means "shown in the Roommates feed", so every existing read
-- (the feed, search, home, campus pages, saved searches, alerts, counts) keeps
-- working untouched; the new states only keep a post OUT of them.
--
--   draft -> submitted -> in_review -> live           (approved: shown in the feed)
--                      \-> changes_requested -> submitted (owner fixes, sends again)
--                      \-> rejected                       (final; the owner may delete it)
--   live -> paused -> live   (resume allowed only while the approval still stands)
--   live + a material edit (rent, address area, city, authority, photos, linked
--   home) -> submitted again, because the post was approved as it was.
--
-- Only `room_offer` posts (a person offering a room in a home) are reviewed:
-- "roommate wanted" and "find together" posts describe people, not a home.
--
-- Additive and safe to run twice. Nullable columns, the one new FK is
-- ON DELETE SET NULL, no new grant (roommate_listings already has
-- select/insert/update/delete for authenticated, and is in the db-06 allowlist).
-- Existing live, paused, filled and expired room offers are grandfathered:
-- approved_at is back-filled from their published date so nothing disappears.

begin;

alter table public.roommate_listings
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_review_note_len' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_review_note_len check (review_note is null or char_length(review_note) <= 1000);
  end if;
end $$;

-- The status check: the review states join the old ones.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.roommate_listings'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%''draft''%''expired''%'
       and conname <> 'roommate_listings_status_v2'
  loop
    execute format('alter table public.roommate_listings drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_status_v2' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_status_v2
      check (status in ('draft', 'submitted', 'in_review', 'changes_requested', 'rejected', 'live', 'paused', 'filled', 'expired', 'removed'));
  end if;
end $$;

-- Back-fill: a room offer that was already public stays approved.
update public.roommate_listings
   set approved_at = coalesce(published_at, created_at)
 where kind = 'room_offer' and approved_at is null and published_at is not null
   and status in ('live', 'paused', 'filled', 'expired');

-- A room offer is never live without an approval on record.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_review_shape' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_review_shape
      check (status <> 'live' or kind <> 'room_offer' or approved_at is not null);
  end if;
end $$;

-- Indexes: the review queue, the owner's list, and the feed's sort with a stable tie-break.
create index if not exists roommate_listings_review_idx on public.roommate_listings (submitted_at) where status in ('submitted', 'in_review');
create index if not exists roommate_listings_feed_idx on public.roommate_listings (published_at desc, id) where status = 'live';
create index if not exists roommate_listings_owner_status_idx on public.roommate_listings (owner_id, status);
create index if not exists roommate_listings_gender_idx on public.roommate_listings (gender_pref) where status = 'live';

-- Members may insert a draft or submit a room offer; only a post that is not a
-- room offer may be inserted already live.
drop policy if exists roommate_listings_owner_insert on public.roommate_listings;
create policy roommate_listings_owner_insert on public.roommate_listings for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and verified_at is null and approved_at is null
    and (status in ('draft', 'submitted') or (status = 'live' and kind <> 'room_offer'))
  );

-- THE OWNER'S RULES, now with the review. Staff (and the database owner) are
-- exempt; everything below binds a member.
create or replace function private.roommate_listing_guard()
returns trigger language plpgsql set search_path to '' as $$
declare
  staff boolean := private.is_staff() or current_user not in ('authenticated', 'anon');
  material boolean := false;
begin
  if tg_op = 'INSERT' and not staff then
    new.verified_at := null;
    new.verified_by := null;
    new.approved_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := null;
    if new.status = 'submitted' then
      if new.kind <> 'room_offer' then
        raise exception 'Only a room offer is sent for review.' using errcode = 'RM203';
      end if;
      new.submitted_at := now();
    elsif new.status = 'live' and new.kind = 'room_offer' then
      raise exception 'A room offer goes live after our team has reviewed it.' using errcode = 'RM203';
    end if;
  end if;

  if tg_op = 'UPDATE' and not staff then
    if old.status = 'removed' then
      raise exception 'This listing was removed by our team and cannot be changed.' using errcode = 'RM201';
    end if;
    if new.status = 'removed' then
      raise exception 'That change is not allowed.' using errcode = 'RM201';
    end if;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
    new.view_count := old.view_count;
    new.interest_count := old.interest_count;
    new.owner_id := old.owner_id;
    -- The review record is staff's.
    new.approved_at := old.approved_at;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.review_note := old.review_note;
    new.submitted_at := old.submitted_at;

    material := new.rent_minor is distinct from old.rent_minor
      or new.listing_id is distinct from old.listing_id or new.authority is distinct from old.authority
      or new.area is distinct from old.area or new.city is distinct from old.city
      or new.photos is distinct from old.photos or new.kind is distinct from old.kind;
    -- A changed room offer loses its verification and its approval: it was checked as it was.
    if material and old.verified_at is not null then
      new.verified_at := null;
      new.verified_by := null;
    end if;
    if material and new.kind = 'room_offer' and old.approved_at is not null then
      new.approved_at := null;
      if new.status = 'live' then
        new.status := 'submitted';
        new.submitted_at := now();
        new.review_note := null;
      end if;
    end if;
    if new.kind = 'room_offer' and old.kind <> 'room_offer' then
      new.approved_at := null;
      if new.status = 'live' then
        new.status := 'submitted';
        new.submitted_at := now();
      end if;
    end if;

    if new.status is distinct from old.status then
      if new.status in ('submitted', 'in_review', 'changes_requested', 'rejected') and new.kind <> 'room_offer' then
        raise exception 'Only a room offer is sent for review.' using errcode = 'RM203';
      end if;
      if new.status in ('in_review', 'changes_requested', 'rejected') then
        raise exception 'That decision belongs to our review team.' using errcode = 'RM203';
      end if;
      if new.status = 'submitted' then
        if old.status not in ('draft', 'changes_requested', 'paused', 'filled', 'expired') then
          raise exception 'This post cannot be sent for review from here.' using errcode = 'RM203';
        end if;
        new.submitted_at := now();
        new.review_note := null;
      end if;
      if new.status = 'live' and new.kind = 'room_offer' and (new.approved_at is null or old.status not in ('paused', 'filled', 'expired')) then
        raise exception 'A room offer goes live after our team has reviewed it.' using errcode = 'RM203';
      end if;
      if old.status = 'rejected' then
        raise exception 'This post was not approved. Make a new post to try again.' using errcode = 'RM203';
      end if;
    end if;
  end if;

  if new.listing_id is not null and (tg_op = 'INSERT' or new.listing_id is distinct from old.listing_id) then
    if not exists (select 1 from public.listings l where l.id = new.listing_id and l.status = 'PUBLISHED') then
      raise exception 'Link a published Vallo listing, or leave it unlinked.' using errcode = 'RM202';
    end if;
  end if;
  if new.status = 'live' and (tg_op = 'INSERT' or old.status <> 'live') then
    new.published_at := coalesce(new.published_at, now());
    new.expires_at := now() + interval '60 days';
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_listings_guard on public.roommate_listings;
create trigger roommate_listings_guard before insert or update on public.roommate_listings
  for each row execute function private.roommate_listing_guard();

-- The owner hears each decision (the notification list, then the push and the
-- email the way every other notice goes).
create or replace function private.roommate_listing_review_notify()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.kind <> 'room_offer' or new.status is not distinct from old.status or old.status not in ('submitted', 'in_review', 'changes_requested') then
    return new;
  end if;
  if new.status = 'in_review' then
    perform private.notify(new.owner_id, 'listing', 'Your room post is being reviewed', new.title, '/roommates/r/' || new.id);
  elsif new.status = 'live' then
    perform private.notify(new.owner_id, 'listing', 'Your room post is live on Roommates', new.title, '/roommates/r/' || new.id);
  elsif new.status = 'changes_requested' then
    perform private.notify(new.owner_id, 'listing', 'Changes needed on your room post', coalesce(new.review_note, new.title), '/roommates/r/' || new.id || '/edit');
  elsif new.status = 'rejected' then
    perform private.notify(new.owner_id, 'listing', 'Your room post was not approved', coalesce(new.review_note, new.title), '/roommates/me');
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_listings_review_notify on public.roommate_listings;
create trigger roommate_listings_review_notify after update of status on public.roommate_listings
  for each row execute function private.roommate_listing_review_notify();

-- THE STAFF QUEUE: what is waiting, oldest first, with what a reviewer needs
-- (who, what authority they declared, how many photos, the linked Vallo home).
-- Reads only the facts on the post; never the owner's phone or email.
create or replace function public.admin_roommate_review_queue(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_status text := nullif(p ->> 'status', '');
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object(
             'id', l.id, 'title', l.title, 'status', l.status, 'kind', l.kind, 'city', l.city, 'area', l.area, 'stateCode', l.state_code,
             'description', l.description, 'rentMinor', l.rent_minor, 'rentPeriod', l.rent_period,
             'authority', l.authority, 'declaredAt', l.authority_declared_at, 'photoCount', cardinality(l.photos), 'photoPaths', to_jsonb(l.photos),
             'linkedListingId', l.listing_id, 'submittedAt', l.submitted_at, 'reviewedAt', l.reviewed_at, 'reviewNote', l.review_note,
             'owner', private.rm_person(l.owner_id),
             'ownerVerified', private.rm_badges(l.owner_id),
             'openCases', (select count(*) from public.moderation_cases c where c.target_type = 'roommate_listing' and c.target_id = l.id::text and c.status not in ('resolved', 'closed'))) x
      from public.roommate_listings l
     where l.kind = 'room_offer'
       and ((f_status is null and l.status in ('submitted', 'in_review', 'changes_requested')) or l.status = f_status)
     order by l.submitted_at asc nulls last, l.created_at asc
     limit lim offset off) t), '[]'::jsonb);
end;
$$;

-- THE DECISION. One function, one transaction, the audit line inside it.
--   claim    submitted -> in_review
--   approve  submitted | in_review -> live (needs the declaration, a rent and three photos; the identity wall is the app's, see lib/verification/lister-identity.ts)
--   changes  submitted | in_review -> changes_requested (the note says what to fix)
--   reject   submitted | in_review | changes_requested -> rejected (the note says why)
create or replace function public.admin_roommate_review_decide(p_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  why text := trim(coalesce(p_note, ''));
  l public.roommate_listings;
  out_status text;
begin
  if not private.case_can(me, 'roommates', 'resolve') then
    raise exception 'Your staff role does not allow this.' using errcode = 'RM401';
  end if;
  select * into l from public.roommate_listings where id = p_id for update;
  if not found or l.kind <> 'room_offer' then
    raise exception 'That post could not be found.' using errcode = 'RM404';
  end if;
  if p_decision = 'claim' then
    if l.status <> 'submitted' then raise exception 'Nothing changed: it may already be in review.' using errcode = 'RM417'; end if;
    out_status := 'in_review';
    update public.roommate_listings set status = 'in_review', reviewed_by = me where id = p_id;
  elsif p_decision = 'approve' then
    if l.status not in ('submitted', 'in_review') then raise exception 'Nothing changed: this post is not waiting for review.' using errcode = 'RM417'; end if;
    if l.authority is null or l.authority_declared_at is null then raise exception 'The owner has not declared the right to offer this home.' using errcode = 'RM410'; end if;
    if l.rent_minor is null then raise exception 'The post has no rent.' using errcode = 'RM410'; end if;
    if cardinality(l.photos) < 3 then raise exception 'A room offer needs at least three photos.' using errcode = 'RM410'; end if;
    out_status := 'live';
    update public.roommate_listings
       set status = 'live', approved_at = now(), reviewed_at = now(), reviewed_by = me, review_note = nullif(why, ''),
           verified_at = coalesce(verified_at, now()), verified_by = coalesce(verified_by, me)
     where id = p_id;
  elsif p_decision in ('changes', 'reject') then
    if char_length(why) < 5 then raise exception 'Tell the owner what to fix, at least five characters.' using errcode = 'RM405'; end if;
    if p_decision = 'changes' and l.status not in ('submitted', 'in_review') then raise exception 'Nothing changed: this post is not waiting for review.' using errcode = 'RM417'; end if;
    if p_decision = 'reject' and l.status not in ('submitted', 'in_review', 'changes_requested') then raise exception 'Nothing changed: this post is not in review.' using errcode = 'RM417'; end if;
    out_status := case when p_decision = 'changes' then 'changes_requested' else 'rejected' end;
    update public.roommate_listings set status = out_status, reviewed_at = now(), reviewed_by = me, review_note = why, approved_at = null where id = p_id;
  else
    raise exception 'That decision does not fit.' using errcode = 'RM408';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'roommates.review.' || p_decision, 'roommate_listing', p_id::text, jsonb_build_object('reason', why, 'to', out_status));
  return out_status;
end;
$$;

revoke all on function public.admin_roommate_review_queue(jsonb) from public, anon;
grant execute on function public.admin_roommate_review_queue(jsonb) to authenticated;
revoke all on function public.admin_roommate_review_decide(uuid, text, text) from public, anon;
grant execute on function public.admin_roommate_review_decide(uuid, text, text) to authenticated;
revoke all on function private.roommate_listing_review_notify() from public, anon, authenticated;

-- THE FEED'S BUDGET RANGE: `minMinor` joins `maxMinor` (both on the monthly equivalent),
-- and `kinds` (an array) lets the feed's "Offering a room" chip ask for two kinds at once.
create or replace function public.roommate_search_listings(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 20), 1), 40);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  f_state text := nullif(p ->> 'stateCode', '');
  f_city text := nullif(p ->> 'city', '');
  f_inst uuid := nullif(p ->> 'institutionId', '')::uuid;
  f_kind text := nullif(p ->> 'kind', '');
  f_kinds text[] := case when jsonb_typeof(p -> 'kinds') = 'array' then array(select jsonb_array_elements_text(p -> 'kinds')) else null end;
  f_max numeric := private.rm_monthly(nullif(p ->> 'maxMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
  f_min numeric := private.rm_monthly(nullif(p ->> 'minMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
  f_by date := nullif(p ->> 'moveBy', '')::date;
  f_room text := nullif(p ->> 'roomType', '');
  f_furn text := nullif(p ->> 'furnished', '');
  f_gender text := nullif(p ->> 'genderPref', '');
  f_verified boolean := coalesce((p ->> 'verifiedOnly')::boolean, false);
  f_linked uuid := nullif(p ->> 'linkedListingId', '')::uuid;
  f_sort text := coalesce(p ->> 'sort', 'newest');
  rows jsonb;
  n integer;
begin
  if me is not null then
    select * into v from public.roommate_profiles where user_id = me;
  end if;
  with pool as (
    select l.id
      from public.roommate_listings l
     where l.status = 'live'
       and (l.expires_at is null or l.expires_at > now())
       and (me is null or not private.blocked_between(me, l.owner_id))
       and (f_state is null or l.state_code = f_state)
       and (f_city is null or lower(l.city) = lower(f_city) or lower(l.area) = lower(f_city))
       and (f_inst is null or l.institution_id = f_inst)
       and (f_kind is null or l.kind = f_kind)
       and (f_kinds is null or l.kind = any(f_kinds))
       and (f_max is null or private.rm_monthly(coalesce(l.share_minor, l.rent_minor), l.rent_period) <= f_max)
       and (f_min is null or private.rm_monthly(coalesce(l.share_minor, l.rent_minor), l.rent_period) >= f_min)
       and (f_by is null or l.available_from is null or l.available_from <= f_by)
       and (f_room is null or l.room_type = f_room)
       and (f_furn is null or l.furnished = f_furn)
       and (f_gender is null or l.gender_pref = f_gender or l.gender_pref = 'any')
       and (not f_verified or l.verified_at is not null)
       and (f_linked is null or l.listing_id = f_linked)
       and (q is null or l.title ilike '%' || q || '%' or l.city ilike '%' || q || '%' or l.area ilike '%' || q || '%'
            or exists (select 1 from public.institutions i where i.id = l.institution_id and (i.name ilike '%' || q || '%' or i.short_name ilike '%' || q || '%')))
     order by l.published_at desc nulls last
     limit 500
  ),
  page as (
    select l2.id,
           row_number() over (order by
             case when f_sort = 'match' then coalesce((private.roommate_listing_match(v, l2) ->> 'score')::int, -1) end desc nulls last,
             case when f_sort = 'budget' then private.rm_monthly(coalesce(l2.share_minor, l2.rent_minor), l2.rent_period) end asc nulls last,
             l2.published_at desc nulls last) as rn
      from pool
      join public.roommate_listings l2 on l2.id = pool.id
  )
  select coalesce(jsonb_agg(private.rm_room_card(l, v) order by page.rn), '[]'::jsonb), count(*)
    into rows, n
    from page
    join public.roommate_listings l on l.id = page.id
   where page.rn > off and page.rn <= off + lim + 1;

  if n > lim then
    return jsonb_build_object('items', rows - lim, 'next', off + lim);
  end if;
  return jsonb_build_object('items', rows, 'next', null);
end;
$$;

-- One check row at the end: the new columns, the states and the functions are there.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'roommate_listings'
     and column_name in ('submitted_at', 'reviewed_at', 'reviewed_by', 'review_note', 'approved_at')) as review_columns_expected_5,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_roommate_review_queue', 'admin_roommate_review_decide', 'roommate_search_listings')) as functions_expected_3,
  (select count(*) from public.roommate_listings where status = 'live' and kind = 'room_offer' and approved_at is null) as live_without_approval_expected_0;

commit;

-- ===== payluk_removal_2026-11-10.sql =====
-- ============================================================================
-- !!  DESTRUCTIVE.  NOT APPLIED.  READ BEFORE RUNNING.  !!
--
-- PAYLUK REMOVAL, database half (founder, 10 November 2026: "Remove Payluk.
-- What is this Payluk naming? We are not using them in our platform no more.").
--
-- This file DROPS database objects. It runs only because the founder said to
-- remove Payluk. The app half is already in the repository: it reads the NEW
-- flag key first and falls back to the old one (lib/money/protected-pay-switch.ts),
-- so this file may run before or after the deploy, in either order.
--
-- WHAT IT DOES, in order, in ONE transaction, safe to run twice:
--   0. PRE-CHECK: counts the rows in the table to be dropped and RAISES (and so
--      rolls everything back) if there is even one. Nothing is destroyed
--      silently. The table is append only (no delete is possible), so if it
--      ever holds a row the founder decides what to do with that record first.
--   1. Creates the neutral flag key payments_protected_pay_on, copying the
--      CURRENT value of payments_payluk_on (false today). on conflict do nothing.
--   2. Deletes the old flag row payments_payluk_on, ONLY after the new row
--      exists.
--   3. Drops the table public.payluk_commission_sweeps (its two triggers go
--      with it).
--   4. Drops private.payluk_sweep_append_only() (the trigger function).
--   5. Drops public.admin_payluk_commission_sweep() (the desk read, called by
--      no code).
--   6. Closing check: none of the above remains, the new flag exists.
--
-- WHAT EACH DROPPED OBJECT WAS (checked in the repository 10 November 2026):
--   payluk_commission_sweeps          the log of the commission sweep job; the
--                                     job and its code were removed on 9 Nov.
--   payluk_sweep_append_only()        its append-only / no-truncate trigger fn.
--   admin_payluk_commission_sweep()   a finance desk read of that log; nothing
--                                     in apps/web/src calls it.
-- (ledger_record_payluk_commission was already dropped on 10 Nov by
--  END_OF_BATCH_2026-11-10.sql, verified live.)
--
-- LEFT IN PLACE ON PURPOSE (listed so nobody thinks they were forgotten). None
-- of these can be removed without rewriting live data rules, and none is
-- visible to a member or to staff:
--   * the text value 'payluk' inside CHECK constraints (not Postgres enums, so
--     no enum value is involved): provider_arrangements_provider_check,
--     provider_webhook_events provider check, chargebacks provider check, the
--     ledger provider checks, financial_provider_accounts / funds_movements /
--     member_funds_reported provider values. Old rows (if any) keep reading.
--   * provider_arrangements.buyer_customer_id / seller_customer_id and the
--     constraint provider_arrangements_payluk_customers_check (the columns are
--     nullable; the constraint binds only rows whose provider is 'payluk', of
--     which there are none: zero arrangements were ever opened).
--   * the wallet tables (funds_movements, financial_provider_accounts,
--     member_funds_reported, provider_webhook_events): provider-neutral by
--     design, kept for whichever provider is chosen next.
--   * historical migration files (never rewritten).
--   Cleaning the constraint text values is a later, separate decision, once
--   the founder has decided what replaces the member wallet.
--
-- Do NOT run until the founder says so. The lead applies it.
-- ============================================================================

begin;

do $removal$
declare
  n bigint := 0;
begin
  -- 0. PRE-CHECK: no row may be lost silently.
  if to_regclass('public.payluk_commission_sweeps') is not null then
    execute 'select count(*) from public.payluk_commission_sweeps' into n;
    if n > 0 then
      raise exception 'payluk_removal: public.payluk_commission_sweeps holds % row(s); nothing was dropped. Decide what happens to that record first.', n;
    end if;
  end if;

  -- 1. The neutral flag, with the current value of the old one (false when
  --    the old row is missing: fail closed).
  insert into public.feature_flags (key, enabled, note)
  select 'payments_protected_pay_on',
         coalesce((select f.enabled from public.feature_flags f where f.key = 'payments_payluk_on'), false),
         'The protected payment rail offered to members (founder switch). Replaces the previous provider''s switch, 10 Nov 2026. Fails closed.'
  on conflict (key) do nothing;

  -- 2. The old flag row goes only once the new one exists.
  if exists (select 1 from public.feature_flags where key = 'payments_protected_pay_on') then
    delete from public.feature_flags where key = 'payments_payluk_on';
  else
    raise exception 'payluk_removal: the new flag payments_protected_pay_on does not exist; the old flag was not deleted';
  end if;
end
$removal$;

-- 3. to 5. The objects.
drop table if exists public.payluk_commission_sweeps;
drop function if exists private.payluk_sweep_append_only();
drop function if exists public.admin_payluk_commission_sweep();

-- 6. Closing check.
do $check$
begin
  if to_regclass('public.payluk_commission_sweeps') is not null
     or to_regprocedure('private.payluk_sweep_append_only()') is not null
     or to_regprocedure('public.admin_payluk_commission_sweep()') is not null then
    raise exception 'payluk_removal: a dropped object is still present';
  end if;
  if not exists (select 1 from public.feature_flags where key = 'payments_protected_pay_on') then
    raise exception 'payluk_removal: the new flag is missing';
  end if;
  if exists (select 1 from public.feature_flags where key = 'payments_payluk_on') then
    raise exception 'payluk_removal: the old flag row is still present';
  end if;
end
$check$;

commit;

