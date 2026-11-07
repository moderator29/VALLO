-- FEATURES A5 and A6: new notification kinds and gentle nudges.
-- Agent FEATURES, 7 November 2026. For the founder to paste in the Supabase
-- SQL Editor; the lead checks it live and moves it into migrations/.
--
-- WHAT ALREADY EXISTS AND IS KEPT AS IT IS (read live on 7 November 2026):
--   price down / changed on a saved place    private.record_listing_change
--   a saved place back on the market          private.record_listing_change
--   a viewing tomorrow (and today)            private.send_viewing_reminders
--   a stay check-in tomorrow (and today)      private.send_stay_reminders
--   a review to leave after a stay or a meal  private.send_stay_reminders
--   new listings for a saved search           new-match-alerts + saved-search-alerts
--
-- WHAT THIS ADDS:
--   A5  new in your area: one digest a day for people who joined an area or
--       set a home area and keep NO saved search alert (those already hear
--       through their alert), filtered by their stated interests
--   A5  new neighbours: people you follow who joined one of your areas, one
--       digest a day
--   A5  a review to leave after a move-in, a month after the move-in date
--       (V-59's window), told once
--   A6  gentle nudges: confirm your phone, verify your ID before a long
--       rental (5 months or more; never for stays), finish your listing
--       draft, add a profile photo. At most ONE nudge a week per person
--       (so never two in a day), each kind stops after THREE, every kind
--       and all nudges together switchable on /settings/notifications/reminders
--
-- Additive only: two tables, five functions, two cron jobs. Nothing dropped.
-- RLS on the public table, own rows only. Every function security definer
-- with search_path ''. Cron runs inside Lagos daytime only.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The switches. A missing row means on; only an explicit false silences.

create table if not exists public.notice_preferences (
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic      text not null check (topic in (
               'new_in_area', 'new_neighbours', 'move_in_review',
               'nudges', 'nudge_phone', 'nudge_identity',
               'nudge_listing_draft', 'nudge_profile')),
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

comment on table public.notice_preferences is
  'FEATURES A5/A6: per person switches for the new notices and nudges. No row means on.';

alter table public.notice_preferences enable row level security;

drop policy if exists notice_preferences_select_own on public.notice_preferences;
create policy notice_preferences_select_own on public.notice_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notice_preferences_insert_own on public.notice_preferences;
create policy notice_preferences_insert_own on public.notice_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists notice_preferences_update_own on public.notice_preferences;
create policy notice_preferences_update_own on public.notice_preferences
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notice_preferences_delete_own on public.notice_preferences;
create policy notice_preferences_delete_own on public.notice_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.notice_preferences from public, anon;
grant select, insert, update, delete on table public.notice_preferences to authenticated;
grant select on table public.notice_preferences to service_role;

-- ---------------------------------------------------------------------------
-- 2. The nudge ledger. Private: never exposed through the API.

create table if not exists private.nudge_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nudge   text not null,
  sent_at timestamptz not null default now()
);

create index if not exists nudge_log_user_sent on private.nudge_log (user_id, sent_at desc);

comment on table private.nudge_log is
  'FEATURES A6: one row per gentle nudge sent. Holds the caps: one a week, three per kind.';

revoke all on table private.nudge_log from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Helpers.

create or replace function private.notice_wanted(p_user uuid, p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.notice_preferences np
     where np.user_id = p_user and np.topic = p_topic and np.enabled = false
  );
$$;

-- One nudge a week per person (so never two kinds in a day), three per kind.
create or replace function private.may_nudge(p_user uuid, p_nudge text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.notice_wanted(p_user, 'nudges')
     and private.notice_wanted(p_user, p_nudge)
     and (select count(*) from private.nudge_log g
           where g.user_id = p_user and g.nudge = p_nudge) < 3
     and not exists (select 1 from private.nudge_log g
                      where g.user_id = p_user and g.sent_at > now() - interval '7 days');
$$;

-- The plain word for a listing, for "A 2 bedroom flat just listed near you".
create or replace function private.listing_noun(p_type text, p_bedrooms integer, p_intent text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_bedrooms, 0) > 0 and p_type in ('apartment', 'home', 'villa', 'rental', 'shortlet')
              then p_bedrooms || ' bedroom ' else '' end
      || case p_type
           when 'apartment' then 'flat'
           when 'home' then 'house'
           when 'villa' then 'villa'
           when 'shortlet' then 'shortlet'
           when 'shop' then 'shop'
           when 'office' then 'office'
           when 'land' then 'plot of land'
           else 'place'
         end
      || case when p_intent = 'sale' then ' for sale' else '' end;
$$;

revoke all on function private.notice_wanted(uuid, text) from public, anon, authenticated;
revoke all on function private.may_nudge(uuid, text) from public, anon, authenticated;
revoke all on function private.listing_noun(text, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. A5: the new notices. Once a day, in the early evening, Lagos time.

create or replace function private.send_feature_notices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     record;
  sent  integer := 0;
  today date := (now() at time zone 'Africa/Lagos')::date;
  hr    integer := extract(hour from (now() at time zone 'Africa/Lagos'))::integer;
begin
  /* Daytime only. */
  if hr < 9 or hr >= 20 then
    return 0;
  end if;

  /* NEW IN YOUR AREA. Listings published in the last day, in an area the
     person joined or set as home, matching their stated interests when they
     stated any. One notice a day, for the area with the most. People with a
     saved search alert switched on are left to that alert. */
  for r in
    with fresh as (
      select l.id, l.agent_id, l.property_type::text as ptype, l.bedrooms,
             l.listing_intent::text as intent, l.published_at,
             private.area_for_listing(l.state_code, l.city, l.area) as area_id
        from public.listings l
       where l.status = 'PUBLISHED'
         and l.closed_at is null
         and not coalesce(l.is_demo, false)
         and l.published_at > now() - interval '24 hours'
    ),
    places as (
      select am.user_id, am.area_id from public.area_members am
      union
      select sp.user_id, sp.home_area_id from public.social_profiles sp
       where sp.home_area_id is not null
    ),
    hits as (
      select pl.user_id, f.area_id, f.id, f.ptype, f.bedrooms, f.intent, f.published_at
        from places pl
        join fresh f on f.area_id = pl.area_id
        join public.profiles p on p.id = pl.user_id
        left join public.agents ag on ag.id = f.agent_id
       where ag.user_id is distinct from pl.user_id
         and (coalesce(cardinality(p.interests), 0) = 0 or f.ptype::text = any (p.interests::text[]))
         and not exists (select 1 from public.saved_searches s
                          where s.user_id = pl.user_id and s.alert_enabled)
         and private.notice_wanted(pl.user_id, 'new_in_area')
    ),
    per_area as (
      select h.user_id, h.area_id, count(*)::integer as n,
             (array_agg(h.id order by h.published_at desc))[1] as newest_id,
             (array_agg(private.listing_noun(h.ptype, h.bedrooms, h.intent) order by h.published_at desc))[1] as newest_noun
        from hits h
       group by h.user_id, h.area_id
    )
    select distinct on (pa.user_id) pa.user_id, pa.n, pa.newest_id, pa.newest_noun, a.name as area_name
      from per_area pa
      join public.areas a on a.id = pa.area_id
     order by pa.user_id, pa.n desc
     limit 5000
  loop
    if private.notify_once(
         'area_digest:' || r.user_id::text || ':' || today::text,
         r.user_id,
         'listing'::public.notification_kind,
         left('New in ' || r.area_name, 40),
         case when r.n = 1
              then 'A ' || r.newest_noun || ' just listed near you.'
              else r.n || ' new places listed near you today.'
         end,
         case when r.n = 1
              then '/listing/' || r.newest_id::text
              else '/search?q=' || replace(r.area_name, ' ', '+') || '&sort=newest'
         end) then
      sent := sent + 1;
    end if;
  end loop;

  /* NEW NEIGHBOURS. People you follow who joined one of your areas in the
     last day. Never across a block. One notice a day. (Circle members join
     this once Circle is live: VALLO_CIRCLE.md section 7.) */
  for r in
    with joined as (
      select am.user_id as joiner, am.area_id
        from public.area_members am
       where am.joined_at > now() - interval '24 hours'
    ),
    mine as (
      select am.user_id, am.area_id from public.area_members am
      union
      select sp.user_id, sp.home_area_id from public.social_profiles sp
       where sp.home_area_id is not null
    ),
    pairs as (
      select distinct m.user_id, j.joiner, j.area_id
        from joined j
        join mine m on m.area_id = j.area_id and m.user_id <> j.joiner
        join public.follows f on f.follower_id = m.user_id and f.followee_id = j.joiner
       where not private.blocked_between(m.user_id, j.joiner)
         and private.notice_wanted(m.user_id, 'new_neighbours')
    )
    select p.user_id,
           count(distinct p.joiner)::integer as n,
           (array_agg(p.joiner))[1] as first_joiner,
           (array_agg(p.area_id))[1] as first_area,
           count(distinct p.area_id)::integer as areas
      from pairs p
     group by p.user_id
     limit 5000
  loop
    if private.notify_once(
         'neighbours:' || r.user_id::text || ':' || today::text,
         r.user_id,
         'social'::public.notification_kind,
         'New neighbours',
         left(
           coalesce(nullif(private.person_name(r.first_joiner), ''), 'Someone you follow')
           || case when r.n = 1 then ''
                   when r.n = 2 then ' and 1 other you follow'
                   else ' and ' || (r.n - 1) || ' others you follow' end
           || case when r.areas = 1
                   then ' joined ' || coalesce((select a.name from public.areas a where a.id = r.first_area), 'your area') || '.'
                   else ' joined your areas.' end,
           110),
         coalesce('/around/' || (select a.slug from public.areas a where a.id = r.first_area), '/around')) then
      sent := sent + 1;
    end if;
  end loop;

  /* A REVIEW TO LEAVE AFTER A MOVE-IN. V-59 opens the tenancy review a month
     after the move-in; this tells the tenant once, inside the first two weeks
     of that window, while they have not answered. */
  for r in
    select rp.id, rp.tenant_id,
           coalesce((select l.title from public.listings l where l.id = rp.listing_id), 'your new home') as place
      from public.rent_payments rp
      join public.bookings b on b.id = rp.booking_id
     where b.status in ('CONFIRMED', 'COMPLETED')
       and rp.move_in <= today - 30
       and rp.move_in > today - 44
       and not exists (select 1 from public.tenancy_reviews tr where tr.rent_payment_id = rp.id)
       and private.notice_wanted(rp.tenant_id, 'move_in_review')
     limit 2000
  loop
    if private.notify_once(
         'tenancy:' || r.id::text || ':review',
         r.tenant_id,
         'booking'::public.notification_kind,
         'How is the new place?',
         left('A month in at ' || r.place || '. Tell other renters how it went.', 110),
         '/rent/review/' || r.id::text) then
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end;
$$;

revoke all on function private.send_feature_notices() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. A6: gentle nudges. Late morning, Lagos time. At most one per person per
--    run, the most useful first, under private.may_nudge.

create or replace function private.send_gentle_nudges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  sent    integer := 0;
  hr      integer := extract(hour from (now() at time zone 'Africa/Lagos'))::integer;
  id_rule boolean := coalesce((select ff.enabled from public.feature_flags ff where ff.key = 'rental_verification'), true);
  v_title text;
  v_body  text;
  v_href  text;
begin
  if hr < 10 or hr >= 19 then
    return 0;
  end if;

  for r in
    with candidates as (
      /* 0. Verify your ID before a long rental: a viewing in the last three
         weeks of a rental of 5 months or more (the founder's rule; the same
         months as lib/identity/rental-verification-rule.ts), no ID on file.
         Never for stays: only rent listings reach this. */
      select * from (
        select distinct on (i.requester_id)
               i.requester_id as user_id, 'nudge_identity'::text as nudge, 0 as rank,
               coalesce(nullif(l.area, ''), l.city) as detail
          from public.inspection_requests i
          join public.listings l on l.id = i.listing_id
         where id_rule
           and l.listing_intent = 'rent'
           and i.state in ('REQUESTED', 'PROPOSED', 'CONFIRMED', 'COMPLETED')
           and i.created_at > now() - interval '21 days'
           and greatest(case l.rent_period when 'month' then 1 when 'quarter' then 3 else 12 end,
                        coalesce(l.minimum_tenancy_months, 0)) >= 5
           and not exists (select 1 from public.agent_documents d
                            where d.uploader_id = i.requester_id and d.kind = 'identity'
                              and d.review_status in ('pending', 'approved'))
         order by i.requester_id, i.created_at desc
      ) id_owed
      union all
      /* 1. Confirm your phone: three days in, a first step toward a deal
         taken (a save, a saved search or a viewing asked), no phone yet. */
      select u.id, 'nudge_phone', 1, null
        from auth.users u
       where u.created_at < now() - interval '3 days'
         and u.deleted_at is null
         and not exists (select 1 from public.confirmed_phones c where c.user_id = u.id)
         and (exists (select 1 from public.saved_items s where s.user_id = u.id)
              or exists (select 1 from public.saved_searches s where s.user_id = u.id)
              or exists (select 1 from public.inspection_requests i where i.requester_id = u.id))
      union all
      /* 2. Finish your listing draft: touched more than two days ago and
         less than thirty. */
      select * from (
        select distinct on (a.user_id)
               a.user_id, 'nudge_listing_draft'::text, 2, l.id::text
          from public.listings l
          join public.agents a on a.id = l.agent_id
         where l.status = 'DRAFT'
           and not coalesce(l.is_demo, false)
           and l.updated_at < now() - interval '2 days'
           and l.updated_at > now() - interval '30 days'
         order by a.user_id, l.updated_at desc
      ) drafts
      union all
      /* 3. Add a profile photo: a week in, no photo anywhere. */
      select p.id, 'nudge_profile', 3, null
        from public.profiles p
        join auth.users u on u.id = p.id
        left join public.social_profiles sp on sp.user_id = p.id
       where u.created_at < now() - interval '7 days'
         and u.deleted_at is null
         and p.avatar_url is null
         and sp.avatar_path is null
    )
    select distinct on (c.user_id) c.user_id, c.nudge, c.detail
      from candidates c
     where private.may_nudge(c.user_id, c.nudge)
     order by c.user_id, c.rank
     limit 2000
  loop
    v_title := case r.nudge
      when 'nudge_identity' then 'Verify before you rent'
      when 'nudge_phone' then 'Confirm your phone'
      when 'nudge_listing_draft' then 'Your listing is waiting'
      else 'Add a profile photo'
    end;
    v_body := case r.nudge
      when 'nudge_identity' then 'Rentals of 5 months or more need an ID check before you pay. It takes about five minutes.'
      when 'nudge_phone' then 'Confirm it now and your first booking or rent payment is one step shorter.'
      when 'nudge_listing_draft' then left(coalesce(
             nullif((select l.title from public.listings l where l.id::text = r.detail), ''), 'Your draft')
             || ' is saved as a draft. Pick up where you left off.', 110)
      else 'A photo helps the people you deal with know it is you.'
    end;
    v_href := case r.nudge
      when 'nudge_identity' then '/verification'
      when 'nudge_phone' then '/settings/phone'
      when 'nudge_listing_draft' then '/agent/list?id=' || r.detail
      else '/profile/setup'
    end;

    insert into private.nudge_log (user_id, nudge) values (r.user_id, r.nudge);
    perform private.notify(r.user_id, 'system'::public.notification_kind, v_title, v_body, v_href);
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function private.send_gentle_nudges() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. The schedules (UTC; Lagos is UTC+1). Notices at 18:10 Lagos, nudges at
--    11:20 Lagos. cron.schedule with the same name replaces the job.

select cron.schedule(
  'vallo_send_feature_notices',
  '10 17 * * *',
  $cron$select private.send_feature_notices();$cron$
);

select cron.schedule(
  'vallo_send_gentle_nudges',
  '20 10 * * *',
  $cron$select private.send_gentle_nudges();$cron$
);

-- Probe after paste (read only):
--   select topic, count(*) from public.notice_preferences group by 1;
--   select jobname, schedule from cron.job where jobname in
--     ('vallo_send_feature_notices', 'vallo_send_gentle_nudges');
