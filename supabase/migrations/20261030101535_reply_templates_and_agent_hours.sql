-- Reply templates (agents answer the same few questions all day) and the
-- hours an agent says they are usually reachable. Both are the member's own;
-- the hours of a listing's agent are readable through one narrow function.

create table public.reply_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 40),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index reply_templates_user_idx on public.reply_templates (user_id, created_at);

create table public.agent_hours (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  schedule   jsonb not null default '{}'::jsonb check (jsonb_typeof(schedule) = 'object' and pg_column_size(schedule) < 2000),
  updated_at timestamptz not null default now()
);

alter table public.reply_templates enable row level security;
alter table public.agent_hours enable row level security;

create policy reply_templates_owner_all on public.reply_templates
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy agent_hours_owner_all on public.agent_hours
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.reply_templates, public.agent_hours from anon, public;
grant select, insert, update, delete on public.reply_templates, public.agent_hours to authenticated;

create function private.reply_templates_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reply_templates where user_id = new.user_id) >= 12 then
    raise exception 'reply_templates_cap' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.reply_templates_cap() from public, anon, authenticated;

create trigger reply_templates_cap_before_insert
  before insert on public.reply_templates
  for each row execute function private.reply_templates_cap();

-- The hours an agent has set, for a listing they are the agent on. Nothing else
-- about the agent leaves: not the user id, not the agent id.
create function public.listing_agent_hours(p_listing uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select h.schedule
    from public.listings l
    join public.agents a on a.id = l.agent_id
    join public.agent_hours h on h.user_id = a.user_id
   where l.id = p_listing
     and l.status = 'PUBLISHED'::public.listing_status
     and l.listing_role = 'agent'::public.listing_role
$$;
revoke all on function public.listing_agent_hours(uuid) from public;
grant execute on function public.listing_agent_hours(uuid) to anon, authenticated, service_role;
