-- A local stand-in for the parts of Vallo's live schema the offers SQL touches.
-- Roles, auth, and the tables as the live migrations define them (trimmed).
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema private; create schema extensions; create schema storage;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key, phone_confirmed_at timestamptz, email_confirmed_at timestamptz);
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create type public.app_role as enum ('user','agent','admin','super_admin');
create type public.listing_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFO_REQUIRED','APPROVED','PUBLISHED','REJECTED','SUSPENDED');
create type public.sale_status as enum ('available','under_offer','sold');
create type public.document_review_status as enum ('pending','approved','rejected');
create type public.notification_kind as enum ('booking','message','wallet','listing','agent','support','system','social');
create type public.report_status as enum ('open','resolved','dismissed');
create table public.profiles (id uuid primary key, display_name text);
create table public.user_roles (user_id uuid, role public.app_role);
create table public.agents (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.listings (id uuid primary key default gen_random_uuid(), agent_id uuid, title text, status public.listing_status default 'DRAFT',
  property_type text, listing_intent text, sale_price_minor bigint, price_negotiable boolean not null default false, sale_status public.sale_status);
create table public.listing_photos (id uuid primary key default gen_random_uuid(), listing_id uuid, storage_path text, position integer default 0);
create table public.listing_mandates (id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  kind text not null, review_status public.document_review_status not null default 'pending', reviewed_at timestamptz, expires_on date);
create table public.conversations (id uuid primary key default gen_random_uuid(), guest_id uuid not null, agent_id uuid not null, listing_id uuid, context_kind text default 'listing', unique (guest_id, agent_id, listing_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id), sender_id uuid not null, body text not null);
create table public.inspection_requests (id uuid primary key default gen_random_uuid(), listing_id uuid, requester_id uuid);
create table public.identity_verifications (id uuid primary key default gen_random_uuid(), subject_id uuid, outcome text);
create table public.identity_checks (id uuid primary key default gen_random_uuid(), subject_id uuid, status text);
create table public.agent_documents (id uuid primary key default gen_random_uuid(), uploader_id uuid, kind text, review_status public.document_review_status default 'pending');
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, entity_type text not null, entity_id text, metadata jsonb default '{}', created_at timestamptz default now());
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null, target_type text not null, target_id text not null, reason text not null, category text, status public.report_status default 'open');
create table public.transactions (id uuid primary key default gen_random_uuid(), agreement_id uuid);
create table public.bookings (id uuid primary key default gen_random_uuid());
create table public.notices (id serial, uid uuid, title text, body text, href text);
create table public.outbox (id serial, uid uuid, template text, dedupe text unique, payload jsonb);
create function private.notify(target_user uuid, n_kind public.notification_kind, n_title text, n_body text, n_href text) returns void language sql as $$ insert into public.notices (uid, title, body, href) values (target_user, n_title, n_body, n_href) $$;
create function private.email_outbox_enqueue(p_user uuid, p_template text, p_dedupe_key text, p_payload jsonb default '{}') returns uuid language sql as $$ insert into public.outbox (uid, template, dedupe, payload) values (p_user, p_template, p_dedupe_key, p_payload) on conflict (dedupe) do nothing; select null::uuid $$;
create function private.has_role(u uuid, r public.app_role) returns boolean language sql stable as $$ select exists (select 1 from public.user_roles x where x.user_id = u and x.role = r) $$;
create function private.staff_can(p_user uuid, p_scope text) returns boolean language sql stable as $$ select p_user is not null and (private.has_role(p_user,'admin') or private.has_role(p_user,'super_admin')) $$;
-- ---- the real agreement tables (A2 lines 125-215, b9 snapshot)

-- -------------------------------------------------------- the agreement
do $$ begin
  create type public.agreement_status as enum
    ('awaiting_parties', 'in_review', 'approved', 'rejected', 'cancelled', 'paid');
exception when duplicate_object then null; end $$;

create table if not exists public.deal_agreements (
  id                        uuid primary key default gen_random_uuid(),
  kind                      text not null check (kind in ('rent', 'stay')),
  listing_id                uuid not null references public.listings (id) on delete restrict,
  inspection_id             uuid unique references public.inspection_requests (id) on delete restrict,
  booking_id                uuid unique references public.bookings (id) on delete restrict,
  renter_id                 uuid not null references auth.users (id) on delete restrict,
  owner_id                  uuid not null references auth.users (id) on delete restrict,
  amount_minor              bigint not null check (amount_minor > 0),
  terms                     jsonb not null,
  terms_version             integer not null default 1 check (terms_version >= 1),
  renter_confirmed_version  integer,
  renter_confirmed_at       timestamptz,
  owner_confirmed_version   integer,
  owner_confirmed_at        timestamptz,
  mandate_id                uuid references public.listing_mandates (id) on delete restrict,
  status                    public.agreement_status not null default 'awaiting_parties',
  submitted_at              timestamptz,
  decided_at                timestamptz,
  decided_by                uuid references auth.users (id) on delete set null,
  decision_reason           text check (decision_reason is null or length(decision_reason) between 1 and 1000),
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint deal_agreements_parties_differ check (renter_id <> owner_id),
  constraint deal_agreements_rent_has_inspection check (kind <> 'rent' or inspection_id is not null),
  constraint deal_agreements_stay_has_booking check (kind <> 'stay' or booking_id is not null),
  constraint deal_agreements_rejection_has_reason check (status <> 'rejected' or decision_reason is not null)
);
create index if not exists deal_agreements_status_idx on public.deal_agreements (status, submitted_at);
create index if not exists deal_agreements_renter_idx on public.deal_agreements (renter_id);
create index if not exists deal_agreements_owner_idx on public.deal_agreements (owner_id);
create index if not exists deal_agreements_listing_idx on public.deal_agreements (listing_id);

