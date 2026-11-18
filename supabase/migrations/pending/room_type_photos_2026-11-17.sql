-- PHOTOGRAPHS PER ROOM TYPE (founder, 17 November 2026).
--
-- A property carries its own photographs (`accommodation_photos`); until now a
-- room type ("Deluxe King", "Family Suite") carried none, so a guest choosing
-- between two rooms on a stay page had a name, a bed count and a price, and no
-- picture of either room. This adds `public.room_type_photos`: up to ten
-- photographs per room type, position 0 the cover.
--
-- NOT APPLIED. The founder runs it. Additive only: one new table, its index,
-- its two policies, its grants and one reorder function. Nothing existing is
-- touched, dropped or narrowed. Safe to run twice (`if not exists`,
-- `drop policy if exists`, `create or replace`).
--
-- MODELLED ON `accommodation_photos`, DELIBERATELY AND CLOSELY, as it stands
-- LIVE (read on 17 November 2026), not as M3 first wrote it:
--
--   * Same columns, the same 0..9 position check, the same path-not-a-URL
--     check (`accommodation_photos_path_not_url`), and the same DEFERRABLE
--     unique on (parent, position) that `20261030101303_reorder_host_photos`
--     gave the other two photo tables, so a reorder moves every position in
--     one statement.
--   * The same bucket: `storage_path` is a path inside the PUBLIC
--     `accommodation-photos` bucket, whose first folder is the uploader's auth
--     uid. The bucket's four storage policies already check exactly that
--     (`(storage.foldername(name))[1] = auth.uid()`), so no storage policy
--     changes here. The application writes `<uid>/<room type id>/<uuid>.<ext>`
--     and re-checks the uid prefix in the server action before recording the
--     row, as it does for the property's own photographs. The uid is NOT
--     re-checked in the table's write policy, for the same reason it is not on
--     `accommodation_photos`: after a business is handed over
--     (`/host/transfer`) the new owner must still be able to reorder and take
--     down photographs the old owner uploaded.
--   * The same RLS shape, one level down. The live `accommodation_photos`
--     policies read the set-returning helpers `private.public_accommodation_ids()`
--     and `private.my_accommodation_ids()`; the room-level twins
--     `private.public_room_type_ids()` (room type, its accommodation and its
--     business all PUBLISHED) and `private.my_room_type_ids()` (the room
--     type's accommodation's business is the caller's) already exist live and
--     are what this table reads. So:
--       - anybody may read a photograph of a room type that is on the shelf
--         (the room type AND its accommodation AND its business PUBLISHED);
--       - the owner of the business above the room type reads and writes;
--       - admin and super_admin read and write, as on every photo table.
--   * The same grants as `accommodation_photos` live: anon SELECT,
--     authenticated SELECT/INSERT/UPDATE/DELETE, service_role all.
--
-- WHAT IT DOES NOT DO. No catalogue trigger: the shelf card's cover is the
-- property's cover, not a room's, so nothing on `catalogue_entries` depends on
-- this table. The submission gate (`missingFrom`) does not require a room
-- photograph; a room with none falls back to the stay page's current look.
--
-- THE APPLICATION ALREADY HANDLES THE TABLE BEING ABSENT. Until this runs,
-- every read of `room_type_photos` answers "relation does not exist"
-- (PGRST205 / 42P01) and the host room screen and the stay page simply draw no
-- room photographs, with no banner and no error.

begin;

/* ------------------------------------------------------------ the table */

create table if not exists public.room_type_photos (
  id           uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  storage_path text not null check (length(storage_path) between 1 and 400),
  -- Position 0 is the cover, as on accommodation_photos and business_photos.
  position     integer not null default 0 check (position >= 0 and position < 10),
  created_at   timestamptz not null default now(),
  constraint room_type_photos_room_type_id_position_key
    unique (room_type_id, position) deferrable initially immediate,
  constraint room_type_photos_path_not_url
    check (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
           and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
);

comment on table public.room_type_photos is
  'Up to 10 photographs of one room type. Position 0 is the cover. storage_path is a path in the public accommodation-photos bucket, uid-prefixed, never a URL.';

comment on column public.room_type_photos.storage_path is
  'Path inside the public accommodation-photos bucket. The first folder is the uploader''s auth uid, which is what the bucket''s own policies check.';

-- The unique above already indexes (room_type_id, position), which is the
-- only shape anything reads this table in (one room type, cover first, or
-- every room type of one stay with `in (...)`), so no second index is needed.

/* ------------------------------------------------------------- the rules */

alter table public.room_type_photos enable row level security;

drop policy if exists room_type_photos_select on public.room_type_photos;
create policy room_type_photos_select
  on public.room_type_photos for select
  using (
    ((room_type_id is not null) and (room_type_id in (select private.public_room_type_ids())))
    or ((room_type_id is not null) and (room_type_id in (select private.my_room_type_ids())))
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
    or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  );

drop policy if exists room_type_photos_write on public.room_type_photos;
create policy room_type_photos_write
  on public.room_type_photos for all
  using (
    ((room_type_id is not null) and (room_type_id in (select private.my_room_type_ids())))
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
    or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  )
  with check (
    ((room_type_id is not null) and (room_type_id in (select private.my_room_type_ids())))
    or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
    or (select private.has_role((select auth.uid()), 'super_admin'::public.app_role))
  );

/* ------------------------------------------------------------ the grants */

revoke all on table public.room_type_photos from public, anon, authenticated;
grant select on table public.room_type_photos to anon;
grant select, insert, update, delete on table public.room_type_photos to authenticated;
grant all on table public.room_type_photos to service_role;

/* --------------------------------------------------------- the reorder */

-- The twin of public.reorder_accommodation_photos: every position moved in one
-- statement inside the caller's own RLS (security invoker), so somebody
-- else's photographs simply do not move, and a half-applied order is refused.
create or replace function public.reorder_room_type_photos(p_room_type uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moved integer;
  total integer;
begin
  set constraints public.room_type_photos_room_type_id_position_key deferred;
  update public.room_type_photos p
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.room_type_id = p_room_type;
  get diagnostics moved = row_count;
  select count(*) into total from public.room_type_photos where room_type_id = p_room_type;
  if moved <> coalesce(array_length(p_ids, 1), 0) or moved <> total then
    raise exception 'reorder_photos_mismatch' using errcode = 'P0001';
  end if;
  return moved;
end;
$$;

revoke all on function public.reorder_room_type_photos(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_room_type_photos(uuid, uuid[]) to authenticated;

commit;

-- Ask PostgREST to read the new table and function without waiting.
notify pgrst, 'reload schema';
