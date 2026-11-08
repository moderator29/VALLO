-- VALLO TRUST AND SAFETY: ONE CASE ENGINE FOR EVERY MODULE (8 November 2026).
--
-- Reports stay the intake (`public.reports`, every existing report form and
-- the Unified queue keep working). Every report now also opens a CASE, or
-- joins the open case for the same thing, so three people reporting one scam
-- room are one case with three reports. A case knows its module (roommates,
-- circle, feed, property, stays, messages, account), its category and
-- severity, its deadline, who owns it, its timeline (notes, status changes,
-- actions, messages to members), its evidence and how it ended.
--
-- Member restrictions (warning, messaging, posting, roommates, suspended)
-- are enforced in the database itself: the roommate functions, the feed and
-- Circle posts and new messages check them. A restricted member is told why
-- and can appeal; a decision overturned on appeal lifts the restriction.
--
-- Roles: four new staff scopes beside the existing ones. trust_safety (all
-- cases, every action, verification documents), roommates (Roommates cases,
-- profiles, posts and groups, no documents), circle (Circle and feed cases
-- and communities), analyst (the numbers only, no case content). Admins can
-- do everything. Every write is a SECURITY DEFINER function that checks the
-- scope with `private.staff_can`, which already demands the console step up
-- and the staff handbook acknowledgement. Every action lands in the case
-- timeline and in `public.audit_log`.
--
-- Additive and safe to run twice.

set lock_timeout = '5s';

-- ------------------------------------------------------------ report categories widen

alter table public.reports drop constraint if exists reports_category_chk;
alter table public.reports add constraint reports_category_chk check (category is null or category = any (array[
  'off_platform_payment', 'scam', 'unsafe', 'not_as_described', 'unavailable', 'offensive', 'duplicate', 'other',
  'harassment', 'impersonation', 'discrimination', 'spam', 'misleading', 'group_dispute', 'inappropriate'
]::text[]));

-- ------------------------------------------------------------ cases

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  module text not null check (module in ('roommates', 'circle', 'feed', 'property', 'stays', 'messages', 'account', 'other')),
  category text not null default 'other',
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'under_review', 'awaiting_info', 'escalated', 'resolved', 'closed')),
  subject_user_id uuid references public.profiles(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id text not null,
  target_label text,
  summary text,
  report_count integer not null default 0,
  team text not null default 'trust_safety',
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz,
  due_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  resolution text check (resolution in ('no_action', 'content_removed', 'content_restored', 'warning_issued', 'member_restricted', 'member_suspended',
                                        'listing_removed', 'group_closed', 'verification_revoked', 'referred', 'duplicate', 'other')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists moderation_cases_one_open
  on public.moderation_cases (target_type, target_id) where status not in ('resolved', 'closed');
create index if not exists moderation_cases_queue_idx on public.moderation_cases (status, severity, due_at);
create index if not exists moderation_cases_module_idx on public.moderation_cases (module, status, created_at desc);
create index if not exists moderation_cases_assignee_idx on public.moderation_cases (assigned_to, status) where assigned_to is not null;
create index if not exists moderation_cases_subject_idx on public.moderation_cases (subject_user_id, created_at desc);

create table if not exists public.moderation_case_reports (
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id)
);
create index if not exists moderation_case_reports_case_idx on public.moderation_case_reports (case_id);

create table if not exists public.moderation_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('opened', 'report_added', 'note', 'status', 'assigned', 'escalated', 'action', 'message', 'evidence', 'resolved', 'reopened', 'appeal')),
  body text check (body is null or char_length(body) <= 4000),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists moderation_case_events_case_idx on public.moderation_case_events (case_id, created_at);

create table if not exists public.moderation_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 300),
  note text check (note is null or char_length(note) <= 500),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists moderation_case_evidence_case_idx on public.moderation_case_evidence (case_id);

-- ------------------------------------------------------------ restrictions and appeals

create table if not exists public.member_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('warning', 'messaging', 'posting', 'roommates', 'suspended')),
  reason text not null check (char_length(reason) between 5 and 1000),
  case_id uuid references public.moderation_cases(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text,
  created_at timestamptz not null default now()
);
create index if not exists member_restrictions_user_idx on public.member_restrictions (user_id, kind) where lifted_at is null;

