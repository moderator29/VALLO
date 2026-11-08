-- VALLO ROOMMATES, PART 3: THE FEED, PROPERTIES AND CIRCLE.
--
-- Additive only. A feed post can carry a roommate post (its own card in the
-- feed, the same way a SHOWCASE carries a listing); a property listing can say
-- it is good for sharing and for how many people; Circle gains two community
-- categories and three communities Vallo starts, where people talk about
-- student housing, NYSC moves and finding roommates. Safe to run twice.

set lock_timeout = '5s';

-- ------------------------------------------------------------ the feed

alter table public.posts add column if not exists roommate_listing_id uuid references public.roommate_listings(id) on delete set null;
create index if not exists posts_roommate_listing_idx on public.posts (roommate_listing_id) where roommate_listing_id is not null;

-- Share a live roommate post to the feed, with a line of your own. The post
-- is an ordinary GIST in the author's name, so every feed rule (the scan,
-- the limits, reports, holds) applies to it unchanged.
create or replace function public.roommate_share_to_feed(p_listing uuid, p_body text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  l public.roommate_listings;
  pid uuid;
  words text := nullif(trim(coalesce(p_body, '')), '');
begin
  if me is null then
    raise exception 'Sign in to use Vallo Roommates.' using errcode = 'RM300';
  end if;
  select * into l from public.roommate_listings where id = p_listing;
  if not found or l.status <> 'live' then
    raise exception 'This post is no longer available.' using errcode = 'RM303';
  end if;
  if private.blocked_between(me, l.owner_id) then
    raise exception 'You cannot share this post.' using errcode = 'RM302';
  end if;
  if char_length(coalesce(words, '')) > 2000 then
    raise exception 'Keep it to 2,000 characters.' using errcode = 'RM330';
  end if;
  if exists (select 1 from public.posts p where p.author_id = me and p.roommate_listing_id = p_listing and p.created_at > now() - interval '7 days' and p.status <> 'REMOVED') then
    raise exception 'You shared this in the last week already.' using errcode = 'RM331';
  end if;
  insert into public.posts (author_id, author_kind, kind, body, roommate_listing_id, status)
  values (me, 'USER', 'GIST', coalesce(words, l.title), p_listing, 'LIVE')
  returning id into pid;
  return pid;
end;
$$;
revoke all on function public.roommate_share_to_feed(uuid, text) from public, anon;
grant execute on function public.roommate_share_to_feed(uuid, text) to authenticated;

-- ------------------------------------------------------------ property listings

alter table public.listings add column if not exists shared_living_ok boolean not null default false;
alter table public.listings add column if not exists max_occupants smallint;
alter table public.listings drop constraint if exists listings_max_occupants_check;
alter table public.listings add constraint listings_max_occupants_check check (max_occupants is null or max_occupants between 1 and 20);
create index if not exists listings_shared_living_idx on public.listings (state_code, city) where shared_living_ok and status = 'PUBLISHED';

-- ------------------------------------------------------------ Circle

alter table public.circle_communities drop constraint if exists circle_communities_category_check;
alter table public.circle_communities add constraint circle_communities_category_check check (category = any (array[
  'neighbourhood', 'renting', 'buying', 'landlords', 'investing', 'short_lets', 'design', 'building', 'professionals', 'general',
  'student_housing', 'roommates'
]::text[]));

insert into public.circle_communities (slug, name, description, category, visibility, rules, started_by_vallo)
values
  ('student-accommodation', 'Student accommodation',
   'Hostels, off-campus flats and shared rooms near Nigerian universities and polytechnics. Ask, compare areas and find people moving to your school.',
   'student_housing', 'public',
   array['Never post anyone''s phone number or address.', 'View a place before you pay for it.', 'Be kind. Everybody here is looking for a home.'], true),
  ('nysc-accommodation', 'NYSC accommodation',
   'Posted to a new state? Ask about areas near your place of primary assignment and find other corps members to share with.',
   'student_housing', 'public',
   array['Never post call-up letters, state codes or anyone''s personal details.', 'Meet somewhere public the first time.'], true),
  ('finding-roommates', 'Finding roommates',
   'Shared living advice, roommate experiences and introductions. Matching itself happens privately on Vallo Roommates.',
   'roommates', 'public',
   array['No listings with payment details in the post.', 'Report anything that looks like a scam.'], true)
on conflict (slug) do nothing;

-- The lister says a property is good for sharing, and for how many people.
-- Only these two columns change, so a published listing is not sent back
-- for review (the owner-write guard only restricts member-role writes, and
-- this function checks ownership itself: the lister's own agent profile or
-- their firm).
create or replace function public.roommate_set_listing_sharing(p_listing uuid, p_ok boolean, p_max smallint)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to continue.' using errcode = 'RM300';
  end if;
  if not exists (select 1 from public.listings l
                  where l.id = p_listing
                    and (l.agent_id in (select private.my_agent_ids())
                         or (l.firm_id is not null and l.firm_id in (select private.my_firm_ids())))) then
    raise exception 'Only the lister can change this.' using errcode = 'RM340';
  end if;
  if p_ok and (p_max is null or p_max < 2 or p_max > 20) then
    raise exception 'Say how many people can share it, from 2 to 20.' using errcode = 'RM341';
  end if;
  update public.listings
     set shared_living_ok = coalesce(p_ok, false),
         max_occupants = case when p_ok then p_max else null end
   where id = p_listing;
end;
$$;
revoke all on function public.roommate_set_listing_sharing(uuid, boolean, smallint) from public, anon;
grant execute on function public.roommate_set_listing_sharing(uuid, boolean, smallint) to authenticated;

-- ------------------------------------------------------------ the funnel

-- Eight Roommates steps join the funnel (lib/funnel/roommates.ts). Counts of
-- steps only, no content; record_funnel_event drops anything unlisted, so
-- before this runs the app's calls are silently ignored.
alter table public.funnel_events drop constraint if exists funnel_events_step_check;
alter table public.funnel_events add constraint funnel_events_step_check check (step = any (array[
  'landing_view', 'get_started', 'signup_opened', 'step_one_done', 'step_two_done', 'code_sent', 'code_resent',
  'verified', 'first_search', 'first_result',
  'roommates_home_view', 'roommates_profile_live', 'roommates_interest_sent', 'roommates_interest_accepted',
  'roommates_chat_opened', 'roommates_listing_published', 'roommates_viewing_requested', 'roommates_group_created'
]::text[]));

-- Signed-in Roommates milestones count once per ACCOUNT (the first time each
-- person does it), like 'verified'; the home view stays one per visit. Same
-- function as 20260930084814, one list longer.
create or replace function public.record_funnel_event(
  p_step text, p_visit uuid, p_locale text, p_surface text, p_door text default null)
returns void
language plpgsql
volatile security definer
set search_path to ''
as $function$
declare
  who uuid := null;
begin
  if p_visit is null then
    return;
  end if;
  if p_step in ('verified', 'first_search', 'first_result',
                'roommates_profile_live', 'roommates_interest_sent', 'roommates_interest_accepted',
                'roommates_chat_opened', 'roommates_listing_published', 'roommates_viewing_requested',
                'roommates_group_created') then
    who := (select auth.uid());
    if who is null then
      return;
    end if;
  end if;
  insert into public.funnel_events (step, visit_id, locale, surface, door, user_id)
  values (p_step, p_visit, p_locale, p_surface, p_door, who)
  on conflict do nothing;
exception when check_violation then
  return;
end;
$function$;
revoke all on function public.record_funnel_event(text, uuid, text, text, text) from public;
grant execute on function public.record_funnel_event(text, uuid, text, text, text) to anon, authenticated;
