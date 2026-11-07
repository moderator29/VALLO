-- PLATFORM GRADE 1 (7 November 2026): staff sign-in alerts only when it
-- matters. The founder: "filter unnecessary stupid notis like sign in etc
-- everytime someone just enters the platform". In 14 days the two alerts
-- below fired 32 times: a mobile network changes its /24 constantly, so
-- nearly every phone sign-in counted as "a new place". Now:
--   - a new place is a new DEVICE (browser or app fingerprint) not seen in
--     60 days; the network is still recorded in the audit, never alerted on;
--   - at most one alert per staff member per 24 hours;
--   - every sign-in is still written to audit_log, exactly as before.
-- PENDING: needs the founder's confirmation in the Supabase prompt.

create or replace function private.audit_staff_sign_in()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  is_staff boolean;
  net text;
  ua text;
  seen boolean;
  recent boolean;
  who text;
  boss uuid;
begin
  select exists (select 1 from public.user_roles r where r.user_id = new.user_id and r.role in ('admin', 'super_admin'))
      or exists (select 1 from public.staff_grants g where g.user_id = new.user_id and g.revoked_at is null)
    into is_staff;
  if not coalesce(is_staff, false) then
    return new;
  end if;

  net := case when new.ip is null then 'unknown'
              else host(network(set_masklen(new.ip, case when family(new.ip) = 4 then 24 else 48 end)))
                   || '/' || case when family(new.ip) = 4 then '24' else '48' end end;
  ua := left(encode(sha256(convert_to(coalesce(new.user_agent, ''), 'UTF8')), 'hex'), 32);

  select exists (
    select 1 from public.audit_log a
     where a.actor_id = new.user_id and a.action = 'staff.sign_in'
       and a.created_at > now() - interval '60 days'
       and a.metadata ->> 'ua_hash' = ua)
    into seen;

  select exists (
    select 1 from public.audit_log a
     where a.actor_id = new.user_id and a.action = 'staff.sign_in'
       and a.created_at > now() - interval '24 hours'
       and (a.metadata ->> 'alerted')::boolean is true)
    into recent;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (new.user_id, 'staff.sign_in', 'user', new.user_id::text,
          jsonb_build_object('session_id', new.id, 'network', net, 'ua_hash', ua,
                             'new_place', not seen, 'alerted', (not seen and not recent)));

  if not seen and not recent then
    select coalesce(nullif(btrim(p.display_name), ''), 'A staff member') into who
      from public.profiles p where p.id = new.user_id;
    perform private.notify(new.user_id, 'system'::public.notification_kind,
      'New device on your staff account',
      'Your staff account signed in on a device we have not seen before. If this was not you, change your password now and tell the founder.',
      '/settings/privacy');
    for boss in
      select distinct r.user_id from public.user_roles r
       where r.role = 'super_admin'::public.app_role and r.user_id <> new.user_id
    loop
      perform private.notify(boss, 'system'::public.notification_kind,
        'Staff sign-in on a new device',
        coalesce(who, 'A staff member') || ' signed in on a device we have not seen before.',
        '/admin/audit?q=staff.sign_in');
    end loop;
  end if;
  return new;
exception when others then
  raise warning '[staff sign-in] audit failed: %', sqlstate;
  return new;
end;
$function$;
