-- The push drain alert raised a new HIGH row for every failed call, so one
-- deploy-time 500 and one old timeout left 24 open duplicates on the desk.
-- Now: an alert needs two failed calls in a row, only one open alert of each
-- title exists at a time, and a healthy reply closes the open ones itself.
create or replace function private.request_push_drain()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_url text;
  secret text;
  request_id bigint;
  previous_id bigint;
  previous_at timestamptz;
  earlier_verdict text;
  previous_status integer;
  previous_body text;
  verdict text;
  failing boolean;
  title_text text;
begin
  select btrim(decrypted_secret, E' \t\r\n') into site_url
    from vault.decrypted_secrets where name = 'vallo_site_url';
  select btrim(decrypted_secret, E' \t\r\n') into secret
    from vault.decrypted_secrets where name = 'vallo_reconcile_secret';

  if site_url is null or site_url = '' or secret is null or secret = '' then
    return jsonb_build_object(
      'status', 'unconfigured',
      'site_url_present', coalesce(site_url, '') <> '',
      'secret_present', coalesce(secret, '') <> ''
    );
  end if;

  select w.last_request_id, w.last_requested_at, w.last_verdict
    into previous_id, previous_at, earlier_verdict
    from private.push_drain_watch w
   where w.only_row;

  if previous_id is not null then
    select r.status_code, left(coalesce(r.content, ''), 1000)
      into previous_status, previous_body
      from net._http_response r
     where r.id = previous_id;

    if previous_status is null then
      verdict := case
        when previous_at > now() - interval '1 hour' then 'no_reply'
        else 'aged_out'
      end;
    elsif previous_status between 200 and 299 then
      if position('"job":"push-drain"' in coalesce(previous_body, '')) > 0 then
        verdict := 'ok_' || previous_status::text;
      else
        verdict := 'wrong_body_' || previous_status::text;
      end if;
    else
      verdict := 'failed_' || previous_status::text;
    end if;

    failing := verdict like 'failed_%' or verdict like 'wrong_body_%' or verdict = 'no_reply';

    if verdict like 'ok_%' then
      /* A healthy reply closes what the failures opened. */
      update public.risk_alerts
         set status = 'resolved', resolved_at = now()
       where status = 'open' and entity_type = 'cron_job' and title like 'Push drain:%';
    elsif failing
      and (coalesce(earlier_verdict, '') like 'failed_%'
           or coalesce(earlier_verdict, '') like 'wrong_body_%'
           or coalesce(earlier_verdict, '') = 'no_reply') then
      title_text := case
        when verdict like 'wrong_body_%'
          then 'Push drain: something answered, but it was not the drain'
        else 'Push drain: the last call did not succeed'
      end;
      if not exists (
        select 1 from public.risk_alerts a
         where a.status = 'open' and a.title = title_text and a.entity_type = 'cron_job'
      ) then
        insert into public.risk_alerts (severity, status, title, description, entity_type)
        values (
          'high',
          'open',
          title_text,
          case
            when verdict like 'wrong_body_%' then format(
              'The scheduled push drain called %s/api/push/drain twice running and got a %s that '
              || 'was NOT the drain''s reply. The route may not be deployed, was renamed, or is '
              || 'shadowed by a redirect. No notification is reaching any device. First 200 '
              || 'characters of what came back: %s',
              site_url, previous_status::text, left(coalesce(previous_body, '(empty)'), 200)
            )
            else format(
              'The scheduled push drain failed twice running (latest reply: %s). Until this reads '
              || '2xx with the drain''s own envelope, no notification is reaching any device. A 401 '
              || 'means the bearer in Vault no longer matches the deployment. Body: %s',
              coalesce(previous_status::text, 'never received'),
              coalesce(nullif(left(previous_body, 200), ''), '(empty)')
            )
          end,
          'cron_job'
        );
      end if;
    end if;
  else
    verdict := 'first_run';
  end if;

  select net.http_get(
    url := rtrim(site_url, '/') || '/api/push/drain',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json',
      'X-Vallo-Scheduler', 'pg_cron'
    ),
    timeout_milliseconds := 30000
  ) into request_id;

  update private.push_drain_watch
     set last_request_id = request_id,
         last_requested_at = now(),
         last_verdict = verdict,
         last_judged_at = now()
   where only_row;

  return jsonb_build_object(
    'status', 'requested',
    'request_id', request_id,
    'previous_verdict', verdict
  );
end;
$$;
