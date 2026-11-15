-- ESCALATIONS FOR EVERY ADMIN DESK (the founder, 15 November 2026).
--
-- NOT APPLIED. Only the founder applies it, in the Supabase SQL editor.
-- Additive only: one sequence, two new tables, private helpers and six public
-- functions. No existing table, policy, function or row is changed, and
-- nothing is removed. Safe to run twice (every statement is `if not exists`
-- or `create or replace`).
--
-- WHAT IT ADDS, IN PLAIN WORDS.
--
--  1. ANY MEMBER OF STAFF CAN ESCALATE WHAT THEY CANNOT OR MAY NOT DECIDE,
--     from any desk. They say what kind of issue it is, how urgent, what
--     happened and what they need. The record they were looking at travels
--     as a link, never as pasted personal data: the text is refused when it
--     carries a long run of digits (an ID, bank or card number).
--
--  2. IT LANDS WITH ONE CLEAR OWNER. The category chooses the team (the
--     routing table, `private.staff_escalation_route`). A team with nobody
--     on it is never chosen: the escalation goes to the COO instead, and to
--     the super admin when there is no COO. An urgent one also tells the
--     super admin at once, whatever the route.
--
--  3. IT RUNS ON A CLOCK. Urgent is due in 1 hour, high in 4, normal in 24,
--     low in 72. `staff_escalation_bump_overdue` (the scheduled job, service
--     role only) moves an overdue one up a level, team to COO to super
--     admin, with half the window again (never less than an hour), and at
--     the top level reminds once a day. While a question is with the raiser
--     the clock is theirs: they are reminded once a day and nothing is moved
--     up.
--
--  4. EVERYTHING IS ON A TIMELINE. `staff_escalation_events` is append only
--     (a trigger refuses a change or a removal). Every action also writes a
--     line to `public.audit_log`, the same log the support hand-off uses.
--
--  5. THE RAISER HEARS THE OUTCOME. Acknowledged, asked a question, resolved
--     or declined: the raiser is told in the app and by email. The receivers
--     are told on raise, on a move up, on a reroute and when the raiser
--     answers. The member is never told anything through this path.
--
-- WHO IS WHO, IN THIS DATABASE.
--   console staff   the admin or super admin role, or a live staff grant with
--                   the current handbook acknowledged. The caller's own
--                   session must also have proved the console's security key
--                   (`private.console_step_up_ok`, as `private.staff_can`).
--   a team          the holders of a staff scope: a live grant carrying the
--                   scope, handbook acknowledged (the same people
--                   `private.tell_scope` tells). The admin role alone is not
--                   a team, so an escalation has a real owner.
--   the COO         a live grant with the position `coo`, or holding every
--                   one of the COO's five scopes (the same rule the COO desk
--                   uses, `lib/admin/overview/guard.ts`).
--   the super admin the `super_admin` role.
--
-- WHAT IT DOES NOT DO.
--  * No grant to anon or authenticated on either table, and no policy: RLS is
--    on and every read and write goes through the SECURITY DEFINER functions
--    below, each with `search_path = ''`, each checking the caller.
--  * It does not touch `public.coo_escalations` (the COO board of 10
--    November). That table and its screen keep working.
--  * It schedules nothing in the database. The app's job
--    (`/api/cron/escalations-overdue`) calls the overdue function.
--
-- THE APP ALREADY SPEAKS TO THIS. Until it is applied every escalation screen
-- says "not set up yet" and nothing fails.
--
-- AFTER APPLYING: move this file up into supabase/migrations/, record it
-- (`node scripts/check-migrations.mjs --record <file>`), and mark it applied
-- in supabase/migrations/pending/README.md.

-- 1. The tables ---------------------------------------------------------------

create sequence if not exists public.staff_escalations_ref_seq;
revoke all on sequence public.staff_escalations_ref_seq from public, anon, authenticated;

create table if not exists public.staff_escalations (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique
                    default ('ESC-' || lpad(nextval('public.staff_escalations_ref_seq')::text, 6, '0')),
  -- Nullable with ON DELETE SET NULL, as on coo_escalations: the record and
  -- its history stay when a colleague's account is closed.
  raised_by       uuid references auth.users (id) on delete set null,
  source_desk     text not null,
  record_url      text,
  record_label    text,
  category        text not null,
  severity        text not null,
  title           text not null,
  what_happened   text not null,
  what_is_needed  text not null,
  routed_to       text not null,
  level           smallint not null default 0,
  status          text not null default 'open',
  assigned_to     uuid references auth.users (id) on delete set null,
  due_at          timestamptz not null,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users (id) on delete set null,
  resolution      text,
  -- When the overdue job last moved it up or sent a reminder.
  last_nudged_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint staff_escalations_category_chk check (category in
    ('identity_fraud', 'money', 'safety', 'listing', 'technical', 'policy_decision',
     'staff_access', 'member_complaint', 'other')),
  constraint staff_escalations_severity_chk check (severity in ('low', 'normal', 'high', 'urgent')),
  constraint staff_escalations_status_chk check (status in
    ('open', 'acknowledged', 'in_progress', 'waiting_on_raiser', 'resolved', 'declined')),
  constraint staff_escalations_level_chk check (level between 0 and 2),
  constraint staff_escalations_title_len check (char_length(btrim(title)) between 3 and 120),
  constraint staff_escalations_happened_len check (char_length(btrim(what_happened)) between 10 and 4000),
  constraint staff_escalations_needed_len check (char_length(btrim(what_is_needed)) between 5 and 2000),
  constraint staff_escalations_desk_chk check (source_desk ~ '^/admin(/[A-Za-z0-9_/-]*)?$' and char_length(source_desk) <= 200),
  constraint staff_escalations_record_chk check (
    record_url is null
    or (record_url ~ '^/admin/[^[:space:]\\]*$' and record_url !~ '//' and record_url !~ '\.\.'
        and char_length(record_url) <= 500)),
  constraint staff_escalations_record_label_len check (record_label is null or char_length(record_label) <= 120),
  constraint staff_escalations_route_chk check (routed_to ~ '^[a-z_]{2,40}$'),
  constraint staff_escalations_resolution_len check (resolution is null or char_length(resolution) <= 4000),
  constraint staff_escalations_closed_pair check ((status in ('resolved', 'declined')) = (resolved_at is not null))
);

