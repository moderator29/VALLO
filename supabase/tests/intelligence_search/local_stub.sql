-- A local stand-in for the parts of the live schema the VALLO Intelligence SQL
-- touches (migrations/pending/intelligence_search_2026-11-16.sql). Not the live
-- database: roles, auth, the four searched tables trimmed to their columns,
-- the staff check and the audit log.
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema private; create schema extensions;
create extension pg_trgm schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key);
create table public.social_profiles (user_id uuid primary key, handle text, display_label text);
create table public.circle_communities (id uuid primary key default gen_random_uuid(), name text, status text);
create table public.posts (id uuid primary key default gen_random_uuid(), title text, body text, status text, depth smallint);
create table public.roommate_listings (id uuid primary key default gen_random_uuid(), title text, area text, status text);
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, entity_type text not null,
  entity_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now());
-- The staff check, as a table the test fills: (user, scope) pairs.
create table private.test_scopes (user_id uuid, scope text);
create function private.staff_can(p_user uuid, p_scope text) returns boolean language sql stable as $$
  select p_user is not null and exists (select 1 from private.test_scopes s where s.user_id = p_user and s.scope in (p_scope, 'admin')) $$;