create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  restriction_id uuid references public.member_restrictions(id) on delete set null,
  case_id uuid references public.moderation_cases(id) on delete set null,
  body text not null check (char_length(body) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned', 'withdrawn')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists moderation_appeals_one_open on public.moderation_appeals (restriction_id) where status = 'open';
create index if not exists moderation_appeals_queue_idx on public.moderation_appeals (status, created_at);

-- ------------------------------------------------------------ who may do what

-- The single permission rule for cases. Actions: view, note, assign, status,
-- escalate, resolve, restrict (warning, messaging, posting, roommates, up to
-- 30 days), suspend (suspended, or any restriction longer than 30 days or
-- with no end), documents (verification evidence), appeal (decide appeals),
-- message (write to a member about their case), numbers (the analytics).
create or replace function private.case_can(p_user uuid, p_module text, p_action text)
returns boolean language sql stable security definer set search_path to '' as $$
  select case
    when p_user is null then false
    when private.staff_can(p_user, 'trust_safety') then true
    when p_action = 'numbers' then
      private.staff_can(p_user, 'analyst') or private.staff_can(p_user, 'moderation')
      or private.staff_can(p_user, 'roommates') or private.staff_can(p_user, 'circle')
    when p_action in ('suspend', 'appeal') then false
    when p_action = 'documents' then private.staff_can(p_user, 'kyc_review')
    when p_action in ('view', 'note', 'message', 'escalate') and private.staff_can(p_user, 'support') then true
    when p_module = 'roommates' then private.staff_can(p_user, 'roommates')
    when p_module in ('circle', 'feed') then private.staff_can(p_user, 'circle') or private.staff_can(p_user, 'moderation')
    when p_module = 'property' then private.staff_can(p_user, 'listing_approval') or (p_action <> 'restrict' and private.staff_can(p_user, 'moderation'))
    when p_module in ('stays', 'messages', 'account', 'other') then private.staff_can(p_user, 'moderation')
    else false
  end;
$$;

-- Can this person see the case desk at all (any case scope)?
create or replace function private.case_desk_open(p_user uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.staff_can(p_user, 'trust_safety') or private.staff_can(p_user, 'moderation')
      or private.staff_can(p_user, 'roommates') or private.staff_can(p_user, 'circle')
      or private.staff_can(p_user, 'support') or private.staff_can(p_user, 'listing_approval');
$$;

-- A member's live restriction of this kind (a suspension counts for every kind).
create or replace function private.member_restricted(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path to '' as $$
  select p_user is not null and exists (
    select 1 from public.member_restrictions r
     where r.user_id = p_user and r.lifted_at is null
       and r.starts_at <= now() and (r.ends_at is null or r.ends_at > now())
       and (r.kind = p_kind or r.kind = 'suspended'));
$$;

-- ------------------------------------------------------------ RLS (reads only; every write is a function)

alter table public.moderation_cases enable row level security;
alter table public.moderation_case_reports enable row level security;
alter table public.moderation_case_events enable row level security;
alter table public.moderation_case_evidence enable row level security;
alter table public.member_restrictions enable row level security;
alter table public.moderation_appeals enable row level security;

drop policy if exists moderation_cases_staff_select on public.moderation_cases;
create policy moderation_cases_staff_select on public.moderation_cases for select to authenticated
  using (private.case_can((select auth.uid()), module, 'view'));
drop policy if exists moderation_case_reports_staff_select on public.moderation_case_reports;
create policy moderation_case_reports_staff_select on public.moderation_case_reports for select to authenticated
  using (exists (select 1 from public.moderation_cases c where c.id = case_id and private.case_can((select auth.uid()), c.module, 'view')));
drop policy if exists moderation_case_events_staff_select on public.moderation_case_events;
create policy moderation_case_events_staff_select on public.moderation_case_events for select to authenticated
  using (exists (select 1 from public.moderation_cases c where c.id = case_id and private.case_can((select auth.uid()), c.module, 'view')));
drop policy if exists moderation_case_evidence_staff_select on public.moderation_case_evidence;
create policy moderation_case_evidence_staff_select on public.moderation_case_evidence for select to authenticated
  using (exists (select 1 from public.moderation_cases c where c.id = case_id and private.case_can((select auth.uid()), c.module, 'view')));
drop policy if exists member_restrictions_select on public.member_restrictions;
create policy member_restrictions_select on public.member_restrictions for select to authenticated
  using (user_id = (select auth.uid()) or private.case_desk_open((select auth.uid())));
drop policy if exists moderation_appeals_select on public.moderation_appeals;
create policy moderation_appeals_select on public.moderation_appeals for select to authenticated
  using (user_id = (select auth.uid()) or private.case_can((select auth.uid()), 'account', 'appeal'));

revoke all on public.moderation_cases, public.moderation_case_reports, public.moderation_case_events,
  public.moderation_case_evidence, public.member_restrictions, public.moderation_appeals from anon;
grant select on public.moderation_cases, public.moderation_case_reports, public.moderation_case_events,
  public.moderation_case_evidence, public.member_restrictions, public.moderation_appeals to authenticated;

-- Evidence files: private, staff read them through short signed links made
-- by the server after the permission check. No member policy at all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moderation-evidence', 'moderation-evidence', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'])
on conflict (id) do nothing;

-- ------------------------------------------------------------ the case engine

create or replace function private.case_module_for(p_type text, p_id text)
returns text language plpgsql stable security definer set search_path to '' as $$
begin
  if p_type in ('roommate_listing', 'roommate_profile', 'roommate_group') then return 'roommates'; end if;
  if p_type in ('circle_community') then return 'circle'; end if;
  if p_type = 'post' then
    if exists (select 1 from public.posts p where p.id::text = p_id and p.community_id is not null) then return 'circle'; end if;
    return 'feed';
  end if;
  if p_type in ('listing', 'review') then return 'property'; end if;
  if p_type in ('accommodation', 'booking', 'reservation', 'business', 'event', 'restaurant') then return 'stays'; end if;
  if p_type in ('message', 'conversation') then return 'messages'; end if;
  if p_type in ('profile', 'user', 'person') then return 'account'; end if;
  return 'other';
end;
$$;

create or replace function private.case_severity_for(p_category text)
returns text language sql immutable set search_path to '' as $$
  select case coalesce(p_category, 'other')
    when 'unsafe' then 'critical'
    when 'scam' then 'high' when 'off_platform_payment' then 'high' when 'impersonation' then 'high' when 'harassment' then 'high'
    when 'discrimination' then 'medium' when 'offensive' then 'medium' when 'inappropriate' then 'medium' when 'group_dispute' then 'medium' when 'misleading' then 'medium'
    else 'low' end;
$$;

create or replace function private.case_due_for(p_severity text, p_from timestamptz)
returns timestamptz language sql immutable set search_path to '' as $$
  select p_from + case p_severity when 'critical' then interval '4 hours' when 'high' then interval '24 hours' when 'medium' then interval '72 hours' else interval '7 days' end;
$$;

create or replace function private.case_team_for(p_module text)
returns text language sql immutable set search_path to '' as $$
  select case p_module when 'roommates' then 'roommates' when 'circle' then 'circle' when 'feed' then 'circle'
                       when 'property' then 'listing_approval' when 'stays' then 'moderation' else 'trust_safety' end;
$$;

-- Who a report is about, and a short label for the desk.
create or replace function private.case_subject_for(p_type text, p_id text, out subject uuid, out label text)
language plpgsql stable security definer set search_path to '' as $$
begin
  begin
    if p_type = 'roommate_listing' then
      select l.owner_id, l.title into subject, label from public.roommate_listings l where l.id::text = p_id;
    elsif p_type = 'roommate_profile' then
      subject := p_id::uuid; label := (private.rm_person(p_id::uuid) ->> 'name');
    elsif p_type = 'roommate_group' then
      select g.owner_id, g.name into subject, label from public.roommate_groups g where g.id::text = p_id;
    elsif p_type = 'post' then
      select p.author_id, left(coalesce(p.title, p.body, ''), 120) into subject, label from public.posts p where p.id::text = p_id;
    elsif p_type = 'circle_community' then
      select c.created_by, c.name into subject, label from public.circle_communities c where c.id::text = p_id;
    elsif p_type = 'listing' then
      select a.user_id, l.title into subject, label from public.listings l left join public.agents a on a.id = l.agent_id where l.id::text = p_id;
    elsif p_type = 'message' then
      select m.sender_id, left(m.body, 120) into subject, label from public.messages m where m.id::text = p_id;
    elsif p_type in ('profile', 'user', 'person') then
      subject := p_id::uuid; label := (private.rm_person(p_id::uuid) ->> 'name');
    end if;
  exception when others then
    subject := null;
  end;
end;
$$;

create or replace function private.case_event(p_case uuid, p_actor uuid, p_kind text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path to '' as $$
begin
  insert into public.moderation_case_events (case_id, actor_id, kind, body, data) values (p_case, p_actor, p_kind, p_body, coalesce(p_data, '{}'::jsonb));
  update public.moderation_cases set last_activity_at = now(), updated_at = now() where id = p_case;
end;
$$;

-- Every new report opens a case or joins the open one for the same target.
create or replace function private.case_from_report()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
  m text;
  sev text;
  subj uuid;
  lbl text;
begin
  begin
    select * into c from public.moderation_cases
     where target_type = new.target_type and target_id = new.target_id and status not in ('resolved', 'closed')
     limit 1;
    if not found then
      m := private.case_module_for(new.target_type, new.target_id);
      sev := private.case_severity_for(new.category);
      select s.subject, s.label into subj, lbl from private.case_subject_for(new.target_type, new.target_id) s;
      insert into public.moderation_cases (module, category, severity, status, subject_user_id, reporter_id, target_type, target_id, target_label, summary, report_count, team, due_at)
      values (m, coalesce(new.category, 'other'), sev, 'new', subj, new.reporter_id, new.target_type, new.target_id, lbl, left(new.reason, 500), 1,
              private.case_team_for(m), private.case_due_for(sev, now()))
      on conflict do nothing
      returning * into c;
      if c.id is null then
        select * into c from public.moderation_cases
         where target_type = new.target_type and target_id = new.target_id and status not in ('resolved', 'closed') limit 1;
      else
        insert into public.moderation_case_reports (case_id, report_id) values (c.id, new.id) on conflict do nothing;
        perform private.case_event(c.id, new.reporter_id, 'opened', null, jsonb_build_object('reportId', new.id, 'category', new.category));
        return new;
      end if;
    end if;
    insert into public.moderation_case_reports (case_id, report_id) values (c.id, new.id) on conflict do nothing;
    update public.moderation_cases
       set report_count = report_count + 1,
           -- Three or more people reporting the same thing raise it one level.
           severity = case when report_count + 1 >= 3 and severity = 'low' then 'medium'
                           when report_count + 1 >= 3 and severity = 'medium' then 'high'
                           else severity end
     where id = c.id;
    update public.moderation_cases
       set severity = greatest_severity
      from (select case when private.case_severity_for(new.category) = 'critical' or c.severity = 'critical' then 'critical'
                        when private.case_severity_for(new.category) = 'high' or c.severity = 'high' then 'high'
                        else c.severity end as greatest_severity) s
     where id = c.id and s.greatest_severity <> c.severity;
    update public.moderation_cases set due_at = least(due_at, private.case_due_for(severity, created_at)) where id = c.id;
    perform private.case_event(c.id, new.reporter_id, 'report_added', null, jsonb_build_object('reportId', new.id, 'category', new.category));
  exception when others then
    -- A fault in the case engine never stops a member reporting.
    raise warning '[cases] could not file report %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists reports_zz_open_case on public.reports;
create trigger reports_zz_open_case after insert on public.reports
  for each row execute function private.case_from_report();

-- Reports filed before this engine existed (and still open) become cases too.
do $$
declare r record;
begin
  for r in select * from public.reports where status in ('open', 'reviewing')
             and not exists (select 1 from public.moderation_case_reports cr where cr.report_id = reports.id)
           order by created_at loop
    begin
      insert into public.moderation_cases (module, category, severity, status, reporter_id, target_type, target_id, summary, report_count, team, due_at, created_at)
      values (private.case_module_for(r.target_type, r.target_id), coalesce(r.category, 'other'), private.case_severity_for(r.category),
              case when r.status = 'reviewing' then 'under_review' else 'new' end, r.reporter_id, r.target_type, r.target_id,
              left(r.reason, 500), 0, private.case_team_for(private.case_module_for(r.target_type, r.target_id)),
              private.case_due_for(private.case_severity_for(r.category), r.created_at), r.created_at)
      on conflict do nothing;
      insert into public.moderation_case_reports (case_id, report_id)
      select c.id, r.id from public.moderation_cases c
       where c.target_type = r.target_type and c.target_id = r.target_id and c.status not in ('resolved', 'closed')
      on conflict do nothing;
      update public.moderation_cases c set report_count = (select count(*) from public.moderation_case_reports x where x.case_id = c.id)
       where c.target_type = r.target_type and c.target_id = r.target_id and c.status not in ('resolved', 'closed');
    exception when others then
      raise warning '[cases] backfill skipped report %: %', r.id, sqlerrm;
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------ the desk: reads

create or replace function private.case_row(c public.moderation_cases)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', c.id, 'number', c.number, 'module', c.module, 'category', c.category, 'severity', c.severity, 'status', c.status,
    'targetType', c.target_type, 'targetId', c.target_id, 'targetLabel', c.target_label, 'summary', c.summary,
    'reportCount', c.report_count, 'team', c.team,
    'subject', case when c.subject_user_id is not null then private.rm_person(c.subject_user_id) end,
    'assignee', case when c.assigned_to is not null then private.rm_person(c.assigned_to) end,
    'dueAt', c.due_at, 'overdue', c.status not in ('resolved', 'closed') and c.due_at < now(),
    'escalatedAt', c.escalated_at, 'resolution', c.resolution, 'resolvedAt', c.resolved_at,
    'lastActivityAt', c.last_activity_at, 'createdAt', c.created_at);
$$;

create or replace function public.admin_cases_list(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_status text := nullif(p ->> 'status', '');
  f_module text := nullif(p ->> 'module', '');
  f_sev text := nullif(p ->> 'severity', '');
  f_who text := coalesce(nullif(p ->> 'assigned', ''), 'any');
  f_overdue boolean := coalesce((p ->> 'overdue')::boolean, false);
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  rows jsonb;
  total integer;
begin
  if not private.case_desk_open(me) then
    raise exception 'The case desk is for Trust and Safety staff.' using errcode = '42501';
  end if;
  with base as (
    select c.* from public.moderation_cases c
     where private.case_can(me, c.module, 'view')
       and (f_status is null or (f_status = 'open' and c.status not in ('resolved', 'closed')) or c.status = f_status)
       and (f_module is null or c.module = f_module)
       and (f_sev is null or c.severity = f_sev)
       and (f_who = 'any' or (f_who = 'me' and c.assigned_to = me) or (f_who = 'none' and c.assigned_to is null))
       and (not f_overdue or (c.status not in ('resolved', 'closed') and c.due_at < now()))
       and (q is null or c.number::text = ltrim(q, 'VC-#') or c.target_label ilike '%' || q || '%' or c.summary ilike '%' || q || '%'
            or c.target_id = q or c.subject_user_id::text = q)
  )
  select count(*) into total from base;
  with base as (
    select c.* from public.moderation_cases c
     where private.case_can(me, c.module, 'view')
       and (f_status is null or (f_status = 'open' and c.status not in ('resolved', 'closed')) or c.status = f_status)
       and (f_module is null or c.module = f_module)
       and (f_sev is null or c.severity = f_sev)
       and (f_who = 'any' or (f_who = 'me' and c.assigned_to = me) or (f_who = 'none' and c.assigned_to is null))
       and (not f_overdue or (c.status not in ('resolved', 'closed') and c.due_at < now()))
       and (q is null or c.number::text = ltrim(q, 'VC-#') or c.target_label ilike '%' || q || '%' or c.summary ilike '%' || q || '%'
            or c.target_id = q or c.subject_user_id::text = q)
     order by case c.status when 'escalated' then 0 when 'new' then 1 when 'under_review' then 2 when 'awaiting_info' then 3 else 4 end,
              case c.severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
              c.due_at nulls last, c.created_at desc
     limit lim offset off
  )
  select coalesce(jsonb_agg(private.case_row(b)), '[]'::jsonb) into rows from base b;
  return jsonb_build_object('items', rows, 'total', total, 'next', case when off + lim < total then off + lim else null end);
end;
$$;

-- What the case is about, read for the desk without opening private threads:
-- a message case shows the reported message only, a group case the group's
-- facts and members (its board only when the group itself is reported).
create or replace function private.case_context(c public.moderation_cases)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  out jsonb := '{}'::jsonb;
begin
  begin
    if c.target_type = 'roommate_listing' then
      select jsonb_build_object('kind', 'roommate_listing', 'title', l.title, 'status', l.status, 'listingKind', l.kind, 'city', l.city, 'area', l.area,
               'description', l.description, 'rentMinor', l.rent_minor, 'rentPeriod', l.rent_period, 'verified', l.verified_at is not null,
               'authority', l.authority, 'photos', to_jsonb(l.photos), 'publishedAt', l.published_at, 'href', '/roommates/r/' || l.id)
        into out from public.roommate_listings l where l.id::text = c.target_id;
    elsif c.target_type = 'roommate_profile' then
      select jsonb_build_object('kind', 'roommate_profile', 'status', r.status, 'intro', r.intro, 'lifeStage', r.life_stage, 'city', r.city,
               'createdAt', r.created_at, 'lastActiveAt', r.last_active_at, 'badges', private.rm_badges(r.user_id),
               'interestsSent24h', (select count(*) from public.roommate_interests i where i.from_id = r.user_id and i.created_at > now() - interval '24 hours'),
               'href', '/roommates/p/' || r.user_id)
        into out from public.roommate_profiles r where r.user_id::text = c.target_id;
    elsif c.target_type = 'roommate_group' then
      select jsonb_build_object('kind', 'roommate_group', 'name', g.name, 'stage', g.stage, 'visibility', g.visibility, 'city', g.city,
               'members', coalesce((select jsonb_agg(private.rm_person(m.user_id) || jsonb_build_object('role', m.role, 'state', m.state))
                                     from public.roommate_group_members m where m.group_id = g.id), '[]'::jsonb),
               'board', coalesce((select jsonb_agg(jsonb_build_object('author', private.rm_person(gp.author_id), 'body', gp.body, 'createdAt', gp.created_at) order by gp.created_at desc)
                                   from (select * from public.roommate_group_posts x where x.group_id = g.id order by x.created_at desc limit 50) gp), '[]'::jsonb))
        into out from public.roommate_groups g where g.id::text = c.target_id;
    elsif c.target_type = 'post' then
      select jsonb_build_object('kind', 'post', 'body', p.body, 'title', p.title, 'status', p.status, 'createdAt', p.created_at,
               'community', (select jsonb_build_object('name', cc.name, 'slug', cc.slug) from public.circle_communities cc where cc.id = p.community_id),
               'href', case when p.community_id is not null then '/circle/p/' || p.id else '/post/' || p.id end)
        into out from public.posts p where p.id::text = c.target_id;
    elsif c.target_type = 'circle_community' then
      select jsonb_build_object('kind', 'circle_community', 'name', cc.name, 'description', cc.description, 'status', cc.status,
               'visibility', cc.visibility, 'members', cc.member_count, 'posts', cc.post_count, 'href', '/circle/c/' || cc.slug)
        into out from public.circle_communities cc where cc.id::text = c.target_id;
    elsif c.target_type = 'message' then
      select jsonb_build_object('kind', 'message', 'body', m.body, 'createdAt', m.created_at, 'sender', private.rm_person(m.sender_id))
        into out from public.messages m where m.id::text = c.target_id;
    elsif c.target_type = 'listing' then
      select jsonb_build_object('kind', 'listing', 'title', l.title, 'status', l.status, 'city', l.city, 'area', l.area, 'href', '/listing/' || l.id)
        into out from public.listings l where l.id::text = c.target_id;
    end if;
  exception when others then
    out := jsonb_build_object('kind', c.target_type, 'unreadable', true);
  end;
  return coalesce(out, jsonb_build_object('kind', c.target_type, 'gone', true));
end;
$$;

create or replace function public.admin_case_view(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  c public.moderation_cases;
begin
  select * into c from public.moderation_cases where id = p_id;
  if not found or not private.case_can(me, c.module, 'view') then
    return null;
  end if;
  return private.case_row(c) || jsonb_build_object(
    'resolutionNote', c.resolution_note,
    'escalationReason', c.escalation_reason,
    'context', private.case_context(c),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'category', r.category, 'reason', r.reason, 'status', r.status,
                                 'createdAt', r.created_at, 'reporter', private.rm_person(r.reporter_id)) order by r.created_at)
                          from public.moderation_case_reports cr join public.reports r on r.id = cr.report_id where cr.case_id = c.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'body', e.body, 'data', e.data, 'createdAt', e.created_at,
                                'actor', case when e.actor_id is not null then private.rm_person(e.actor_id) end) order by e.created_at)
                         from public.moderation_case_events e where e.case_id = c.id), '[]'::jsonb),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'path', x.storage_path, 'note', x.note, 'createdAt', x.created_at,
                                  'addedBy', private.rm_person(x.added_by)) order by x.created_at)
                           from public.moderation_case_evidence x where x.case_id = c.id), '[]'::jsonb),
    'subjectHistory', case when c.subject_user_id is null then null else jsonb_build_object(
        'cases', (select count(*) from public.moderation_cases o where o.subject_user_id = c.subject_user_id and o.id <> c.id),
        'upheld', (select count(*) from public.moderation_cases o where o.subject_user_id = c.subject_user_id and o.id <> c.id
                    and o.resolution in ('content_removed', 'warning_issued', 'member_restricted', 'member_suspended', 'listing_removed', 'group_closed', 'verification_revoked')),
        'restrictions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'reason', r.reason, 'startsAt', r.starts_at,
                                       'endsAt', r.ends_at, 'liftedAt', r.lifted_at, 'active', r.lifted_at is null and (r.ends_at is null or r.ends_at > now())) order by r.created_at desc)
                                  from public.member_restrictions r where r.user_id = c.subject_user_id), '[]'::jsonb),
        'memberSince', (select pr.created_at from public.profiles pr where pr.id = c.subject_user_id),
        'badges', private.rm_badges(c.subject_user_id)) end,
    'can', jsonb_build_object(
        'note', private.case_can(me, c.module, 'note'), 'assign', private.case_can(me, c.module, 'assign'),
        'status', private.case_can(me, c.module, 'status'), 'escalate', private.case_can(me, c.module, 'escalate'),
        'resolve', private.case_can(me, c.module, 'resolve'), 'restrict', private.case_can(me, c.module, 'restrict'),
        'suspend', private.case_can(me, c.module, 'suspend'), 'message', private.case_can(me, c.module, 'message'),
        'documents', private.case_can(me, c.module, 'documents'))
  );
