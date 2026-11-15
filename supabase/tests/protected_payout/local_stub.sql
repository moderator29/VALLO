-- A local stand-in for the parts of the live schema the payout SQL touches
-- (20261115120000_protected_payout_to_lister.sql). Not the live database.
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists private;
create type public.notification_kind as enum ('booking','message','wallet','listing','agent','support','system','social');
create table public.listings (id uuid primary key default gen_random_uuid(), title text);
create table public.accommodations (id uuid primary key default gen_random_uuid(), name text);
create table public.deal_agreements (id uuid primary key default gen_random_uuid(), listing_id uuid, accommodation_id uuid);
create table public.provider_arrangements (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.deal_agreements (id),
  provider text not null default 'escrowpay',
  reference text not null,
  amount_minor bigint not null,
  buyer_user_id uuid not null,
  seller_user_id uuid not null,
  status text not null default 'released',
  updated_at timestamptz default now()
);
grant select on public.provider_arrangements to authenticated;
grant select, insert, update on public.provider_arrangements to service_role;
create table public.notices (key text primary key, uid uuid, kind public.notification_kind, title text, body text, href text);
create table public.notice_failures (what text, state text, message text);
create function private.notify_once(p_key text, p_user uuid, p_kind public.notification_kind, p_title text, p_body text, p_href text) returns void
  language sql as $$ insert into public.notices values (p_key, p_user, p_kind, p_title, p_body, p_href) on conflict (key) do nothing $$;
create function private.notice_failed(p_what text, p_entity_type text, p_entity_id text, p_state text, p_message text) returns void
  language sql as $$ insert into public.notice_failures values (p_what, p_state, p_message) $$;
