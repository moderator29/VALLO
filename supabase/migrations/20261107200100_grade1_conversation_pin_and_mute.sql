-- INBOX PIN AND MUTE (Platform Grade 1, messages; Agent MSG's recommendation,
-- 7 November 2026). A member's own choices about a conversation: pin it to
-- the top of their inbox, mute it until a time. Own rows only; the other
-- person never sees either.
--
-- Push respects a mute through private.conversation_muted (wired by the lead
-- in the push path after this is live). Nothing else reads these rows.

create table if not exists public.conversation_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  pinned_at timestamptz,
  muted_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create index if not exists conversation_prefs_conversation_idx on public.conversation_prefs (conversation_id);

alter table public.conversation_prefs enable row level security;

-- Own rows, and only for a conversation the member is in.
create policy conversation_prefs_select_own on public.conversation_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy conversation_prefs_insert_own on public.conversation_prefs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.in_conversation(conversation_id));

create policy conversation_prefs_update_own on public.conversation_prefs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.in_conversation(conversation_id));

create policy conversation_prefs_delete_own on public.conversation_prefs
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.conversation_prefs from anon;
grant select, insert, update, delete on table public.conversation_prefs to authenticated;

create trigger conversation_prefs_updated_at
  before update on public.conversation_prefs
  for each row execute function public.set_updated_at();

-- At most 5 pinned conversations per member, like the phone apps people know.
create or replace function private.conversation_prefs_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pinned_at is not null and (tg_op = 'INSERT' or old.pinned_at is null) then
    if (select count(*) from public.conversation_prefs p
         where p.user_id = new.user_id and p.pinned_at is not null
           and p.conversation_id <> new.conversation_id) >= 5 then
      raise exception 'You can pin up to 5 conversations.' using errcode = 'VP005';
    end if;
  end if;
  return new;
end;
$$;

create trigger conversation_prefs_pin_limit
  before insert or update on public.conversation_prefs
  for each row execute function private.conversation_prefs_pin_limit();

-- True while the member has this conversation muted. For the push path.
create or replace function private.conversation_muted(p_user uuid, p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_prefs p
     where p.user_id = p_user and p.conversation_id = p_conversation
       and p.muted_until is not null and p.muted_until > now()
  );
$$;

revoke all on function private.conversation_muted(uuid, uuid) from public, anon, authenticated;
revoke all on function private.conversation_prefs_pin_limit() from public, anon, authenticated;
