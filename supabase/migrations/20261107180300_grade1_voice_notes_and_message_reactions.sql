-- PLATFORM GRADE 1 (P1.3, 7 November 2026): voice notes and reactions in
-- Messages. Additive: existing rows read as photos, as before.
-- PENDING: the founder confirms in the Supabase prompt, then it is applied
-- with the MCP tool and moved to the top level under the stamped version.

-- 1. Voice notes ride in the same private bucket and the same
--    conversation-folder rule as photos; only audio types are added.
update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf',
     'audio/webm','audio/mp4','audio/aac','audio/mpeg','audio/ogg','audio/x-m4a'
   ]
 where id = 'message-attachments';

alter table public.message_attachments
  add column if not exists kind text not null default 'image',
  add column if not exists duration_ms integer,
  add column if not exists peaks jsonb;

alter table public.message_attachments
  drop constraint if exists message_attachments_kind_chk,
  add constraint message_attachments_kind_chk check (kind in ('image', 'audio')),
  drop constraint if exists message_attachments_duration_chk,
  add constraint message_attachments_duration_chk
    check (duration_ms is null or (kind = 'audio' and duration_ms between 0 and 300000)),
  drop constraint if exists message_attachments_peaks_chk,
  add constraint message_attachments_peaks_chk
    check (peaks is null or (kind = 'audio' and jsonb_typeof(peaks) = 'array' and jsonb_array_length(peaks) <= 64));

-- 2. Reactions: one per person per message (a new one replaces the old),
--    from a fixed set, visible only to the conversation's members.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  -- Copied from the message by the trigger below, never trusted from the
  -- client, so realtime can filter one conversation's reactions.
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji_chk check (emoji in (
    U&'\+01F44D', U&'\2764\FE0F', U&'\+01F602', U&'\+01F62E', U&'\+01F622', U&'\+01F64F', U&'\+01F525', U&'\+01F389'
  ))
);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists message_reactions_conversation_idx on public.message_reactions (conversation_id);

create or replace function private.message_reaction_conversation()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  select m.conversation_id into new.conversation_id
    from public.messages m where m.id = new.message_id;
  if new.conversation_id is null then
    raise exception 'No such message.' using errcode = '23503';
  end if;
  return new;
end;
$function$;

drop trigger if exists message_reactions_00_conversation on public.message_reactions;
create trigger message_reactions_00_conversation
  before insert or update of message_id on public.message_reactions
  for each row execute function private.message_reaction_conversation();

alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full;

revoke all on public.message_reactions from anon;
grant select, insert, update, delete on public.message_reactions to authenticated;

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m
                 where m.id = message_reactions.message_id
                   and private.in_conversation(m.conversation_id)));

drop policy if exists message_reactions_insert on public.message_reactions;
create policy message_reactions_insert on public.message_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m
                where m.id = message_reactions.message_id
                  and m.deleted_for_everyone_at is null
                  and private.in_conversation(m.conversation_id))
    and not private.blocked_for_message(message_id)
  );

drop policy if exists message_reactions_update on public.message_reactions;
create policy message_reactions_update on public.message_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and not private.blocked_for_message(message_id));

drop policy if exists message_reactions_delete on public.message_reactions;
create policy message_reactions_delete on public.message_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