end;
$$;

-- ------------------------------------------------------------ the desk: writes

create or replace function private.case_need(p_id uuid, p_action text)
returns public.moderation_cases language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
begin
  select * into c from public.moderation_cases where id = p_id for update;
  if not found then
    raise exception 'That case could not be found.' using errcode = 'RM400';
  end if;
  if not private.case_can((select auth.uid()), c.module, p_action) then
    raise exception 'Your staff role does not allow this on % cases.', c.module using errcode = 'RM401';
  end if;
  return c;
end;
$$;

create or replace function private.case_audit(p_action text, p_case uuid, p_meta jsonb)
returns void language sql security definer set search_path to '' as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, 'moderation_case', p_case::text, coalesce(p_meta, '{}'::jsonb));
$$;

create or replace function public.admin_case_note(p_id uuid, p_body text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'note');
  if char_length(trim(coalesce(p_body, ''))) < 2 then
    raise exception 'Write the note first.' using errcode = 'RM402';
  end if;
  perform private.case_event(c.id, (select auth.uid()), 'note', trim(p_body), '{}'::jsonb);
  if c.status = 'new' then
    update public.moderation_cases set status = 'under_review' where id = c.id;
  end if;
end;
$$;

create or replace function public.admin_case_assign(p_id uuid, p_to uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
  who uuid := coalesce(p_to, (select auth.uid()));
begin
  c := private.case_need(p_id, 'assign');
  if not private.case_can(who, c.module, 'view') and not (who = (select auth.uid())) then
    raise exception 'That person cannot work % cases.', c.module using errcode = 'RM403';
  end if;
  update public.moderation_cases
     set assigned_to = who, assigned_at = now(), status = case when status = 'new' then 'under_review' else status end
   where id = c.id;
  perform private.case_event(c.id, (select auth.uid()), 'assigned', null, jsonb_build_object('to', who, 'toPerson', private.rm_person(who)));
  perform private.case_audit('case.assign', c.id, jsonb_build_object('to', who));
end;
$$;

create or replace function public.admin_case_set_status(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'status');
  if p_status not in ('under_review', 'awaiting_info') then
    raise exception 'Use Escalate, Resolve or Close for that.' using errcode = 'RM404';
  end if;
  update public.moderation_cases set status = p_status where id = c.id;
  perform private.case_event(c.id, (select auth.uid()), 'status', nullif(trim(coalesce(p_note, '')), ''), jsonb_build_object('from', c.status, 'to', p_status));
end;
$$;

create or replace function public.admin_case_escalate(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'escalate');
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Say why this needs escalating.' using errcode = 'RM405';
  end if;
  update public.moderation_cases
     set status = 'escalated', escalated_at = now(), escalation_reason = trim(p_reason), team = 'trust_safety',
         severity = case when severity in ('low', 'medium') then 'high' else severity end,
         due_at = least(coalesce(due_at, now() + interval '24 hours'), now() + interval '24 hours')
   where id = c.id;
  perform private.case_event(c.id, (select auth.uid()), 'escalated', trim(p_reason), jsonb_build_object('from', c.status));
  perform private.case_audit('case.escalate', c.id, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

-- Write to a member about their case (the reporter or the reported person).
-- Lands in their notifications from Vallo Trust and Safety, never as a chat.
create or replace function public.admin_case_message(p_id uuid, p_to uuid, p_body text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'message');
  if p_to is null or (p_to is distinct from c.subject_user_id and p_to is distinct from c.reporter_id
                      and not exists (select 1 from public.moderation_case_reports cr join public.reports r on r.id = cr.report_id
                                       where cr.case_id = c.id and r.reporter_id = p_to)) then
    raise exception 'You can only write to people on this case.' using errcode = 'RM406';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Write the message first.' using errcode = 'RM402';
  end if;
  perform private.notify(p_to, 'support', 'A message from Vallo Trust and Safety', left(trim(p_body), 600), '/settings/standing?case=' || c.number);
  perform private.case_event(c.id, (select auth.uid()), 'message', trim(p_body), jsonb_build_object('to', p_to, 'toPerson', private.rm_person(p_to)));
  if c.status in ('new', 'under_review') and p_to = c.reporter_id then
    update public.moderation_cases set status = 'awaiting_info' where id = c.id;
  end if;
end;
$$;

create or replace function public.admin_case_add_evidence(p_id uuid, p_path text, p_note text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
  eid uuid;
begin
  c := private.case_need(p_id, 'note');
  if p_path is null or p_path not like 'cases/' || c.id || '/%' then
    raise exception 'Upload the file again.' using errcode = 'RM407';
  end if;
  insert into public.moderation_case_evidence (case_id, storage_path, note, added_by) values (c.id, p_path, nullif(trim(coalesce(p_note, '')), ''), (select auth.uid()))
  returning id into eid;
  perform private.case_event(c.id, (select auth.uid()), 'evidence', nullif(trim(coalesce(p_note, '')), ''), jsonb_build_object('evidenceId', eid));
  return eid;
end;
$$;

-- Take an action on the thing reported. Each one is reversible from the
-- same desk (restore), and each one is written to the timeline and the
-- audit log with the reason.
create or replace function public.admin_case_act(p_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
  why text := trim(coalesce(p_reason, ''));
begin
  c := private.case_need(p_id, 'resolve');
  if char_length(why) < 5 then
    raise exception 'Give the reason for this action.' using errcode = 'RM405';
  end if;
  if p_action = 'remove_content' and c.target_type = 'post' then
    update public.posts set status = 'REMOVED', removed_at = now() where id::text = c.target_id;
  elsif p_action = 'restore_content' and c.target_type = 'post' then
    update public.posts set status = 'LIVE', removed_at = null where id::text = c.target_id;
  elsif p_action = 'hold_content' and c.target_type = 'post' then
    update public.posts set status = 'HELD', hold_reason = left(why, 200) where id::text = c.target_id;
  elsif p_action = 'remove_content' and c.target_type = 'roommate_listing' then
    update public.roommate_listings set status = 'removed' where id::text = c.target_id;
  elsif p_action = 'restore_content' and c.target_type = 'roommate_listing' then
    update public.roommate_listings set status = 'paused' where id::text = c.target_id and status = 'removed';
  elsif p_action = 'hold_profile' and c.target_type = 'roommate_profile' then
    update public.roommate_profiles set status = 'held' where user_id::text = c.target_id;
  elsif p_action = 'restore_profile' and c.target_type = 'roommate_profile' then
    update public.roommate_profiles set status = 'paused' where user_id::text = c.target_id and status = 'held';
  elsif p_action = 'close_group' and c.target_type = 'roommate_group' then
    update public.roommate_groups set stage = 'closed' where id::text = c.target_id;
  elsif p_action = 'restore_group' and c.target_type = 'roommate_group' then
    update public.roommate_groups set stage = 'forming' where id::text = c.target_id and stage = 'closed';
  elsif p_action = 'pause_community' and c.target_type = 'circle_community' then
    update public.circle_communities set status = 'paused' where id::text = c.target_id;
  elsif p_action = 'remove_community' and c.target_type = 'circle_community' then
    update public.circle_communities set status = 'removed' where id::text = c.target_id;
  elsif p_action = 'restore_community' and c.target_type = 'circle_community' then
    update public.circle_communities set status = 'live' where id::text = c.target_id;
  elsif p_action = 'revoke_verification' and c.subject_user_id is not null then
    if not private.case_can((select auth.uid()), c.module, 'documents') and not private.case_can((select auth.uid()), c.module, 'suspend') then
      raise exception 'Only verification staff can revoke a verification.' using errcode = 'RM401';
    end if;
    update public.roommate_verifications set status = 'rejected', reason = left(why, 300), reviewed_by = (select auth.uid()), reviewed_at = now()
     where user_id = c.subject_user_id and status = 'verified';
  else
    raise exception 'That action does not fit this case.' using errcode = 'RM408';
  end if;
  perform private.case_event(c.id, (select auth.uid()), 'action', why, jsonb_build_object('action', p_action));
  perform private.case_audit('case.' || p_action, c.id, jsonb_build_object('reason', why, 'target', c.target_type || ':' || c.target_id));
end;
$$;

create or replace function public.admin_case_resolve(p_id uuid, p_resolution text, p_note text, p_tell_reporters boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  c public.moderation_cases;
  r record;
begin
  c := private.case_need(p_id, 'resolve');
  if p_resolution is null then
    raise exception 'Choose how the case ended.' using errcode = 'RM409';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Write a short note on the decision.' using errcode = 'RM405';
  end if;
  update public.moderation_cases
     set status = 'resolved', resolution = p_resolution, resolution_note = trim(p_note), resolved_by = (select auth.uid()), resolved_at = now()
   where id = c.id;
  update public.reports rep set status = case when p_resolution in ('no_action', 'duplicate') then 'dismissed'::public.report_status else 'resolved'::public.report_status end,
                             resolved_at = now(), resolved_by = (select auth.uid())
    from public.moderation_case_reports cr where cr.case_id = c.id and cr.report_id = rep.id and rep.status in ('open', 'reviewing');
  perform private.case_event(c.id, (select auth.uid()), 'resolved', trim(p_note), jsonb_build_object('resolution', p_resolution));
  perform private.case_audit('case.resolve', c.id, jsonb_build_object('resolution', p_resolution));
  if coalesce(p_tell_reporters, true) then
    for r in select distinct rp.reporter_id from public.moderation_case_reports cr join public.reports rp on rp.id = cr.report_id
              where cr.case_id = c.id and rp.reporter_id is not null loop
      perform private.notify(r.reporter_id, 'support', 'We looked into your report',
        case when p_resolution in ('no_action', 'duplicate') then 'We reviewed it and did not find a breach of our rules this time. Thank you for telling us.'
             else 'We reviewed it and took action. Thank you for helping keep Vallo safe.' end,
        '/settings/standing?case=' || c.number);
    end loop;
  end if;
end;
$$;

create or replace function public.admin_case_close(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'resolve');
  if c.status <> 'resolved' then
    raise exception 'Resolve the case before closing it.' using errcode = 'RM410';
  end if;
  update public.moderation_cases set status = 'closed', closed_at = now() where id = c.id;
  perform private.case_event(c.id, (select auth.uid()), 'status', nullif(trim(coalesce(p_note, '')), ''), jsonb_build_object('from', 'resolved', 'to', 'closed'));
end;
$$;

create or replace function public.admin_case_reopen(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare c public.moderation_cases;
begin
  c := private.case_need(p_id, 'resolve');
  if c.status not in ('resolved', 'closed') then
    raise exception 'This case is still open.' using errcode = 'RM410';
  end if;
  if exists (select 1 from public.moderation_cases o where o.target_type = c.target_type and o.target_id = c.target_id and o.id <> c.id and o.status not in ('resolved', 'closed')) then
    raise exception 'There is already an open case for this. Work that one.' using errcode = 'RM411';
  end if;
  update public.moderation_cases set status = 'under_review', resolved_at = null, closed_at = null, due_at = private.case_due_for(severity, now()) where id = c.id;
  perform private.case_event(c.id, (select auth.uid()), 'reopened', trim(coalesce(p_reason, '')), '{}'::jsonb);
  perform private.case_audit('case.reopen', c.id, jsonb_build_object('reason', p_reason));
end;
$$;

-- ------------------------------------------------------------ restrictions

create or replace function public.admin_restrict_member(p_user uuid, p_kind text, p_days integer, p_reason text, p_case uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  m text := 'account';
  rid uuid;
  heavy boolean := p_kind = 'suspended' or p_days is null or p_days > 30;
  why text := trim(coalesce(p_reason, ''));
begin
  if p_case is not null then
    select c.module into m from public.moderation_cases c where c.id = p_case;
  end if;
  if p_kind not in ('warning', 'messaging', 'posting', 'roommates', 'suspended') then
    raise exception 'Choose a restriction.' using errcode = 'RM412';
  end if;
  if p_kind = 'warning' then heavy := false; end if;
  if not private.case_can(me, m, case when heavy then 'suspend' else 'restrict' end) then
    raise exception 'Your staff role does not allow this. A suspension, or anything longer than 30 days, needs Trust and Safety.' using errcode = 'RM401';
  end if;
  if p_user is null or p_user = me then
    raise exception 'Choose the member.' using errcode = 'RM412';
  end if;
  if private.has_role(p_user, 'admin'::public.app_role) or private.has_role(p_user, 'super_admin'::public.app_role) then
    raise exception 'An administrator cannot be restricted from this desk.' using errcode = 'RM401';
  end if;
  if char_length(why) < 10 then
    raise exception 'Write the reason the member will read (10 characters or more).' using errcode = 'RM405';
  end if;
  insert into public.member_restrictions (user_id, kind, reason, case_id, ends_at, created_by)
  values (p_user, p_kind, why, p_case, case when p_kind = 'warning' then now() else case when p_days is null then null else now() + make_interval(days => p_days) end end, me)
  returning id into rid;
  if p_kind = 'roommates' or p_kind = 'suspended' then
    update public.roommate_profiles set status = 'held' where user_id = p_user and status <> 'held';
    update public.roommate_listings set status = 'paused' where owner_id = p_user and status = 'live';
  end if;
  perform private.notify(p_user, 'system',
    case p_kind when 'warning' then 'A warning from Vallo' when 'suspended' then 'Your account is suspended' else 'Part of your account is restricted' end,
    left(why, 400), '/settings/standing');
  if p_case is not null then
    perform private.case_event(p_case, me, 'action', why, jsonb_build_object('action', 'restrict', 'kind', p_kind, 'days', p_days, 'restrictionId', rid, 'member', private.rm_person(p_user)));
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'member.restrict', 'profile', p_user::text, jsonb_build_object('kind', p_kind, 'days', p_days, 'case', p_case, 'reason', why));
  return rid;
end;
$$;

create or replace function public.admin_lift_restriction(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  r public.member_restrictions;
  m text := 'account';
begin
  select * into r from public.member_restrictions where id = p_id;
  if not found or r.lifted_at is not null then
    raise exception 'That restriction is not in force.' using errcode = 'RM413';
  end if;
  if r.case_id is not null then select c.module into m from public.moderation_cases c where c.id = r.case_id; end if;
  if not private.case_can(me, m, case when r.kind = 'suspended' then 'suspend' else 'restrict' end) then
    raise exception 'Your staff role does not allow this.' using errcode = 'RM401';
  end if;
  update public.member_restrictions set lifted_at = now(), lifted_by = me, lift_reason = trim(coalesce(p_reason, '')) where id = p_id;
  if r.kind in ('roommates', 'suspended') then
    update public.roommate_profiles set status = 'paused' where user_id = r.user_id and status = 'held';
  end if;
  perform private.notify(r.user_id, 'system', 'A restriction on your account was lifted', coalesce(nullif(trim(p_reason), ''), 'You can use Vallo as normal again.'), '/settings/standing');
  if r.case_id is not null then
    perform private.case_event(r.case_id, me, 'action', trim(coalesce(p_reason, '')), jsonb_build_object('action', 'lift', 'restrictionId', r.id));
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'member.lift_restriction', 'profile', r.user_id::text, jsonb_build_object('restriction', r.id, 'reason', p_reason));
end;
$$;

-- The member's own view and their appeal.
create or replace function public.my_standing()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'restrictions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'reason', r.reason, 'startsAt', r.starts_at, 'endsAt', r.ends_at,
                                   'liftedAt', r.lifted_at, 'active', r.lifted_at is null and (r.ends_at is null or r.ends_at > now()) and r.kind <> 'warning',
                                   'appeal', (select jsonb_build_object('id', a.id, 'status', a.status, 'decisionNote', a.decision_note, 'createdAt', a.created_at)
                                                from public.moderation_appeals a where a.restriction_id = r.id order by a.created_at desc limit 1))
                                   order by r.created_at desc)
                              from public.member_restrictions r where r.user_id = (select auth.uid())), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('number', c.number, 'status', c.status, 'category', rp.category, 'createdAt', rp.created_at,
                                 'outcome', case when c.status in ('resolved', 'closed') then case when c.resolution in ('no_action', 'duplicate') then 'no_action' else 'action_taken' end end)
                                 order by rp.created_at desc)
                          from public.reports rp
                          join public.moderation_case_reports cr on cr.report_id = rp.id
                          join public.moderation_cases c on c.id = cr.case_id
                         where rp.reporter_id = (select auth.uid()) and rp.created_at > now() - interval '180 days'), '[]'::jsonb)
  );
