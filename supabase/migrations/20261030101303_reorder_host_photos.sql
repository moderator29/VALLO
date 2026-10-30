-- Photo order for hosts: drag a photograph to move it. Position is unique per
-- subject, so a reorder used to need a free slot and at ten photographs there
-- is none. The two uniques become deferrable and one function per spine moves
-- every position in one statement, inside the caller's own RLS (security
-- invoker): somebody else's photographs simply do not move.

alter table public.accommodation_photos
  drop constraint accommodation_photos_accommodation_id_position_key,
  add constraint accommodation_photos_accommodation_id_position_key unique (accommodation_id, position) deferrable initially immediate;
alter table public.business_photos
  drop constraint business_photos_business_id_position_key,
  add constraint business_photos_business_id_position_key unique (business_id, position) deferrable initially immediate;

create function public.reorder_accommodation_photos(p_accommodation uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moved integer;
  total integer;
begin
  set constraints public.accommodation_photos_accommodation_id_position_key deferred;
  update public.accommodation_photos p
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.accommodation_id = p_accommodation;
  get diagnostics moved = row_count;
  select count(*) into total from public.accommodation_photos where accommodation_id = p_accommodation;
  if moved <> coalesce(array_length(p_ids, 1), 0) or moved <> total then
    raise exception 'reorder_photos_mismatch' using errcode = 'P0001';
  end if;
  return moved;
end;
$$;

create function public.reorder_business_photos(p_business uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moved integer;
  total integer;
begin
  set constraints public.business_photos_business_id_position_key deferred;
  update public.business_photos p
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.business_id = p_business;
  get diagnostics moved = row_count;
  select count(*) into total from public.business_photos where business_id = p_business;
  if moved <> coalesce(array_length(p_ids, 1), 0) or moved <> total then
    raise exception 'reorder_photos_mismatch' using errcode = 'P0001';
  end if;
  return moved;
end;
$$;

revoke all on function public.reorder_accommodation_photos(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_business_photos(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_accommodation_photos(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_business_photos(uuid, uuid[]) to authenticated;
