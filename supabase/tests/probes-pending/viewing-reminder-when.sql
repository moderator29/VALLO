-- VIEWING-REMINDER-WHEN (migration 20261021104421_viewing_reminder_day_from_dates, applied):
--  1. a 'soon' reminder at 22:30 Lagos for a 00:30 visit says tomorrow, not today
--  2. a reminder on the visit's own Lagos day says today
--  3. the 'eve' case (19:00 the evening before) still says tomorrow with the date
-- Reads only; the final raise rolls back nothing because nothing is written.
do $$
declare
  said text;
begin
  -- 1. Visit 00:30 Lagos on Sunday 18 October 2026 (23:30 UTC on the 17th), asked at 22:30 Lagos.
  said := private.viewing_reminder_when('2026-10-17 23:30:00+00', '2026-10-17 21:30:00+00');
  if said is distinct from 'tomorrow, Sun 18 Oct, at 00:30 (Lagos time)' then
    raise exception 'PROBE_FAIL viewing-reminder-when 1: said %', coalesce(said, 'nothing');
  end if;

  -- 2. Visit 14:00 Lagos, asked at 12:00 Lagos the same day.
  said := private.viewing_reminder_when('2026-10-18 13:00:00+00', '2026-10-18 11:00:00+00');
  if said is distinct from 'today at 14:00 (Lagos time)' then
    raise exception 'PROBE_FAIL viewing-reminder-when 2: said %', coalesce(said, 'nothing');
  end if;

  -- 3. Visit 10:00 Lagos on the 18th, asked at 19:05 Lagos on the 17th.
  said := private.viewing_reminder_when('2026-10-18 09:00:00+00', '2026-10-17 18:05:00+00');
  if said is distinct from 'tomorrow, Sun 18 Oct, at 10:00 (Lagos time)' then
    raise exception 'PROBE_FAIL viewing-reminder-when 3: said %', coalesce(said, 'nothing');
  end if;

  raise exception 'PROBE_OK viewing-reminder-when';
end
$$;
