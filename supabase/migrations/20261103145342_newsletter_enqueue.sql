set lock_timeout = '5s';

-- QUEUE THE PLATFORM NEWSLETTER, BY HAND, ONCE PER CAMPAIGN (3 November 2026).
--
-- Nothing calls this automatically: no trigger, no cron, no server action. The
-- founder runs it from the SQL editor, `select public.newsletter_enqueue('2026-11-launch');`,
-- and the email outbox drain (/api/cron/email-outbox) sends what it queued in
-- batches. `lib/notify/templates.ts` renders the template 'platform.newsletter'
-- with `platformNewsletter`, on the `marketing` channel.
--
-- WHO GETS A ROW. Every account that is not anonymous, not deleted, has a
-- confirmed email address, and has not switched marketing email off
-- (`profiles.settings.notifications.marketing = false`). The drain applies the
-- same marketing check again at send time, so a switch turned off between the
-- queueing and the send still wins.
--
-- `p_opt_in_only` is the stricter reading: when true, only members whose
-- marketing switch is explicitly true get a row (the Settings screen shows
-- marketing off until somebody turns it on).
--
-- ONCE ONLY. The dedupe key is `newsletter:<campaign>:<user id>` and
-- `email_outbox_dedupe_key` is UNIQUE, so a second call for the same campaign
-- queues nothing. Answer: the number of rows this call queued.
--
-- Rule 21: born locked, service_role only, read back below.

create or replace function public.newsletter_enqueue(p_campaign text, p_opt_in_only boolean default false)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_campaign text := btrim(coalesce(p_campaign, ''));
  v_count integer;
begin
  if v_campaign = '' or char_length(v_campaign) > 60
     or v_campaign !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'newsletter_enqueue: campaign must be 1 to 60 characters of letters, digits, dot, dash or underscore';
  end if;

  insert into public.email_outbox (user_id, template, dedupe_key, payload)
  select u.id,
         'platform.newsletter',
         'newsletter:' || v_campaign || ':' || u.id::text,
         jsonb_build_object('campaign', v_campaign)
    from auth.users u
    left join public.profiles p on p.id = u.id
   where not coalesce(u.is_anonymous, false)
     and u.deleted_at is null
     and u.email_confirmed_at is not null
     and coalesce(btrim(u.email), '') <> ''
     and case
           when p_opt_in_only then (p.settings #>> '{notifications,marketing}') = 'true'
           else coalesce(p.settings #>> '{notifications,marketing}', '') <> 'false'
         end
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function public.newsletter_enqueue(text, boolean) from public, anon, authenticated;
grant execute on function public.newsletter_enqueue(text, boolean) to service_role;

comment on function public.newsletter_enqueue(text, boolean) is
  'Queues the platform.newsletter email once per confirmed, undeleted member who has not switched marketing off. Founder-run from the SQL editor; idempotent per campaign.';

-- ----------------------------------------------------------------------------
-- RULE 21, READ BACK INSIDE THE MIGRATION, BOTH HALVES.

do $fn$
declare
  v_open int;
  v_service int;
begin
  select count(*) into v_open
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'newsletter_enqueue'
     and (has_function_privilege('anon', p.oid, 'EXECUTE')
       or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_open <> 0 then
    raise exception 'rule 21: newsletter_enqueue is executable by anon or authenticated';
  end if;

  select count(*) into v_service
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'newsletter_enqueue'
     and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if v_service <> 1 then
    raise exception 'service_role cannot call newsletter_enqueue';
  end if;
end
$fn$;
