-- ROOMMATES 8: A ROOM OFFER GOES LIVE ONLY AFTER REVIEW, AND THE FEED GETS A BUDGET RANGE.
--
-- Founder, 10 Nov 2026: a person can list a house or room for roommates like a
-- normal listing, but it must go through verification and review, and only
-- when APPROVED does it show in the Vallo Roommates feed (never the main feed:
-- roommate_listings is its own table, and the main search reads `listings`).
--
-- ONE SOURCE OF TRUTH: `roommate_listings.status` stays the single state.
-- `live` already means "shown in the Roommates feed", so every existing read
-- (the feed, search, home, campus pages, saved searches, alerts, counts) keeps
-- working untouched; the new states only keep a post OUT of them.
--
--   draft -> submitted -> in_review -> live           (approved: shown in the feed)
--                      \-> changes_requested -> submitted (owner fixes, sends again)
--                      \-> rejected                       (final; the owner may delete it)
--   live -> paused -> live   (resume allowed only while the approval still stands)
--   live + a material edit (rent, address area, city, authority, photos, linked
--   home) -> submitted again, because the post was approved as it was.
--
-- Only `room_offer` posts (a person offering a room in a home) are reviewed:
-- "roommate wanted" and "find together" posts describe people, not a home.
--
-- Additive and safe to run twice. Nullable columns, the one new FK is
-- ON DELETE SET NULL, no new grant (roommate_listings already has
-- select/insert/update/delete for authenticated, and is in the db-06 allowlist).
-- Existing live, paused, filled and expired room offers are grandfathered:
-- approved_at is back-filled from their published date so nothing disappears.

begin;

alter table public.roommate_listings
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_review_note_len' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_review_note_len check (review_note is null or char_length(review_note) <= 1000);
  end if;
end $$;

-- The status check: the review states join the old ones.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.roommate_listings'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%''draft''%''expired''%'
       and conname <> 'roommate_listings_status_v2'
  loop
    execute format('alter table public.roommate_listings drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_status_v2' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_status_v2
      check (status in ('draft', 'submitted', 'in_review', 'changes_requested', 'rejected', 'live', 'paused', 'filled', 'expired', 'removed'));
  end if;
end $$;

-- Back-fill: a room offer that was already public stays approved.
update public.roommate_listings
   set approved_at = coalesce(published_at, created_at)
 where kind = 'room_offer' and approved_at is null and published_at is not null
   and status in ('live', 'paused', 'filled', 'expired');

-- A room offer is never live without an approval on record.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roommate_listings_review_shape' and conrelid = 'public.roommate_listings'::regclass) then
    alter table public.roommate_listings add constraint roommate_listings_review_shape
      check (status <> 'live' or kind <> 'room_offer' or approved_at is not null);
  end if;
end $$;

-- Indexes: the review queue, the owner's list, and the feed's sort with a stable tie-break.
create index if not exists roommate_listings_review_idx on public.roommate_listings (submitted_at) where status in ('submitted', 'in_review');
create index if not exists roommate_listings_feed_idx on public.roommate_listings (published_at desc, id) where status = 'live';
create index if not exists roommate_listings_owner_status_idx on public.roommate_listings (owner_id, status);
create index if not exists roommate_listings_gender_idx on public.roommate_listings (gender_pref) where status = 'live';

-- Members may insert a draft or submit a room offer; only a post that is not a
-- room offer may be inserted already live.
drop policy if exists roommate_listings_owner_insert on public.roommate_listings;
create policy roommate_listings_owner_insert on public.roommate_listings for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and verified_at is null and approved_at is null
    and (status in ('draft', 'submitted') or (status = 'live' and kind <> 'room_offer'))
  );

-- THE OWNER'S RULES, now with the review. Staff (and the database owner) are
-- exempt; everything below binds a member.
create or replace function private.roommate_listing_guard()
returns trigger language plpgsql set search_path to '' as $$
declare
  staff boolean := private.is_staff() or current_user not in ('authenticated', 'anon');
  material boolean := false;
