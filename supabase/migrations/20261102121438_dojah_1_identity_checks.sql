set lock_timeout = '5s';

-- DOJAH (2 November 2026). One row per hosted EasyOnboard session (government
-- ID lookup + selfie liveness + face match). The row's id is the opaque
-- reference handed to Dojah as metadata.vallo_ref; Dojah's own reference
-- (DJ-...) arrives with the result. No NIN or BVN is stored: only HMACs.
create table if not exists public.identity_checks (
  id              uuid primary key default gen_random_uuid(),
  subject_id      uuid not null references auth.users(id) on delete cascade,
  provider        text not null default 'dojah' check (provider in ('dojah')),
  environment     text not null check (environment in ('sandbox', 'live')),
  status          text not null default 'opened'
                  check (status in ('opened', 'waiting', 'passed', 'review', 'retry', 'abandoned', 'approved', 'refused')),
  dojah_reference text check (dojah_reference is null or length(dojah_reference) <= 100),
  id_type         text check (id_type is null or length(id_type) <= 40),
  legal_name      text check (legal_name is null or length(btrim(legal_name)) between 2 and 200),
  date_of_birth   text check (date_of_birth is null or length(date_of_birth) <= 40),
  nin_hmac        text check (nin_hmac is null or nin_hmac ~ '^[0-9a-f]{64}$'),
  bvn_hmac        text check (bvn_hmac is null or bvn_hmac ~ '^[0-9a-f]{64}$'),
  selfie_match    numeric check (selfie_match is null or selfie_match between 0 and 100),
  liveness        numeric check (liveness is null or liveness between 0 and 100),
  document_type   text check (document_type is null or length(document_type) <= 80),
  country         text check (country is null or length(country) <= 80),
  proxy           boolean,
  reasons         text[] not null default '{}',
  files           jsonb not null default '{}'::jsonb,
  dashboard_url   text check (dashboard_url is null or (dashboard_url ~ '^https://' and length(dashboard_url) <= 500)),
  aml             jsonb,
  summary         jsonb,
  decided_by      uuid references auth.users(id),
  decided_at      timestamptz,
  decision_note   text check (decision_note is null or length(decision_note) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists identity_checks_dojah_reference_key
  on public.identity_checks (dojah_reference) where dojah_reference is not null;
create index if not exists identity_checks_subject_idx on public.identity_checks (subject_id, created_at desc);
create index if not exists identity_checks_review_idx on public.identity_checks (created_at) where status = 'review';

comment on table public.identity_checks is
  'Dojah EasyOnboard sessions: government ID + selfie liveness + face match. Written by the service role (record_dojah_check) and staff (decide_identity_check). HMACs only, never a NIN or BVN.';

alter table public.identity_checks enable row level security;
revoke all on public.identity_checks from public, anon, authenticated;

-- identity_verifications learns a third method and a BVN hash.
alter table public.identity_verifications drop constraint if exists identity_verifications_method_check;
alter table public.identity_verifications add constraint identity_verifications_method_check
  check (method in ('vnin', 'photo', 'dojah'));
alter table public.identity_verifications add column if not exists bvn_hmac text
  check (bvn_hmac is null or bvn_hmac ~ '^[0-9a-f]{64}$');
create unique index if not exists identity_verifications_one_account_per_bvn
  on public.identity_verifications (bvn_hmac) where outcome = 'matched' and bvn_hmac is not null;

-- Dojah deliveries go in the same raw event log as the money providers (redacted first).
alter table public.provider_webhook_events drop constraint if exists provider_webhook_events_provider_check;
alter table public.provider_webhook_events add constraint provider_webhook_events_provider_check
  check (provider in ('payluk', 'paystack', 'yellowcard', 'dojah'));

insert into public.feature_flags (key, enabled, note)
values ('dojah_identity', false,
        'Selfie + government ID check through Dojah EasyOnboard on /verification. Needs DOJAH_APP_ID, DOJAH_SECRET_KEY, DOJAH_WIDGET_ID, DOJAH_WEBHOOK_SECRET and VALLO_NIN_HMAC_KEY.')
on conflict (key) do nothing;

-- Selfies and ID images copied from Dojah's hour-long links. Private: no
-- policies, so only the service role reads it; staff see files streamed
-- through the console.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-checks', 'identity-checks', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
