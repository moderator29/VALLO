-- A renter moves their own viewing to another open time, atomically: the old
-- one is withdrawn and the new one booked through the same function the
-- listing page uses, in one transaction. If the new time is not free the
-- whole move is refused and the old viewing stands. The lister hears both
-- through the existing inspection triggers.
create or replace function public.reschedule_my_viewing(p_inspection uuid, p_slot timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  old_row public.inspection_requests;
  booked uuid;
begin
  if caller is null then
    raise exception 'sign in to change a viewing' using errcode = '42501';
  end if;
  select * into old_row from public.inspection_requests where id = p_inspection for update;
  if not found or old_row.requester_id <> caller then
    raise exception 'that viewing could not be found' using errcode = 'P0001', hint = 'viewing_not_found';
  end if;
  if old_row.state not in ('REQUESTED', 'PROPOSED', 'CONFIRMED') then
    raise exception 'that viewing is closed' using errcode = 'P0001', hint = 'viewing_closed';
  end if;
  if coalesce(old_row.slot_at, old_row.requested_at) <= now() then
    raise exception 'that viewing time has passed' using errcode = 'P0001', hint = 'viewing_time_passed';
  end if;
  if old_row.slot_at is not null and old_row.slot_at = p_slot then
    raise exception 'that is already the time' using errcode = 'P0001', hint = 'viewing_same_time';
  end if;

  update public.inspection_requests set state = 'WITHDRAWN' where id = old_row.id;
  booked := public.book_viewing_slot_mode(old_row.listing_id, p_slot, old_row.note, coalesce(old_row.visit_mode, 'in_person'));
  update public.inspection_requests set conversation_id = old_row.conversation_id where id = booked;
  return booked;
end;
$$;
revoke all on function public.reschedule_my_viewing(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_my_viewing(uuid, timestamptz) to authenticated;
