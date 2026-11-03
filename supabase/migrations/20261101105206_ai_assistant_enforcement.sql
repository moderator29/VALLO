-- VALLO AI ASSISTANT, PHASE 1: the enforcement layer.
-- Off by default. Every grant, revoke and decision is made by a SECURITY
-- DEFINER function that reads auth.uid() itself, so the browser and the model
-- can never name another person. Nothing here touches bookings, transactions
-- or any ledger.

create table if not exists public.ai_assistant_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  terms_version text,
  privacy_version text,
  accepted_at timestamptz,
  grant_epoch integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistant_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  permission text not null check (permission in (
    'discovery', 'saved_prefs', 'bookings_viewings', 'account_info',
    'transactions', 'wallet_balance', 'payment_assist', 'notifications'
  )),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, permission)
);

create table if not exists public.ai_assistant_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  event text not null check (char_length(event) between 1 and 60),
  permission text,
  tool text,
  outcome text not null default 'ok' check (outcome in ('ok', 'denied', 'refused', 'failed')),
  detail jsonb not null default '{}'::jsonb
);
create index if not exists ai_assistant_audit_user_at_idx on public.ai_assistant_audit (user_id, at desc);

create table if not exists public.ai_learned_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 80),
  value jsonb not null,
  source text not null default 'member' check (source in ('member', 'activity', 'conversation')),
  weight numeric not null default 1 check (weight between -5 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 60),
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  result jsonb
);
create index if not exists ai_action_proposals_user_idx on public.ai_action_proposals (user_id, created_at desc);

alter table public.ai_assistant_settings enable row level security;
alter table public.ai_assistant_permissions enable row level security;
alter table public.ai_assistant_audit enable row level security;
alter table public.ai_learned_preferences enable row level security;
alter table public.ai_action_proposals enable row level security;

create policy ai_settings_select_own on public.ai_assistant_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_permissions_select_own on public.ai_assistant_permissions
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_audit_select_own on public.ai_assistant_audit
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_proposals_select_own on public.ai_action_proposals
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_prefs_select_own on public.ai_learned_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_prefs_insert_own on public.ai_learned_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_prefs_update_own on public.ai_learned_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.ai_assistant_settings, public.ai_assistant_permissions, public.ai_assistant_audit,
  public.ai_learned_preferences, public.ai_action_proposals from anon, authenticated;
grant select on public.ai_assistant_settings, public.ai_assistant_permissions, public.ai_assistant_audit,
  public.ai_action_proposals to authenticated;
grant select, insert, update on public.ai_learned_preferences to authenticated;

-- The versions of the two documents a member accepts. The app holds the same
-- strings (lib/assistant/access.ts); a test keeps them equal.
create or replace function private.ai_current_versions()
returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object('terms', '2026-11-01', 'privacy', '2026-11-01') $$;

