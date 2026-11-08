-- A local stand-in for the parts of Vallo's live schema the Roommates SQL
-- touches. Column names and types copied from the live database (read only).
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema private; create schema extensions; create schema storage;
create extension pg_trgm schema extensions;
grant usage on schema public, auth, extensions, storage to anon, authenticated;
grant usage on schema private to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key);

create type public.thread_context as enum ('listing','reservation','booking','business','direct');
create type public.notification_kind as enum ('booking','message','wallet','listing','agent','support','system','social');
create type public.listing_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFO_REQUIRED','APPROVED','PUBLISHED','REJECTED','SUSPENDED');
create type public.rent_period as enum ('month','quarter','year');
create type public.post_kind as enum ('GIST','ASK','REPLY','SHOWCASE','SYSTEM','STORY');
create type public.social_status as enum ('LIVE','HELD','REMOVED');
create type public.app_role as enum ('user','agent','admin','super_admin');

create table public.states (code text primary key, name text);
insert into public.states values ('AB','Abia'),('AD','Adamawa'),('AK','Akwa Ibom'),('AN','Anambra'),('BA','Bauchi'),('BE','Benue'),('BO','Borno'),('BY','Bayelsa'),('CR','Cross River'),('DE','Delta'),('EB','Ebonyi'),('ED','Edo'),('EK','Ekiti'),('EN','Enugu'),('FC','FCT (Abuja)'),('GO','Gombe'),('IM','Imo'),('JI','Jigawa'),('KD','Kaduna'),('KE','Kebbi'),('KN','Kano'),('KO','Kogi'),('KT','Katsina'),('KW','Kwara'),('LA','Lagos'),('NA','Nasarawa'),('NI','Niger'),('OG','Ogun'),('ON','Ondo'),('OS','Osun'),('OY','Oyo'),('PL','Plateau'),('RI','Rivers'),('SO','Sokoto'),('TA','Taraba'),('YO','Yobe'),('ZA','Zamfara');
create table public.profiles (id uuid primary key, display_name text, avatar_url text, settings jsonb default '{}', created_at timestamptz default now());
create table public.user_roles (user_id uuid, role public.app_role);
create table public.areas (id uuid primary key default gen_random_uuid(), slug text, name text, state_code text, city text);
create table public.agents (id uuid primary key default gen_random_uuid(), user_id uuid);
create function private.my_agent_ids() returns setof uuid language sql stable security definer set search_path to '' as $$ select a.id from public.agents a where a.user_id = auth.uid() $$;
create function private.my_firm_ids() returns setof uuid language sql stable as $$ select null::uuid where false $$;
create table public.listings (id uuid primary key default gen_random_uuid(), agent_id uuid, title text, status public.listing_status default 'DRAFT', state_code text, city text, area text,
  bedrooms integer default 0, bathrooms integer default 1, rent_amount_minor bigint, rent_period public.rent_period, rate_minor bigint, sale_price_minor bigint, listing_intent text, property_type text, firm_id uuid, created_at timestamptz default now());
create table public.listing_photos (id uuid primary key default gen_random_uuid(), listing_id uuid, storage_path text, position integer default 0);
create table public.social_profiles (user_id uuid primary key references public.profiles(id), handle text, display_label text, avatar_path text, contact_policy text default 'REQUEST', created_at timestamptz default now());
create table public.follows (follower_id uuid, followee_id uuid);
create table public.blocks (user_id uuid, other_id uuid);
create table public.mutes (user_id uuid, target_id uuid);
create table public.conversations (id uuid primary key default gen_random_uuid(), guest_id uuid, agent_id uuid, listing_id uuid, context_kind public.thread_context default 'listing', created_at timestamptz default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid, kind public.notification_kind, title text, body text, href text, created_at timestamptz default now());
create table public.saved_collection_items (collection_id uuid, kind text, target_id uuid, constraint saved_collection_items_kind_check check (kind in ('listing','accommodation','restaurant')));
create table public.identity_verifications (id uuid primary key default gen_random_uuid(), subject_id uuid, outcome text);
create table public.identity_checks (id uuid primary key default gen_random_uuid(), subject_id uuid, status text);
create table public.confirmed_phones (user_id uuid primary key, phone text, confirmed_at timestamptz);
create table public.posts (id uuid primary key default gen_random_uuid(), author_id uuid, author_kind text default 'USER', kind public.post_kind, body text, listing_id uuid, payload jsonb, status public.social_status default 'LIVE', community_id uuid, circle_type text, created_at timestamptz default now(),
  constraint posts_listing_chk check (listing_id is null or kind in ('SHOWCASE','SYSTEM')));
