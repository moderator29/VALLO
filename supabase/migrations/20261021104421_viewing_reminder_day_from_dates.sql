-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). Check against the live definition before applying:
--   select pg_get_functiondef('private.send_viewing_reminders()'::regprocedure);
-- It must still match 20261013100331_visit_reminders_both_sides.sql (step 3) apart
-- from the lines marked NEW below; if it has drifted, re-base this on the live
-- body rather than applying it as written.
--
-- WHAT IT FIXES. The reminder text chose its day from the STAGE: 'eve' said
-- "tomorrow", every other stage said "today". The 'soon' stage fires two hours
-- before, so a visit at 00:30 Lagos time booked late in the evening was told at
-- 22:30 "Your viewing is ... today at 00:30", which is the wrong day. The day is
-- now read from the Lagos dates of the slot and of the moment the reminder is
-- sent, in a small helper that can be tried at any instant without a clock
-- (the viewing_reminder_stage pattern):
--   private.viewing_reminder_when(p_slot, p_at)
--     the same Lagos date  -> 'today at HH:MI (Lagos time)'
--     any later date       -> 'tomorrow, Dy DD Mon, at HH:MI (Lagos time)'
--                            (the sweep only reads visits under two days ahead,
--                             and 'eve' only fires for exactly tomorrow)
-- The titles are unchanged ('soon' says "Viewing at HH:MI", no day).
--
-- Grants: both functions owned by postgres, EXECUTE for postgres only (the live
-- one keeps its ACL under CREATE OR REPLACE; the helper is revoked from public,
-- anon and authenticated). No row changes. Probe:
-- supabase/tests/probes-pending/viewing-reminder-when.sql (move it to probes/ once applied).

set lock_timeout = '5s';

create or replace function private.viewing_reminder_when(
  p_slot timestamptz,
  p_at   timestamptz
)
returns text
language sql
stable
set search_path = ''
as $fn$
  select case
    when (p_slot at time zone 'Africa/Lagos')::date = (p_at at time zone 'Africa/Lagos')::date
      then 'today at ' || to_char(p_slot at time zone 'Africa/Lagos', 'HH24:MI') || ' (Lagos time)'
    else 'tomorrow, ' || to_char(p_slot at time zone 'Africa/Lagos', 'Dy DD Mon') || ', at '
      || to_char(p_slot at time zone 'Africa/Lagos', 'HH24:MI') || ' (Lagos time)'
  end;
$fn$;

revoke all on function private.viewing_reminder_when(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function private.send_viewing_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r           record;
  sent        integer := 0;
  due_stage   text;
  aud         text;
  slot_local  timestamp;
  hhmm        text;
  when_text   text;
  how_text    text;
  title       text;
  renter_href text;
begin
  for r in
    select i.id, i.listing_id, i.requester_id, i.lister_id, i.slot_at, i.visit_mode,
           coalesce(i.confirmed_at, i.updated_at) as confirmed_at,
           coalesce(nullif(l.area, ''), l.city, 'the property') as place,
           coalesce(nullif(p.display_name, ''), 'the lister') as shown_by,
           coalesce(nullif(v.display_name, ''), 'your visitor') as visitor
      from public.inspection_requests i
      join public.listings l on l.id = i.listing_id
      left join public.profiles p on p.id = i.lister_id
      left join public.profiles v on v.id = i.requester_id
     where i.state = 'CONFIRMED'
       and i.slot_at is not null
       and i.slot_at > now()
       and i.slot_at < now() + interval '2 days'
     limit 1000
  loop
    -- The latest stage that is due, and only that one: a missed earlier stage is never sent late.
    due_stage := private.viewing_reminder_stage(r.slot_at, r.confirmed_at, now());
    continue when due_stage is null;

    slot_local := r.slot_at at time zone 'Africa/Lagos';
    hhmm := to_char(slot_local, 'HH24:MI');
    -- NEW: the day is read from the dates, never from the stage. A 'soon' reminder for a
    -- 00:30 visit goes out at 22:30 the evening before, and used to say "today at 00:30".
    when_text := private.viewing_reminder_when(r.slot_at, now());
    how_text := case when r.visit_mode = 'video'
      then 'by video call in Vallo'
      else 'in person at ' || r.place
    end;
    title := case when r.visit_mode = 'video' then 'Video viewing' else 'Viewing' end
      || case due_stage when 'eve' then ' tomorrow at ' when 'morning' then ' today at ' else ' at ' end
      || hhmm || ' Lagos time';
    renter_href := '/listing/' || r.listing_id::text || '/visit/' || r.id::text;

    foreach aud in array array['renter', 'lister'] loop
      insert into public.viewing_reminders (inspection_id, audience, stage, slot_at)
      values (r.id, aud, due_stage, r.slot_at) on conflict do nothing;
      if found then
        if aud = 'renter' then
          perform private.notify(r.requester_id, 'booking'::public.notification_kind,
            title,
            case when r.visit_mode = 'video'
              then 'Your viewing of the home in ' || r.place || ' is ' || how_text || ', ' || when_text ||
                   ', with ' || r.shown_by || '.'
              else 'Your viewing is ' || how_text || ', ' || when_text || ', shown by ' || r.shown_by || '.'
            end,
            renter_href);
        else
          perform private.notify(r.lister_id, 'booking'::public.notification_kind,
            title,
            'You are showing ' || r.place || ' to ' || r.visitor || ' ' ||
              case when r.visit_mode = 'video' then 'by video call in Vallo' else 'in person' end ||
              ', ' || when_text || '.',
            '/agent/inspections');
        end if;
        sent := sent + 1;
      end if;
    end loop;
  end loop;
  return sent;
end;
$fn$;

revoke all on function private.send_viewing_reminders() from public, anon, authenticated;