begin
  if tg_op = 'INSERT' and not staff then
    new.verified_at := null;
    new.verified_by := null;
    new.approved_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := null;
    if new.status = 'submitted' then
      if new.kind <> 'room_offer' then
        raise exception 'Only a room offer is sent for review.' using errcode = 'RM203';
      end if;
      new.submitted_at := now();
    elsif new.status = 'live' and new.kind = 'room_offer' then
      raise exception 'A room offer goes live after our team has reviewed it.' using errcode = 'RM203';
    end if;
  end if;

  if tg_op = 'UPDATE' and not staff then
    if old.status = 'removed' then
      raise exception 'This listing was removed by our team and cannot be changed.' using errcode = 'RM201';
    end if;
    if new.status = 'removed' then
      raise exception 'That change is not allowed.' using errcode = 'RM201';
    end if;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
    new.view_count := old.view_count;
    new.interest_count := old.interest_count;
    new.owner_id := old.owner_id;
    -- The review record is staff's.
    new.approved_at := old.approved_at;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.review_note := old.review_note;
    new.submitted_at := old.submitted_at;

    material := new.rent_minor is distinct from old.rent_minor
      or new.listing_id is distinct from old.listing_id or new.authority is distinct from old.authority
      or new.area is distinct from old.area or new.city is distinct from old.city
      or new.photos is distinct from old.photos or new.kind is distinct from old.kind;
    -- A changed room offer loses its verification and its approval: it was checked as it was.
    if material and old.verified_at is not null then
      new.verified_at := null;
      new.verified_by := null;
    end if;
    if material and new.kind = 'room_offer' and old.approved_at is not null then
      new.approved_at := null;
      if new.status = 'live' then
        new.status := 'submitted';
        new.submitted_at := now();
        new.review_note := null;
      end if;
    end if;
    if new.kind = 'room_offer' and old.kind <> 'room_offer' then
      new.approved_at := null;
      if new.status = 'live' then
        new.status := 'submitted';
        new.submitted_at := now();
      end if;
    end if;

    if new.status is distinct from old.status then
      if new.status in ('submitted', 'in_review', 'changes_requested', 'rejected') and new.kind <> 'room_offer' then
        raise exception 'Only a room offer is sent for review.' using errcode = 'RM203';
      end if;
      if new.status in ('in_review', 'changes_requested', 'rejected') then
        raise exception 'That decision belongs to our review team.' using errcode = 'RM203';
      end if;
      if new.status = 'submitted' then
        if old.status not in ('draft', 'changes_requested', 'paused', 'filled', 'expired') then
          raise exception 'This post cannot be sent for review from here.' using errcode = 'RM203';
        end if;
        new.submitted_at := now();
        new.review_note := null;
      end if;
      if new.status = 'live' and new.kind = 'room_offer' and (new.approved_at is null or old.status not in ('paused', 'filled', 'expired')) then
        raise exception 'A room offer goes live after our team has reviewed it.' using errcode = 'RM203';
      end if;
      if old.status = 'rejected' then
        raise exception 'This post was not approved. Make a new post to try again.' using errcode = 'RM203';
      end if;
    end if;
  end if;

  if new.listing_id is not null and (tg_op = 'INSERT' or new.listing_id is distinct from old.listing_id) then
    if not exists (select 1 from public.listings l where l.id = new.listing_id and l.status = 'PUBLISHED') then
      raise exception 'Link a published Vallo listing, or leave it unlinked.' using errcode = 'RM202';
    end if;
  end if;
  if new.status = 'live' and (tg_op = 'INSERT' or old.status <> 'live') then
    new.published_at := coalesce(new.published_at, now());
    new.expires_at := now() + interval '60 days';
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_listings_guard on public.roommate_listings;
create trigger roommate_listings_guard before insert or update on public.roommate_listings
  for each row execute function private.roommate_listing_guard();

-- The owner hears each decision (the notification list, then the push and the
-- email the way every other notice goes).
create or replace function private.roommate_listing_review_notify()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.kind <> 'room_offer' or new.status is not distinct from old.status or old.status not in ('submitted', 'in_review', 'changes_requested') then
    return new;
  end if;
  if new.status = 'in_review' then
    perform private.notify(new.owner_id, 'listing', 'Your room post is being reviewed', new.title, '/roommates/r/' || new.id);
  elsif new.status = 'live' then
    perform private.notify(new.owner_id, 'listing', 'Your room post is live on Roommates', new.title, '/roommates/r/' || new.id);
  elsif new.status = 'changes_requested' then
    perform private.notify(new.owner_id, 'listing', 'Changes needed on your room post', coalesce(new.review_note, new.title), '/roommates/r/' || new.id || '/edit');
  elsif new.status = 'rejected' then
    perform private.notify(new.owner_id, 'listing', 'Your room post was not approved', coalesce(new.review_note, new.title), '/roommates/me');
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_listings_review_notify on public.roommate_listings;
create trigger roommate_listings_review_notify after update of status on public.roommate_listings
  for each row execute function private.roommate_listing_review_notify();

