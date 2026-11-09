-- THE CRASH LOG (Platform Grade 1, founder ruling of 7 November 2026: "Vallo's
-- own crash log, read in the admin panel", no paid service).
--
-- One row per DISTINCT crash (its fingerprint), counted: the same crash on a
-- thousand phones is one row with occurrences = 1000, never a thousand alerts.
-- risk_alerts folded every browser crash into one open "Client: error" alert
-- for a day, so the second different crash in a day was never seen.
--
-- Written only by the service role through public.record_crash; read only by
-- the service role behind the admin guard (operations scope). RLS is on with
-- no policies, so no member can read or write a row.
--
-- Nothing personal is stored: the message and stack arrive already scrubbed
-- by lib/observability/scrub.ts, the place is the first path segment only,
-- and there is no user id, IP or user agent column.

create table if not exists public.crash_reports (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  source text not null check (source in ('web', 'ios', 'android', 'server')),
  kind text not null,
  error_type text not null,
  message text not null,
  stack_top text,
  area text,
  release text,
  last_ref text,
  occurrences integer not null default 1 check (occurrences > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index if not exists crash_reports_last_seen_idx on public.crash_reports (last_seen_at desc);
create index if not exists crash_reports_status_idx on public.crash_reports (status, last_seen_at desc);

alter table public.crash_reports enable row level security;
revoke all on table public.crash_reports from anon, authenticated;

create or replace function public.record_crash(
  p_fingerprint text,
  p_source text,
  p_kind text,
  p_type text,
  p_message text,
  p_stack_top text,
  p_area text,
  p_release text,
  p_ref text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_fingerprint is null or length(p_fingerprint) = 0 then
    return;
  end if;
  insert into public.crash_reports as c
    (fingerprint, source, kind, error_type, message, stack_top, area, release, last_ref)
  values (
    left(p_fingerprint, 200),
    case when p_source in ('web', 'ios', 'android', 'server') then p_source else 'web' end,
    left(coalesce(p_kind, 'error'), 80),
    left(coalesce(p_type, 'Error'), 80),
    left(coalesce(p_message, ''), 600),
    left(p_stack_top, 1200),
    left(p_area, 80),
    left(p_release, 60),
    left(p_ref, 80)
  )
  on conflict (fingerprint) do update set
    occurrences = least(c.occurrences, 2000000000) + 1,
    last_seen_at = now(),
    stack_top = coalesce(excluded.stack_top, c.stack_top),
    release = coalesce(excluded.release, c.release),
    last_ref = coalesce(excluded.last_ref, c.last_ref),
    -- A resolved crash that comes back is open again; an ignored one stays quiet.
    status = case when c.status = 'resolved' then 'open' else c.status end,
    resolved_at = case when c.status = 'resolved' then null else c.resolved_at end,
    resolved_by = case when c.status = 'resolved' then null else c.resolved_by end;
end;
$$;

revoke all on function public.record_crash(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_crash(text, text, text, text, text, text, text, text, text) to service_role;
