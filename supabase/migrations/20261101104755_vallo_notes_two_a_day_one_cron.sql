-- Vallo's own notes: at most two a day, sometimes one, from the ONE existing cron job (vallo-daily-note).
-- The 05:00 and 15:00 UTC runs (06:00 and 16:00 Lagos) post the first and, on two days in three, a second note.
-- Old notes are hidden in the feed by the read, not deleted here.
create or replace function private.post_daily_note()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  body      text;
  new_id    uuid;
  today     date := (now() at time zone 'Africa/Lagos')::date;
  posted    integer;
  allowed   integer;
begin
  select count(*) into posted
    from public.posts
   where author_kind = 'SYSTEM'
     and area_id is null
     and parent_id is null
     and (created_at at time zone 'Africa/Lagos')::date = today;

  allowed := case when (today - date '2026-01-01') % 3 = 2 then 1 else 2 end;
  if posted >= allowed then
    return null;
  end if;
  if posted = 1 and extract(hour from (now() at time zone 'Africa/Lagos')) < 14 then
    return null;
  end if;

  for candidate in
    select slug from private.daily_notes
     order by last_used asc nulls first, used_count asc, slug asc
  loop
    body := private.daily_note_body(candidate.slug);
    exit when body is not null;
  end loop;

  if body is null then return null; end if;

  insert into public.posts (area_id, author_kind, kind, body, status)
  values (null, 'SYSTEM', 'SYSTEM', body, 'LIVE')
  returning id into new_id;

  update private.daily_notes
     set last_used = now(), used_count = used_count + 1
   where slug = candidate.slug;

  return new_id;
end;
$$;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'vallo-daily-note'),
  schedule := '0 5,15 * * *'
);
