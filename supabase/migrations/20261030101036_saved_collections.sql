-- Saved collections: a member's own named lists ("Lagos shortlist") over what
-- they have saved. A list holds a pointer to a saved listing, stay or table;
-- removing the save does not need to touch the list (the page only draws
-- members that are still saved), and deleting the list never deletes a save.

create table public.saved_collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index saved_collections_user_name_idx
  on public.saved_collections (user_id, lower(btrim(name)));

create table public.saved_collection_items (
  collection_id uuid not null references public.saved_collections (id) on delete cascade,
  kind          text not null check (kind in ('listing', 'accommodation', 'restaurant')),
  target_id     uuid not null,
  created_at    timestamptz not null default now(),
  primary key (collection_id, kind, target_id)
);

alter table public.saved_collections enable row level security;
alter table public.saved_collection_items enable row level security;

create policy saved_collections_owner_all on public.saved_collections
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_collection_items_owner_all on public.saved_collection_items
  for all to authenticated
  using (exists (
    select 1 from public.saved_collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.saved_collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ));

revoke all on public.saved_collections, public.saved_collection_items from anon, public;
grant select, insert, update, delete on public.saved_collections, public.saved_collection_items to authenticated;

-- A member keeps at most 20 lists, so the page stays a shortlist and not a filing cabinet.
create function private.saved_collections_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_collections where user_id = new.user_id) >= 20 then
    raise exception 'saved_collections_cap' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.saved_collections_cap() from public, anon, authenticated;

create trigger saved_collections_cap_before_insert
  before insert on public.saved_collections
  for each row execute function private.saved_collections_cap();