$$;

create or replace function public.appeal_restriction(p_restriction uuid, p_body text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  r public.member_restrictions;
  aid uuid;
begin
  select * into r from public.member_restrictions where id = p_restriction and user_id = me;
  if not found then
    raise exception 'That restriction could not be found.' using errcode = 'RM413';
  end if;
  if r.kind = 'warning' and r.created_at < now() - interval '30 days' then
    raise exception 'A warning can be appealed within 30 days.' using errcode = 'RM414';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 10 then
    raise exception 'Tell us why, in a sentence or two.' using errcode = 'RM405';
  end if;
  if exists (select 1 from public.moderation_appeals a where a.restriction_id = r.id and a.status in ('upheld', 'overturned')) then
    raise exception 'This decision was already reviewed on appeal.' using errcode = 'RM414';
  end if;
  insert into public.moderation_appeals (user_id, restriction_id, case_id, body) values (me, r.id, r.case_id, trim(p_body)) returning id into aid;
  if r.case_id is not null then
    perform private.case_event(r.case_id, me, 'appeal', trim(p_body), jsonb_build_object('appealId', aid));
  end if;
  return aid;
end;
$$;

create or replace function public.admin_decide_appeal(p_id uuid, p_overturn boolean, p_note text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  a public.moderation_appeals;
begin
  if not private.case_can(me, 'account', 'appeal') then
    raise exception 'Appeals are decided by Trust and Safety.' using errcode = 'RM401';
  end if;
  select * into a from public.moderation_appeals where id = p_id and status = 'open';
  if not found then
    raise exception 'That appeal is not open.' using errcode = 'RM415';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Write the decision the member will read.' using errcode = 'RM405';
  end if;
  -- The person who made a decision does not judge its appeal.
  if exists (select 1 from public.member_restrictions r where r.id = a.restriction_id and r.created_by = me)
     and not private.has_role(me, 'super_admin'::public.app_role) then
    raise exception 'Someone other than the person who made the decision must review the appeal.' using errcode = 'RM416';
  end if;
  update public.moderation_appeals set status = case when p_overturn then 'overturned' else 'upheld' end, decided_by = me, decided_at = now(), decision_note = trim(p_note) where id = a.id;
  if p_overturn and a.restriction_id is not null then
    update public.member_restrictions set lifted_at = now(), lifted_by = me, lift_reason = 'Overturned on appeal: ' || trim(p_note) where id = a.restriction_id and lifted_at is null;
    update public.roommate_profiles set status = 'paused' where user_id = a.user_id and status = 'held';
  end if;
  perform private.notify(a.user_id, 'system', case when p_overturn then 'Your appeal was accepted' else 'Your appeal was reviewed' end, left(trim(p_note), 400), '/settings/standing');
  if a.case_id is not null then
    perform private.case_event(a.case_id, me, 'appeal', trim(p_note), jsonb_build_object('appealId', a.id, 'overturned', p_overturn));
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'appeal.decide', 'moderation_appeal', a.id::text, jsonb_build_object('overturned', p_overturn));
end;
$$;

create or replace function public.admin_appeals_list(p_status text)
returns jsonb language sql stable security definer set search_path to '' as $$
  select case when not private.case_can((select auth.uid()), 'account', 'appeal') then null else
    coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'body', a.body, 'createdAt', a.created_at, 'decidedAt', a.decided_at,
                'decisionNote', a.decision_note, 'member', private.rm_person(a.user_id),
                'restriction', (select jsonb_build_object('id', r.id, 'kind', r.kind, 'reason', r.reason, 'endsAt', r.ends_at, 'createdBy', private.rm_person(r.created_by))
                                  from public.member_restrictions r where r.id = a.restriction_id),
                'caseNumber', (select c.number from public.moderation_cases c where c.id = a.case_id)) order by a.created_at)
              from public.moderation_appeals a where p_status is null or a.status = p_status), '[]'::jsonb) end;