comment on table public.staff_escalations is
  'Something a member of staff cannot or may not decide, raised from any admin desk to the right team, the COO or the super admin. Written only by the staff_escalation_* functions.';

create index if not exists staff_escalations_live_idx on public.staff_escalations (due_at)
  where status not in ('resolved', 'declined');
create index if not exists staff_escalations_route_idx on public.staff_escalations (routed_to, level, status);
create index if not exists staff_escalations_raised_by_idx on public.staff_escalations (raised_by);
create index if not exists staff_escalations_assigned_to_idx on public.staff_escalations (assigned_to);
create index if not exists staff_escalations_resolved_by_idx on public.staff_escalations (resolved_by);

create table if not exists public.staff_escalation_events (
  id            uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references public.staff_escalations (id) on delete restrict,
  -- Null means the system (the overdue job). No foreign key on purpose: the
  -- timeline is append only, so an account closing must not rewrite it.
  actor         uuid,
  kind          text not null,
  body          text,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint staff_escalation_events_kind_chk check (kind in
    ('raised', 'acknowledged', 'assigned', 'comment', 'rerouted', 'bumped', 'asked_raiser',
     'raiser_replied', 'resolved', 'declined', 'reopened')),
  constraint staff_escalation_events_body_len check (body is null or char_length(body) <= 4000)
);

comment on table public.staff_escalation_events is
  'The timeline of a staff escalation. Append only: a trigger refuses every change and every removal.';

create index if not exists staff_escalation_events_escalation_idx
  on public.staff_escalation_events (escalation_id, created_at);

alter table public.staff_escalations enable row level security;
alter table public.staff_escalation_events enable row level security;
revoke all on table public.staff_escalations from public, anon, authenticated;
revoke all on table public.staff_escalation_events from public, anon, authenticated;

-- 2. The timeline cannot be rewritten --------------------------------------------

create or replace function private.staff_escalation_events_frozen()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'staff_escalation_events is append only' using errcode = '55000';
end;
$function$;

revoke all on function private.staff_escalation_events_frozen() from public, anon, authenticated;

create or replace trigger staff_escalation_events_no_rewrite
  before update or delete on public.staff_escalation_events
  for each row execute function private.staff_escalation_events_frozen();
create or replace trigger staff_escalation_events_no_truncate
  before truncate on public.staff_escalation_events
  for each statement execute function private.staff_escalation_events_frozen();

-- 3. The rules, as small private functions ----------------------------------------

-- The response clock. Mirrored in lib/admin/escalations/types.ts (DUE_HOURS).
create or replace function private.staff_escalation_window(p_severity text)
returns interval
language sql
immutable
set search_path to ''
as $function$
  select case p_severity
    when 'urgent' then interval '1 hour'
    when 'high' then interval '4 hours'
    when 'normal' then interval '24 hours'
    when 'low' then interval '72 hours'
  end;
$function$;