create table public.circle_communities (id uuid primary key default gen_random_uuid(), slug text unique, name text, description text default '', visibility text default 'public', rules text[] default '{}', started_by_vallo boolean default false, category text,
  constraint circle_communities_category_check check (category in ('neighbourhood','renting','buying','landlords','investing','short_lets','design','building','professionals','general')));
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, target_type text, target_id text, reason text, status text default 'open', created_at timestamptz default now());
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz default now());
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;

create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create function private.has_role(check_user_id uuid, check_role public.app_role) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = check_user_id and r.role = check_role) $$;
create function private.is_staff() returns boolean language sql stable security definer set search_path to '' as $$
  select private.has_role((select auth.uid()), 'admin'::public.app_role) or private.has_role((select auth.uid()), 'super_admin'::public.app_role) $$;
create function private.blocked_between(person_a uuid, person_b uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.blocks b where (b.user_id = person_a and b.other_id = person_b) or (b.user_id = person_b and b.other_id = person_a)) $$;
create function private.block_between(p_a uuid, p_b uuid) returns boolean language sql stable security definer set search_path to '' as $$ select private.blocked_between(p_a, p_b) $$;
create function private.has_muted(p_user uuid, p_target uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.mutes m where m.user_id = p_user and m.target_id = p_target) $$;
create function private.notify(target_user uuid, n_kind public.notification_kind, n_title text, n_body text, n_href text) returns void language plpgsql security definer set search_path to 'public' as $$
begin if target_user is null then return; end if; insert into public.notifications (user_id, kind, title, body, href) values (target_user, n_kind, n_title, n_body, n_href); end $$;
create function private.notify_social(p_recipient uuid, p_actor uuid, p_title text, p_body text, p_href text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_recipient is null or p_actor is null then return; end if;
  if p_recipient = p_actor then return; end if;
  if private.block_between(p_recipient, p_actor) then return; end if;
  if private.has_muted(p_recipient, p_actor) then return; end if;
  perform private.notify(p_recipient, 'social', p_title, p_body, p_href);
end $$;
create function private.content_writer_is_member() returns boolean language sql stable as $$ select true $$;
create function private.consume_rate_limit(p_bucket text, p_subject text, p_limit_count integer, p_window_seconds integer) returns boolean language sql as $$ select true $$;
create function private.limit_member_inserts() returns trigger language plpgsql security definer set search_path to '' as $$
declare within boolean;
begin
  within := private.consume_rate_limit('db:' || tg_table_name, auth.uid()::text, tg_argv[0]::int, tg_argv[1]::int);
  if not within then raise exception 'limit' using errcode = 'program_limit_exceeded'; end if;
  return new;
end $$;
grant execute on all functions in schema private to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on function auth.uid() to anon, authenticated;
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
-- Trust and Safety stand-ins
do $$ begin create type public.staff_scope as enum ('listing_approval','kyc_review','moderation','support','agreements','guarantee','finance','compliance','operations'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status as enum ('open','reviewing','resolved','dismissed','withdrawn'); exception when duplicate_object then null; end $$;
alter table public.reports alter column status drop default;
alter table public.reports alter column status type public.report_status using status::public.report_status;
alter table public.reports alter column status set default 'open';
alter table public.reports add column if not exists category text, add column if not exists resolved_at timestamptz, add column if not exists resolved_by uuid;
alter table public.reports add constraint reports_category_chk check (category is null or category in ('off_platform_payment','scam','unsafe','not_as_described','unavailable','offensive','duplicate','other'));
create table if not exists public.staff_grants (user_id uuid, scopes public.staff_scope[], revoked_at timestamptz);
create table if not exists public.staff_handbook_acks (user_id uuid, version int);
create or replace function private.staff_handbook_version() returns int language sql stable as $$ select 1 $$;
create or replace function private.console_step_up_ok() returns boolean language sql stable as $$ select true $$;
create or replace function private.staff_can(p_user uuid, p_scope text) returns boolean language sql stable security definer set search_path to '' as $$
  select p_user is not null and (exists (select 1 from public.user_roles r where r.user_id = p_user and r.role in ('admin','super_admin'))
    or exists (select 1 from public.staff_grants g where g.user_id = p_user and g.revoked_at is null and p_scope = any (g.scopes::text[])
               and exists (select 1 from public.staff_handbook_acks a where a.user_id = p_user and a.version = private.staff_handbook_version()))) $$;
create table if not exists public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_id uuid, body text, created_at timestamptz default now());
alter table public.posts add column if not exists title text, add column if not exists removed_at timestamptz, add column if not exists hold_reason text;
alter table public.circle_communities add column if not exists status text default 'live', add column if not exists member_count int default 0, add column if not exists post_count int default 0,
  add column if not exists last_activity_at timestamptz, add column if not exists created_by uuid, add column if not exists created_at timestamptz default now();
grant execute on all functions in schema private to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