$$;

-- ------------------------------------------------------------ enforcement

-- Feed and Circle posts, and new messages, check the author's restrictions.
-- Only member writes are checked (staff tools and the platform itself are
-- not). These triggers are deliberately NOT security definer: inside a
-- definer function current_user is always the owner, so the member check
-- would never fire.
create or replace function private.member_restriction_on_post()
returns trigger language plpgsql set search_path to '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.author_kind = 'USER' and private.member_restricted(new.author_id, 'posting') then
    raise exception 'Posting is paused on your account. See Settings, Account standing.' using errcode = 'RM420';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_zz_member_restriction on public.posts;
create trigger posts_zz_member_restriction before insert on public.posts
  for each row execute function private.member_restriction_on_post();

create or replace function private.member_restriction_on_message()
returns trigger language plpgsql set search_path to '' as $$
begin
  if current_user in ('authenticated', 'anon') and private.member_restricted(new.sender_id, 'messaging') then
    raise exception 'Messaging is paused on your account. See Settings, Account standing.' using errcode = 'RM421';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_zz_member_restriction on public.messages;
create trigger messages_zz_member_restriction before insert on public.messages
  for each row execute function private.member_restriction_on_message();

-- Roommates: profiles going live, posts, interests, groups and viewings.
create or replace function private.member_restriction_on_roommates()
returns trigger language plpgsql set search_path to '' as $$
declare
  row jsonb := to_jsonb(new);
  who uuid;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  who := (row ->> case tg_table_name
    when 'roommate_profiles' then 'user_id'
    when 'roommate_listings' then 'owner_id'
    when 'roommate_interests' then 'from_id'
    when 'roommate_groups' then 'owner_id'
    when 'roommate_viewings' then 'requester_id'
    else 'none' end)::uuid;
  if tg_table_name = 'roommate_profiles' and row ->> 'status' <> 'active' then return new; end if;
  if tg_table_name = 'roommate_listings' and row ->> 'status' <> 'live' then return new; end if;
  if private.member_restricted(who, 'roommates') then
    raise exception 'Vallo Roommates is paused on your account. See Settings, Account standing.' using errcode = 'RM422';
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_profiles_zz_restriction on public.roommate_profiles;
create trigger roommate_profiles_zz_restriction before insert or update on public.roommate_profiles
  for each row execute function private.member_restriction_on_roommates();
