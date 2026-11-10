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

-- ------------------------------------------------------------ triggers, RLS, grants

do $apply$
declare
  t text;
begin
  foreach t in array array['marketing_campaigns', 'content_items', 'tech_incidents', 'support_policy_notes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.staff_desks_touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;

  -- Tables a person may read, add to and change.
  foreach t in array array['marketing_campaigns', 'marketing_campaign_results', 'content_items', 'tech_incidents', 'support_policy_notes'] loop
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
                            'tech_incidents', 'tech_incident_updates', 'support_qa_reviews', 'support_policy_notes')) <> 7 then
    raise exception 'staff_roles: a table is missing';
  end if;
end
$check$;

notify pgrst, 'reload schema';

commit;