-- THE STAFF QUEUE: what is waiting, oldest first, with what a reviewer needs
-- (who, what authority they declared, how many photos, the linked Vallo home).
-- Reads only the facts on the post; never the owner's phone or email.
create or replace function public.admin_roommate_review_queue(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 50), 1), 100);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  f_status text := nullif(p ->> 'status', '');
begin
  if not private.case_can(me, 'roommates', 'view') then
    raise exception 'This is for Roommates staff.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object(
             'id', l.id, 'title', l.title, 'status', l.status, 'kind', l.kind, 'city', l.city, 'area', l.area, 'stateCode', l.state_code,
             'description', l.description, 'rentMinor', l.rent_minor, 'rentPeriod', l.rent_period,
             'authority', l.authority, 'declaredAt', l.authority_declared_at, 'photoCount', cardinality(l.photos), 'photoPaths', to_jsonb(l.photos),
             'linkedListingId', l.listing_id, 'submittedAt', l.submitted_at, 'reviewedAt', l.reviewed_at, 'reviewNote', l.review_note,
             'owner', private.rm_person(l.owner_id),
             'ownerVerified', private.rm_badges(l.owner_id),
             'openCases', (select count(*) from public.moderation_cases c where c.target_type = 'roommate_listing' and c.target_id = l.id::text and c.status not in ('resolved', 'closed'))) x
      from public.roommate_listings l
     where l.kind = 'room_offer'
       and ((f_status is null and l.status in ('submitted', 'in_review', 'changes_requested')) or l.status = f_status)
     order by l.submitted_at asc nulls last, l.created_at asc
     limit lim offset off) t), '[]'::jsonb);
end;
$$;

