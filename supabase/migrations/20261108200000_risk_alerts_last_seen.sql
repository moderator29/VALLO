-- R-04: track when a deduplicated alert last fired
-- so admins see recency, not just first-seen time.

alter table public.risk_alerts
  add column if not exists last_seen_at timestamptz not null default now();

-- Backfill: set last_seen_at = created_at for existing rows.
update public.risk_alerts set last_seen_at = created_at where last_seen_at = now();

comment on column public.risk_alerts.last_seen_at is
  'When this alert last fired (updated on dedup instead of creating a new row).';
