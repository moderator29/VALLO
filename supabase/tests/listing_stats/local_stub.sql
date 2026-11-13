-- A local stand-in for the parts of Vallo's live schema the listing stats SQL
-- touches: roles, auth, the V-73 tables and salt, and the tables the triggers
-- watch, trimmed to the columns used. Not the live schema; see README.md.
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema private; create schema extensions;
create extension if not exists pgcrypto schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
create table auth.users (id uuid primary key, created_at timestamptz not null default now());
create type public.app_role as enum ('user','agent','admin','super_admin');
create type public.listing_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFO_REQUIRED','APPROVED','PUBLISHED','REJECTED','SUSPENDED');
create table public.user_roles (user_id uuid, role public.app_role);
create table public.staff_grants (user_id uuid primary key, scopes text[] not null default '{}', revoked_at timestamptz);
create table public.staff_handbook_acks (user_id uuid, version text);
create table public.internal_accounts (user_id uuid primary key);
create table public.agents (id uuid primary key default gen_random_uuid(), user_id uuid not null, display_name text not null default 'Lister');
create table public.listings (id uuid primary key default gen_random_uuid(), agent_id uuid not null references public.agents(id),
  assigned_agent_id uuid references public.agents(id), title text not null default 'A flat', area text, city text,
  status public.listing_status not null default 'PUBLISHED', is_demo boolean not null default false, published_at timestamptz);
create table public.saved_items (user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id, listing_id));
create table public.conversations (id uuid primary key default gen_random_uuid(), guest_id uuid not null, agent_id uuid not null, listing_id uuid, created_at timestamptz not null default now());
create table public.inspection_requests (id uuid primary key default gen_random_uuid(), listing_id uuid not null, requester_id uuid not null, created_at timestamptz not null default now());
-- private.has_role and private.staff_can as live (20260929122514), the step-up proof stubbed as true.
create function private.console_step_up_ok() returns boolean language sql stable as $$ select true $$;
create function private.staff_handbook_version() returns text language sql stable as $$ select 'v1' $$;
create function private.has_role(check_user_id uuid, check_role public.app_role) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.user_roles where user_id = check_user_id and role = check_role)
     and (check_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) or check_user_id is distinct from (select auth.uid()) or private.console_step_up_ok()) $$;
create function private.staff_can(p_user uuid, p_scope text) returns boolean language sql stable security definer set search_path to '' as $$
  select p_user is not null
     and (p_user is distinct from (select auth.uid()) or private.console_step_up_ok())
     and (exists (select 1 from public.user_roles r where r.user_id = p_user and r.role in ('admin'::public.app_role, 'super_admin'::public.app_role))
          or exists (select 1 from public.staff_grants g where g.user_id = p_user and g.revoked_at is null and p_scope = any (g.scopes)
                      and exists (select 1 from public.staff_handbook_acks a where a.user_id = p_user and a.version = private.staff_handbook_version()))) $$;
-- The V-73 tables exactly as 20260928231155 creates them.
create table public.listing_daily_stats (listing_id uuid not null references public.listings(id) on delete cascade, day date not null,
  impressions integer not null default 0 check (impressions >= 0), opens integer not null default 0 check (opens >= 0), primary key (listing_id, day));
create table public.listing_view_marks (listing_id uuid not null references public.listings(id) on delete cascade, day date not null,
  kind "char" not null check (kind in ('i', 'o')), viewer_hash text not null, primary key (listing_id, day, kind, viewer_hash));
create table private.listing_view_salts (day date primary key, salt bytea not null);
alter table public.listing_daily_stats enable row level security;
alter table public.listing_view_marks enable row level security;
-- Supabase's default privileges: every new table and function is granted to the API roles.
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
revoke all on public.listing_daily_stats, public.listing_view_marks from anon, authenticated;
-- Fixture: a lister, a member, staff, a real listing and an example.
insert into auth.users (id, created_at) values
  ('00000000-0000-4000-8000-00000000000a', now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000000b', now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000000c', now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000000d', now());
insert into public.user_roles values ('00000000-0000-4000-8000-00000000000c', 'admin');
insert into public.agents (id, user_id, display_name) values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Ada Homes');
insert into public.listings (id, agent_id, title, area, city, is_demo, published_at) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', 'Two bedroom flat', 'Yaba', 'Lagos', false, now() - interval '9 days'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000a1', 'Example duplex', 'Lekki', 'Lagos', true, now() - interval '9 days');
-- History before the file runs: one V-73 open, an existing save, an enquiry and a viewing.
insert into public.listing_daily_stats (listing_id, day, opens) values ('00000000-0000-4000-8000-0000000000f1', current_date - 2, 3);
insert into public.saved_items (user_id, listing_id, created_at) values ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000f1', now() - interval '2 days');
insert into public.conversations (guest_id, agent_id, listing_id, created_at) values ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1', now() - interval '1 day');
insert into public.inspection_requests (listing_id, requester_id, created_at) values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000b', now() - interval '1 day');