-- THE DECISION. One function, one transaction, the audit line inside it.
--   claim    submitted -> in_review
--   approve  submitted | in_review -> live (needs the declaration, a rent and three photos; the identity wall is the app's, see lib/verification/lister-identity.ts)
--   changes  submitted | in_review -> changes_requested (the note says what to fix)
--   reject   submitted | in_review | changes_requested -> rejected (the note says why)
create or replace function public.admin_roommate_review_decide(p_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  why text := trim(coalesce(p_note, ''));
  l public.roommate_listings;
  out_status text;
begin
  if not private.case_can(me, 'roommates', 'resolve') then
    raise exception 'Your staff role does not allow this.' using errcode = 'RM401';
  end if;
  select * into l from public.roommate_listings where id = p_id for update;
  if not found or l.kind <> 'room_offer' then
    raise exception 'That post could not be found.' using errcode = 'RM404';
  end if;
  if p_decision = 'claim' then
    if l.status <> 'submitted' then raise exception 'Nothing changed: it may already be in review.' using errcode = 'RM417'; end if;
    out_status := 'in_review';
    update public.roommate_listings set status = 'in_review', reviewed_by = me where id = p_id;
  elsif p_decision = 'approve' then
    if l.status not in ('submitted', 'in_review') then raise exception 'Nothing changed: this post is not waiting for review.' using errcode = 'RM417'; end if;
    if l.authority is null or l.authority_declared_at is null then raise exception 'The owner has not declared the right to offer this home.' using errcode = 'RM410'; end if;
    if l.rent_minor is null then raise exception 'The post has no rent.' using errcode = 'RM410'; end if;
    if cardinality(l.photos) < 3 then raise exception 'A room offer needs at least three photos.' using errcode = 'RM410'; end if;
    out_status := 'live';
    update public.roommate_listings
       set status = 'live', approved_at = now(), reviewed_at = now(), reviewed_by = me, review_note = nullif(why, ''),
           verified_at = coalesce(verified_at, now()), verified_by = coalesce(verified_by, me)
     where id = p_id;
  elsif p_decision in ('changes', 'reject') then
    if char_length(why) < 5 then raise exception 'Tell the owner what to fix, at least five characters.' using errcode = 'RM405'; end if;
    if p_decision = 'changes' and l.status not in ('submitted', 'in_review') then raise exception 'Nothing changed: this post is not waiting for review.' using errcode = 'RM417'; end if;
    if p_decision = 'reject' and l.status not in ('submitted', 'in_review', 'changes_requested') then raise exception 'Nothing changed: this post is not in review.' using errcode = 'RM417'; end if;
    out_status := case when p_decision = 'changes' then 'changes_requested' else 'rejected' end;
    update public.roommate_listings set status = out_status, reviewed_at = now(), reviewed_by = me, review_note = why, approved_at = null where id = p_id;
  else
    raise exception 'That decision does not fit.' using errcode = 'RM408';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'roommates.review.' || p_decision, 'roommate_listing', p_id::text, jsonb_build_object('reason', why, 'to', out_status));
  return out_status;
end;
$$;

revoke all on function public.admin_roommate_review_queue(jsonb) from public, anon;
grant execute on function public.admin_roommate_review_queue(jsonb) to authenticated;
revoke all on function public.admin_roommate_review_decide(uuid, text, text) from public, anon;
grant execute on function public.admin_roommate_review_decide(uuid, text, text) to authenticated;
revoke all on function private.roommate_listing_review_notify() from public, anon, authenticated;

-- THE FEED'S BUDGET RANGE: `minMinor` joins `maxMinor` (both on the monthly equivalent),
-- and `kinds` (an array) lets the feed's "Offering a room" chip ask for two kinds at once.
create or replace function public.roommate_search_listings(p jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 20), 1), 40);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  f_state text := nullif(p ->> 'stateCode', '');
  f_city text := nullif(p ->> 'city', '');
  f_inst uuid := nullif(p ->> 'institutionId', '')::uuid;
  f_kind text := nullif(p ->> 'kind', '');
  f_kinds text[] := case when jsonb_typeof(p -> 'kinds') = 'array' then array(select jsonb_array_elements_text(p -> 'kinds')) else null end;
  f_max numeric := private.rm_monthly(nullif(p ->> 'maxMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
  f_min numeric := private.rm_monthly(nullif(p ->> 'minMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
  f_by date := nullif(p ->> 'moveBy', '')::date;
  f_room text := nullif(p ->> 'roomType', '');
  f_furn text := nullif(p ->> 'furnished', '');
  f_gender text := nullif(p ->> 'genderPref', '');
  f_verified boolean := coalesce((p ->> 'verifiedOnly')::boolean, false);
  f_linked uuid := nullif(p ->> 'linkedListingId', '')::uuid;
  f_sort text := coalesce(p ->> 'sort', 'newest');
  rows jsonb;
  n integer;
begin
  if me is not null then
    select * into v from public.roommate_profiles where user_id = me;
  end if;
  with pool as (
    select l.id
      from public.roommate_listings l
     where l.status = 'live'
       and (l.expires_at is null or l.expires_at > now())
       and (me is null or not private.blocked_between(me, l.owner_id))
       and (f_state is null or l.state_code = f_state)
       and (f_city is null or lower(l.city) = lower(f_city) or lower(l.area) = lower(f_city))
       and (f_inst is null or l.institution_id = f_inst)
       and (f_kind is null or l.kind = f_kind)
       and (f_kinds is null or l.kind = any(f_kinds))
       and (f_max is null or private.rm_monthly(coalesce(l.share_minor, l.rent_minor), l.rent_period) <= f_max)
       and (f_min is null or private.rm_monthly(coalesce(l.share_minor, l.rent_minor), l.rent_period) >= f_min)
       and (f_by is null or l.available_from is null or l.available_from <= f_by)
       and (f_room is null or l.room_type = f_room)
       and (f_furn is null or l.furnished = f_furn)
       and (f_gender is null or l.gender_pref = f_gender or l.gender_pref = 'any')
       and (not f_verified or l.verified_at is not null)
       and (f_linked is null or l.listing_id = f_linked)
       and (q is null or l.title ilike '%' || q || '%' or l.city ilike '%' || q || '%' or l.area ilike '%' || q || '%'
            or exists (select 1 from public.institutions i where i.id = l.institution_id and (i.name ilike '%' || q || '%' or i.short_name ilike '%' || q || '%')))
     order by l.published_at desc nulls last
     limit 500
  ),
  page as (
    select l2.id,
           row_number() over (order by
             case when f_sort = 'match' then coalesce((private.roommate_listing_match(v, l2) ->> 'score')::int, -1) end desc nulls last,
             case when f_sort = 'budget' then private.rm_monthly(coalesce(l2.share_minor, l2.rent_minor), l2.rent_period) end asc nulls last,
             l2.published_at desc nulls last) as rn
      from pool
      join public.roommate_listings l2 on l2.id = pool.id
  )
  select coalesce(jsonb_agg(private.rm_room_card(l, v) order by page.rn), '[]'::jsonb), count(*)
    into rows, n
    from page
    join public.roommate_listings l on l.id = page.id
   where page.rn > off and page.rn <= off + lim + 1;

  if n > lim then
    return jsonb_build_object('items', rows - lim, 'next', off + lim);
  end if;
  return jsonb_build_object('items', rows, 'next', null);
end;
$$;

-- One check row at the end: the new columns, the states and the functions are there.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'roommate_listings'
     and column_name in ('submitted_at', 'reviewed_at', 'reviewed_by', 'review_note', 'approved_at')) as review_columns_expected_5,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_roommate_review_queue', 'admin_roommate_review_decide', 'roommate_search_listings')) as functions_expected_3,
  (select count(*) from public.roommate_listings where status = 'live' and kind = 'room_offer' and approved_at is null) as live_without_approval_expected_0;

commit;
