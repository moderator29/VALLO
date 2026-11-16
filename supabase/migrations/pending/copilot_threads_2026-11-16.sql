-- THE COPILOT'S CHAT HISTORY (founder, 16 November 2026: "there should be chat
-- history, and when I leave and go back my chat history should be there").
--
-- NOT APPLIED. Additive only: one new table and one clean-up function.
-- Nothing existing is touched, dropped or narrowed. Safe to run twice.
--
-- HOW IT IS USED. The console copilot (`components/admin/copilot`) saves each
-- conversation after every answer through `/api/admin/copilot/threads`, which
-- checks the console door first and then writes with the person's OWN session,
-- so the policies below decide. The history list in the copilot reads the
-- same way. Until this table exists the copilot keeps the conversation for the
-- browser session only, as it always has, and says so in the history panel.
--
-- WHOSE. A row belongs to the staff member who had the conversation and is
-- readable by nobody else, not even the super admin: these are working notes.
-- When the account is deleted its conversations go with it.
--
-- WHAT IS KEPT. The words of each turn, the cards that were offered (label,
-- summary, the preview, and whether it was confirmed) and the pages offered.
-- Never a confirm token: a card loaded from history can no longer be pressed.
--
-- RETENTION. 90 days after the last message. `private.copilot_threads_cleanup()`
-- deletes older conversations; run it by hand or from a scheduled job, it is
-- not scheduled here.

create table if not exists public.copilot_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  desk       text not null default 'console',
  title      text not null,
  turns      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint copilot_threads_desk_len check (char_length(desk) between 1 and 60),
  constraint copilot_threads_title_len check (char_length(title) between 1 and 120),
  constraint copilot_threads_turns_array check (jsonb_typeof(turns) = 'array'),
  constraint copilot_threads_turns_count check (jsonb_array_length(turns) <= 80),
  constraint copilot_threads_turns_size check (pg_column_size(turns) <= 262144)
);

comment on table public.copilot_threads is
  'A staff member''s own copilot conversations, saved after each answer so they are there next time. Owner-only. Never holds a confirm token. Deleted 90 days after the last message (private.copilot_threads_cleanup()).';

create index if not exists copilot_threads_user_updated_idx on public.copilot_threads (user_id, updated_at desc);

alter table public.copilot_threads enable row level security;
revoke all on table public.copilot_threads from public, anon, authenticated;
grant select, insert, update, delete on table public.copilot_threads to authenticated;

drop policy if exists copilot_threads_own_read on public.copilot_threads;
create policy copilot_threads_own_read on public.copilot_threads
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists copilot_threads_own_insert on public.copilot_threads;
create policy copilot_threads_own_insert on public.copilot_threads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists copilot_threads_own_update on public.copilot_threads;
create policy copilot_threads_own_update on public.copilot_threads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists copilot_threads_own_delete on public.copilot_threads;
create policy copilot_threads_own_delete on public.copilot_threads
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.copilot_threads_cleanup()
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  removed integer;
begin
  delete from public.copilot_threads where updated_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke all on function private.copilot_threads_cleanup() from public, anon, authenticated;

-- Self-check: the table is there, RLS is on, four policies, and no grant to anon.
do $check$
declare
  policies integer;
begin
  if to_regclass('public.copilot_threads') is null then
    raise exception 'copilot_threads self-check: table missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.copilot_threads'::regclass) then
    raise exception 'copilot_threads self-check: row level security is off';
  end if;
  select count(*) into policies from pg_policies where schemaname = 'public' and tablename = 'copilot_threads';
  if policies <> 4 then
    raise exception 'copilot_threads self-check: expected 4 policies, found %', policies;
  end if;
  if has_table_privilege('anon', 'public.copilot_threads', 'select') then
    raise exception 'copilot_threads self-check: anon can read';
  end if;
  raise notice 'copilot_threads self-check passed';
end;
$check$;