-- The routing table. Mirrored in lib/admin/escalations/types.ts (ROUTING);
-- lib/admin/escalations/types.test.ts reads this function and fails if the
-- two drift.
create or replace function private.staff_escalation_route(p_category text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_category
    when 'identity_fraud' then 'trust_safety'
    when 'money' then 'finance'
    when 'safety' then 'trust_safety'
    when 'listing' then 'listing_approval'
    when 'technical' then 'technical'
    when 'policy_decision' then 'coo'
    when 'staff_access' then 'super_admin'
    when 'member_complaint' then 'support_lead'
    when 'other' then 'coo'
  end;
$function$;

-- Where a category goes next when nobody holds its team, before the COO.
-- Mirrored in types.ts (ROUTE_FALLBACK).
create or replace function private.staff_escalation_route_fallback(p_category text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_category
    when 'identity_fraud' then 'compliance'
  end;
$function$;

-- No long run of digits and no card-like number: an ID, bank or card number
-- is linked, never pasted. Mirrored in types.ts (carriesPersonalNumber).
create or replace function private.staff_escalation_text_ok(p_text text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_text is null
      or (p_text !~ '[0-9]{10,}'
          and p_text !~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{1,7}'
          and p_text !~ '[0-9]{4}[ -][0-9]{6}[ -][0-9]{5}');
$function$;

create or replace function private.staff_escalation_is_route(p_target text)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select p_target in ('coo', 'super_admin')
      or exists (select 1 from unnest(enum_range(null::public.staff_scope)) s where s::text = p_target);
$function$;

create or replace function private.staff_escalation_acked(p_user uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (select 1 from public.staff_handbook_acks a
                  where a.user_id = p_user and a.version = private.staff_handbook_version());
$function$;

-- A member of the team that holds a scope.
create or replace function private.staff_escalation_holds(p_user uuid, p_scope text)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select p_user is not null and exists (
    select 1 from public.staff_grants g
     where g.user_id = p_user and g.revoked_at is null
       and p_scope = any (g.scopes::text[])
       and private.staff_escalation_acked(g.user_id));
$function$;

create or replace function private.staff_escalation_is_coo(p_user uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select p_user is not null and exists (
    select 1 from public.staff_grants g
     where g.user_id = p_user and g.revoked_at is null
       and (g.position = 'coo'
            or g.scopes::text[] @> array['listing_approval', 'moderation', 'support', 'agreements', 'operations'])
       and private.staff_escalation_acked(g.user_id));
$function$;

create or replace function private.staff_escalation_is_super(p_user uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select p_user is not null and exists (
    select 1 from public.user_roles r
     where r.user_id = p_user and r.role = 'super_admin'::public.app_role);
$function$;

-- Console staff: the admin role, or any live grant with the handbook
-- acknowledged. The caller's own session must have proved its security key.
create or replace function private.staff_escalation_is_staff(p_user uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select p_user is not null
     and (p_user is distinct from (select auth.uid()) or private.console_step_up_ok())
     and (exists (select 1 from public.user_roles r
                   where r.user_id = p_user and r.role in ('admin'::public.app_role, 'super_admin'::public.app_role))
          or exists (select 1 from public.staff_grants g
                      where g.user_id = p_user and g.revoked_at is null
                        and private.staff_escalation_acked(g.user_id)));
$function$;

-- Is this route staffed by somebody other than p_exclude?
create or replace function private.staff_escalation_staffed(p_target text, p_exclude uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when p_target = 'super_admin' then true
    when p_target = 'coo' then exists (
      select 1 from public.staff_grants g
       where g.user_id is distinct from p_exclude and private.staff_escalation_is_coo(g.user_id))
    else exists (
      select 1 from public.staff_grants g
       where g.user_id is distinct from p_exclude and private.staff_escalation_holds(g.user_id, p_target))
  end;
$function$;

-- The first staffed stop on the way: the team asked for, the category's
-- fallback, the COO, then the super admin. Never an empty team.
create or replace function private.staff_escalation_resolve_route(p_target text, p_fallback text, p_exclude uuid)
returns text
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when private.staff_escalation_staffed(p_target, p_exclude) then p_target
    when p_fallback is not null and private.staff_escalation_staffed(p_fallback, p_exclude) then p_fallback
    when private.staff_escalation_staffed('coo', p_exclude) then 'coo'
    else 'super_admin'
  end;
$function$;

create or replace function private.staff_escalation_level_of(p_target text)
returns smallint
language sql
immutable
set search_path to ''
as $function$
  select (case p_target when 'super_admin' then 2 when 'coo' then 1 else 0 end)::smallint;
$function$;

-- Is this escalation waiting on this person's group at its present level?
create or replace function private.staff_escalation_waits_on(p_user uuid, p_routed_to text, p_level smallint)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when p_level >= 2 then private.staff_escalation_is_super(p_user)
    when p_level = 1 then private.staff_escalation_is_coo(p_user)
    else private.staff_escalation_holds(p_user, p_routed_to)
  end;
$function$;

-- May this person work it: the team it was routed to, whoever holds it now,
-- the COO and the super admin.
create or replace function private.staff_escalation_handles(p_user uuid, p_routed_to text, p_assigned uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select p_user is not null
     and (p_user is not distinct from p_assigned
          or private.staff_escalation_is_super(p_user)
          or private.staff_escalation_is_coo(p_user)
          or (p_routed_to not in ('coo', 'super_admin') and private.staff_escalation_holds(p_user, p_routed_to)));
$function$;

-- The people an escalation is with right now: its owner when one took it,
-- otherwise the group at its level.
create or replace function private.staff_escalation_receivers(p_routed_to text, p_level smallint, p_assigned uuid)
returns setof uuid
language sql
stable security definer
set search_path to ''
as $function$
  select p_assigned where p_assigned is not null
  union
  select r.user_id from public.user_roles r
   where p_assigned is null and p_level >= 2 and r.role = 'super_admin'::public.app_role
  union
  select g.user_id from public.staff_grants g
   where p_assigned is null and p_level = 1 and private.staff_escalation_is_coo(g.user_id)
  union
  select g.user_id from public.staff_grants g
   where p_assigned is null and p_level = 0 and private.staff_escalation_holds(g.user_id, p_routed_to);
$function$;

create or replace function private.staff_escalation_name(p_user uuid)
returns text
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(
    (select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.first_name), ''))
       from public.profiles p where p.id = p_user),
    'A colleague');
$function$;

create or replace function private.staff_escalation_route_words(p_target text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_target
    when 'coo' then 'the COO'
    when 'super_admin' then 'the super admin'
    else 'the ' || replace(p_target, '_', ' ') || ' team'
  end;
$function$;

-- One person told: a notice in the app, and an email when asked for. Telling
-- never blocks the write that caused it.
create or replace function private.staff_escalation_tell(
  p_user uuid, p_event text, p_event_id uuid, p_escalation uuid, p_reference text, p_title text,
  p_severity text, p_due timestamptz, p_notice_title text, p_email boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_user is null then
    return;
  end if;
  begin
    perform private.notify(p_user, 'system'::public.notification_kind, p_notice_title,
      p_reference || ': ' || left(p_title, 140), '/admin/escalations/' || p_escalation::text);
    if p_email then
      perform private.email_outbox_enqueue(p_user, 'staff.escalation',
        'staff.escalation:' || p_event_id::text || ':' || p_user::text,
        -- The reference and the clock only. The title and the text stay in the console.
        jsonb_build_object('event', p_event, 'escalation_id', p_escalation, 'reference', p_reference,
                           'severity', p_severity, 'due_at', p_due));
    end if;
  exception when others then
    raise warning 'staff_escalation_tell(%): %', p_event, sqlerrm;
  end;
end;
$function$;

create or replace function private.staff_escalation_log(p_actor uuid, p_action text, p_id uuid, p_meta jsonb)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'staff_escalation.' || p_action, 'staff_escalation', p_id::text, coalesce(p_meta, '{}'::jsonb));
$function$;

revoke all on function private.staff_escalation_window(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_route(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_route_fallback(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_text_ok(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_is_route(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_acked(uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_holds(uuid, text) from public, anon, authenticated;
revoke all on function private.staff_escalation_is_coo(uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_is_super(uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_is_staff(uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_staffed(text, uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_resolve_route(text, text, uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_level_of(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_waits_on(uuid, text, smallint) from public, anon, authenticated;
revoke all on function private.staff_escalation_handles(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_receivers(text, smallint, uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_name(uuid) from public, anon, authenticated;
revoke all on function private.staff_escalation_route_words(text) from public, anon, authenticated;
revoke all on function private.staff_escalation_tell(uuid, text, uuid, uuid, text, text, text, timestamptz, text, boolean) from public, anon, authenticated;
revoke all on function private.staff_escalation_log(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- 4. Raise ----------------------------------------------------------------------

create or replace function public.staff_escalation_raise(
  p_category text,
  p_severity text,
  p_title text,
  p_what_happened text,
  p_what_is_needed text,
  p_source_desk text,
  p_record_url text default null,
  p_record_label text default null,
  p_routed_to text default null)
returns jsonb
language plpgsql
volatile security definer
set search_path to ''
as $function$
declare
  actor    uuid := (select auth.uid());
  v_title  text := btrim(coalesce(p_title, ''));
  v_what   text := btrim(coalesce(p_what_happened, ''));
  v_need   text := btrim(coalesce(p_what_is_needed, ''));
  v_desk   text := btrim(coalesce(p_source_desk, ''));
  v_record text := nullif(btrim(coalesce(p_record_url, '')), '');
  v_label  text := nullif(btrim(coalesce(p_record_label, '')), '');
  v_asked  text := nullif(btrim(coalesce(p_routed_to, '')), '');
  intended text;
  target   text;
  e        public.staff_escalations%rowtype;
  ev       uuid;
  who      uuid;
  told     uuid[] := '{}';
begin
  if actor is null or not private.staff_escalation_is_staff(actor) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if private.staff_escalation_route(p_category) is null then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  if private.staff_escalation_window(p_severity) is null then
    return jsonb_build_object('status', 'invalid_severity');
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    return jsonb_build_object('status', 'title_length');
  end if;
  if char_length(v_what) < 10 or char_length(v_what) > 4000 then
    return jsonb_build_object('status', 'what_happened_length');
  end if;
  if char_length(v_need) < 5 or char_length(v_need) > 2000 then
    return jsonb_build_object('status', 'what_is_needed_length');
  end if;
  if v_desk !~ '^/admin(/[A-Za-z0-9_/-]*)?$' or char_length(v_desk) > 200 then
    return jsonb_build_object('status', 'invalid_desk');
  end if;
  if v_record is not null
     and (v_record !~ '^/admin/[^[:space:]\\]*$' or v_record ~ '//' or v_record ~ '\.\.' or char_length(v_record) > 500) then
    return jsonb_build_object('status', 'invalid_record');
  end if;
  if v_label is not null and char_length(v_label) > 120 then
    v_label := left(v_label, 120);
  end if;
  if not (private.staff_escalation_text_ok(v_title) and private.staff_escalation_text_ok(v_what)
          and private.staff_escalation_text_ok(v_need) and private.staff_escalation_text_ok(v_label)) then
    return jsonb_build_object('status', 'personal_data');
  end if;
  if v_asked is not null and not private.staff_escalation_is_route(v_asked) then
    return jsonb_build_object('status', 'invalid_route');
  end if;

  intended := coalesce(v_asked, private.staff_escalation_route(p_category));
  target := private.staff_escalation_resolve_route(
    intended,
    case when v_asked is null then private.staff_escalation_route_fallback(p_category) end,
    actor);

  insert into public.staff_escalations
    (raised_by, source_desk, record_url, record_label, category, severity, title, what_happened,
     what_is_needed, routed_to, level, status, due_at)
  values
    (actor, v_desk, v_record, v_label, p_category, p_severity, v_title, v_what, v_need, target,
     private.staff_escalation_level_of(target), 'open', now() + private.staff_escalation_window(p_severity))
  returning * into e;

  insert into public.staff_escalation_events (escalation_id, actor, kind, detail)
  values (e.id, actor, 'raised',
          jsonb_build_object('routed_to', target, 'intended', intended, 'fallback', target <> intended,
                             'severity', e.severity, 'category', e.category))
  returning id into ev;

  perform private.staff_escalation_log(actor, 'raise', e.id,
    jsonb_build_object('reference', e.reference, 'category', e.category, 'severity', e.severity,
                       'routed_to', target, 'intended', intended, 'source_desk', e.source_desk));

  for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, null) r where r <> actor loop
    perform private.staff_escalation_tell(who, 'raised', ev, e.id, e.reference, e.title, e.severity, e.due_at,
      case when e.severity = 'urgent' then 'An urgent escalation needs you' else 'An escalation needs you' end, true);
    told := told || who;
  end loop;
  -- Urgent: the super admin hears at once, whatever the route.
  if e.severity = 'urgent' then
    for who in select r.user_id from public.user_roles r
                where r.role = 'super_admin'::public.app_role
                  and r.user_id <> actor and not (r.user_id = any (told)) loop
      perform private.staff_escalation_tell(who, 'urgent', ev, e.id, e.reference, e.title, e.severity, e.due_at,
        'An urgent escalation was raised', true);
    end loop;
  end if;

  return jsonb_build_object('status', 'ok', 'id', e.id, 'reference', e.reference, 'routed_to', e.routed_to,
                            'intended', intended, 'level', e.level, 'due_at', e.due_at, 'severity', e.severity);
end;
$function$;

-- 5. Read -----------------------------------------------------------------------

-- One row of a list, as the screens read it. p_me decides the "me" flags.
create or replace function private.staff_escalation_row(e public.staff_escalations, p_me uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', e.id, 'reference', e.reference, 'title', e.title, 'category', e.category, 'severity', e.severity,
    'status', e.status, 'routed_to', e.routed_to, 'level', e.level, 'source_desk', e.source_desk,
    'raised_by_name', case when e.raised_by is null then null else private.staff_escalation_name(e.raised_by) end,
    'raised_by_me', e.raised_by is not distinct from p_me,
    'assigned_to_name', case when e.assigned_to is null then null else private.staff_escalation_name(e.assigned_to) end,
    'assigned_to_me', e.assigned_to is not null and e.assigned_to = p_me,
    'due_at', e.due_at, 'created_at', e.created_at, 'updated_at', e.updated_at,
    'acknowledged_at', e.acknowledged_at, 'resolved_at', e.resolved_at,
    'waiting_on_me',
      (e.status in ('open', 'acknowledged', 'in_progress')
       and (e.assigned_to = p_me
            or (e.assigned_to is null and private.staff_escalation_waits_on(p_me, e.routed_to, e.level))))
      or (e.status = 'waiting_on_raiser' and e.raised_by = p_me));
$function$;

revoke all on function private.staff_escalation_row(public.staff_escalations, uuid) from public, anon, authenticated;

create or replace function public.staff_escalation_list(p_view text default 'for_me')
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  me     uuid := (select auth.uid());
  lead   boolean;
  rows   jsonb;
begin
  if me is null or not private.staff_escalation_is_staff(me) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_view is null or p_view not in ('for_me', 'mine', 'all') then
    return jsonb_build_object('status', 'invalid_view');
  end if;
  lead := private.staff_escalation_is_coo(me) or private.staff_escalation_is_super(me);
  if p_view = 'all' and not lead then
    return jsonb_build_object('status', 'forbidden');
  end if;

  -- Overdue first, then the soonest due; closed ones last, newest first.
  select coalesce(jsonb_agg(x.r order by x.closed, x.overdue desc, x.sort_key, x.created_at), '[]'::jsonb)
    into rows
    from (
      select private.staff_escalation_row(e, me) as r,
             e.status in ('resolved', 'declined') as closed,
             (e.status not in ('resolved', 'declined') and e.due_at < now()) as overdue,
             case when e.status in ('resolved', 'declined') then -extract(epoch from e.updated_at)
                  else extract(epoch from e.due_at) end as sort_key,
             e.created_at
        from public.staff_escalations e
       where case p_view
               when 'mine' then e.raised_by = me
               when 'all' then true
               else (e.status in ('open', 'acknowledged', 'in_progress')
                     and (e.assigned_to = me
                          or (e.assigned_to is null and private.staff_escalation_waits_on(me, e.routed_to, e.level))))
                    or (e.status = 'waiting_on_raiser' and e.raised_by = me)
             end
       order by 2, 3 desc, 4, 5
       limit 200) x;

  return jsonb_build_object('status', 'ok', 'view', p_view, 'can_see_all', lead, 'rows', rows);
end;
$function$;

create or replace function public.staff_escalation_get(p_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  me      uuid := (select auth.uid());
  e       public.staff_escalations%rowtype;
  handler boolean;
  lead    boolean;
  events  jsonb;
  people  jsonb := '[]'::jsonb;
begin
  if me is null or not private.staff_escalation_is_staff(me) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select * into e from public.staff_escalations where id = p_id;
  if e.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  handler := private.staff_escalation_handles(me, e.routed_to, e.assigned_to);
  -- Somebody who may not see it is told the same as when it does not exist.
  if not (handler or e.raised_by is not distinct from me) then
    return jsonb_build_object('status', 'not_found');
  end if;
  lead := private.staff_escalation_is_coo(me) or private.staff_escalation_is_super(me);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'kind', v.kind, 'body', v.body, 'detail', v.detail, 'created_at', v.created_at,
           'system', v.actor is null,
           'actor_name', case when v.actor is null then null else private.staff_escalation_name(v.actor) end,
           'actor_me', v.actor is not null and v.actor = me)
           order by v.created_at, v.id), '[]'::jsonb)
    into events
    from public.staff_escalation_events v
   where v.escalation_id = e.id;

  -- Who a lead may hand it to: the routed team, the COO and the super admin.
  if lead then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.uid, 'name', private.staff_escalation_name(c.uid))
                              order by private.staff_escalation_name(c.uid)), '[]'::jsonb)
      into people
      from (
        select g.user_id as uid from public.staff_grants g
         where (private.staff_escalation_is_coo(g.user_id)
                or (e.routed_to not in ('coo', 'super_admin') and private.staff_escalation_holds(g.user_id, e.routed_to)))
        union
        select r.user_id from public.user_roles r where r.role = 'super_admin'::public.app_role
      ) c
     where c.uid is distinct from e.raised_by
     limit 50;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'escalation', private.staff_escalation_row(e, me) || jsonb_build_object(
      'what_happened', e.what_happened, 'what_is_needed', e.what_is_needed,
      'record_url', e.record_url, 'record_label', e.record_label, 'resolution', e.resolution,
      'resolved_by_name', case when e.resolved_by is null then null else private.staff_escalation_name(e.resolved_by) end),
    'events', events,
    'viewer', jsonb_build_object(
      'is_raiser', e.raised_by is not distinct from me,
      'is_handler', handler,
      'is_lead', lead,
      'is_assignee', e.assigned_to is not null and e.assigned_to = me),
    'assignable', people);
end;
$function$;

-- The nav badge, and which routes have somebody on them (for the form's
-- "this goes to" line).
create or replace function public.staff_escalation_counts()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  me       uuid := (select auth.uid());
  waiting  integer;
  overdue  integer;
  staffed  jsonb;
begin
  if me is null or not private.staff_escalation_is_staff(me) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select count(*), count(*) filter (where e.due_at < now())
    into waiting, overdue
    from public.staff_escalations e
   where (e.status in ('open', 'acknowledged', 'in_progress')
          and (e.assigned_to = me
               or (e.assigned_to is null and private.staff_escalation_waits_on(me, e.routed_to, e.level))))
      or (e.status = 'waiting_on_raiser' and e.raised_by = me);

  select coalesce(jsonb_agg(t.target order by t.target), '[]'::jsonb)
    into staffed
    from (select s::text as target from unnest(enum_range(null::public.staff_scope)) s
          union all select 'coo' union all select 'super_admin') t
   where private.staff_escalation_staffed(t.target, me);

  return jsonb_build_object('status', 'ok', 'waiting', waiting, 'overdue', overdue, 'staffed', staffed,
                            'can_see_all', private.staff_escalation_is_coo(me) or private.staff_escalation_is_super(me));
end;
$function$;

-- 6. Act ------------------------------------------------------------------------

create or replace function public.staff_escalation_act(
  p_id uuid, p_action text, p_body text default null, p_target text default null)
returns jsonb
language plpgsql
volatile security definer
set search_path to ''
as $function$
declare
  actor    uuid := (select auth.uid());
  note     text := nullif(btrim(coalesce(p_body, '')), '');
  e        public.staff_escalations%rowtype;
  handler  boolean;
  raiser   boolean;
  lead     boolean;
  own      boolean;
  live     boolean;
  ev       uuid;
  who      uuid;
  assignee uuid;
  target   text;
  half     interval;
  first_ack boolean;
begin
  if actor is null or not private.staff_escalation_is_staff(actor) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_action is null or p_action not in
     ('acknowledge', 'assign', 'comment', 'reroute', 'ask_raiser', 'raiser_reply', 'resolve', 'decline', 'reopen') then
    return jsonb_build_object('status', 'invalid_action');
  end if;
  select * into e from public.staff_escalations where id = p_id for update;
  if e.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  handler := private.staff_escalation_handles(actor, e.routed_to, e.assigned_to);
  raiser := e.raised_by is not distinct from actor;
  if not (handler or raiser) then
    return jsonb_build_object('status', 'not_found');
  end if;
  lead := private.staff_escalation_is_coo(actor) or private.staff_escalation_is_super(actor);
  -- Nobody works their own escalation, except a lead with nobody above them.
  own := raiser and not lead;
  live := e.status not in ('resolved', 'declined');
  if note is not null and char_length(note) > 4000 then
    return jsonb_build_object('status', 'too_long');
  end if;
  if not private.staff_escalation_text_ok(note) then
    return jsonb_build_object('status', 'personal_data');
  end if;
  half := greatest(private.staff_escalation_window(e.severity) / 2, interval '1 hour');

  if p_action = 'acknowledge' then
    if not handler or own then return jsonb_build_object('status', 'forbidden'); end if;
    if e.status <> 'open' then return jsonb_build_object('status', 'not_open'); end if;
    update public.staff_escalations
       set status = 'acknowledged', acknowledged_at = now(), updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind)
    values (e.id, actor, 'acknowledged') returning id into ev;
    perform private.staff_escalation_log(actor, 'acknowledge', e.id, jsonb_build_object('reference', e.reference));
    if e.raised_by is not null and e.raised_by <> actor then
      perform private.staff_escalation_tell(e.raised_by, 'acknowledged', ev, e.id, e.reference, e.title, e.severity,
        e.due_at, 'Your escalation was acknowledged', true);
    end if;

  elsif p_action = 'assign' then
    if not live then return jsonb_build_object('status', 'closed'); end if;
    if p_target is null or btrim(p_target) = '' or btrim(p_target) = actor::text then
      if not handler or own then return jsonb_build_object('status', 'forbidden'); end if;
      assignee := actor;
    else
      if not lead then return jsonb_build_object('status', 'forbidden'); end if;
      begin
        assignee := btrim(p_target)::uuid;
      exception when others then
        return jsonb_build_object('status', 'invalid_target');
      end;
      if assignee is not distinct from e.raised_by
         or not private.staff_escalation_handles(assignee, e.routed_to, null) then
        return jsonb_build_object('status', 'invalid_target');
      end if;
    end if;
    if e.assigned_to is not distinct from assignee then
      return jsonb_build_object('status', 'already');
    end if;
    first_ack := e.acknowledged_at is null;
    update public.staff_escalations
       set assigned_to = assignee,
           status = case when status in ('open', 'acknowledged') then 'in_progress' else status end,
           acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, detail)
    values (e.id, actor, 'assigned',
            jsonb_build_object('to_name', private.staff_escalation_name(assignee), 'self', assignee = actor))
    returning id into ev;
    perform private.staff_escalation_log(actor, 'assign', e.id,
      jsonb_build_object('reference', e.reference, 'assigned_to', assignee));
    if assignee <> actor then
      perform private.staff_escalation_tell(assignee, 'assigned', ev, e.id, e.reference, e.title, e.severity,
        e.due_at, 'An escalation was given to you', true);
    end if;
    if first_ack and e.raised_by is not null and e.raised_by <> actor then
      perform private.staff_escalation_tell(e.raised_by, 'acknowledged', ev, e.id, e.reference, e.title, e.severity,
        e.due_at, 'Your escalation was picked up', true);
    end if;

  elsif p_action = 'comment' then
    if not live then return jsonb_build_object('status', 'closed'); end if;
    if note is null or char_length(note) < 2 or char_length(note) > 2000 then
      return jsonb_build_object('status', 'note_needed');
    end if;
    update public.staff_escalations set updated_at = now() where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body)
    values (e.id, actor, 'comment', note) returning id into ev;
    perform private.staff_escalation_log(actor, 'comment', e.id, jsonb_build_object('reference', e.reference));
    -- The other side hears, in the app only.
    if raiser then
      for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, e.assigned_to) r where r <> actor loop
        perform private.staff_escalation_tell(who, 'comment', ev, e.id, e.reference, e.title, e.severity, e.due_at,
          'A note was added to an escalation', false);
      end loop;
    elsif e.raised_by is not null then
      perform private.staff_escalation_tell(e.raised_by, 'comment', ev, e.id, e.reference, e.title, e.severity,
        e.due_at, 'A note was added to your escalation', false);
    end if;

  elsif p_action = 'reroute' then
    if not handler or own then return jsonb_build_object('status', 'forbidden'); end if;
    if not live then return jsonb_build_object('status', 'closed'); end if;
    if p_target is null or not private.staff_escalation_is_route(btrim(p_target)) then
      return jsonb_build_object('status', 'invalid_route');
    end if;
    if note is null or char_length(note) < 10 or char_length(note) > 1000 then
      return jsonb_build_object('status', 'reason_needed');
    end if;
    target := private.staff_escalation_resolve_route(btrim(p_target), null, actor);
    if target = e.routed_to and private.staff_escalation_level_of(target) = e.level then
      return jsonb_build_object('status', 'already');
    end if;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body, detail)
    values (e.id, actor, 'rerouted', note,
            jsonb_build_object('from', e.routed_to, 'to', target, 'intended', btrim(p_target)))
    returning id into ev;
    perform private.staff_escalation_log(actor, 'reroute', e.id,
      jsonb_build_object('reference', e.reference, 'from', e.routed_to, 'to', target));
    update public.staff_escalations
       set routed_to = target, level = private.staff_escalation_level_of(target), assigned_to = null,
           status = 'open', acknowledged_at = null, last_nudged_at = null,
           due_at = now() + private.staff_escalation_window(severity), updated_at = now()
     where id = e.id returning * into e;
    for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, null) r where r <> actor loop
      perform private.staff_escalation_tell(who, 'rerouted', ev, e.id, e.reference, e.title, e.severity, e.due_at,
        'An escalation was sent to you', true);
    end loop;
    if e.raised_by is not null and e.raised_by <> actor then
      perform private.staff_escalation_tell(e.raised_by, 'rerouted_raiser', ev, e.id, e.reference, e.title, e.severity,
        e.due_at, 'Your escalation went to ' || private.staff_escalation_route_words(target), false);
    end if;

  elsif p_action = 'ask_raiser' then
    if not handler or own then return jsonb_build_object('status', 'forbidden'); end if;
    if not live then return jsonb_build_object('status', 'closed'); end if;
    if e.raised_by is null then return jsonb_build_object('status', 'no_raiser'); end if;
    if e.status = 'waiting_on_raiser' then return jsonb_build_object('status', 'already'); end if;
    if note is null or char_length(note) < 5 or char_length(note) > 2000 then
      return jsonb_build_object('status', 'note_needed');
    end if;
    update public.staff_escalations
       set status = 'waiting_on_raiser', acknowledged_at = coalesce(acknowledged_at, now()),
           last_nudged_at = now(), updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body)
    values (e.id, actor, 'asked_raiser', note) returning id into ev;
    perform private.staff_escalation_log(actor, 'ask_raiser', e.id, jsonb_build_object('reference', e.reference));
    perform private.staff_escalation_tell(e.raised_by, 'asked', ev, e.id, e.reference, e.title, e.severity, e.due_at,
      'A question about your escalation', true);

  elsif p_action = 'raiser_reply' then
    if not raiser then return jsonb_build_object('status', 'forbidden'); end if;
    if e.status <> 'waiting_on_raiser' then return jsonb_build_object('status', 'not_waiting'); end if;
    if note is null or char_length(note) < 2 or char_length(note) > 2000 then
      return jsonb_build_object('status', 'note_needed');
    end if;
    update public.staff_escalations
       set status = case when assigned_to is null then 'acknowledged' else 'in_progress' end,
           due_at = greatest(due_at, now() + half), last_nudged_at = null, updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body)
    values (e.id, actor, 'raiser_replied', note) returning id into ev;
    perform private.staff_escalation_log(actor, 'raiser_reply', e.id, jsonb_build_object('reference', e.reference));
    for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, e.assigned_to) r where r <> actor loop
      perform private.staff_escalation_tell(who, 'answered', ev, e.id, e.reference, e.title, e.severity, e.due_at,
        'The raiser answered your question', true);
    end loop;

  elsif p_action in ('resolve', 'decline') then
    if not handler or own then return jsonb_build_object('status', 'forbidden'); end if;
    if not live then return jsonb_build_object('status', 'closed'); end if;
    if note is null or char_length(note) < 10 then
      return jsonb_build_object('status', case when p_action = 'resolve' then 'resolution_needed' else 'reason_needed' end);
    end if;
    update public.staff_escalations
       set status = case when p_action = 'resolve' then 'resolved' else 'declined' end,
           resolved_at = now(), resolved_by = actor, resolution = note,
           acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body)
    values (e.id, actor, case when p_action = 'resolve' then 'resolved' else 'declined' end, note)
    returning id into ev;
    perform private.staff_escalation_log(actor, p_action, e.id, jsonb_build_object('reference', e.reference));
    if e.raised_by is not null and e.raised_by <> actor then
      perform private.staff_escalation_tell(e.raised_by,
        case when p_action = 'resolve' then 'resolved' else 'declined' end,
        ev, e.id, e.reference, e.title, e.severity, e.due_at,
        case when p_action = 'resolve' then 'Your escalation was resolved' else 'Your escalation was declined' end, true);
    end if;

  elsif p_action = 'reopen' then
    if not (raiser or lead) then return jsonb_build_object('status', 'forbidden'); end if;
    if live then return jsonb_build_object('status', 'not_closed'); end if;
    if e.resolved_at < now() - interval '14 days' then
      return jsonb_build_object('status', 'too_late');
    end if;
    if note is null or char_length(note) < 5 or char_length(note) > 1000 then
      return jsonb_build_object('status', 'reason_needed');
    end if;
    update public.staff_escalations
       set status = 'open', resolved_at = null, resolved_by = null, resolution = null,
           acknowledged_at = null, last_nudged_at = null,
           due_at = now() + private.staff_escalation_window(severity), updated_at = now()
     where id = e.id returning * into e;
    insert into public.staff_escalation_events (escalation_id, actor, kind, body)
    values (e.id, actor, 'reopened', note) returning id into ev;
    perform private.staff_escalation_log(actor, 'reopen', e.id, jsonb_build_object('reference', e.reference));
    for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, e.assigned_to) r where r <> actor loop
      perform private.staff_escalation_tell(who, 'reopened', ev, e.id, e.reference, e.title, e.severity, e.due_at,
        'An escalation was reopened', true);
    end loop;
  end if;

  return jsonb_build_object('status', 'ok', 'id', e.id, 'reference', e.reference, 'escalation_status', e.status,
                            'routed_to', e.routed_to, 'level', e.level, 'due_at', e.due_at);
end;
$function$;

-- 7. The overdue job ----------------------------------------------------------------

create or replace function public.staff_escalation_bump_overdue()
returns jsonb
language plpgsql
volatile security definer
set search_path to ''
as $function$
declare
  e        public.staff_escalations%rowtype;
  ev       uuid;
  who      uuid;
  next_lvl smallint;
  bumped   integer := 0;
  reminded integer := 0;
  nudged   integer := 0;
begin
  -- The scheduled job only. A signed-in person is never the job.
  if (select auth.uid()) is not null then
    return jsonb_build_object('status', 'forbidden');
  end if;

  for e in
    select * from public.staff_escalations
     where status in ('open', 'acknowledged', 'in_progress') and due_at < now()
     order by due_at
     limit 200
     for update skip locked
  loop
    if e.level < 2 then
      -- Team to COO to super admin. With no COO it goes straight to the top.
      next_lvl := case when e.level = 0 and private.staff_escalation_staffed('coo', null) then 1 else 2 end;
      insert into public.staff_escalation_events (escalation_id, actor, kind, detail)
      values (e.id, null, 'bumped',
              jsonb_build_object('from_level', e.level, 'to_level', next_lvl, 'was_due', e.due_at))
      returning id into ev;
      update public.staff_escalations
         set level = next_lvl, assigned_to = null, last_nudged_at = now(), updated_at = now(),
             due_at = now() + greatest(private.staff_escalation_window(severity) / 2, interval '1 hour')
       where id = e.id returning * into e;
      perform private.staff_escalation_log(null, 'bump', e.id,
        jsonb_build_object('reference', e.reference, 'to_level', next_lvl));
      for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, null) r loop
        perform private.staff_escalation_tell(who, 'bumped', ev, e.id, e.reference, e.title, e.severity, e.due_at,
          'An overdue escalation moved up to you', true);
      end loop;
      bumped := bumped + 1;
    elsif e.last_nudged_at is null or e.last_nudged_at < now() - interval '1 day' then
      -- The top level: nowhere higher to go, so one reminder a day.
      insert into public.staff_escalation_events (escalation_id, actor, kind, detail)
      values (e.id, null, 'bumped', jsonb_build_object('reminder', true, 'was_due', e.due_at))
      returning id into ev;
      update public.staff_escalations set last_nudged_at = now() where id = e.id;
      for who in select r from private.staff_escalation_receivers(e.routed_to, e.level, e.assigned_to) r loop
        perform private.staff_escalation_tell(who, 'reminder', ev, e.id, e.reference, e.title, e.severity, e.due_at,
          'An escalation is still overdue', true);
      end loop;
      reminded := reminded + 1;
    end if;
  end loop;

  -- A question still with the raiser: the clock is theirs, so they are
  -- reminded once a day and nothing moves up. When the raiser has left, the
  -- question can never be answered, so it goes back to the people who hold it.
  for e in
    select * from public.staff_escalations
     where status = 'waiting_on_raiser' and due_at < now()
       and (last_nudged_at is null or last_nudged_at < now() - interval '1 day')
     order by due_at
     limit 200
     for update skip locked
  loop
    if e.raised_by is null then
      update public.staff_escalations
         set status = case when assigned_to is null then 'acknowledged' else 'in_progress' end, updated_at = now()
       where id = e.id;
    else
      update public.staff_escalations set last_nudged_at = now() where id = e.id;
      perform private.staff_escalation_tell(e.raised_by, 'asked_again', gen_random_uuid(), e.id, e.reference, e.title,
        e.severity, e.due_at, 'A question about your escalation is still waiting', true);
      nudged := nudged + 1;
    end if;
  end loop;

  return jsonb_build_object('status', 'ok', 'bumped', bumped, 'reminded', reminded, 'nudged', nudged);
end;
$function$;

-- 8. Who may call what --------------------------------------------------------------

revoke all on function public.staff_escalation_raise(text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.staff_escalation_list(text) from public, anon;
revoke all on function public.staff_escalation_get(uuid) from public, anon;
revoke all on function public.staff_escalation_counts() from public, anon;
revoke all on function public.staff_escalation_act(uuid, text, text, text) from public, anon;
revoke all on function public.staff_escalation_bump_overdue() from public, anon, authenticated;
grant execute on function public.staff_escalation_raise(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.staff_escalation_list(text) to authenticated;
grant execute on function public.staff_escalation_get(uuid) to authenticated;
grant execute on function public.staff_escalation_counts() to authenticated;
grant execute on function public.staff_escalation_act(uuid, text, text, text) to authenticated;
grant execute on function public.staff_escalation_bump_overdue() to service_role;

-- 9. Read back ----------------------------------------------------------------------

do $check$
declare
  fn text;
begin
  if to_regclass('public.staff_escalations') is null then
    raise exception 'staff_escalations: table missing';
  end if;
  if to_regclass('public.staff_escalation_events') is null then
    raise exception 'staff_escalation_events: table missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.staff_escalations'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.staff_escalation_events'::regclass) then
    raise exception 'RLS is off on an escalation table';
  end if;
  if has_table_privilege('anon', 'public.staff_escalations', 'select')
     or has_table_privilege('authenticated', 'public.staff_escalations', 'select')
     or has_table_privilege('authenticated', 'public.staff_escalations', 'insert')
     or has_table_privilege('authenticated', 'public.staff_escalations', 'update')
     or has_table_privilege('anon', 'public.staff_escalation_events', 'select')
     or has_table_privilege('authenticated', 'public.staff_escalation_events', 'select')
     or has_table_privilege('authenticated', 'public.staff_escalation_events', 'insert') then
    raise exception 'a member can reach an escalation table directly';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.staff_escalation_events'::regclass
                    and tgname = 'staff_escalation_events_no_rewrite' and not tgisinternal) then
    raise exception 'the timeline can be rewritten: the append-only trigger is missing';
  end if;
  foreach fn in array array[
    'public.staff_escalation_raise(text,text,text,text,text,text,text,text,text)',
    'public.staff_escalation_list(text)',
    'public.staff_escalation_get(uuid)',
    'public.staff_escalation_counts()',
    'public.staff_escalation_act(uuid,text,text,text)',
    'public.staff_escalation_bump_overdue()'] loop
    if to_regprocedure(fn) is null then
      raise exception '% is missing', fn;
    end if;
    if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure(fn)) then
      raise exception '% is not SECURITY DEFINER', fn;
    end if;
    if not exists (select 1 from pg_proc p
                    where p.oid = to_regprocedure(fn) and p.proconfig @> array['search_path=""']) then
      raise exception '% does not pin an empty search_path', fn;
    end if;
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'anon can call %', fn;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public.staff_escalation_bump_overdue()', 'execute') then
    raise exception 'a signed-in person can run the overdue job';
  end if;
  if not has_function_privilege('service_role', 'public.staff_escalation_bump_overdue()', 'execute') then
    raise exception 'the service role cannot run the overdue job';
  end if;
  if not has_function_privilege('authenticated', 'public.staff_escalation_raise(text,text,text,text,text,text,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.staff_escalation_act(uuid,text,text,text)', 'execute') then
    raise exception 'staff cannot call the escalation doors';
  end if;
  if has_function_privilege('authenticated', 'private.staff_escalation_tell(uuid,text,uuid,uuid,text,text,text,timestamptz,text,boolean)', 'execute')
     or has_function_privilege('authenticated', 'private.staff_escalation_is_staff(uuid)', 'execute') then
    raise exception 'authenticated can call a private escalation helper';
  end if;
  -- With no caller, every door refuses.
  if public.staff_escalation_raise('other', 'low', 'A probe title', 'A probe of what happened.', 'A probe need.', '/admin') ->> 'status' <> 'forbidden' then
    raise exception 'raise must refuse a caller with no identity';
  end if;
  if public.staff_escalation_list('for_me') ->> 'status' <> 'forbidden'
     or public.staff_escalation_get(gen_random_uuid()) ->> 'status' <> 'forbidden'
     or public.staff_escalation_counts() ->> 'status' <> 'forbidden'
     or public.staff_escalation_act(gen_random_uuid(), 'acknowledge') ->> 'status' <> 'forbidden' then
    raise exception 'a read or an action answered a caller with no identity';
  end if;
  -- The routing table sends every category somewhere real.
  if exists (select 1 from unnest(array['identity_fraud', 'money', 'safety', 'listing', 'technical',
                                        'policy_decision', 'staff_access', 'member_complaint', 'other']) c
              where not private.staff_escalation_is_route(private.staff_escalation_route(c))) then
    raise exception 'a category routes to something that is not a team, the COO or the super admin';
  end if;
  if not private.staff_escalation_is_route('compliance') then
    raise exception 'the identity fallback is not a staff scope';
  end if;
end
$check$;

notify pgrst, 'reload schema';
