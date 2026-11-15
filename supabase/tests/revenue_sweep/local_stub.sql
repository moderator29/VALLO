-- A local stand-in for the parts of the live schema that
-- revenue_sweep_2026-11-15.sql touches. Not the live database. The column
-- lists and the checks below were read from live on 15 November 2026.
do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists private;

create table public.deal_agreements (id uuid primary key default gen_random_uuid());

create table public.provider_arrangements (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid references public.deal_agreements (id),
  provider text not null default 'escrowpay',
  reference text not null,
  provider_arrangement_id text,
  amount_minor bigint not null,
  currency text not null default 'NGN',
  status text not null default 'preparing',
  environment text,
  updated_at timestamptz default now()
);
grant select on public.provider_arrangements to authenticated;
grant select, insert, update on public.provider_arrangements to service_role;

create table public.transactions (id uuid primary key default gen_random_uuid());

-- Exactly the live function and the live checks.
create function private.is_ledger_event(p text) returns boolean language sql immutable set search_path to '' as $fn$
  select p in (
    'DEPOSIT_INITIATED', 'DEPOSIT_CONFIRMED',
    'WITHDRAWAL_INITIATED', 'WITHDRAWAL_COMPLETED',
    'TRANSFER_INITIATED', 'TRANSFER_COMPLETED',
    'ESCROW_CREATED', 'ESCROW_FUNDED', 'ESCROW_RELEASED',
    'REFUND_INITIATED', 'REFUND_COMPLETED',
    'FEE_CHARGED',
    'DISPUTE_OPENED', 'DISPUTE_RESOLVED')
$fn$;

create table public.ledger_vallo_revenue (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) between 8 and 200),
  transaction_id uuid references public.transactions (id),
  provider text not null check (provider = any (array['paystack'::text, 'payluk'::text, 'vallo'::text])),
  provider_reference text,
  rail text check (rail = any (array['escrow'::text, 'direct'::text])),
  event_type text not null check (private.is_ledger_event(event_type) and (event_type <> all (array['ESCROW_CREATED'::text, 'ESCROW_FUNDED'::text, 'ESCROW_RELEASED'::text, 'DEPOSIT_INITIATED'::text, 'DEPOSIT_CONFIRMED'::text]))),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction = any (array['in'::text, 'out'::text])),
  status text not null default 'confirmed' check (status = any (array['pending'::text, 'confirmed'::text, 'failed'::text, 'unknown'::text])),
  corrects_entry_id uuid references public.ledger_vallo_revenue (id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