create or replace function private.ai_audit(p_user uuid, p_event text, p_permission text, p_tool text, p_outcome text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean jsonb := coalesce(p_detail, '{}'::jsonb);
  denied_recent integer;
begin
  if jsonb_typeof(clean) <> 'object' then clean := '{}'::jsonb; end if;
  -- Secrets never go in the log, whoever asks.
  clean := clean - 'password' - 'passcode' - 'token' - 'secret' - 'card' - 'cvv' - 'pin' - 'authorization';
  if octet_length(clean::text) > 4000 then clean := jsonb_build_object('truncated', true); end if;
  insert into public.ai_assistant_audit (user_id, event, permission, tool, outcome, detail)
  values (p_user, left(p_event, 60), p_permission, p_tool,
          case when p_outcome in ('ok', 'denied', 'refused', 'failed') then p_outcome else 'failed' end, clean);

  if p_outcome = 'denied' then
    select count(*) into denied_recent
      from public.ai_assistant_audit a
     where a.user_id = p_user and a.outcome = 'denied' and a.at > now() - interval '10 minutes';
    if denied_recent >= 8
       and exists (select 1 from public.ai_assistant_settings s where s.user_id = p_user and s.enabled) then
      perform private.ai_switch_off(p_user, 'suspicious_activity');
      insert into public.risk_alerts (severity, status, title, description, entity_type, entity_id)
      values ('medium', 'open', 'AI assistant switched off: repeated refused requests',
              'The assistant was asked eight or more times in ten minutes for things this member had not allowed, so it was switched off for them. Their account and records are untouched.',
              'ai_assistant', p_user::text);
    end if;
  end if;
end;
$$;
revoke all on function private.ai_audit(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.ai_switch_off(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_assistant_settings
     set enabled = false, grant_epoch = grant_epoch + 1, updated_at = now()
   where user_id = p_user;
  update public.ai_assistant_permissions set revoked_at = now() where user_id = p_user and revoked_at is null;
  update public.ai_action_proposals
     set status = 'cancelled', decided_at = now()
   where user_id = p_user and status = 'pending';
  insert into public.ai_assistant_audit (user_id, event, outcome, detail)
  values (p_user, 'deactivated', 'ok', jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function private.ai_switch_off(uuid, text) from public, anon, authenticated;

create or replace function public.ai_assistant_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.ai_assistant_settings;
  perms text[];
  v jsonb := private.ai_current_versions();
begin
  if uid is null then return jsonb_build_object('signed_in', false); end if;
  select * into s from public.ai_assistant_settings where user_id = uid;
  select coalesce(array_agg(permission order by permission), '{}') into perms
    from public.ai_assistant_permissions where user_id = uid and revoked_at is null;
  return jsonb_build_object(
    'signed_in', true,
    'enabled', coalesce(s.enabled, false),
    'terms_version', s.terms_version,
    'privacy_version', s.privacy_version,
    'accepted_at', s.accepted_at,
    'grant_epoch', coalesce(s.grant_epoch, 0),
    'permissions', to_jsonb(perms),
    'current_versions', v,
    'needs_reaccept', s.user_id is not null
       and (s.terms_version is distinct from v->>'terms' or s.privacy_version is distinct from v->>'privacy')
  );
end;
$$;

create or replace function public.ai_assistant_activate(
  p_terms_version text,
  p_privacy_version text,
  p_accept_terms boolean,
  p_accept_privacy boolean,
  p_permissions text[] default array['discovery']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v jsonb := private.ai_current_versions();
  perm text;
  wanted text[] := coalesce(p_permissions, '{}');
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if coalesce(p_accept_terms, false) is not true or coalesce(p_accept_privacy, false) is not true then
    perform private.ai_audit(uid, 'activate_refused', null, null, 'refused', jsonb_build_object('reason', 'terms_not_accepted'));
    return jsonb_build_object('ok', false, 'reason', 'terms_not_accepted');
  end if;
  if p_terms_version is distinct from v->>'terms' or p_privacy_version is distinct from v->>'privacy' then
    perform private.ai_audit(uid, 'activate_refused', null, null, 'refused', jsonb_build_object('reason', 'version_mismatch'));
    return jsonb_build_object('ok', false, 'reason', 'version_mismatch');
  end if;
  foreach perm in array wanted loop
    if perm not in ('discovery', 'saved_prefs', 'bookings_viewings', 'account_info', 'notifications') then
      perform private.ai_audit(uid, 'activate_refused', perm, null, 'refused', jsonb_build_object('reason', 'permission_not_grantable_here'));
      return jsonb_build_object('ok', false, 'reason', 'permission_not_grantable_here');
    end if;
  end loop;

  insert into public.ai_assistant_settings (user_id, enabled, terms_version, privacy_version, accepted_at, updated_at)
  values (uid, true, p_terms_version, p_privacy_version, now(), now())
  on conflict (user_id) do update
    set enabled = true, terms_version = excluded.terms_version, privacy_version = excluded.privacy_version,
        accepted_at = now(), updated_at = now();

  update public.ai_assistant_permissions set revoked_at = now() where user_id = uid and revoked_at is null;
  insert into public.ai_assistant_permissions (user_id, permission, granted_at, revoked_at)
  select uid, p, now(), null from (select distinct unnest(array_append(wanted, 'discovery')) as p) x
  on conflict (user_id, permission) do update set granted_at = now(), revoked_at = null;

  perform private.ai_audit(uid, 'activated', null, null, 'ok',
    jsonb_build_object('terms', p_terms_version, 'privacy', p_privacy_version, 'permissions', to_jsonb(array_append(wanted, 'discovery'))));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ai_assistant_deactivate()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if not exists (select 1 from public.ai_assistant_settings where user_id = uid) then
    return jsonb_build_object('ok', true);
  end if;
  perform private.ai_switch_off(uid, 'member');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ai_assistant_set_permission(p_permission text, p_granted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_permission not in ('discovery', 'saved_prefs', 'bookings_viewings', 'account_info',
                          'transactions', 'wallet_balance', 'payment_assist', 'notifications') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_permission');
  end if;
  if not exists (select 1 from public.ai_assistant_settings where user_id = uid and enabled) then
    perform private.ai_audit(uid, 'permission_refused', p_permission, null, 'refused', jsonb_build_object('reason', 'assistant_off'));
    return jsonb_build_object('ok', false, 'reason', 'assistant_off');
  end if;

  if p_granted then
    if p_permission = 'payment_assist' and not exists (
      select 1 from public.ai_assistant_permissions
       where user_id = uid and revoked_at is null and permission in ('transactions', 'bookings_viewings')
    ) then
      perform private.ai_audit(uid, 'permission_refused', p_permission, null, 'refused', jsonb_build_object('reason', 'needs_a_read_permission_first'));
      return jsonb_build_object('ok', false, 'reason', 'needs_a_read_permission_first');
    end if;
    insert into public.ai_assistant_permissions (user_id, permission) values (uid, p_permission)
    on conflict (user_id, permission) do update set granted_at = now(), revoked_at = null;
    perform private.ai_audit(uid, 'permission_granted', p_permission, null, 'ok', '{}'::jsonb);
  else
    if p_permission = 'discovery' then
      -- Discovery is the floor: turning it off is turning the assistant off.
      perform private.ai_switch_off(uid, 'discovery_revoked');
      return jsonb_build_object('ok', true, 'switched_off', true);
    end if;
    update public.ai_assistant_permissions set revoked_at = now()
     where user_id = uid and permission = p_permission and revoked_at is null;
    if not exists (
      select 1 from public.ai_assistant_permissions
       where user_id = uid and revoked_at is null and permission in ('transactions', 'bookings_viewings')
    ) then
      update public.ai_assistant_permissions set revoked_at = now()
       where user_id = uid and permission = 'payment_assist' and revoked_at is null;
    end if;
    update public.ai_assistant_settings set grant_epoch = grant_epoch + 1, updated_at = now() where user_id = uid;
    update public.ai_action_proposals set status = 'cancelled', decided_at = now()
     where user_id = uid and status = 'pending';
    perform private.ai_audit(uid, 'permission_revoked', p_permission, null, 'ok', '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ai_assistant_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ai_assistant_settings s
      join public.ai_assistant_permissions p on p.user_id = s.user_id
     where s.user_id = (select auth.uid()) and s.enabled and p.permission = p_permission and p.revoked_at is null
  )
$$;

create or replace function public.ai_assistant_audit_write(
  p_event text, p_permission text, p_tool text, p_outcome text, p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return; end if;
  perform private.ai_audit(uid, p_event, p_permission, p_tool, p_outcome, p_detail);
end;
$$;

create or replace function public.ai_assistant_clear_preferences()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  update public.ai_learned_preferences
     set key = 'cleared:' || gen_random_uuid()::text, value = 'null'::jsonb, weight = 0, updated_at = now()
   where user_id = uid and key not like 'cleared:%';
  perform private.ai_audit(uid, 'preferences_cleared', 'saved_prefs', null, 'ok', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ai_assistant_forget_preference(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  update public.ai_learned_preferences
     set key = 'cleared:' || gen_random_uuid()::text, value = 'null'::jsonb, weight = 0, updated_at = now()
   where user_id = uid and key = p_key;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.ai_assistant_forget_preference(text) from public, anon;
grant execute on function public.ai_assistant_forget_preference(text) to authenticated;

revoke all on function public.ai_assistant_state() from public, anon;
revoke all on function public.ai_assistant_activate(text, text, boolean, boolean, text[]) from public, anon;
revoke all on function public.ai_assistant_deactivate() from public, anon;
revoke all on function public.ai_assistant_set_permission(text, boolean) from public, anon;
revoke all on function public.ai_assistant_can(text) from public, anon;
revoke all on function public.ai_assistant_audit_write(text, text, text, text, jsonb) from public, anon;
revoke all on function public.ai_assistant_clear_preferences() from public, anon;
grant execute on function public.ai_assistant_state() to authenticated;
grant execute on function public.ai_assistant_activate(text, text, boolean, boolean, text[]) to authenticated;
grant execute on function public.ai_assistant_deactivate() to authenticated;
grant execute on function public.ai_assistant_set_permission(text, boolean) to authenticated;
grant execute on function public.ai_assistant_can(text) to authenticated;
grant execute on function public.ai_assistant_audit_write(text, text, text, text, jsonb) to authenticated;
grant execute on function public.ai_assistant_clear_preferences() to authenticated;