drop trigger if exists roommate_listings_zz_restriction on public.roommate_listings;
create trigger roommate_listings_zz_restriction before insert or update on public.roommate_listings
  for each row execute function private.member_restriction_on_roommates();
drop trigger if exists roommate_interests_zz_restriction on public.roommate_interests;
create trigger roommate_interests_zz_restriction before insert on public.roommate_interests
  for each row execute function private.member_restriction_on_roommates();
drop trigger if exists roommate_groups_zz_restriction on public.roommate_groups;
create trigger roommate_groups_zz_restriction before insert on public.roommate_groups
  for each row execute function private.member_restriction_on_roommates();
drop trigger if exists roommate_viewings_zz_restriction on public.roommate_viewings;
create trigger roommate_viewings_zz_restriction before insert on public.roommate_viewings
  for each row execute function private.member_restriction_on_roommates();

-- ------------------------------------------------------------ the numbers

create or replace function public.admin_trust_overview(p_days integer)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not private.case_can(me, 'account', 'numbers') then
    raise exception 'The numbers are for staff.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', since,
    'cases', jsonb_build_object(
      'open', (select count(*) from public.moderation_cases where status not in ('resolved', 'closed')),
      'new', (select count(*) from public.moderation_cases where status = 'new'),
      'escalated', (select count(*) from public.moderation_cases where status = 'escalated'),
      'overdue', (select count(*) from public.moderation_cases where status not in ('resolved', 'closed') and due_at < now()),
      'unassigned', (select count(*) from public.moderation_cases where status not in ('resolved', 'closed') and assigned_to is null),
      'critical', (select count(*) from public.moderation_cases where status not in ('resolved', 'closed') and severity = 'critical'),
      'openedInPeriod', (select count(*) from public.moderation_cases where created_at >= since),
      'resolvedInPeriod', (select count(*) from public.moderation_cases where resolved_at >= since),
      'medianHoursToResolve', (select round(percentile_cont(0.5) within group (order by extract(epoch from resolved_at - created_at) / 3600)::numeric, 1)
                                 from public.moderation_cases where resolved_at >= since),
      'byModule', coalesce((select jsonb_object_agg(module, n) from (select module, count(*) n from public.moderation_cases where status not in ('resolved', 'closed') group by module) x), '{}'::jsonb),
      'byCategory', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from public.moderation_cases where created_at >= since group by category) x), '{}'::jsonb),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'opened', (select count(*) from public.moderation_cases c where c.created_at::date = d::date),
                                                              'resolved', (select count(*) from public.moderation_cases c where c.resolved_at::date = d::date)) order by d)
                          from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d), '[]'::jsonb)
    ),
    'restrictions', jsonb_build_object(
      'active', (select count(*) from public.member_restrictions where lifted_at is null and kind <> 'warning' and (ends_at is null or ends_at > now())),
      'suspended', (select count(*) from public.member_restrictions where lifted_at is null and kind = 'suspended' and (ends_at is null or ends_at > now())),
      'appealsOpen', (select count(*) from public.moderation_appeals where status = 'open')
    ),
    'roommates', jsonb_build_object(
      'profiles', (select jsonb_build_object('active', count(*) filter (where status = 'active'), 'draft', count(*) filter (where status = 'draft'),
                                             'paused', count(*) filter (where status = 'paused'), 'held', count(*) filter (where status = 'held'),
                                             'newInPeriod', count(*) filter (where created_at >= since)) from public.roommate_profiles),
      'interests', (select jsonb_build_object('sent', count(*), 'accepted', count(*) filter (where status = 'accepted'), 'declined', count(*) filter (where status = 'declined'))
                      from public.roommate_interests where created_at >= since),
      'listings', (select jsonb_build_object('live', count(*) filter (where status = 'live'), 'newInPeriod', count(*) filter (where created_at >= since),
                                             'unverifiedLive', count(*) filter (where status = 'live' and kind = 'room_offer' and verified_at is null),
                                             'removed', count(*) filter (where status = 'removed')) from public.roommate_listings),
      'groups', (select jsonb_build_object('active', count(*) filter (where stage in ('forming', 'searching', 'decided', 'living')), 'newInPeriod', count(*) filter (where created_at >= since))
                   from public.roommate_groups),
      'viewings', (select count(*) from public.roommate_viewings where created_at >= since),
      'verificationsWaiting', (select count(*) from public.roommate_verifications where status = 'review')
    ),
    'circle', jsonb_build_object(
      'communities', (select jsonb_build_object('live', count(*) filter (where status = 'live'), 'paused', count(*) filter (where status = 'paused'), 'removed', count(*) filter (where status = 'removed'))
                        from public.circle_communities),
      'posts', (select jsonb_build_object('inPeriod', count(*) filter (where created_at >= since), 'held', count(*) filter (where status = 'HELD'),
                                          'removedInPeriod', count(*) filter (where status = 'REMOVED' and created_at >= since))
                  from public.posts where community_id is not null)
    )
  );
