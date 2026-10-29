create table if not exists public.push_enrol_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null check (platform in ('web','ios','android')),
  ok boolean not null,
  reason text check (reason is null or char_length(reason) <= 40),
  step text check (step is null or char_length(step) <= 20),
  detail text check (detail is null or char_length(detail) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists push_enrol_log_created_idx on public.push_enrol_log (created_at desc);
create index if not exists push_enrol_log_user_idx on public.push_enrol_log (user_id);
alter table public.push_enrol_log enable row level security;
revoke all on public.push_enrol_log from anon, authenticated;
comment on table public.push_enrol_log is 'One row per push enrolment attempt (reference only, never a token), written by the service role from /api/push/enrol-log so a failure on a phone can be read without the person relaying it. No client access.';