alter table public.deal_agreements enable row level security;
revoke all on public.deal_agreements from anon, authenticated;
grant select on public.deal_agreements to authenticated;
drop policy if exists deal_agreements_party_read on public.deal_agreements;
create policy deal_agreements_party_read on public.deal_agreements for select to authenticated
  using ((select auth.uid()) in (renter_id, owner_id)
         or private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

create table if not exists public.deal_agreement_events (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.deal_agreements (id) on delete restrict,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null check (action in ('opened', 'amended', 'confirmed', 'submitted',
                                                'approved', 'rejected', 'cancelled', 'paid')),
  from_status   public.agreement_status,
  to_status     public.agreement_status not null,
  terms_version integer not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists deal_agreement_events_agreement_idx on public.deal_agreement_events (agreement_id, created_at);
alter table public.deal_agreement_events enable row level security;
revoke all on public.deal_agreement_events from anon, authenticated;
grant select on public.deal_agreement_events to authenticated;
drop policy if exists deal_agreement_events_party_read on public.deal_agreement_events;
create policy deal_agreement_events_party_read on public.deal_agreement_events for select to authenticated
  using (exists (select 1 from public.deal_agreements a where a.id = agreement_id
                  and ((select auth.uid()) in (a.renter_id, a.owner_id)
                       or private.has_role((select auth.uid()), 'admin'::public.app_role)
                       or private.has_role((select auth.uid()), 'super_admin'::public.app_role))));

create or replace function private.history_is_fixed()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$function$;
drop trigger if exists deal_agreement_events_fixed on public.deal_agreement_events;
create trigger deal_agreement_events_fixed before update or delete on public.deal_agreement_events
  for each row execute function private.history_is_fixed();

create table if not exists public.deal_agreement_versions (
  agreement_id  uuid not null references public.deal_agreements (id) on delete cascade,
  terms_version integer not null,
  terms         jsonb not null default '{}'::jsonb,
  amount_minor  bigint not null,
  created_at    timestamptz not null default now(),
  primary key (agreement_id, terms_version),
  constraint deal_agreement_versions_version_chk check (terms_version >= 1)
);

comment on table public.deal_agreement_versions is
  'B9: the terms of each agreement version, kept immutably so a party can see what changed since they confirmed. Written only by private.snapshot_agreement_version.';

alter table public.deal_agreement_versions enable row level security;
revoke all on public.deal_agreement_versions from anon, authenticated;
grant select on public.deal_agreement_versions to authenticated;

drop policy if exists deal_agreement_versions_parties_read on public.deal_agreement_versions;
create policy deal_agreement_versions_parties_read
  on public.deal_agreement_versions
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.deal_agreements a
       where a.id = deal_agreement_versions.agreement_id
         and (select auth.uid()) in (a.renter_id, a.owner_id)
    )
  );

create or replace function private.snapshot_agreement_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.terms_version is null or new.terms_version < 1 then
    return new;
  end if;
  insert into public.deal_agreement_versions (agreement_id, terms_version, terms, amount_minor)
  values (new.id, new.terms_version, coalesce(new.terms, '{}'::jsonb), coalesce(new.amount_minor, 0))
  on conflict (agreement_id, terms_version)
  do update set terms = excluded.terms, amount_minor = excluded.amount_minor;
  return new;
end;
$function$;

revoke all on function private.snapshot_agreement_version() from public, anon, authenticated;
create trigger deal_agreements_zz_snapshot_version after insert or update of terms, terms_version, amount_minor on public.deal_agreements for each row execute function private.snapshot_agreement_version();
create or replace function private.agreement_log(
  p_agreement public.deal_agreements, p_actor uuid, p_action text,
  p_from public.agreement_status, p_note text)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.deal_agreement_events (agreement_id, actor_id, action, from_status, to_status, terms_version, note)
  values (p_agreement.id, p_actor, p_action, p_from, p_agreement.status, p_agreement.terms_version, p_note);
$function$;
alter table public.transactions add constraint transactions_agreement_id_fkey foreign key (agreement_id) references public.deal_agreements (id);
