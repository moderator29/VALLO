-- PLATFORM GRADE 1 (7 November 2026): a push leaves within seconds, not
-- up to five minutes. The drain was only called by pg_cron every 5 minutes,
-- so a message notification waited 2 to 4 minutes before Apple saw it (the
-- founder's report; push_queue rows at 14:16 and 14:17 UTC settled at 14:20).
-- Now a new row in push_queue kicks the same drain at once, at most once
-- every 10 seconds; the 5-minute job stays as the safety net.
-- PENDING: needs the founder's confirmation in the Supabase prompt.

alter table private.push_drain_watch
  add column if not exists last_kick_at timestamptz;

create or replace function private.kick_push_drain()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  site_url text;
  secret text;
  claimed boolean;
begin
  update private.push_drain_watch
     set last_kick_at = now()
   where only_row
     and (last_kick_at is null or last_kick_at < now() - interval '10 seconds')
  returning true into claimed;
  if not coalesce(claimed, false) then
    return null;
  end if;

  select btrim(decrypted_secret, E' \t\r\n') into site_url
    from vault.decrypted_secrets where name = 'vallo_site_url';
  select btrim(decrypted_secret, E' \t\r\n') into secret
    from vault.decrypted_secrets where name = 'vallo_reconcile_secret';
  if coalesce(site_url, '') = '' or coalesce(secret, '') = '' then
    return null;
  end if;

  perform net.http_get(
    url := rtrim(site_url, '/') || '/api/push/drain',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json',
      'X-Vallo-Scheduler', 'enqueue-kick'
    ),
    timeout_milliseconds := 30000
  );
  return null;
exception when others then
  return null;
end;
$function$;

revoke all on function private.kick_push_drain() from public;

drop trigger if exists push_queue_zz_kick_drain on public.push_queue;
create trigger push_queue_zz_kick_drain
  after insert on public.push_queue
  for each statement
  execute function private.kick_push_drain();