end;
$$;

-- Behaviour that looks like spam or manipulation in Roommates. Counts only,
-- never anybody's preferences or conversations.
create or replace function public.admin_roommates_signals()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare me uuid := (select auth.uid());
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'heavySenders', coalesce((select jsonb_agg(x order by (x ->> 'sent')::int desc) from (
        select private.rm_person(i.from_id) || jsonb_build_object('sent', count(*), 'declined', count(*) filter (where i.status = 'declined')) x
          from public.roommate_interests i where i.created_at > now() - interval '24 hours'
         group by i.from_id having count(*) >= 15 limit 50) t), '[]'::jsonb),
    'repeatListers', coalesce((select jsonb_agg(x) from (
        select private.rm_person(l.owner_id) || jsonb_build_object('live', count(*)) x
          from public.roommate_listings l where l.status = 'live'
         group by l.owner_id having count(*) >= 4 limit 50) t), '[]'::jsonb),
    'duplicateTitles', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('title', min(l.title), 'count', count(*), 'owners', count(distinct l.owner_id)) x
          from public.roommate_listings l where l.status = 'live'
         group by lower(regexp_replace(l.title, '\s+', ' ', 'g')) having count(*) >= 2 limit 50) t), '[]'::jsonb),
    'reportedOften', coalesce((select jsonb_agg(x) from (
        select private.rm_person(c.subject_user_id) || jsonb_build_object('cases', count(*)) x
          from public.moderation_cases c where c.module = 'roommates' and c.subject_user_id is not null and c.created_at > now() - interval '90 days'
         group by c.subject_user_id having count(*) >= 2 limit 50) t), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------ module desks: lists

create or replace function public.admin_roommate_profiles(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_status text := nullif(p ->> 'status', '');
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  f_flagged boolean := coalesce((p ->> 'flagged')::boolean, false);
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select private.rm_person(r.user_id) || jsonb_build_object(
             'status', r.status, 'lifeStage', r.life_stage, 'city', r.city, 'createdAt', r.created_at, 'lastActiveAt', r.last_active_at,
             'badges', private.rm_badges(r.user_id),
             'openCases', (select count(*) from public.moderation_cases c where c.subject_user_id = r.user_id and c.status not in ('resolved', 'closed')),
             'listings', (select count(*) from public.roommate_listings l where l.owner_id = r.user_id and l.status = 'live')) x
      from public.roommate_profiles r
      left join public.social_profiles sp on sp.user_id = r.user_id
     where (f_status is null or r.status = f_status)
       and (q is null or sp.handle ilike '%' || q || '%' or sp.display_label ilike '%' || q || '%' or r.city ilike '%' || q || '%' or r.user_id::text = q)
       and (not f_flagged or exists (select 1 from public.moderation_cases c where c.subject_user_id = r.user_id and c.status not in ('resolved', 'closed')))
     order by r.last_active_at desc
     limit lim offset off) t), '[]'::jsonb);
end;
$$;

create or replace function public.admin_roommate_listings(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_status text := nullif(p ->> 'status', '');
  f_unverified boolean := coalesce((p ->> 'unverified')::boolean, false);
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select private.rm_room_card(l, null::public.roommate_profiles) || jsonb_build_object(
             'authority', l.authority, 'viewCount', l.view_count, 'interestCount', l.interest_count, 'createdAt', l.created_at,
             'openCases', (select count(*) from public.moderation_cases c where c.target_type = 'roommate_listing' and c.target_id = l.id::text and c.status not in ('resolved', 'closed'))) x
      from public.roommate_listings l
     where (f_status is null or l.status = f_status)
       and (not f_unverified or (l.verified_at is null and l.kind = 'room_offer' and l.status = 'live'))
       and (q is null or l.title ilike '%' || q || '%' or l.city ilike '%' || q || '%' or l.area ilike '%' || q || '%' or l.id::text = q)
     order by l.updated_at desc
     limit lim offset off) t), '[]'::jsonb);
end;
$$;

create or replace function public.admin_roommate_groups(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_stage text := nullif(p ->> 'stage', '');
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  -- Facts only: a group's board and shortlist stay private unless the group is reported.
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', g.id, 'name', g.name, 'stage', g.stage, 'visibility', g.visibility, 'city', g.city, 'createdAt', g.created_at,
             'owner', private.rm_person(g.owner_id),
             'members', (select count(*) from public.roommate_group_members m where m.group_id = g.id and m.state = 'active'),
             'posts7d', (select count(*) from public.roommate_group_posts gp where gp.group_id = g.id and gp.created_at > now() - interval '7 days'),
             'openCases', (select count(*) from public.moderation_cases c where c.target_type = 'roommate_group' and c.target_id = g.id::text and c.status not in ('resolved', 'closed'))) x
      from public.roommate_groups g
     where f_stage is null or g.stage = f_stage
     order by g.updated_at desc
     limit lim offset off) t), '[]'::jsonb);
end;
$$;

