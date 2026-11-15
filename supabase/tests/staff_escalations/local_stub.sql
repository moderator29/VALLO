-- A local stand-in for the parts of the live schema the staff escalations SQL
-- touches (migrations/pending/staff_escalations_2026-11-15.sql). Not the live
-- database: roles, auth, the staff tables and the two telling doors, trimmed.
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema private;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key);
create type public.app_role as enum ('user','agent','admin','super_admin');
create type public.staff_scope as enum ('listing_approval','kyc_review','moderation','support','agreements','guarantee',
  'finance','compliance','operations','trust_safety','roommates','circle','analyst','business_development','social_media',
  'marketing','content','technical','support_lead');
create type public.notification_kind as enum ('booking','message','wallet','listing','agent','support','system','social');
create table public.profiles (id uuid primary key, first_name text, display_name text);
create table public.user_roles (user_id uuid, role public.app_role);
create table public.staff_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scopes public.staff_scope[] not null check (cardinality(scopes) > 0),
  position text,
  revoked_at timestamptz
);
create table public.staff_handbook_acks (user_id uuid not null, version text not null, primary key (user_id, version));
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users (id) on delete set null,
  action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table public.notices (id serial, uid uuid, title text, body text, href text);
create table public.outbox (id serial, uid uuid, template text, dedupe text unique, payload jsonb);
create function private.staff_handbook_version() returns text language sql immutable as $$ select 'v1' $$;
-- The console's second factor, as a switch the test can turn off.
create function private.console_step_up_ok() returns boolean language sql stable as $$ select coalesce(current_setting('test.step_up', true), 'on') <> 'off' $$;
create function private.has_role(u uuid, r public.app_role) returns boolean language sql stable as $$ select exists (select 1 from public.user_roles x where x.user_id = u and x.role = r) $$;
create function private.notify(target_user uuid, n_kind public.notification_kind, n_title text, n_body text, n_href text) returns void
  language sql as $$ insert into public.notices (uid, title, body, href) values (target_user, n_title, n_body, n_href) $$;
create function private.email_outbox_enqueue(p_user uuid, p_template text, p_dedupe_key text, p_payload jsonb default '{}') returns uuid
  language sql as $$ insert into public.outbox (uid, template, dedupe, payload) values (p_user, p_template, p_dedupe_key, p_payload) on conflict (dedupe) do nothing; select null::uuid $$;