-- Staff act on a roommate post or profile directly (from the desk, not a case):
-- verify a room post, remove or restore it, hold or restore a profile.
create or replace function public.admin_roommate_act(p_target_type text, p_target uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  why text := trim(coalesce(p_reason, ''));
begin
  if not private.case_can(me, 'roommates', 'resolve') then
    raise exception 'Your staff role does not allow this.' using errcode = 'RM401';
  end if;
  if char_length(why) < 5 and p_action <> 'verify' then
    raise exception 'Give the reason for this action.' using errcode = 'RM405';
  end if;
  if p_target_type = 'roommate_listing' and p_action = 'verify' then
    update public.roommate_listings set verified_at = now(), verified_by = me where id = p_target and status = 'live';
  elsif p_target_type = 'roommate_listing' and p_action = 'unverify' then
    update public.roommate_listings set verified_at = null, verified_by = null where id = p_target;
  elsif p_target_type = 'roommate_listing' and p_action = 'remove' then
    update public.roommate_listings set status = 'removed' where id = p_target;
  elsif p_target_type = 'roommate_listing' and p_action = 'restore' then
    update public.roommate_listings set status = 'paused' where id = p_target and status = 'removed';
  elsif p_target_type = 'roommate_profile' and p_action = 'hold' then
    update public.roommate_profiles set status = 'held' where user_id = p_target;
  elsif p_target_type = 'roommate_profile' and p_action = 'restore' then
    update public.roommate_profiles set status = 'paused' where user_id = p_target and status = 'held';
  elsif p_target_type = 'roommate_group' and p_action = 'close' then
    update public.roommate_groups set stage = 'closed' where id = p_target;
  elsif p_target_type = 'roommate_group' and p_action = 'restore' then
    update public.roommate_groups set stage = 'forming' where id = p_target and stage = 'closed';
  else
    raise exception 'That action does not fit.' using errcode = 'RM408';
  end if;
  if not found then
    raise exception 'Nothing changed: it may already be in that state.' using errcode = 'RM417';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'roommates.' || p_action, p_target_type, p_target::text, jsonb_build_object('reason', why));
end;
$$;

-- The verification queue: decisions only by staff allowed to see documents.
create or replace function public.admin_roommate_verifications(p_status text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare me uuid := (select auth.uid());
begin
  if not private.case_can(me, 'roommates', 'documents') then
    raise exception 'Verification documents are for verification staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'status', v.status, 'member', private.rm_person(v.user_id),
            'institution', private.rm_institution(v.institution_id), 'emailMasked', v.email_masked, 'hasDocument', v.evidence_path is not null,
            'reason', v.reason, 'createdAt', v.created_at, 'reviewedAt', v.reviewed_at, 'reviewedBy', case when v.reviewed_by is not null then private.rm_person(v.reviewed_by) end)
            order by v.created_at)
          from public.roommate_verifications v where (p_status is null and v.status = 'review') or v.status = p_status), '[]'::jsonb);
end;
$$;

create or replace function public.admin_roommate_decide_verification(p_id uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_verifications;
begin
  if not private.case_can(me, 'roommates', 'documents') then
    raise exception 'Verification documents are for verification staff.' using errcode = 'RM401';
  end if;
  select * into v from public.roommate_verifications where id = p_id;
  if not found or v.status not in ('review', 'pending', 'verified') then
    raise exception 'That check is not waiting on a decision.' using errcode = 'RM418';
  end if;
  if v.user_id = me then
    raise exception 'You cannot decide your own verification.' using errcode = 'RM416';
  end if;
  if p_decision = 'approve' then
    update public.roommate_verifications set status = 'verified', reviewed_by = me, reviewed_at = now(), expires_at = now() + interval '1 year', reason = null where id = p_id;
    perform private.notify(v.user_id, 'system', 'You are verified on Vallo Roommates', 'Your badge now shows on your roommate profile.', '/roommates/verify');
  elsif p_decision = 'reject' or p_decision = 'more_info' then
    if char_length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'Tell the member what to fix.' using errcode = 'RM405';
    end if;
    update public.roommate_verifications set status = 'rejected', reviewed_by = me, reviewed_at = now(), reason = left(trim(p_reason), 300) where id = p_id;
    perform private.notify(v.user_id, 'system',
      case when p_decision = 'more_info' then 'We need a little more for your verification' else 'Your verification was not accepted' end,
      left(trim(p_reason), 300), '/roommates/verify');
  else
    raise exception 'Choose approve, reject or ask for more.' using errcode = 'RM408';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'roommates.verification.' || p_decision, 'roommate_verification', p_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_circle_communities(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  f_status text := nullif(p ->> 'status', '');
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
begin
  if not private.case_can(me, 'circle', 'view') then
    raise exception 'This is for Circle staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'category', c.category, 'status', c.status, 'visibility', c.visibility,
             'byVallo', c.started_by_vallo, 'members', c.member_count, 'posts', c.post_count, 'lastActivityAt', c.last_activity_at, 'createdAt', c.created_at,
             'owner', case when c.created_by is not null then private.rm_person(c.created_by) end,
             'held', (select count(*) from public.posts p where p.community_id = c.id and p.status = 'HELD'),
             'openCases', (select count(*) from public.moderation_cases mc where mc.module = 'circle' and mc.status not in ('resolved', 'closed')
                            and (mc.target_id = c.id::text or mc.target_id in (select p.id::text from public.posts p where p.community_id = c.id)))) x
      from public.circle_communities c
     where (f_status is null or c.status = f_status) and (q is null or c.name ilike '%' || q || '%' or c.slug ilike '%' || q || '%')
     order by c.last_activity_at desc nulls last, c.created_at desc
     limit 200) t), '[]'::jsonb);
end;
$$;

create or replace function public.admin_circle_act(p_community uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path to '' as $$
declare me uuid := (select auth.uid());
begin
  if not private.case_can(me, 'circle', 'resolve') then
    raise exception 'Your staff role does not allow this.' using errcode = 'RM401';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Give the reason for this action.' using errcode = 'RM405';
  end if;
  update public.circle_communities
     set status = case p_action when 'pause' then 'paused' when 'remove' then 'removed' when 'restore' then 'live' else status end
   where id = p_community and p_action in ('pause', 'remove', 'restore');
  if not found then
    raise exception 'That action does not fit.' using errcode = 'RM408';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'circle.' || p_action, 'circle_community', p_community::text, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

-- ------------------------------------------------------------ grants

do $$
declare f text;
begin
  foreach f in array array[
    'private.case_can(uuid, text, text)', 'private.case_desk_open(uuid)', 'private.member_restricted(uuid, text)',
    'private.case_module_for(text, text)', 'private.case_severity_for(text)', 'private.case_due_for(text, timestamptz)',
    'private.case_team_for(text)', 'private.case_subject_for(text, text)', 'private.case_event(uuid, uuid, text, text, jsonb)',
    'private.case_row(public.moderation_cases)', 'private.case_context(public.moderation_cases)',
    'private.case_need(uuid, text)', 'private.case_audit(text, uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  foreach f in array array[
    'public.admin_cases_list(jsonb)', 'public.admin_case_view(uuid)', 'public.admin_case_note(uuid, text)', 'public.admin_case_assign(uuid, uuid)',
    'public.admin_case_set_status(uuid, text, text)', 'public.admin_case_escalate(uuid, text)', 'public.admin_case_message(uuid, uuid, text)',
    'public.admin_case_add_evidence(uuid, text, text)', 'public.admin_case_act(uuid, text, text)', 'public.admin_case_resolve(uuid, text, text, boolean)',
    'public.admin_case_close(uuid, text)', 'public.admin_case_reopen(uuid, text)', 'public.admin_restrict_member(uuid, text, integer, text, uuid)',
    'public.admin_lift_restriction(uuid, text)', 'public.my_standing()', 'public.appeal_restriction(uuid, text)', 'public.admin_decide_appeal(uuid, boolean, text)',
    'public.admin_appeals_list(text)', 'public.admin_trust_overview(integer)', 'public.admin_roommates_signals()', 'public.admin_roommate_profiles(jsonb)',
    'public.admin_roommate_listings(jsonb)', 'public.admin_roommate_groups(jsonb)', 'public.admin_roommate_act(text, uuid, text, text)',
    'public.admin_roommate_verifications(text)', 'public.admin_roommate_decide_verification(uuid, text, text)',
    'public.admin_circle_communities(jsonb)', 'public.admin_circle_act(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Policies call these as the member's role.
  execute 'grant execute on function private.case_can(uuid, text, text) to authenticated';
  execute 'grant execute on function private.case_desk_open(uuid) to authenticated';
  -- The restriction triggers run as the member (so they can tell a member's
  -- write from a staff tool's), and ask this.
  execute 'grant execute on function private.member_restricted(uuid, text) to authenticated';
end;
$$;
