-- =====================================================================
-- VALLO ROOMMATES: THE ONE SQL DROP
-- =====================================================================
-- Paste this whole file into the Supabase SQL Editor and press Run once.
--
-- What it does, in order:
--   Part 1  tables, row level security, storage buckets, chat on a mutual yes
--   Part 2  the matching engine, the private reads, every write and its
--           notifications, saved search alerts, the nightly expiry job
--   Part 3  the feed card column, "good for sharing" on property listings,
--           two Circle categories and three Vallo-started communities
--   Part 5  the schools directory (55 schools, email domains checked)
--
-- Safe to run twice: every table and index is IF NOT EXISTS, every policy
-- is dropped before it is created, every function is CREATE OR REPLACE,
-- every seed is ON CONFLICT DO NOTHING. Nothing existing is deleted. Two
-- existing objects are widened, never narrowed: the saved collections kind
-- check (adds roommate kinds) and the Circle category check (adds two).
-- One existing trigger function is upgraded: a direct chat is allowed
-- between two people with an accepted roommate connection.
--
-- Built by build_roommates_all.sh from the roommates_*.sql parts, each one
-- tested on a local copy of the schema (supabase/tests/roommates).
-- =====================================================================

begin;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> roommates_1_core.sql

-- VALLO ROOMMATES, PART 1: THE CORE (8 November 2026).
--
-- One product, four journeys (find a roommate, find a room, offer a room,
-- find a place together) on one set of tables. Everything here is additive:
-- new tables, new functions, one widened check constraint
-- (saved_collection_items.kind) and one upgraded trigger function
-- (private.direct_chat_respects_contact_policy, which now also lets two
-- people with an accepted roommate connection open their chat). Nothing
-- existing is dropped or rewritten. Safe to run twice.
--
-- PRIVACY MODEL. A roommate profile row is readable by its owner and staff
-- only. Every other person sees a profile through the SECURITY DEFINER reads
-- below (roommate_discover, roommate_profile_view), which mask the fields the
-- owner chose to hide, never return gender unless shown, exclude blocked
-- people and only serve signed-in members who have an active profile of
-- their own. Room listings are public while live (shared links open on the
-- web) and carry an area, never an address.

set lock_timeout = '5s';

-- ------------------------------------------------------------ institutions

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 3 and 140),
  short_name text check (short_name is null or char_length(short_name) <= 30),
  kind text not null check (kind in ('university', 'polytechnic', 'college', 'other')),
  state_code text references public.states(code),
  city text check (city is null or char_length(city) <= 80),
  area_id uuid references public.areas(id) on delete set null,
  email_domains text[] not null default '{}',
  email_verify_on boolean not null default false,
  status text not null default 'live' check (status in ('live', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institutions_state_idx on public.institutions (state_code) where status = 'live';
create index if not exists institutions_name_trgm_idx on public.institutions using gin (lower(name) extensions.gin_trgm_ops);

alter table public.institutions enable row level security;
drop policy if exists institutions_select on public.institutions;
create policy institutions_select on public.institutions for select to authenticated
  using (status = 'live' or (select private.is_staff()));
drop policy if exists institutions_select_anon on public.institutions;
create policy institutions_select_anon on public.institutions for select to anon
  using (status = 'live');
drop policy if exists institutions_staff_write on public.institutions;
create policy institutions_staff_write on public.institutions for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

drop trigger if exists institutions_set_updated_at on public.institutions;
create trigger institutions_set_updated_at before update on public.institutions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ the matching weights

create table if not exists public.roommate_match_weights (
  id boolean primary key default true check (id),
  budget smallint not null default 30 check (budget between 0 and 100),
  location smallint not null default 25 check (location between 0 and 100),
  move_in smallint not null default 15 check (move_in between 0 and 100),
  lifestyle smallint not null default 20 check (lifestyle between 0 and 100),
  accommodation smallint not null default 10 check (accommodation between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.roommate_match_weights (id) values (true) on conflict (id) do nothing;
alter table public.roommate_match_weights enable row level security;
drop policy if exists roommate_match_weights_select on public.roommate_match_weights;
create policy roommate_match_weights_select on public.roommate_match_weights for select to anon, authenticated using (true);
drop policy if exists roommate_match_weights_staff on public.roommate_match_weights;
create policy roommate_match_weights_staff on public.roommate_match_weights for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ------------------------------------------------------------ roommate profiles

create table if not exists public.roommate_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'held')),
  intents text[] not null default '{}'
    check (intents <@ array['find_roommate', 'find_room', 'offer_room', 'find_together']::text[]),
  intro text check (intro is null or char_length(intro) <= 600),
  life_stage text check (life_stage in ('student', 'corps_member', 'graduate', 'professional', 'other')),
  institution_id uuid references public.institutions(id) on delete set null,
  institution_visible boolean not null default true,
  course text check (course is null or char_length(course) <= 80),
  study_level text check (study_level is null or char_length(study_level) <= 30),
  workplace text check (workplace is null or char_length(workplace) <= 80),
  workplace_visible boolean not null default false,
  nysc_state_code text references public.states(code),
  state_code text references public.states(code),
  city text check (city is null or char_length(city) <= 60),
  areas text[] not null default '{}' check (cardinality(areas) <= 6),
  budget_min_minor bigint check (budget_min_minor is null or budget_min_minor >= 0),
  budget_max_minor bigint check (budget_max_minor is null or budget_max_minor >= 0),
  budget_period text not null default 'year' check (budget_period in ('month', 'year')),
  move_in_on date,
  move_in_flex text not null default 'flexible' check (move_in_flex in ('asap', 'fixed', 'flexible')),
  room_pref text check (room_pref in ('private', 'shared', 'either')),
  furnished_pref text check (furnished_pref in ('furnished', 'unfurnished', 'either')),
  household_size smallint check (household_size is null or household_size between 2 and 8),
  cleanliness smallint check (cleanliness between 1 and 3),
  social smallint check (social between 1 and 3),
  sleep text check (sleep in ('early', 'late', 'varies')),
  smoking text check (smoking in ('never', 'outside', 'yes')),
  pets text check (pets in ('none', 'fine', 'have')),
  guests text check (guests in ('rarely', 'sometimes', 'often')),
  cooking text check (cooking in ('rarely', 'sometimes', 'often')),
  schedule text check (schedule in ('day', 'night', 'mixed', 'home')),
  gender text check (gender in ('female', 'male')),
  gender_visible boolean not null default false,
  gender_pref text not null default 'any' check (gender_pref in ('any', 'female', 'male')),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roommate_profiles_budget_order check (budget_min_minor is null or budget_max_minor is null or budget_min_minor <= budget_max_minor),
  constraint roommate_profiles_active_shape check (
    status <> 'active' or (cardinality(intents) > 0 and city is not null and budget_max_minor is not null)
  )
);
create index if not exists roommate_profiles_discover_idx on public.roommate_profiles (state_code, city, last_active_at desc) where status = 'active';
create index if not exists roommate_profiles_institution_idx on public.roommate_profiles (institution_id) where status = 'active';
create index if not exists roommate_profiles_areas_idx on public.roommate_profiles using gin (areas);

alter table public.roommate_profiles enable row level security;
drop policy if exists roommate_profiles_owner_select on public.roommate_profiles;
create policy roommate_profiles_owner_select on public.roommate_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists roommate_profiles_owner_insert on public.roommate_profiles;
create policy roommate_profiles_owner_insert on public.roommate_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and status in ('draft', 'active', 'paused'));
drop policy if exists roommate_profiles_owner_update on public.roommate_profiles;
create policy roommate_profiles_owner_update on public.roommate_profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists roommate_profiles_owner_delete on public.roommate_profiles;
create policy roommate_profiles_owner_delete on public.roommate_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists roommate_profiles_set_updated_at on public.roommate_profiles;
create trigger roommate_profiles_set_updated_at before update on public.roommate_profiles
  for each row execute function public.set_updated_at();

-- A held profile (staff moderation) stays held: the owner cannot lift it.
create or replace function private.roommate_profile_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'held' and new.status <> 'held' and not private.is_staff() then
    raise exception 'This profile is under review. Our team will be in touch.' using errcode = 'RM101';
  end if;
  if new.status = 'held' and (tg_op = 'INSERT' or old.status <> 'held') and not private.is_staff() then
    raise exception 'That change is not allowed.' using errcode = 'RM101';
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_profiles_guard on public.roommate_profiles;
create trigger roommate_profiles_guard before insert or update on public.roommate_profiles
  for each row execute function private.roommate_profile_guard();

-- ------------------------------------------------------------ room listings (opportunities)

create table if not exists public.roommate_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('room_offer', 'roommate_wanted', 'together')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'filled', 'expired', 'removed')),
  title text not null check (char_length(title) between 8 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  state_code text references public.states(code),
  city text check (city is null or char_length(city) <= 60),
  area text check (area is null or char_length(area) <= 80),
  institution_id uuid references public.institutions(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  rent_minor bigint check (rent_minor is null or rent_minor >= 0),
  rent_period text not null default 'year' check (rent_period in ('month', 'year')),
  share_minor bigint check (share_minor is null or share_minor >= 0),
  deposit_minor bigint check (deposit_minor is null or deposit_minor >= 0),
  agency_fee_minor bigint check (agency_fee_minor is null or agency_fee_minor >= 0),
  legal_fee_minor bigint check (legal_fee_minor is null or legal_fee_minor >= 0),
  service_charge_minor bigint check (service_charge_minor is null or service_charge_minor >= 0),
  utilities_monthly_minor bigint check (utilities_monthly_minor is null or utilities_monthly_minor >= 0),
  rooms_available smallint check (rooms_available is null or rooms_available between 0 and 20),
  occupants_now smallint check (occupants_now is null or occupants_now between 0 and 20),
  occupants_max smallint check (occupants_max is null or occupants_max between 1 and 20),
  bedrooms smallint check (bedrooms is null or bedrooms between 0 and 20),
  bathrooms smallint check (bathrooms is null or bathrooms between 0 and 20),
  room_type text check (room_type in ('private', 'shared', 'ensuite')),
  furnished text check (furnished in ('furnished', 'semi', 'unfurnished')),
  amenities text[] not null default '{}' check (cardinality(amenities) <= 24),
  house_rules text[] not null default '{}' check (cardinality(house_rules) <= 10),
  available_from date,
  min_stay_months smallint check (min_stay_months is null or min_stay_months between 1 and 60),
  gender_pref text not null default 'any' check (gender_pref in ('any', 'female', 'male')),
  photos text[] not null default '{}' check (cardinality(photos) <= 12),
  authority text check (authority in ('owner', 'tenant_permitted', 'agent', 'manager')),
  authority_declared_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  view_count integer not null default 0,
  interest_count integer not null default 0,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roommate_listings_live_shape check (
    status <> 'live' or (city is not null and (kind <> 'room_offer' or (authority is not null and authority_declared_at is not null and rent_minor is not null)))
  )
);
create index if not exists roommate_listings_search_idx on public.roommate_listings (state_code, city, kind, published_at desc) where status = 'live';
create index if not exists roommate_listings_owner_idx on public.roommate_listings (owner_id, updated_at desc);
create index if not exists roommate_listings_institution_idx on public.roommate_listings (institution_id) where status = 'live';
create index if not exists roommate_listings_listing_idx on public.roommate_listings (listing_id) where listing_id is not null;

alter table public.roommate_listings enable row level security;
drop policy if exists roommate_listings_select on public.roommate_listings;
create policy roommate_listings_select on public.roommate_listings for select to authenticated
  using (
    (status = 'live' and not private.blocked_between((select auth.uid()), owner_id))
    or owner_id = (select auth.uid())
    or (select private.is_staff())
  );
drop policy if exists roommate_listings_select_anon on public.roommate_listings;
create policy roommate_listings_select_anon on public.roommate_listings for select to anon
  using (status = 'live');
drop policy if exists roommate_listings_owner_insert on public.roommate_listings;
create policy roommate_listings_owner_insert on public.roommate_listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and status in ('draft', 'live') and verified_at is null);
drop policy if exists roommate_listings_owner_update on public.roommate_listings;
create policy roommate_listings_owner_update on public.roommate_listings for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_staff()))
  with check (owner_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists roommate_listings_owner_delete on public.roommate_listings;
create policy roommate_listings_owner_delete on public.roommate_listings for delete to authenticated
  using (owner_id = (select auth.uid()));

drop trigger if exists roommate_listings_set_updated_at on public.roommate_listings;
create trigger roommate_listings_set_updated_at before update on public.roommate_listings
  for each row execute function public.set_updated_at();
drop trigger if exists roommate_listings_limit on public.roommate_listings;
create trigger roommate_listings_limit before insert on public.roommate_listings
  for each row execute function private.limit_member_inserts('5', '3600', '10');

-- The owner's own rules: a removed listing stays removed, the counters and
-- the verification are staff's, publishing stamps the dates, a room offer is
-- never live without the declaration of the right to offer it, and a listing
-- linked to a Vallo property must point at a published one.
create or replace function private.roommate_listing_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  staff boolean := private.is_staff();
begin
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
    -- A changed room offer loses its verification: it was checked as it was.
    if old.verified_at is not null and (new.rent_minor is distinct from old.rent_minor
        or new.listing_id is distinct from old.listing_id or new.authority is distinct from old.authority
        or new.area is distinct from old.area or new.city is distinct from old.city) then
      new.verified_at := null;
      new.verified_by := null;
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

-- ------------------------------------------------------------ interests and connections

create table if not exists public.roommate_interests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.roommate_listings(id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'ended')),
  conversation_id uuid references public.conversations(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint roommate_interests_not_self check (from_id <> to_id)
);
create unique index if not exists roommate_interests_one_open
  on public.roommate_interests (least(from_id, to_id), greatest(from_id, to_id))
  where status in ('pending', 'accepted');
create index if not exists roommate_interests_to_idx on public.roommate_interests (to_id, status, created_at desc);
create index if not exists roommate_interests_from_idx on public.roommate_interests (from_id, status, created_at desc);

alter table public.roommate_interests enable row level security;
drop policy if exists roommate_interests_select on public.roommate_interests;
create policy roommate_interests_select on public.roommate_interests for select to authenticated
  using ((select auth.uid()) in (from_id, to_id) or (select private.is_staff()));
-- No insert, update or delete policy: every write goes through the functions below.

drop trigger if exists roommate_interests_limit on public.roommate_interests;
create trigger roommate_interests_limit before insert on public.roommate_interests
  for each row execute function private.limit_member_inserts('15', '3600', '30');

create or replace function private.roommate_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.roommate_interests i
     where i.status = 'accepted'
       and least(i.from_id, i.to_id) = least(a, b)
       and greatest(i.from_id, i.to_id) = greatest(a, b)
  );
$$;

-- ------------------------------------------------------------ groups (find a place together, then live together)

create table if not exists public.roommate_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  intro text check (intro is null or char_length(intro) <= 500),
  visibility text not null default 'private' check (visibility in ('private', 'open')),
  stage text not null default 'forming' check (stage in ('forming', 'searching', 'decided', 'living', 'closed')),
  state_code text references public.states(code),
  city text check (city is null or char_length(city) <= 60),
  areas text[] not null default '{}' check (cardinality(areas) <= 6),
  institution_id uuid references public.institutions(id) on delete set null,
  bedrooms smallint check (bedrooms is null or bedrooms between 1 and 10),
  size_target smallint not null default 3 check (size_target between 2 and 8),
  budget_min_minor bigint check (budget_min_minor is null or budget_min_minor >= 0),
  budget_max_minor bigint check (budget_max_minor is null or budget_max_minor >= 0),
  budget_period text not null default 'year' check (budget_period in ('month', 'year')),
  move_in_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roommate_groups_open_idx on public.roommate_groups (state_code, city, updated_at desc) where visibility = 'open' and stage in ('forming', 'searching');

create table if not exists public.roommate_group_members (
  group_id uuid not null references public.roommate_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  state text not null default 'invited' check (state in ('invited', 'requested', 'active', 'declined', 'left', 'removed')),
  invited_by uuid references public.profiles(id) on delete set null,
  share_percent numeric(5, 2) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists roommate_group_members_user_idx on public.roommate_group_members (user_id, state);

create or replace function private.roommate_group_role(p_group uuid, p_user uuid)
returns text language sql stable security definer set search_path to '' as $$
  select m.role from public.roommate_group_members m
   where m.group_id = p_group and m.user_id = p_user and m.state = 'active';
$$;

create or replace function private.roommate_group_invited(p_group uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.roommate_group_members m
                  where m.group_id = p_group and m.user_id = p_user and m.state in ('invited', 'requested'));
$$;

alter table public.roommate_groups enable row level security;
drop policy if exists roommate_groups_select on public.roommate_groups;
create policy roommate_groups_select on public.roommate_groups for select to authenticated
  using (
    private.roommate_group_role(id, (select auth.uid())) is not null
    or private.roommate_group_invited(id, (select auth.uid()))
    or (visibility = 'open' and stage in ('forming', 'searching') and not private.blocked_between((select auth.uid()), owner_id))
    or (select private.is_staff())
  );
drop policy if exists roommate_groups_owner_update on public.roommate_groups;
create policy roommate_groups_owner_update on public.roommate_groups for update to authenticated
  using (private.roommate_group_role(id, (select auth.uid())) = 'owner')
  with check (private.roommate_group_role(id, (select auth.uid())) = 'owner');
-- Insert through roommate_create_group (it writes the owner's membership in the same step).

drop trigger if exists roommate_groups_set_updated_at on public.roommate_groups;
create trigger roommate_groups_set_updated_at before update on public.roommate_groups
  for each row execute function public.set_updated_at();

alter table public.roommate_group_members enable row level security;
drop policy if exists roommate_group_members_select on public.roommate_group_members;
create policy roommate_group_members_select on public.roommate_group_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.roommate_group_role(group_id, (select auth.uid())) is not null
    or (select private.is_staff())
  );
-- Writes through the group functions.

create table if not exists public.roommate_group_shortlist (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.roommate_groups(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  roommate_listing_id uuid references public.roommate_listings(id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  constraint roommate_group_shortlist_one check (num_nonnulls(listing_id, roommate_listing_id) = 1)
);
create unique index if not exists roommate_group_shortlist_unique
  on public.roommate_group_shortlist (group_id, coalesce(listing_id, roommate_listing_id));

alter table public.roommate_group_shortlist enable row level security;
drop policy if exists roommate_group_shortlist_select on public.roommate_group_shortlist;
create policy roommate_group_shortlist_select on public.roommate_group_shortlist for select to authenticated
  using (private.roommate_group_role(group_id, (select auth.uid())) is not null or (select private.is_staff()));
drop policy if exists roommate_group_shortlist_insert on public.roommate_group_shortlist;
create policy roommate_group_shortlist_insert on public.roommate_group_shortlist for insert to authenticated
  with check (added_by = (select auth.uid()) and private.roommate_group_role(group_id, (select auth.uid())) is not null);
drop policy if exists roommate_group_shortlist_delete on public.roommate_group_shortlist;
create policy roommate_group_shortlist_delete on public.roommate_group_shortlist for delete to authenticated
  using (added_by = (select auth.uid()) or private.roommate_group_role(group_id, (select auth.uid())) = 'owner');

create table if not exists public.roommate_group_votes (
  shortlist_id uuid not null references public.roommate_group_shortlist(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  primary key (shortlist_id, user_id)
);
create or replace function private.roommate_shortlist_group(p_shortlist uuid)
returns uuid language sql stable security definer set search_path to '' as $$
  select s.group_id from public.roommate_group_shortlist s where s.id = p_shortlist;
$$;
alter table public.roommate_group_votes enable row level security;
drop policy if exists roommate_group_votes_select on public.roommate_group_votes;
create policy roommate_group_votes_select on public.roommate_group_votes for select to authenticated
  using (private.roommate_group_role(private.roommate_shortlist_group(shortlist_id), (select auth.uid())) is not null);
drop policy if exists roommate_group_votes_write on public.roommate_group_votes;
create policy roommate_group_votes_write on public.roommate_group_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.roommate_group_role(private.roommate_shortlist_group(shortlist_id), (select auth.uid())) is not null);
drop policy if exists roommate_group_votes_update on public.roommate_group_votes;
create policy roommate_group_votes_update on public.roommate_group_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists roommate_group_votes_delete on public.roommate_group_votes;
create policy roommate_group_votes_delete on public.roommate_group_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- The group board: short notes between members (groups have no chat thread,
-- Vallo's conversations are between two people).
create table if not exists public.roommate_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.roommate_groups(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists roommate_group_posts_group_idx on public.roommate_group_posts (group_id, created_at desc);
alter table public.roommate_group_posts enable row level security;
drop policy if exists roommate_group_posts_select on public.roommate_group_posts;
create policy roommate_group_posts_select on public.roommate_group_posts for select to authenticated
  using (private.roommate_group_role(group_id, (select auth.uid())) is not null or (select private.is_staff()));
drop policy if exists roommate_group_posts_insert on public.roommate_group_posts;
create policy roommate_group_posts_insert on public.roommate_group_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and private.roommate_group_role(group_id, (select auth.uid())) is not null);
drop policy if exists roommate_group_posts_delete on public.roommate_group_posts;
create policy roommate_group_posts_delete on public.roommate_group_posts for delete to authenticated
  using (author_id = (select auth.uid()) or private.roommate_group_role(group_id, (select auth.uid())) = 'owner');
drop trigger if exists roommate_group_posts_limit on public.roommate_group_posts;
create trigger roommate_group_posts_limit before insert on public.roommate_group_posts
  for each row execute function private.limit_member_inserts('30', '600', '300');

-- Household money, RECORDED not moved: Vallo never collects or holds this
-- money. A row says what the household agreed and who says they paid.
create table if not exists public.roommate_group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.roommate_groups(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  amount_minor bigint not null check (amount_minor > 0),
  paid_by uuid references public.profiles(id) on delete set null,
  due_on date,
  split text not null default 'equal' check (split in ('equal', 'shares')),
  status text not null default 'planned' check (status in ('planned', 'recorded', 'settled')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roommate_group_expenses_group_idx on public.roommate_group_expenses (group_id, created_at desc);
alter table public.roommate_group_expenses enable row level security;
drop policy if exists roommate_group_expenses_select on public.roommate_group_expenses;
create policy roommate_group_expenses_select on public.roommate_group_expenses for select to authenticated
  using (private.roommate_group_role(group_id, (select auth.uid())) is not null);
drop policy if exists roommate_group_expenses_insert on public.roommate_group_expenses;
create policy roommate_group_expenses_insert on public.roommate_group_expenses for insert to authenticated
  with check (created_by = (select auth.uid()) and private.roommate_group_role(group_id, (select auth.uid())) is not null);
drop policy if exists roommate_group_expenses_update on public.roommate_group_expenses;
create policy roommate_group_expenses_update on public.roommate_group_expenses for update to authenticated
  using (private.roommate_group_role(group_id, (select auth.uid())) is not null)
  with check (private.roommate_group_role(group_id, (select auth.uid())) is not null);
drop policy if exists roommate_group_expenses_delete on public.roommate_group_expenses;
create policy roommate_group_expenses_delete on public.roommate_group_expenses for delete to authenticated
  using (created_by = (select auth.uid()) or private.roommate_group_role(group_id, (select auth.uid())) = 'owner');
drop trigger if exists roommate_group_expenses_set_updated_at on public.roommate_group_expenses;
create trigger roommate_group_expenses_set_updated_at before update on public.roommate_group_expenses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ viewings

create table if not exists public.roommate_viewings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.roommate_listings(id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'in_person' check (mode in ('in_person', 'virtual')),
  proposed_at timestamptz not null,
  alt_at timestamptz,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'done')),
  confirmed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint roommate_viewings_not_self check (requester_id <> host_id)
);
create index if not exists roommate_viewings_host_idx on public.roommate_viewings (host_id, status, proposed_at);
create index if not exists roommate_viewings_requester_idx on public.roommate_viewings (requester_id, status, proposed_at);
alter table public.roommate_viewings enable row level security;
drop policy if exists roommate_viewings_select on public.roommate_viewings;
create policy roommate_viewings_select on public.roommate_viewings for select to authenticated
  using ((select auth.uid()) in (requester_id, host_id) or (select private.is_staff()));
drop trigger if exists roommate_viewings_limit on public.roommate_viewings;
create trigger roommate_viewings_limit before insert on public.roommate_viewings
  for each row execute function private.limit_member_inserts('10', '3600', '20');

-- ------------------------------------------------------------ verification (student, corps member, workplace)

create table if not exists public.roommate_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('student_email', 'student_id', 'nysc', 'workplace')),
  institution_id uuid references public.institutions(id) on delete set null,
  email_masked text check (email_masked is null or char_length(email_masked) <= 120),
  evidence_path text check (evidence_path is null or char_length(evidence_path) <= 300),
  status text not null default 'pending' check (status in ('pending', 'review', 'verified', 'rejected', 'expired')),
  reason text check (reason is null or char_length(reason) <= 300),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roommate_verifications_user_idx on public.roommate_verifications (user_id, kind, created_at desc);
create index if not exists roommate_verifications_queue_idx on public.roommate_verifications (status, created_at) where status = 'review';
alter table public.roommate_verifications enable row level security;
drop policy if exists roommate_verifications_select on public.roommate_verifications;
create policy roommate_verifications_select on public.roommate_verifications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists roommate_verifications_staff on public.roommate_verifications;
create policy roommate_verifications_staff on public.roommate_verifications for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
-- Members never write here directly: the server opens a check with the
-- service role after validating the input, so a member cannot mark
-- themselves verified.
drop trigger if exists roommate_verifications_set_updated_at on public.roommate_verifications;
create trigger roommate_verifications_set_updated_at before update on public.roommate_verifications
  for each row execute function public.set_updated_at();

-- One-time email codes. No member policy at all: service role only.
create table if not exists public.roommate_email_codes (
  verification_id uuid primary key references public.roommate_verifications(id) on delete cascade,
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.roommate_email_codes enable row level security;

-- ------------------------------------------------------------ saved searches with alerts

create table if not exists public.roommate_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  kind text check (kind in ('room_offer', 'roommate_wanted', 'together')),
  state_code text references public.states(code),
  city text,
  institution_id uuid references public.institutions(id) on delete set null,
  max_minor bigint,
  period text not null default 'year' check (period in ('month', 'year')),
  alert boolean not null default true,
  last_alert_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists roommate_saved_searches_user_idx on public.roommate_saved_searches (user_id);
create index if not exists roommate_saved_searches_alert_idx on public.roommate_saved_searches (city) where alert;
alter table public.roommate_saved_searches enable row level security;
drop policy if exists roommate_saved_searches_owner on public.roommate_saved_searches;
create policy roommate_saved_searches_owner on public.roommate_saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists roommate_saved_searches_limit on public.roommate_saved_searches;
create trigger roommate_saved_searches_limit before insert on public.roommate_saved_searches
  for each row execute function private.limit_member_inserts('10', '3600', '20');

-- ------------------------------------------------------------ the universal collections take roommates

alter table public.saved_collection_items drop constraint if exists saved_collection_items_kind_check;
alter table public.saved_collection_items add constraint saved_collection_items_kind_check
  check (kind in ('listing', 'accommodation', 'restaurant', 'roommate_listing', 'roommate_profile'));

-- ------------------------------------------------------------ storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roommate-photos', 'roommate-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roommate-evidence', 'roommate-evidence', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists roommate_photos_owner_insert on storage.objects;
create policy roommate_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'roommate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roommate_photos_owner_update on storage.objects;
create policy roommate_photos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'roommate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roommate_photos_owner_delete on storage.objects;
create policy roommate_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'roommate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roommate_evidence_owner_insert on storage.objects;
create policy roommate_evidence_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'roommate-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roommate_evidence_owner_select on storage.objects;
create policy roommate_evidence_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'roommate-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------ chat opens on a mutual yes

-- The contact policy ("Ask me first") is about strangers. Two people who
-- both said yes on Vallo Roommates are not strangers, so the accepted
-- connection is a second way through, beside a follow.
create or replace function private.direct_chat_respects_contact_policy()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  me    uuid := (select auth.uid());
  other uuid;
  pol   text;
begin
  if new.context_kind is distinct from 'direct'::public.thread_context or me is null then
    return new;
  end if;
  other := case when new.guest_id = me then new.agent_id else new.guest_id end;
  select sp.contact_policy into pol from public.social_profiles sp where sp.user_id = other;
  if coalesce(pol, 'REQUEST') = 'REQUEST'
     and not exists (select 1 from public.follows f
                      where f.follower_id = me and f.followee_id = other)
     and not private.roommate_connected(me, other) then
    raise exception 'direct:follow_first' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- ------------------------------------------------------------ grants

revoke all on public.roommate_email_codes from anon, authenticated;
grant select on public.institutions, public.roommate_match_weights to anon, authenticated;
grant select on public.roommate_listings to anon;
grant select, insert, update, delete on public.roommate_profiles, public.roommate_listings, public.roommate_saved_searches,
  public.roommate_group_shortlist, public.roommate_group_votes, public.roommate_group_posts, public.roommate_group_expenses to authenticated;
grant select, update on public.roommate_groups, public.roommate_verifications, public.institutions, public.roommate_match_weights to authenticated;
grant insert, delete on public.institutions to authenticated;
grant select on public.roommate_interests, public.roommate_group_members, public.roommate_viewings to authenticated;

revoke all on function private.roommate_connected(uuid, uuid) from public, anon;
revoke all on function private.roommate_group_role(uuid, uuid) from public, anon;
revoke all on function private.roommate_group_invited(uuid, uuid) from public, anon;
revoke all on function private.roommate_shortlist_group(uuid) from public, anon;
grant execute on function private.roommate_connected(uuid, uuid) to authenticated;
grant execute on function private.roommate_group_role(uuid, uuid) to authenticated;
grant execute on function private.roommate_group_invited(uuid, uuid) to authenticated;
grant execute on function private.roommate_shortlist_group(uuid) to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> roommates_2_engine.sql

-- VALLO ROOMMATES, PART 2: THE MATCHING ENGINE, THE READS AND THE WRITES.
--
-- Every function here is SECURITY DEFINER with an empty search path and
-- fully qualified names, and every one checks who is calling. The reads
-- return JSON already shaped like `apps/web/src/lib/features/roommates/model.ts`
-- (camelCase keys), so the app only adds photo URLs.
--
-- THE MATCH. Five parts, each 0 to 1, each only when both people answered:
-- budget (overlap of the monthly ranges), location (same area, city, state),
-- move-in (days apart, softened by "flexible"), lifestyle (eight questions,
-- each with its own similarity), accommodation (room, furnishing, household
-- size). The score is the weighted mean of the parts present, times 100,
-- with the weights in `roommate_match_weights` (staff can tune them). Fewer
-- than two parts: no score at all, the screen asks for more profile. Gender
-- preference is a filter both ways, never a score, and a person's own gender
-- is never returned unless they chose to show it.
--
-- Safe to run twice: create or replace everywhere.

set lock_timeout = '5s';

-- ------------------------------------------------------------ small helpers

create or replace function private.rm_monthly(p_minor bigint, p_period text)
returns numeric language sql immutable set search_path to '' as $$
  select case when p_minor is null then null when p_period = 'year' then p_minor / 12.0 else p_minor::numeric end;
$$;

create or replace function private.rm_person(p_user uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'userId', p.id,
    'name', coalesce(nullif(sp.display_label, ''), nullif(p.display_name, ''), 'Vallo member'),
    'handle', sp.handle,
    'avatarUrl', coalesce(sp.avatar_path, p.avatar_url)
  )
  from public.profiles p
  left join public.social_profiles sp on sp.user_id = p.id
  where p.id = p_user;
$$;

-- The badges a person has earned, each one naming what was checked.
create or replace function private.rm_badges(p_user uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb) from (
    select v.kind as k
      from public.roommate_verifications v
     where v.user_id = p_user and v.status = 'verified' and (v.expires_at is null or v.expires_at > now())
    union all
    select 'identity'
     where exists (select 1 from public.identity_verifications iv where iv.subject_id = p_user and iv.outcome = 'matched')
        or exists (select 1 from public.identity_checks ic where ic.subject_id = p_user and ic.status in ('passed', 'approved'))
    union all
    select 'phone' where exists (select 1 from public.confirmed_phones cp where cp.user_id = p_user)
  ) x;
$$;

create or replace function private.rm_institution(p_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'name', i.name, 'shortName', i.short_name, 'kind', i.kind, 'stateCode', i.state_code, 'city', i.city)
    from public.institutions i where i.id = p_id;
$$;

create or replace function private.rm_lower_overlap(a text[], b text[])
returns boolean language sql immutable set search_path to '' as $$
  select exists (select 1 from unnest(coalesce(a, '{}')) x join unnest(coalesce(b, '{}')) y on lower(trim(x)) = lower(trim(y)));
$$;

-- Both people's gender preferences hold (a filter, never a score).
create or replace function private.rm_gender_ok(a public.roommate_profiles, b public.roommate_profiles)
returns boolean language sql immutable set search_path to '' as $$
  select (a.gender_pref = 'any' or b.gender = a.gender_pref)
     and (b.gender_pref = 'any' or a.gender = b.gender_pref);
$$;

-- ------------------------------------------------------------ the match

create or replace function private.roommate_match(a public.roommate_profiles, b public.roommate_profiles)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  w public.roommate_match_weights;
  parts jsonb := '{}'::jsonb;
  reasons text[] := '{}';
  amin numeric; amax numeric; bmin numeric; bmax numeric;
  v numeric;
  d integer;
  ls numeric := 0; ln integer := 0;
  acc numeric := 0; an integer := 0;
  total numeric := 0; wsum numeric := 0;
  sim numeric;
  ord constant jsonb := '{"rarely":1,"sometimes":2,"often":3}';
begin
  if a.user_id is null or b.user_id is null then
    return null;
  end if;
  select * into w from public.roommate_match_weights limit 1;
  if not found then
    w.budget := 30; w.location := 25; w.move_in := 15; w.lifestyle := 20; w.accommodation := 10;
  end if;

  -- Budget: the monthly ranges overlap, or how far apart they are.
  amax := private.rm_monthly(a.budget_max_minor, a.budget_period);
  bmax := private.rm_monthly(b.budget_max_minor, b.budget_period);
  if amax is not null and bmax is not null and amax > 0 and bmax > 0 then
    amin := coalesce(private.rm_monthly(a.budget_min_minor, a.budget_period), amax * 0.6);
    bmin := coalesce(private.rm_monthly(b.budget_min_minor, b.budget_period), bmax * 0.6);
    if least(amax, bmax) >= greatest(amin, bmin) then
      v := 1;
    else
      v := greatest(0, 1 - (greatest(amin, bmin) - least(amax, bmax)) / greatest(amax, bmax));
    end if;
    parts := parts || jsonb_build_object('budget', round(v, 2));
    if v >= 0.8 then reasons := reasons || 'budget'::text; end if;
  end if;

  -- Location.
  if a.city is not null and b.city is not null then
    if private.rm_lower_overlap(a.areas, b.areas) then
      v := 1; reasons := reasons || 'same_area'::text;
    elsif lower(trim(a.city)) = lower(trim(b.city)) then
      v := 0.75; reasons := reasons || 'same_city'::text;
    elsif a.state_code is not null and a.state_code = b.state_code then
      v := 0.4; reasons := reasons || 'same_state'::text;
    else
      v := 0;
    end if;
    parts := parts || jsonb_build_object('location', v);
  end if;

  -- Move-in.
  if a.move_in_on is not null and b.move_in_on is not null then
    d := abs(a.move_in_on - b.move_in_on);
    v := case when d <= 14 then 1 when d <= 45 then 0.75 when d <= 90 then 0.4 else 0.1 end;
    if a.move_in_flex = 'flexible' or b.move_in_flex = 'flexible' then v := greatest(v, 0.6); end if;
    parts := parts || jsonb_build_object('move_in', v);
    if v >= 0.75 then reasons := reasons || 'move_in'::text; end if;
  elsif a.move_in_flex = 'asap' and b.move_in_flex = 'asap' then
    parts := parts || jsonb_build_object('move_in', 1);
    reasons := reasons || 'move_in'::text;
  elsif a.move_in_flex in ('asap', 'flexible') and b.move_in_flex in ('asap', 'flexible') then
    parts := parts || jsonb_build_object('move_in', 0.8);
  end if;

  -- Lifestyle: each question both answered, averaged.
  if a.cleanliness is not null and b.cleanliness is not null then
    sim := 1 - abs(a.cleanliness - b.cleanliness) / 2.0; ls := ls + sim; ln := ln + 1;
    if a.cleanliness >= 2 and b.cleanliness >= 2 then reasons := reasons || 'tidy'::text; end if;
  end if;
  if a.social is not null and b.social is not null then
    sim := 1 - abs(a.social - b.social) / 2.0; ls := ls + sim; ln := ln + 1;
    if a.social = 1 and b.social = 1 then reasons := reasons || 'quiet'::text; end if;
    if a.social = 3 and b.social = 3 then reasons := reasons || 'social'::text; end if;
  end if;
  if a.sleep is not null and b.sleep is not null then
    sim := case when a.sleep = b.sleep then 1 when 'varies' in (a.sleep, b.sleep) then 0.6 else 0.2 end;
    ls := ls + sim; ln := ln + 1;
    if a.sleep = b.sleep and a.sleep <> 'varies' then reasons := reasons || 'sleep'::text; end if;
  end if;
  if a.smoking is not null and b.smoking is not null then
    sim := case
      when a.smoking = b.smoking then 1
      when 'never' in (a.smoking, b.smoking) and 'yes' in (a.smoking, b.smoking) then 0
      else 0.6 end;
    ls := ls + sim; ln := ln + 1;
    if a.smoking = 'never' and b.smoking = 'never' then reasons := reasons || 'non_smoking'::text; end if;
  end if;
  if a.pets is not null and b.pets is not null then
    sim := case
      when 'none' in (a.pets, b.pets) and 'have' in (a.pets, b.pets) then 0
      when a.pets = b.pets then (case when a.pets = 'have' then 0.8 else 1 end)
      when 'none' in (a.pets, b.pets) then 0.7
      else 1 end;
    ls := ls + sim; ln := ln + 1;
  end if;
  if a.guests is not null and b.guests is not null then
    sim := 1 - abs((ord ->> a.guests)::int - (ord ->> b.guests)::int) / 2.0; ls := ls + sim; ln := ln + 1;
  end if;
  if a.cooking is not null and b.cooking is not null then
    sim := 1 - abs((ord ->> a.cooking)::int - (ord ->> b.cooking)::int) / 2.0; ls := ls + sim; ln := ln + 1;
  end if;
  if a.schedule is not null and b.schedule is not null then
    sim := case when a.schedule = b.schedule then 1 when 'mixed' in (a.schedule, b.schedule) then 0.7 else 0.5 end;
    ls := ls + sim; ln := ln + 1;
  end if;
  if ln >= 2 then
    parts := parts || jsonb_build_object('lifestyle', round(ls / ln, 2));
  end if;

  -- Accommodation.
  if a.room_pref is not null and b.room_pref is not null then
    sim := case when a.room_pref = b.room_pref or 'either' in (a.room_pref, b.room_pref) then 1 else 0.3 end;
    acc := acc + sim; an := an + 1;
    if a.room_pref = b.room_pref and a.room_pref <> 'either' then reasons := reasons || 'room'::text; end if;
  end if;
  if a.furnished_pref is not null and b.furnished_pref is not null then
    sim := case when a.furnished_pref = b.furnished_pref or 'either' in (a.furnished_pref, b.furnished_pref) then 1 else 0.4 end;
    acc := acc + sim; an := an + 1;
  end if;
  if a.household_size is not null and b.household_size is not null then
    acc := acc + greatest(0, 1 - abs(a.household_size - b.household_size) / 4.0); an := an + 1;
  end if;
  if an >= 1 then
    parts := parts || jsonb_build_object('accommodation', round(acc / an, 2));
  end if;

  -- Not scored, but worth saying.
  if a.institution_id is not null and a.institution_id = b.institution_id and b.institution_visible then
    reasons := reasons || 'institution'::text;
  end if;
  if a.life_stage is not null and a.life_stage = b.life_stage and a.life_stage <> 'other' then
    reasons := reasons || 'life_stage'::text;
  end if;

  if parts ? 'budget' then total := total + w.budget * (parts ->> 'budget')::numeric; wsum := wsum + w.budget; end if;
  if parts ? 'location' then total := total + w.location * (parts ->> 'location')::numeric; wsum := wsum + w.location; end if;
  if parts ? 'move_in' then total := total + w.move_in * (parts ->> 'move_in')::numeric; wsum := wsum + w.move_in; end if;
  if parts ? 'lifestyle' then total := total + w.lifestyle * (parts ->> 'lifestyle')::numeric; wsum := wsum + w.lifestyle; end if;
  if parts ? 'accommodation' then total := total + w.accommodation * (parts ->> 'accommodation')::numeric; wsum := wsum + w.accommodation; end if;

  return jsonb_build_object(
    'score', case when (select count(*) from jsonb_object_keys(parts)) >= 2 and wsum > 0 then round(total / wsum * 100)::int else null end,
    'parts', parts,
    'reasons', to_jsonb(reasons)
  );
end;
$$;

-- A room post compared with a person: the post stands in as a profile (its
-- city and area, the person's share as the budget, the available date, the
-- room) and the lister's own lifestyle answers when they have a profile.
create or replace function private.roommate_listing_match(v public.roommate_profiles, l public.roommate_listings)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  o public.roommate_profiles;
  pseudo public.roommate_profiles;
  price bigint;
begin
  if v.user_id is null or v.status <> 'active' or l.owner_id = v.user_id then
    return null;
  end if;
  select * into o from public.roommate_profiles where user_id = l.owner_id;
  pseudo := o;
  pseudo.user_id := l.owner_id;
  pseudo.state_code := l.state_code;
  pseudo.city := l.city;
  pseudo.areas := case when l.area is null then '{}'::text[] else array[l.area] end;
  price := coalesce(l.share_minor, case when coalesce(l.occupants_max, 0) > 0 then l.rent_minor / l.occupants_max else l.rent_minor end);
  pseudo.budget_min_minor := price;
  pseudo.budget_max_minor := price;
  pseudo.budget_period := l.rent_period;
  pseudo.move_in_on := l.available_from;
  pseudo.move_in_flex := case when l.available_from is null or l.available_from <= current_date then 'asap' else 'fixed' end;
  pseudo.room_pref := case l.room_type when 'shared' then 'shared' when 'private' then 'private' when 'ensuite' then 'private' else null end;
  pseudo.furnished_pref := case l.furnished when 'furnished' then 'furnished' when 'semi' then 'either' when 'unfurnished' then 'unfurnished' else null end;
  pseudo.household_size := l.occupants_max;
  pseudo.institution_id := l.institution_id;
  pseudo.institution_visible := true;
  return private.roommate_match(v, pseudo);
end;
$$;

-- ------------------------------------------------------------ cards

create or replace function private.rm_card(p public.roommate_profiles, viewer public.roommate_profiles)
returns jsonb language sql stable security definer set search_path to '' as $$
  select private.rm_person(p.user_id) || jsonb_build_object(
    'intro', p.intro,
    'lifeStage', p.life_stage,
    'institution', case when p.institution_visible then private.rm_institution(p.institution_id) end,
    'workplace', case when p.workplace_visible then p.workplace end,
    'stateCode', p.state_code,
    'city', p.city,
    'areas', to_jsonb(p.areas),
    'budget', jsonb_build_object('minMinor', p.budget_min_minor, 'maxMinor', p.budget_max_minor, 'period', p.budget_period),
    'moveInOn', p.move_in_on,
    'moveInFlex', p.move_in_flex,
    'intents', to_jsonb(p.intents),
    'roomPref', p.room_pref,
    'lifestyle', jsonb_build_object(
      'cleanliness', p.cleanliness, 'social', p.social, 'sleep', p.sleep, 'smoking', p.smoking,
      'pets', p.pets, 'guests', p.guests, 'cooking', p.cooking, 'schedule', p.schedule),
    'gender', case when p.gender_visible then p.gender end,
    'badges', private.rm_badges(p.user_id),
    'lastActiveAt', p.last_active_at,
    'match', case when viewer.user_id is not null and viewer.user_id <> p.user_id then private.roommate_match(viewer, p) end
  );
$$;

create or replace function private.rm_room_card(l public.roommate_listings, viewer public.roommate_profiles)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', l.id,
    'kind', l.kind,
    'status', l.status,
    'title', l.title,
    'stateCode', l.state_code,
    'city', l.city,
    'area', l.area,
    'institution', private.rm_institution(l.institution_id),
    'rentMinor', l.rent_minor,
    'rentPeriod', l.rent_period,
    'shareMinor', l.share_minor,
    'roomsAvailable', l.rooms_available,
    'occupantsNow', l.occupants_now,
    'occupantsMax', l.occupants_max,
    'bedrooms', l.bedrooms,
    'bathrooms', l.bathrooms,
    'roomType', l.room_type,
    'furnished', l.furnished,
    'amenities', to_jsonb(l.amenities),
    'availableFrom', l.available_from,
    'genderPref', l.gender_pref,
    'photoUrls', to_jsonb(l.photos),
    'verified', l.verified_at is not null,
    'linkedListingId', l.listing_id,
    'owner', coalesce(private.rm_person(l.owner_id), '{}'::jsonb) || jsonb_build_object('badges', private.rm_badges(l.owner_id)),
    'publishedAt', l.published_at,
    'match', private.roommate_listing_match(viewer, l)
  );
$$;

-- The connection between the caller and another person, as the screens read it.
create or replace function private.rm_connection(p_me uuid, p_other uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce((
    select case
      when i.status = 'accepted' then jsonb_build_object('state', 'connected', 'interestId', i.id, 'conversationId', i.conversation_id)
      when i.status = 'pending' and i.from_id = p_me then jsonb_build_object('state', 'sent', 'interestId', i.id)
      when i.status = 'pending' then jsonb_build_object('state', 'received', 'interestId', i.id, 'note', i.note)
      when i.status = 'declined' and i.from_id = p_me then jsonb_build_object('state', 'declined')
      else jsonb_build_object('state', 'none') end
      from public.roommate_interests i
     where least(i.from_id, i.to_id) = least(p_me, p_other)
       and greatest(i.from_id, i.to_id) = greatest(p_me, p_other)
     order by (i.status in ('pending', 'accepted')) desc, i.created_at desc
     limit 1
  ), jsonb_build_object('state', 'none'));
$$;

-- ------------------------------------------------------------ discover people

create or replace function public.roommate_discover(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  lim integer := least(greatest(coalesce((p ->> 'limit')::int, 20), 1), 40);
  off integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  f_state text := nullif(p ->> 'stateCode', '');
  f_city text := nullif(p ->> 'city', '');
  f_inst uuid := nullif(p ->> 'institutionId', '')::uuid;
  f_stage text := nullif(p ->> 'lifeStage', '');
  f_intent text := nullif(p ->> 'intent', '');
  f_max numeric := private.rm_monthly(nullif(p ->> 'maxMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
  f_by date := nullif(p ->> 'moveBy', '')::date;
  f_verified boolean := coalesce((p ->> 'verifiedOnly')::boolean, false);
  f_sort text := coalesce(p ->> 'sort', 'match');
  rows jsonb;
  n integer;
begin
  if me is null then
    return jsonb_build_object('items', '[]'::jsonb, 'next', null);
  end if;
  select * into v from public.roommate_profiles where user_id = me;
  if not found or v.status <> 'active' then
    return jsonb_build_object('needProfile', true, 'items', '[]'::jsonb, 'next', null);
  end if;
  update public.roommate_profiles set last_active_at = now() where user_id = me and last_active_at < now() - interval '10 minutes';

  with pool as (
    select r.user_id
      from public.roommate_profiles r
     where r.status = 'active'
       and r.user_id <> me
       and not private.blocked_between(me, r.user_id)
       and private.rm_gender_ok(v, r)
       and (f_state is null or r.state_code = f_state)
       and (f_city is null or lower(r.city) = lower(f_city) or private.rm_lower_overlap(r.areas, array[f_city]))
       and (f_inst is null or (r.institution_id = f_inst and r.institution_visible))
       and (f_stage is null or r.life_stage = f_stage)
       and (f_intent is null or f_intent = any (r.intents))
       and (f_max is null or private.rm_monthly(coalesce(r.budget_min_minor, r.budget_max_minor), r.budget_period) <= f_max)
       and (f_by is null or r.move_in_on is null or r.move_in_on <= f_by)
       and (q is null
            or r.city ilike '%' || q || '%'
            or exists (select 1 from unnest(r.areas) a where a ilike '%' || q || '%')
            or (r.institution_visible and exists (select 1 from public.institutions i where i.id = r.institution_id and (i.name ilike '%' || q || '%' or i.short_name ilike '%' || q || '%'))))
     order by r.last_active_at desc
     limit 500
  ),
  scored as (
    select r.user_id, r.last_active_at, r.budget_max_minor, r.budget_period, private.roommate_match(v, r) as m
      from pool
      join public.roommate_profiles r on r.user_id = pool.user_id
     where not f_verified or jsonb_array_length(private.rm_badges(r.user_id)) > 0
  ),
  page as (
    select s.user_id,
           row_number() over (order by
             case when f_sort = 'match' then coalesce((s.m ->> 'score')::int, -1) end desc nulls last,
             case when f_sort = 'budget' then private.rm_monthly(s.budget_max_minor, s.budget_period) end asc nulls last,
             s.last_active_at desc) as rn
      from scored s
  )
  select coalesce(jsonb_agg(private.rm_card(r, v) order by page.rn), '[]'::jsonb), count(*)
    into rows, n
    from page
    join public.roommate_profiles r on r.user_id = page.user_id
   where page.rn > off and page.rn <= off + lim + 1;

  if n > lim then
    rows := rows - lim;
    return jsonb_build_object('items', rows, 'next', off + lim);
  end if;
  return jsonb_build_object('items', rows, 'next', null);
end;
$$;

-- ------------------------------------------------------------ one person

create or replace function public.roommate_profile_view(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  t public.roommate_profiles;
  related boolean;
  card jsonb;
begin
  if me is null or p_user is null then
    return null;
  end if;
  select * into t from public.roommate_profiles where user_id = p_user;
  if not found then
    return null;
  end if;
  select * into v from public.roommate_profiles where user_id = me;
  if p_user <> me then
    if private.blocked_between(me, p_user) then
      return null;
    end if;
    related := exists (select 1 from public.roommate_interests i
                        where least(i.from_id, i.to_id) = least(me, p_user)
                          and greatest(i.from_id, i.to_id) = greatest(me, p_user)
                          and i.status in ('pending', 'accepted'))
            or exists (select 1 from public.roommate_group_members a
                         join public.roommate_group_members b on b.group_id = a.group_id
                        where a.user_id = me and b.user_id = p_user
                          and a.state = 'active' and b.state in ('active', 'invited', 'requested'));
    if (v.user_id is null or v.status <> 'active') and not related and not private.is_staff() then
      return jsonb_build_object('needProfile', true);
    end if;
    if t.status <> 'active' and not related and not private.is_staff() then
      return null;
    end if;
  end if;

  card := private.rm_card(t, case when p_user = me then null::public.roommate_profiles else v end);
  return card || jsonb_build_object(
    'course', case when t.institution_visible then t.course end,
    'studyLevel', case when t.institution_visible then t.study_level end,
    'householdSize', t.household_size,
    'furnishedPref', t.furnished_pref,
    'genderPref', t.gender_pref,
    'memberSince', (select pr.created_at from public.profiles pr where pr.id = p_user),
    'connection', case when p_user = me then jsonb_build_object('state', 'none') else private.rm_connection(me, p_user) end,
    'isSelf', p_user = me,
    'listings', coalesce((select jsonb_agg(private.rm_room_card(l, v) order by l.published_at desc)
                            from public.roommate_listings l
                           where l.owner_id = p_user and l.status = 'live'), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------ search room posts

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
  f_max numeric := private.rm_monthly(nullif(p ->> 'maxMinor', '')::bigint, coalesce(p ->> 'period', 'year'));
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
       and (f_max is null or private.rm_monthly(coalesce(l.share_minor, l.rent_minor), l.rent_period) <= f_max)
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

-- ------------------------------------------------------------ one room post

create or replace function public.roommate_listing_view(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  l public.roommate_listings;
  linked jsonb;
  viewing jsonb;
begin
  select * into l from public.roommate_listings where id = p_id;
  if not found then
    return null;
  end if;
  if me is not null then
    if private.blocked_between(me, l.owner_id) then
      return null;
    end if;
    select * into v from public.roommate_profiles where user_id = me;
  end if;
  if l.status <> 'live' and (me is null or (me <> l.owner_id and not private.is_staff()
        and not exists (select 1 from public.roommate_interests i where i.listing_id = l.id and me in (i.from_id, i.to_id))
        and not exists (select 1 from public.roommate_viewings rv where rv.listing_id = l.id and me in (rv.requester_id, rv.host_id)))) then
    return null;
  end if;

  if l.listing_id is not null then
    select jsonb_build_object(
             'id', li.id,
             'title', li.title,
             'area', li.area,
             'city', li.city,
             'photoUrl', (select 'listing-photos/' || ph.storage_path from public.listing_photos ph where ph.listing_id = li.id order by ph.position limit 1),
             'priceLabel', case
               when li.rent_amount_minor is not null then 'NGN ' || to_char(li.rent_amount_minor / 100, 'FM999,999,999,990') || ' per ' || coalesce(li.rent_period::text, 'year')
               when li.sale_price_minor is not null then 'NGN ' || to_char(li.sale_price_minor / 100, 'FM999,999,999,990')
               else null end)
      into linked
      from public.listings li
     where li.id = l.listing_id and li.status = 'PUBLISHED';
  end if;

  if me is not null then
    select jsonb_build_object('id', rv.id, 'status', rv.status, 'proposedAt', rv.proposed_at)
      into viewing
      from public.roommate_viewings rv
     where rv.listing_id = l.id and rv.requester_id = me
     order by rv.created_at desc limit 1;
  end if;

  return private.rm_room_card(l, v) || jsonb_build_object(
    'description', l.description,
    'depositMinor', l.deposit_minor,
    'agencyFeeMinor', l.agency_fee_minor,
    'legalFeeMinor', l.legal_fee_minor,
    'serviceChargeMinor', l.service_charge_minor,
    'utilitiesMonthlyMinor', l.utilities_monthly_minor,
    'houseRules', to_jsonb(l.house_rules),
    'minStayMonths', l.min_stay_months,
    'authority', l.authority,
    'expiresAt', l.expires_at,
    'viewCount', l.view_count,
    'interestCount', l.interest_count,
    'isOwner', me is not null and me = l.owner_id,
    'connection', case when me is null or me = l.owner_id then jsonb_build_object('state', 'none') else private.rm_connection(me, l.owner_id) end,
    'myViewing', viewing,
    'linkedListing', linked
  );
end;
$$;

-- ------------------------------------------------------------ home

create or replace function public.roommate_home()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  name text;
  completeness integer := 0;
  recommended jsonb := '[]'::jsonb;
  pending jsonb := jsonb_build_object('requests', 0, 'invites', 0, 'viewings', 0);
  home_state text;
begin
  if me is not null then
    select * into v from public.roommate_profiles where user_id = me;
    select coalesce(nullif(sp.display_label, ''), nullif(pr.display_name, '')) into name
      from public.profiles pr left join public.social_profiles sp on sp.user_id = pr.id where pr.id = me;
    if v.user_id is not null then
      update public.roommate_profiles set last_active_at = now() where user_id = me and last_active_at < now() - interval '10 minutes';
      completeness := round(100.0 * (
          (cardinality(v.intents) > 0)::int
        + (v.city is not null)::int
        + (v.budget_max_minor is not null)::int
        + (v.move_in_on is not null or v.move_in_flex <> 'fixed')::int
        + (v.life_stage is not null and char_length(coalesce(v.intro, '')) >= 20)::int
        + ((v.cleanliness is not null)::int + (v.social is not null)::int + (v.sleep is not null)::int + (v.smoking is not null)::int
           + (v.pets is not null)::int + (v.guests is not null)::int + (v.cooking is not null)::int + (v.schedule is not null)::int >= 4)::int
        + exists (select 1 from public.social_profiles sp where sp.user_id = me and sp.avatar_path is not null)::int
      ) / 7);
      if v.status = 'active' then
        recommended := coalesce(public.roommate_discover(jsonb_build_object('stateCode', v.state_code, 'limit', 6, 'sort', 'match')) -> 'items', '[]'::jsonb);
      end if;
    end if;
    pending := jsonb_build_object(
      'requests', (select count(*) from public.roommate_interests i where i.to_id = me and i.status = 'pending'),
      'invites', (select count(*) from public.roommate_group_members m where m.user_id = me and m.state = 'invited'),
      'viewings', (select count(*) from public.roommate_viewings rv where rv.host_id = me and rv.status = 'requested'));
  end if;
  home_state := coalesce(v.status, 'none');

  return jsonb_build_object(
    'viewerName', name,
    'myStatus', home_state,
    'completeness', completeness,
    'stats', jsonb_build_object(
      'people', (select count(*) from public.roommate_profiles r where r.status = 'active'),
      'rooms', (select count(*) from public.roommate_listings l where l.status = 'live' and l.kind = 'room_offer'),
      'groups', (select count(*) from public.roommate_groups g where g.stage in ('forming', 'searching'))),
    'recommended', recommended,
    'rooms', coalesce((public.roommate_search_listings(jsonb_build_object('kind', 'room_offer', 'stateCode', v.state_code, 'limit', 8)) -> 'items'), '[]'::jsonb),
    'together', coalesce((select jsonb_agg(x) from (
        select private.rm_room_card(l, v) x
          from public.roommate_listings l
         where l.status = 'live' and l.kind in ('roommate_wanted', 'together')
           and (me is null or (l.owner_id <> me and not private.blocked_between(me, l.owner_id)))
         order by l.published_at desc nulls last limit 6) t), '[]'::jsonb),
    'institutions', coalesce((select jsonb_agg(x order by (x ->> 'people')::int + (x ->> 'rooms')::int desc, x ->> 'name') from (
        select private.rm_institution(i.id) || jsonb_build_object(
                 'people', (select count(*) from public.roommate_profiles r where r.institution_id = i.id and r.status = 'active' and r.institution_visible),
                 'rooms', (select count(*) from public.roommate_listings l where l.institution_id = i.id and l.status = 'live')) x
          from public.institutions i
         where i.status = 'live' and i.kind in ('university', 'polytechnic')
         order by (select count(*) from public.roommate_profiles r where r.institution_id = i.id and r.status = 'active') desc, i.name
         limit 8) t), '[]'::jsonb),
    'pending', pending
  );
end;
$$;

-- ------------------------------------------------------------ the hub

create or replace function public.roommate_my_hub()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
begin
  if me is null then
    return null;
  end if;
  select * into v from public.roommate_profiles where user_id = me;
  return jsonb_build_object(
    'myStatus', coalesce(v.status, 'none'),
    'badges', private.rm_badges(me),
    'interests', coalesce((select jsonb_agg(x order by x ->> 'createdAt' desc) from (
        select jsonb_build_object(
                 'id', i.id,
                 'direction', case when i.from_id = me then 'out' else 'in' end,
                 'status', i.status,
                 'note', i.note,
                 'createdAt', i.created_at,
                 'decidedAt', i.decided_at,
                 'conversationId', i.conversation_id,
                 'person', coalesce(private.rm_person(case when i.from_id = me then i.to_id else i.from_id end), '{}'::jsonb)
                           || jsonb_build_object('badges', private.rm_badges(case when i.from_id = me then i.to_id else i.from_id end)),
                 'listing', (select jsonb_build_object('id', l.id, 'title', l.title) from public.roommate_listings l where l.id = i.listing_id)) x
          from public.roommate_interests i
         where me in (i.from_id, i.to_id)
           and not private.blocked_between(i.from_id, i.to_id)
           and (i.status in ('pending', 'accepted') or i.created_at > now() - interval '30 days')
         order by i.created_at desc limit 200) t), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object(
                 'id', g.id, 'name', g.name, 'stage', g.stage, 'city', g.city,
                 'role', case when m.state = 'active' then m.role end,
                 'state', m.state,
                 'memberCount', (select count(*) from public.roommate_group_members mm where mm.group_id = g.id and mm.state = 'active'),
                 'sizeTarget', g.size_target,
                 'faces', coalesce((select jsonb_agg(private.rm_person(mm.user_id)) from (
                     select mm.user_id from public.roommate_group_members mm where mm.group_id = g.id and mm.state = 'active' order by mm.joined_at limit 4) mm), '[]'::jsonb),
                 'invitedBy', case when m.state = 'invited' then private.rm_person(m.invited_by) end) x
          from public.roommate_group_members m
          join public.roommate_groups g on g.id = m.group_id
         where m.user_id = me and m.state in ('invited', 'requested', 'active') and g.stage <> 'closed'
         order by g.updated_at desc) t), '[]'::jsonb),
    'viewings', coalesce((select jsonb_agg(x order by x ->> 'proposedAt') from (
        select jsonb_build_object(
                 'id', rv.id,
                 'role', case when rv.host_id = me then 'host' else 'guest' end,
                 'status', rv.status, 'mode', rv.mode, 'proposedAt', rv.proposed_at, 'altAt', rv.alt_at, 'note', rv.note,
                 'listing', jsonb_build_object('id', l.id, 'title', l.title, 'area', l.area, 'city', l.city, 'photoUrl', l.photos[1]),
                 'person', private.rm_person(case when rv.host_id = me then rv.requester_id else rv.host_id end)) x
          from public.roommate_viewings rv
          join public.roommate_listings l on l.id = rv.listing_id
         where me in (rv.host_id, rv.requester_id)
           and (rv.status in ('requested', 'confirmed') or rv.proposed_at > now() - interval '30 days')
         limit 100) t), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(private.rm_room_card(l, null::public.roommate_profiles)
                          || jsonb_build_object('viewCount', l.view_count, 'interestCount', l.interest_count, 'expiresAt', l.expires_at)
                          order by l.updated_at desc)
                          from public.roommate_listings l where l.owner_id = me and l.status <> 'removed'), '[]'::jsonb),
    'searches', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', s.id, 'label', s.label, 'kind', s.kind, 'city', s.city, 'stateCode', s.state_code,
                 'institutionId', s.institution_id, 'maxMinor', s.max_minor, 'period', s.period, 'alert', s.alert, 'createdAt', s.created_at)
                 order by s.created_at desc)
                 from public.roommate_saved_searches s where s.user_id = me), '[]'::jsonb),
    'verifications', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', rv.id, 'kind', rv.kind, 'status', rv.status, 'institution', private.rm_institution(rv.institution_id),
                 'emailMasked', rv.email_masked, 'reason', rv.reason, 'createdAt', rv.created_at, 'reviewedAt', rv.reviewed_at)
                 order by rv.created_at desc)
                 from public.roommate_verifications rv where rv.user_id = me and rv.created_at > now() - interval '400 days'), '[]'::jsonb)
  );
end;
$$;

create or replace function public.roommate_my_connections()
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(private.rm_person(case when i.from_id = (select auth.uid()) then i.to_id else i.from_id end)
                            || jsonb_build_object('interestId', i.id) order by i.decided_at desc nulls last), '[]'::jsonb)
    from public.roommate_interests i
   where (select auth.uid()) in (i.from_id, i.to_id)
     and i.status = 'accepted'
     and not private.blocked_between(i.from_id, i.to_id);
$$;

-- ------------------------------------------------------------ groups (reads)

create or replace function private.rm_shortlist_target(s public.roommate_group_shortlist)
returns jsonb language sql stable security definer set search_path to '' as $$
  select case
    when s.listing_id is not null then (
      select jsonb_build_object(
               'id', li.id, 'title', li.title, 'area', li.area, 'city', li.city,
               'photoUrl', (select 'listing-photos/' || ph.storage_path from public.listing_photos ph where ph.listing_id = li.id order by ph.position limit 1),
               'priceMinor', coalesce(li.rent_amount_minor, li.sale_price_minor, li.rate_minor),
               'period', case li.rent_period::text when 'month' then 'month' when 'year' then 'year' else null end,
               'bedrooms', li.bedrooms,
               'href', '/listing/' || li.id)
        from public.listings li where li.id = s.listing_id)
    else (
      select jsonb_build_object(
               'id', l.id, 'title', l.title, 'area', l.area, 'city', l.city,
               'photoUrl', l.photos[1],
               'priceMinor', coalesce(l.share_minor, l.rent_minor),
               'period', l.rent_period,
               'bedrooms', l.bedrooms,
               'href', '/roommates/r/' || l.id)
        from public.roommate_listings l where l.id = s.roommate_listing_id)
  end;
$$;

create or replace function public.roommate_group_view(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
  mine public.roommate_group_members;
  member boolean;
begin
  if me is null then
    return null;
  end if;
  select * into g from public.roommate_groups where id = p_id;
  if not found then
    return null;
  end if;
  select * into mine from public.roommate_group_members where group_id = p_id and user_id = me;
  member := mine.state = 'active';
  if not coalesce(member, false)
     and coalesce(mine.state, '') not in ('invited', 'requested')
     and not (g.visibility = 'open' and g.stage in ('forming', 'searching') and not private.blocked_between(me, g.owner_id))
     and not private.is_staff() then
    return null;
  end if;

  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'intro', g.intro, 'visibility', g.visibility, 'stage', g.stage,
    'stateCode', g.state_code, 'city', g.city, 'areas', to_jsonb(g.areas),
    'institution', private.rm_institution(g.institution_id),
    'bedrooms', g.bedrooms, 'sizeTarget', g.size_target,
    'budgetMinMinor', g.budget_min_minor, 'budgetMaxMinor', g.budget_max_minor, 'budgetPeriod', g.budget_period,
    'moveInOn', g.move_in_on,
    'myRole', case when member then mine.role end,
    'myState', case when mine.state in ('invited', 'requested', 'active') then mine.state end,
    'createdAt', g.created_at,
    'members', coalesce((select jsonb_agg(private.rm_person(m.user_id) || jsonb_build_object(
                    'role', m.role, 'state', m.state, 'sharePercent', m.share_percent, 'badges', private.rm_badges(m.user_id))
                    order by (m.role = 'owner') desc, m.joined_at nulls last, m.created_at)
                  from public.roommate_group_members m
                 where m.group_id = g.id
                   and (m.state = 'active' or (member and m.state in ('invited', 'requested')))), '[]'::jsonb),
    'shortlist', case when member then coalesce((select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'note', s.note, 'createdAt', s.created_at,
                    'addedBy', private.rm_person(s.added_by),
                    'kind', case when s.listing_id is not null then 'property' else 'room' end,
                    'target', private.rm_shortlist_target(s),
                    'votes', jsonb_build_object(
                      'yes', (select count(*) from public.roommate_group_votes vt where vt.shortlist_id = s.id and vt.vote = 'yes'),
                      'maybe', (select count(*) from public.roommate_group_votes vt where vt.shortlist_id = s.id and vt.vote = 'maybe'),
                      'no', (select count(*) from public.roommate_group_votes vt where vt.shortlist_id = s.id and vt.vote = 'no'),
                      'mine', (select vt.vote from public.roommate_group_votes vt where vt.shortlist_id = s.id and vt.user_id = me)))
                    order by s.created_at desc)
                  from public.roommate_group_shortlist s where s.group_id = g.id), '[]'::jsonb) else '[]'::jsonb end,
    'posts', case when member then coalesce((select jsonb_agg(x order by x ->> 'createdAt' desc) from (
                    select jsonb_build_object('id', gp.id, 'body', gp.body, 'createdAt', gp.created_at,
                                              'author', private.rm_person(gp.author_id), 'mine', gp.author_id = me) x
                      from public.roommate_group_posts gp where gp.group_id = g.id
                     order by gp.created_at desc limit 100) t), '[]'::jsonb) else '[]'::jsonb end,
    'expenses', case when member then coalesce((select jsonb_agg(jsonb_build_object(
                    'id', e.id, 'title', e.title, 'amountMinor', e.amount_minor,
                    'paidBy', case when e.paid_by is not null then private.rm_person(e.paid_by) end,
                    'dueOn', e.due_on, 'status', e.status, 'createdAt', e.created_at)
                    order by e.created_at desc)
                  from public.roommate_group_expenses e where e.group_id = g.id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.roommate_open_groups(p_state text, p_city text)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object(
             'id', g.id, 'name', g.name, 'stage', g.stage, 'city', g.city,
             'role', null, 'state', coalesce(m.state, 'none'),
             'memberCount', (select count(*) from public.roommate_group_members mm where mm.group_id = g.id and mm.state = 'active'),
             'sizeTarget', g.size_target,
             'faces', coalesce((select jsonb_agg(private.rm_person(mm.user_id)) from (
                 select mm.user_id from public.roommate_group_members mm where mm.group_id = g.id and mm.state = 'active' order by mm.joined_at limit 4) mm), '[]'::jsonb),
             'invitedBy', null) x
      from public.roommate_groups g
      left join public.roommate_group_members m on m.group_id = g.id and m.user_id = (select auth.uid())
     where (select auth.uid()) is not null
       and g.visibility = 'open' and g.stage in ('forming', 'searching')
       and coalesce(m.state, 'none') not in ('active', 'removed')
       and not private.blocked_between((select auth.uid()), g.owner_id)
       and (p_state is null or g.state_code = p_state)
       and (p_city is null or lower(g.city) = lower(p_city))
     order by g.updated_at desc
     limit 20) t;
$$;

-- ------------------------------------------------------------ schools

create or replace function public.roommate_institution_page(p_slug text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  v public.roommate_profiles;
  i public.institutions;
begin
  select * into i from public.institutions where slug = p_slug and status = 'live';
  if not found then
    return jsonb_build_object('institution', null);
  end if;
  if me is not null then
    select * into v from public.roommate_profiles where user_id = me;
  end if;
  return jsonb_build_object(
    'institution', private.rm_institution(i.id) || jsonb_build_object('emailVerifyOn', i.email_verify_on and cardinality(i.email_domains) > 0),
    'people', (select count(*) from public.roommate_profiles r where r.institution_id = i.id and r.status = 'active' and r.institution_visible),
    'roomsCount', (select count(*) from public.roommate_listings l where l.institution_id = i.id and l.status = 'live'),
    'rooms', coalesce((public.roommate_search_listings(jsonb_build_object('institutionId', i.id, 'limit', 12)) -> 'items'), '[]'::jsonb),
    'students', case when v.status = 'active'
                  then coalesce((public.roommate_discover(jsonb_build_object('institutionId', i.id, 'limit', 12)) -> 'items'), '[]'::jsonb)
                  else '[]'::jsonb end
  );
end;
$$;

-- ------------------------------------------------------------ writes: interests and connections

create or replace function public.roommate_express_interest(p_to uuid, p_listing uuid, p_note text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  mine public.roommate_profiles;
  existing public.roommate_interests;
  l public.roommate_listings;
  new_id uuid;
  my_name text;
begin
  if me is null then
    raise exception 'Sign in to use Vallo Roommates.' using errcode = 'RM300';
  end if;
  if p_to is null or p_to = me then
    raise exception 'That is you.' using errcode = 'RM300';
  end if;
  select * into mine from public.roommate_profiles where user_id = me;
  if not found or mine.status <> 'active' then
    raise exception 'Make your roommate profile live first, so they can see who you are.' using errcode = 'RM301';
  end if;
  if private.blocked_between(me, p_to) then
    raise exception 'You cannot contact this person.' using errcode = 'RM302';
  end if;
  if p_listing is not null then
    select * into l from public.roommate_listings where id = p_listing;
    if not found or l.status <> 'live' or l.owner_id <> p_to then
      raise exception 'This post is no longer available.' using errcode = 'RM303';
    end if;
  elsif not exists (select 1 from public.roommate_profiles r where r.user_id = p_to and r.status = 'active') then
    raise exception 'This person is not looking right now.' using errcode = 'RM303';
  end if;

  select * into existing from public.roommate_interests i
   where least(i.from_id, i.to_id) = least(me, p_to) and greatest(i.from_id, i.to_id) = greatest(me, p_to)
     and i.status in ('pending', 'accepted')
   limit 1;
  if found then
    if existing.status = 'accepted' then
      raise exception 'You are already connected.' using errcode = 'RM304';
    end if;
    if existing.from_id = me then
      raise exception 'You have already said you are interested. We will tell you when they answer.' using errcode = 'RM304';
    end if;
    -- They were already interested in you: a mutual yes connects you now.
    update public.roommate_interests set status = 'accepted', decided_at = now() where id = existing.id;
    my_name := private.rm_person(me) ->> 'name';
    perform private.notify_social(p_to, me, my_name || ' accepted. You are connected', 'Start a chat when you are ready.',
                                  '/roommates/p/' || me || '?from=' || me);
    return existing.id;
  end if;

  -- A declined request cannot be sent again for 30 days.
  if exists (select 1 from public.roommate_interests i
              where i.from_id = me and i.to_id = p_to and i.status = 'declined' and i.decided_at > now() - interval '30 days') then
    raise exception 'They answered not this time. You can try again later.' using errcode = 'RM305';
  end if;

  insert into public.roommate_interests (from_id, to_id, listing_id, note)
  values (me, p_to, p_listing, nullif(trim(coalesce(p_note, '')), ''))
  returning id into new_id;
  if p_listing is not null then
    update public.roommate_listings set interest_count = interest_count + 1 where id = p_listing;
  end if;
  my_name := private.rm_person(me) ->> 'name';
  perform private.notify_social(p_to, me, my_name || ' is interested in sharing a home',
                                coalesce(nullif(trim(coalesce(p_note, '')), ''), case when p_listing is not null then 'About ' || l.title else 'Open Vallo Roommates to answer.' end),
                                '/roommates/me?tab=requests&from=' || me);
  return new_id;
end;
$$;

create or replace function public.roommate_answer_interest(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  i public.roommate_interests;
  s text := case when p_accept then 'accepted' else 'declined' end;
begin
  select * into i from public.roommate_interests where id = p_id;
  if not found or i.to_id is distinct from me then
    raise exception 'That request could not be found.' using errcode = 'RM306';
  end if;
  if i.status <> 'pending' then
    raise exception 'That request has already been answered.' using errcode = 'RM306';
  end if;
  if p_accept and private.blocked_between(i.from_id, i.to_id) then
    raise exception 'You cannot connect with this person.' using errcode = 'RM302';
  end if;
  update public.roommate_interests set status = s, decided_at = now() where id = p_id;
  if p_accept then
    perform private.notify_social(i.from_id, me, (private.rm_person(me) ->> 'name') || ' accepted. You are connected',
                                  'Start a chat when you are ready.', '/roommates/p/' || me || '?from=' || me);
  end if;
  return s;
end;
$$;

create or replace function public.roommate_withdraw_interest(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.roommate_interests set status = 'withdrawn', decided_at = now()
   where id = p_id and from_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'That request could not be withdrawn.' using errcode = 'RM306';
  end if;
end;
$$;

create or replace function public.roommate_end_connection(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.roommate_interests set status = 'ended', decided_at = now()
   where id = p_id and (select auth.uid()) in (from_id, to_id) and status = 'accepted';
  if not found then
    raise exception 'That connection could not be found.' using errcode = 'RM306';
  end if;
end;
$$;

-- The chat for a mutual yes, in Vallo's own messages (a direct conversation).
create or replace function public.roommate_open_chat(p_interest uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  i public.roommate_interests;
  other uuid;
  cid uuid;
begin
  select * into i from public.roommate_interests where id = p_interest;
  if not found or me is null or me not in (i.from_id, i.to_id) or i.status <> 'accepted' then
    raise exception 'Chat opens when you are both connected.' using errcode = 'RM307';
  end if;
  other := case when i.from_id = me then i.to_id else i.from_id end;
  if private.blocked_between(me, other) then
    raise exception 'You cannot message this person.' using errcode = 'RM302';
  end if;
  select c.id into cid from public.conversations c
   where c.context_kind = 'direct'
     and least(c.guest_id, c.agent_id) = least(me, other)
     and greatest(c.guest_id, c.agent_id) = greatest(me, other)
   limit 1;
  if cid is null then
    begin
      insert into public.conversations (guest_id, agent_id, context_kind) values (me, other, 'direct') returning id into cid;
    exception when unique_violation then
      select c.id into cid from public.conversations c
       where c.context_kind = 'direct'
         and least(c.guest_id, c.agent_id) = least(me, other)
         and greatest(c.guest_id, c.agent_id) = greatest(me, other)
       limit 1;
    end;
  end if;
  update public.roommate_interests set conversation_id = cid where id = i.id and conversation_id is distinct from cid;
  return cid;
end;
$$;

-- ------------------------------------------------------------ writes: groups

-- The owner can change everything about a group except who owns it; that
-- moves only through roommate_leave_group.
create or replace function private.roommate_group_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.owner_id is distinct from old.owner_id and coalesce(current_setting('vallo.rm_transfer', true), '') <> 'on' then
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists roommate_groups_guard on public.roommate_groups;
create trigger roommate_groups_guard before update on public.roommate_groups
  for each row execute function private.roommate_group_guard();

create or replace function public.roommate_create_group(p jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  gid uuid;
begin
  if me is null then
    raise exception 'Sign in to use Vallo Roommates.' using errcode = 'RM300';
  end if;
  if (select count(*) from public.roommate_groups g where g.owner_id = me and g.stage <> 'closed') >= 5 then
    raise exception 'You already run five groups. Close one to start another.' using errcode = 'RM310';
  end if;
  insert into public.roommate_groups (owner_id, name, intro, visibility, state_code, city, areas, institution_id, bedrooms, size_target,
                                      budget_min_minor, budget_max_minor, budget_period, move_in_on)
  values (me,
          trim(p ->> 'name'),
          nullif(trim(coalesce(p ->> 'intro', '')), ''),
          coalesce(p ->> 'visibility', 'private'),
          nullif(p ->> 'stateCode', ''),
          nullif(trim(coalesce(p ->> 'city', '')), ''),
          coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'areas', '[]'::jsonb)) x where trim(x) <> ''), '{}'),
          nullif(p ->> 'institutionId', '')::uuid,
          nullif(p ->> 'bedrooms', '')::smallint,
          coalesce(nullif(p ->> 'sizeTarget', '')::smallint, 3),
          nullif(p ->> 'budgetMinMinor', '')::bigint,
          nullif(p ->> 'budgetMaxMinor', '')::bigint,
          coalesce(p ->> 'budgetPeriod', 'year'),
          nullif(p ->> 'moveInOn', '')::date)
  returning id into gid;
  insert into public.roommate_group_members (group_id, user_id, role, state, joined_at) values (gid, me, 'owner', 'active', now());
  return gid;
end;
$$;

create or replace function public.roommate_invite_to_group(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
  cur text;
begin
  select * into g from public.roommate_groups where id = p_group;
  if not found or private.roommate_group_role(p_group, me) is distinct from 'owner' then
    raise exception 'Only the group''s owner can invite.' using errcode = 'RM311';
  end if;
  if p_user is null or p_user = me or private.blocked_between(me, p_user) then
    raise exception 'You cannot invite this person.' using errcode = 'RM311';
  end if;
  if not private.roommate_connected(me, p_user) then
    raise exception 'Connect with this person on Vallo Roommates first.' using errcode = 'RM312';
  end if;
  if (select count(*) from public.roommate_group_members m where m.group_id = p_group and m.state in ('active', 'invited')) >= 8 then
    raise exception 'A group can have eight people at most.' using errcode = 'RM313';
  end if;
  select state into cur from public.roommate_group_members where group_id = p_group and user_id = p_user;
  if cur in ('active', 'invited') then
    raise exception 'They are already in the group or invited.' using errcode = 'RM314';
  end if;
  insert into public.roommate_group_members (group_id, user_id, role, state, invited_by)
  values (p_group, p_user, 'member', 'invited', me)
  on conflict (group_id, user_id) do update set state = 'invited', invited_by = me, role = 'member';
  perform private.notify_social(p_user, me, (private.rm_person(me) ->> 'name') || ' invited you to ' || g.name,
                                'Find a place together on Vallo Roommates.', '/roommates/me?tab=groups&from=' || me);
end;
$$;

create or replace function public.roommate_answer_group_invite(p_group uuid, p_accept boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
begin
  select * into g from public.roommate_groups where id = p_group;
  update public.roommate_group_members
     set state = case when p_accept then 'active' else 'declined' end,
         joined_at = case when p_accept then now() else joined_at end
   where group_id = p_group and user_id = me and state = 'invited';
  if not found then
    raise exception 'That invitation could not be found.' using errcode = 'RM315';
  end if;
  if p_accept then
    perform private.notify_social(g.owner_id, me, (private.rm_person(me) ->> 'name') || ' joined ' || g.name,
                                  'Your group is coming together.', '/roommates/groups/' || g.id || '?from=' || me);
  end if;
end;
$$;

create or replace function public.roommate_request_join_group(p_group uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
  cur text;
begin
  select * into g from public.roommate_groups where id = p_group;
  if not found or g.visibility <> 'open' or g.stage not in ('forming', 'searching') then
    raise exception 'This group is not taking requests.' using errcode = 'RM316';
  end if;
  if private.blocked_between(me, g.owner_id) then
    raise exception 'This group is not taking requests.' using errcode = 'RM316';
  end if;
  if not exists (select 1 from public.roommate_profiles r where r.user_id = me and r.status = 'active') then
    raise exception 'Make your roommate profile live first, so the group can see who you are.' using errcode = 'RM301';
  end if;
  select state into cur from public.roommate_group_members where group_id = p_group and user_id = me;
  if cur in ('active', 'requested', 'invited') then
    raise exception 'You have already asked, or you are in the group.' using errcode = 'RM314';
  end if;
  if cur = 'removed' then
    raise exception 'This group is not taking requests.' using errcode = 'RM316';
  end if;
  insert into public.roommate_group_members (group_id, user_id, role, state)
  values (p_group, me, 'member', 'requested')
  on conflict (group_id, user_id) do update set state = 'requested';
  perform private.notify_social(g.owner_id, me, (private.rm_person(me) ->> 'name') || ' asked to join ' || g.name,
                                'Open the group to answer.', '/roommates/groups/' || g.id || '?from=' || me);
end;
$$;

create or replace function public.roommate_answer_join_request(p_group uuid, p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
begin
  select * into g from public.roommate_groups where id = p_group;
  if not found or private.roommate_group_role(p_group, me) is distinct from 'owner' then
    raise exception 'Only the group''s owner can answer.' using errcode = 'RM311';
  end if;
  update public.roommate_group_members
     set state = case when p_accept then 'active' else 'declined' end,
         joined_at = case when p_accept then now() else joined_at end
   where group_id = p_group and user_id = p_user and state = 'requested';
  if not found then
    raise exception 'That request could not be found.' using errcode = 'RM315';
  end if;
  if p_accept then
    perform private.notify_social(p_user, me, 'You are in ' || g.name, 'Say hello on the group board.', '/roommates/groups/' || g.id || '?from=' || me);
  end if;
end;
$$;

create or replace function public.roommate_leave_group(p_group uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  heir uuid;
begin
  if private.roommate_group_role(p_group, me) is null then
    raise exception 'You are not in this group.' using errcode = 'RM315';
  end if;
  if private.roommate_group_role(p_group, me) = 'owner' then
    select m.user_id into heir from public.roommate_group_members m
     where m.group_id = p_group and m.state = 'active' and m.user_id <> me
     order by m.joined_at nulls last limit 1;
    if heir is null then
      update public.roommate_groups set stage = 'closed' where id = p_group;
    else
      perform set_config('vallo.rm_transfer', 'on', true);
      update public.roommate_groups set owner_id = heir where id = p_group;
      perform set_config('vallo.rm_transfer', 'off', true);
      update public.roommate_group_members set role = 'owner' where group_id = p_group and user_id = heir;
    end if;
  end if;
  update public.roommate_group_members set state = 'left', role = 'member' where group_id = p_group and user_id = me;
end;
$$;

create or replace function public.roommate_remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
begin
  if private.roommate_group_role(p_group, me) is distinct from 'owner' or p_user = me then
    raise exception 'Only the group''s owner can remove someone.' using errcode = 'RM311';
  end if;
  update public.roommate_group_members set state = 'removed' where group_id = p_group and user_id = p_user and state in ('active', 'invited', 'requested');
  if not found then
    raise exception 'That person is not in the group.' using errcode = 'RM315';
  end if;
end;
$$;

create or replace function public.roommate_set_share(p_group uuid, p_user uuid, p_percent numeric)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if private.roommate_group_role(p_group, (select auth.uid())) is distinct from 'owner' then
    raise exception 'Only the group''s owner can set shares.' using errcode = 'RM311';
  end if;
  update public.roommate_group_members set share_percent = p_percent where group_id = p_group and user_id = p_user and state = 'active';
  if not found then
    raise exception 'That person is not in the group.' using errcode = 'RM315';
  end if;
end;
$$;

create or replace function public.roommate_post_to_group(p_group uuid, p_body text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g public.roommate_groups;
  pid uuid;
  m record;
  my_name text;
begin
  select * into g from public.roommate_groups where id = p_group;
  if not found or private.roommate_group_role(p_group, me) is null then
    raise exception 'Only the group''s members can post here.' using errcode = 'RM315';
  end if;
  insert into public.roommate_group_posts (group_id, author_id, body) values (p_group, me, trim(p_body)) returning id into pid;
  my_name := private.rm_person(me) ->> 'name';
  for m in select user_id from public.roommate_group_members where group_id = p_group and state = 'active' and user_id <> me loop
    perform private.notify_social(m.user_id, me, my_name || ' posted in ' || g.name, left(trim(p_body), 140), '/roommates/groups/' || g.id || '?from=' || me);
  end loop;
  return pid;
end;
$$;

-- ------------------------------------------------------------ writes: viewings

create or replace function public.roommate_request_viewing(p_listing uuid, p_mode text, p_at timestamptz, p_alt timestamptz, p_note text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  l public.roommate_listings;
  vid uuid;
begin
  if me is null then
    raise exception 'Sign in to use Vallo Roommates.' using errcode = 'RM300';
  end if;
  select * into l from public.roommate_listings where id = p_listing;
  if not found or l.status <> 'live' then
    raise exception 'This post is no longer available.' using errcode = 'RM303';
  end if;
  if l.owner_id = me then
    raise exception 'This is your own post.' using errcode = 'RM320';
  end if;
  if private.blocked_between(me, l.owner_id) then
    raise exception 'You cannot contact this person.' using errcode = 'RM302';
  end if;
  if p_at is null or p_at < now() + interval '30 minutes' then
    raise exception 'Choose a time at least half an hour from now.' using errcode = 'RM321';
  end if;
  if exists (select 1 from public.roommate_viewings rv where rv.listing_id = p_listing and rv.requester_id = me and rv.status in ('requested', 'confirmed')) then
    raise exception 'You already have a viewing for this room.' using errcode = 'RM322';
  end if;
  insert into public.roommate_viewings (listing_id, requester_id, host_id, mode, proposed_at, alt_at, note)
  values (p_listing, me, l.owner_id, coalesce(p_mode, 'in_person'), p_at, p_alt, nullif(trim(coalesce(p_note, '')), ''))
  returning id into vid;
  perform private.notify_social(l.owner_id, me, (private.rm_person(me) ->> 'name') || ' asked to view your room',
                                l.title, '/roommates/me?tab=viewings&from=' || me);
  return vid;
end;
$$;

create or replace function public.roommate_answer_viewing(p_id uuid, p_confirm boolean, p_at timestamptz)
returns text language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  rv public.roommate_viewings;
  s text := case when p_confirm then 'confirmed' else 'declined' end;
begin
  select * into rv from public.roommate_viewings where id = p_id;
  if not found or rv.host_id is distinct from me then
    raise exception 'That viewing could not be found.' using errcode = 'RM323';
  end if;
  if rv.status not in ('requested', 'confirmed') then
    raise exception 'That viewing has already been settled.' using errcode = 'RM323';
  end if;
  if p_at is not null and p_at < now() + interval '30 minutes' then
    raise exception 'Choose a time at least half an hour from now.' using errcode = 'RM321';
  end if;
  update public.roommate_viewings
     set status = s,
         proposed_at = coalesce(p_at, proposed_at),
         confirmed_at = case when p_confirm then now() else confirmed_at end,
         decided_at = now()
   where id = p_id;
  perform private.notify_social(rv.requester_id, me,
    case when p_confirm then 'Your viewing is confirmed' else 'Your viewing was not accepted' end,
    case when p_confirm then to_char(coalesce(p_at, rv.proposed_at) at time zone 'Africa/Lagos', 'Dy DD Mon, HH24:MI') else 'You can ask for another time.' end,
    '/roommates/me?tab=viewings&from=' || me);
  return s;
end;
$$;

create or replace function public.roommate_cancel_viewing(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  rv public.roommate_viewings;
begin
  select * into rv from public.roommate_viewings where id = p_id;
  if not found or me not in (rv.host_id, rv.requester_id) or rv.status not in ('requested', 'confirmed') then
    raise exception 'That viewing could not be cancelled.' using errcode = 'RM323';
  end if;
  update public.roommate_viewings set status = 'cancelled', decided_at = now() where id = p_id;
  perform private.notify_social(case when me = rv.host_id then rv.requester_id else rv.host_id end, me,
                                'A viewing was cancelled', 'Open Vallo Roommates to arrange another.', '/roommates/me?tab=viewings&from=' || me);
end;
$$;

create or replace function public.roommate_viewing_done(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.roommate_viewings set status = 'done', decided_at = now()
   where id = p_id and (select auth.uid()) in (host_id, requester_id) and status = 'confirmed' and proposed_at < now();
  if not found then
    raise exception 'That viewing cannot be marked as done yet.' using errcode = 'RM323';
  end if;
end;
$$;

-- ------------------------------------------------------------ views, alerts, expiry

create or replace function public.roommate_record_view(p_listing uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return;
  end if;
  if exists (select 1 from public.roommate_listings l where l.id = p_listing and l.owner_id <> me and l.status = 'live') then
    begin
      if private.consume_rate_limit('rm_view:' || p_listing, me::text, 1, 86400) then
        update public.roommate_listings set view_count = view_count + 1 where id = p_listing;
      end if;
    exception when others then
      return;
    end;
  end if;
end;
$$;

-- A room post going live tells the people whose saved search it matches
-- (at most one alert per search every six hours).
create or replace function private.roommate_alert_searches()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  s record;
  price numeric;
begin
  if new.status <> 'live' or (tg_op = 'UPDATE' and old.status = 'live') then
    return new;
  end if;
  price := private.rm_monthly(coalesce(new.share_minor, new.rent_minor), new.rent_period);
  for s in
    select ss.* from public.roommate_saved_searches ss
     where ss.alert and ss.user_id <> new.owner_id
       and (ss.kind is null or ss.kind = new.kind)
       and (ss.state_code is null or ss.state_code = new.state_code)
       and (ss.city is null or lower(ss.city) = lower(new.city) or lower(ss.city) = lower(coalesce(new.area, '')))
       and (ss.institution_id is null or ss.institution_id = new.institution_id)
       and (ss.max_minor is null or price is null or price <= private.rm_monthly(ss.max_minor, ss.period))
       and (ss.last_alert_at is null or ss.last_alert_at < now() - interval '6 hours')
       and not private.blocked_between(ss.user_id, new.owner_id)
     limit 200
  loop
    perform private.notify(s.user_id, 'listing', 'A new post matches "' || s.label || '"', new.title, '/roommates/r/' || new.id || '?from=' || new.owner_id);
    update public.roommate_saved_searches set last_alert_at = now() where id = s.id;
  end loop;
  return new;
end;
$$;
drop trigger if exists roommate_listings_alerts on public.roommate_listings;
create trigger roommate_listings_alerts after insert or update of status on public.roommate_listings
  for each row execute function private.roommate_alert_searches();

create or replace function private.roommate_expire_listings()
returns integer language plpgsql security definer set search_path to '' as $$
declare
  n integer;
begin
  update public.roommate_listings set status = 'expired' where status = 'live' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  update public.roommate_verifications set status = 'expired' where status = 'verified' and expires_at is not null and expires_at < now();
  update public.roommate_verifications set status = 'expired' where status = 'pending' and created_at < now() - interval '1 day';
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'vallo-roommates-expire';
    perform cron.schedule('vallo-roommates-expire', '17 3 * * *', 'select private.roommate_expire_listings()');
  end if;
end;
$$;

-- ------------------------------------------------------------ grants

revoke all on function private.rm_monthly(bigint, text) from public, anon;
revoke all on function private.rm_person(uuid) from public, anon;
revoke all on function private.rm_badges(uuid) from public, anon;
revoke all on function private.rm_institution(uuid) from public, anon;
revoke all on function private.rm_lower_overlap(text[], text[]) from public, anon;
revoke all on function private.rm_gender_ok(public.roommate_profiles, public.roommate_profiles) from public, anon;
revoke all on function private.roommate_match(public.roommate_profiles, public.roommate_profiles) from public, anon, authenticated;
revoke all on function private.roommate_listing_match(public.roommate_profiles, public.roommate_listings) from public, anon, authenticated;
revoke all on function private.rm_card(public.roommate_profiles, public.roommate_profiles) from public, anon, authenticated;
revoke all on function private.rm_room_card(public.roommate_listings, public.roommate_profiles) from public, anon, authenticated;
revoke all on function private.rm_connection(uuid, uuid) from public, anon, authenticated;
revoke all on function private.rm_shortlist_target(public.roommate_group_shortlist) from public, anon, authenticated;
revoke all on function private.roommate_expire_listings() from public, anon, authenticated;

revoke all on function public.roommate_discover(jsonb) from public, anon;
revoke all on function public.roommate_profile_view(uuid) from public, anon;
revoke all on function public.roommate_my_hub() from public, anon;
revoke all on function public.roommate_my_connections() from public, anon;
revoke all on function public.roommate_group_view(uuid) from public, anon;
revoke all on function public.roommate_open_groups(text, text) from public, anon;
revoke all on function public.roommate_express_interest(uuid, uuid, text) from public, anon;
revoke all on function public.roommate_answer_interest(uuid, boolean) from public, anon;
revoke all on function public.roommate_withdraw_interest(uuid) from public, anon;
revoke all on function public.roommate_end_connection(uuid) from public, anon;
revoke all on function public.roommate_open_chat(uuid) from public, anon;
revoke all on function public.roommate_create_group(jsonb) from public, anon;
revoke all on function public.roommate_invite_to_group(uuid, uuid) from public, anon;
revoke all on function public.roommate_answer_group_invite(uuid, boolean) from public, anon;
revoke all on function public.roommate_request_join_group(uuid) from public, anon;
revoke all on function public.roommate_answer_join_request(uuid, uuid, boolean) from public, anon;
revoke all on function public.roommate_leave_group(uuid) from public, anon;
revoke all on function public.roommate_remove_member(uuid, uuid) from public, anon;
revoke all on function public.roommate_set_share(uuid, uuid, numeric) from public, anon;
revoke all on function public.roommate_post_to_group(uuid, text) from public, anon;
revoke all on function public.roommate_request_viewing(uuid, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.roommate_answer_viewing(uuid, boolean, timestamptz) from public, anon;
revoke all on function public.roommate_cancel_viewing(uuid) from public, anon;
revoke all on function public.roommate_viewing_done(uuid) from public, anon;
revoke all on function public.roommate_record_view(uuid) from public, anon;

grant execute on function public.roommate_discover(jsonb) to authenticated;
grant execute on function public.roommate_profile_view(uuid) to authenticated;
grant execute on function public.roommate_my_hub() to authenticated;
grant execute on function public.roommate_my_connections() to authenticated;
grant execute on function public.roommate_group_view(uuid) to authenticated;
grant execute on function public.roommate_open_groups(text, text) to authenticated;
grant execute on function public.roommate_express_interest(uuid, uuid, text) to authenticated;
grant execute on function public.roommate_answer_interest(uuid, boolean) to authenticated;
grant execute on function public.roommate_withdraw_interest(uuid) to authenticated;
grant execute on function public.roommate_end_connection(uuid) to authenticated;
grant execute on function public.roommate_open_chat(uuid) to authenticated;
grant execute on function public.roommate_create_group(jsonb) to authenticated;
grant execute on function public.roommate_invite_to_group(uuid, uuid) to authenticated;
grant execute on function public.roommate_answer_group_invite(uuid, boolean) to authenticated;
grant execute on function public.roommate_request_join_group(uuid) to authenticated;
grant execute on function public.roommate_answer_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.roommate_leave_group(uuid) to authenticated;
grant execute on function public.roommate_remove_member(uuid, uuid) to authenticated;
grant execute on function public.roommate_set_share(uuid, uuid, numeric) to authenticated;
grant execute on function public.roommate_post_to_group(uuid, text) to authenticated;
grant execute on function public.roommate_request_viewing(uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.roommate_answer_viewing(uuid, boolean, timestamptz) to authenticated;
grant execute on function public.roommate_cancel_viewing(uuid) to authenticated;
grant execute on function public.roommate_viewing_done(uuid) to authenticated;
grant execute on function public.roommate_record_view(uuid) to authenticated;

-- Public reads: room posts and schools open on the web for shared links.
grant execute on function public.roommate_search_listings(jsonb) to anon, authenticated;
grant execute on function public.roommate_listing_view(uuid) to anon, authenticated;
grant execute on function public.roommate_home() to anon, authenticated;
grant execute on function public.roommate_institution_page(text) to anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> roommates_3_integrations.sql

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> roommates_5_institutions.sql

-- VALLO ROOMMATES, PART 5: THE SCHOOLS DIRECTORY (first list).
--
-- 55 Nigerian universities, polytechnics and colleges to start with. Staff add
-- more from the admin desk (/admin/roommates, Schools). Each email domain was
-- checked on 8 November 2026 against a public source: the page title served
-- on that domain, or the official site named by the school, Wikipedia or the
-- NUC. School email checks are switched ON only where the domain was
-- confirmed; the others verify by student ID until staff confirm a domain.
-- A subdomain counts (a student address like name@live.unilag.edu.ng fits
-- unilag.edu.ng). Existing rows are never overwritten: staff edits win.

insert into public.institutions (slug, name, short_name, kind, state_code, city, email_domains, email_verify_on) values
  ('university-of-lagos', 'University of Lagos', 'UNILAG', 'university', 'LA', 'Akoka, Yaba', '{unilag.edu.ng}', true),
  ('lagos-state-university', 'Lagos State University', 'LASU', 'university', 'LA', 'Ojo', '{lasu.edu.ng}', true),
  ('yaba-college-of-technology', 'Yaba College of Technology', 'YABATECH', 'polytechnic', 'LA', 'Yaba', '{yabatech.edu.ng}', true),
  ('pan-atlantic-university', 'Pan-Atlantic University', 'PAU', 'university', 'LA', 'Ibeju-Lekki', '{pau.edu.ng}', true),
  ('caleb-university', 'Caleb University', 'Caleb', 'university', 'LA', 'Imota', '{calebuniversity.edu.ng}', true),
  ('lagos-state-university-of-science-and-technology', 'Lagos State University of Science and Technology', 'LASUSTECH', 'university', 'LA', 'Ikorodu', '{lasustech.edu.ng}', true),
  ('covenant-university', 'Covenant University', 'CU', 'university', 'OG', 'Ota', '{covenantuniversity.edu.ng}', true),
  ('babcock-university', 'Babcock University', 'Babcock', 'university', 'OG', 'Ilishan-Remo', '{babcock.edu.ng}', true),
  ('federal-university-of-agriculture-abeokuta', 'Federal University of Agriculture, Abeokuta', 'FUNAAB', 'university', 'OG', 'Abeokuta', '{funaab.edu.ng}', true),
  ('olabisi-onabanjo-university', 'Olabisi Onabanjo University', 'OOU', 'university', 'OG', 'Ago-Iwoye', '{oouagoiwoye.edu.ng}', true),
  ('university-of-ibadan', 'University of Ibadan', 'UI', 'university', 'OY', 'Ibadan', '{ui.edu.ng}', true),
  ('ladoke-akintola-university-of-technology', 'Ladoke Akintola University of Technology', 'LAUTECH', 'university', 'OY', 'Ogbomoso', '{lautech.edu.ng}', true),
  ('the-polytechnic-ibadan', 'The Polytechnic, Ibadan', 'Poly Ibadan', 'polytechnic', 'OY', 'Ibadan', '{polyibadan.edu.ng}', true),
  ('obafemi-awolowo-university', 'Obafemi Awolowo University', 'OAU', 'university', 'OS', 'Ile-Ife', '{oauife.edu.ng}', true),
  ('federal-university-of-technology-akure', 'Federal University of Technology, Akure', 'FUTA', 'university', 'ON', 'Akure', '{futa.edu.ng}', true),
  ('ekiti-state-university', 'Ekiti State University', 'EKSU', 'university', 'EK', 'Ado-Ekiti', '{eksu.edu.ng}', true),
  ('university-of-ilorin', 'University of Ilorin', 'UNILORIN', 'university', 'KW', 'Ilorin', '{unilorin.edu.ng}', true),
  ('kwara-state-polytechnic', 'Kwara State Polytechnic', 'Kwara Poly', 'polytechnic', 'KW', 'Ilorin', '{kwarastatepolytechnic.edu.ng}', true),
  ('university-of-benin', 'University of Benin', 'UNIBEN', 'university', 'ED', 'Benin City', '{uniben.edu}', true),
  ('ambrose-alli-university', 'Ambrose Alli University', 'AAU', 'university', 'ED', 'Ekpoma', '{aauekpoma.edu.ng}', true),
  ('delta-state-university', 'Delta State University', 'DELSU', 'university', 'DE', 'Abraka', '{delsu.edu.ng}', true),
  ('university-of-nigeria-nsukka', 'University of Nigeria, Nsukka', 'UNN', 'university', 'EN', 'Nsukka', '{unn.edu.ng}', true),
  ('enugu-state-university-of-science-and-technology', 'Enugu State University of Science and Technology', 'ESUT', 'university', 'EN', 'Enugu', '{esut.edu.ng}', true),
  ('institute-of-management-and-technology', 'Institute of Management and Technology', 'IMT', 'polytechnic', 'EN', 'Enugu', '{imt.edu.ng}', true),
  ('nnamdi-azikiwe-university', 'Nnamdi Azikiwe University', 'UNIZIK', 'university', 'AN', 'Awka', '{unizik.edu.ng}', true),
  ('federal-university-of-technology-owerri', 'Federal University of Technology, Owerri', 'FUTO', 'university', 'IM', 'Owerri', '{futo.edu.ng}', true),
  ('imo-state-university', 'Imo State University', 'IMSU', 'university', 'IM', 'Owerri', '{imsu.edu.ng}', true),
  ('abia-state-university', 'Abia State University', 'ABSU', 'university', 'AB', 'Uturu', '{abiastateuniversity.edu.ng}', true),
  ('michael-okpara-university-of-agriculture', 'Michael Okpara University of Agriculture', 'MOUAU', 'university', 'AB', 'Umudike', '{mouau.edu.ng}', true),
  ('university-of-port-harcourt', 'University of Port Harcourt', 'UNIPORT', 'university', 'RI', 'Choba', '{uniport.edu.ng}', true),
  ('rivers-state-university', 'Rivers State University', 'RSU', 'university', 'RI', 'Port Harcourt', '{rsu.edu.ng}', true),
  ('university-of-calabar', 'University of Calabar', 'UNICAL', 'university', 'CR', 'Calabar', '{unical.edu.ng}', true),
  ('university-of-uyo', 'University of Uyo', 'UNIUYO', 'university', 'AK', 'Uyo', '{uniuyo.edu.ng}', true),
  ('niger-delta-university', 'Niger Delta University', 'NDU', 'university', 'BY', 'Amassoma', '{ndu.edu.ng}', true),
  ('university-of-abuja', 'University of Abuja', 'UNIABUJA', 'university', 'FC', 'Gwagwalada', '{uniabuja.edu.ng}', true),
  ('baze-university', 'Baze University', 'Baze', 'university', 'FC', 'Abuja', '{bazeuniversity.edu.ng}', true),
  ('nile-university-of-nigeria', 'Nile University of Nigeria', 'Nile', 'university', 'FC', 'Abuja', '{nileuniversity.edu.ng}', true),
  ('veritas-university', 'Veritas University', 'Veritas', 'university', 'FC', 'Bwari', '{veritas.edu.ng}', true),
  ('ahmadu-bello-university', 'Ahmadu Bello University', 'ABU', 'university', 'KD', 'Zaria', '{abu.edu.ng}', true),
  ('kaduna-state-university', 'Kaduna State University', 'KASU', 'university', 'KD', 'Kaduna', '{kasu.edu.ng}', true),
  ('kaduna-polytechnic', 'Kaduna Polytechnic', 'Kadpoly', 'polytechnic', 'KD', 'Kaduna', '{kadunapolytechnic.edu.ng}', false),
  ('bayero-university-kano', 'Bayero University Kano', 'BUK', 'university', 'KN', 'Kano', '{buk.edu.ng}', true),
  ('university-of-jos', 'University of Jos', 'UNIJOS', 'university', 'PL', 'Jos', '{unijos.edu.ng}', true),
  ('federal-university-of-technology-minna', 'Federal University of Technology, Minna', 'FUTMINNA', 'university', 'NI', 'Minna', '{futminna.edu.ng}', true),
  ('university-of-maiduguri', 'University of Maiduguri', 'UNIMAID', 'university', 'BO', 'Maiduguri', '{unimaid.edu.ng}', true),
  ('usmanu-danfodiyo-university', 'Usmanu Danfodiyo University', 'UDUS', 'university', 'SO', 'Sokoto', '{udusok.edu.ng}', true),
  ('modibbo-adama-university', 'Modibbo Adama University', 'MAU', 'university', 'AD', 'Yola', '{mau.edu.ng}', true),
  ('joseph-sarwuan-tarka-university-makurdi', 'Joseph Sarwuan Tarka University, Makurdi', 'FUAM', 'university', 'BE', 'Makurdi', '{}', false),
  ('rev-fr-moses-orshio-adasu-university-makurdi', 'Rev. Fr. Moses Orshio Adasu University, Makurdi', 'BSU', 'university', 'BE', 'Makurdi', '{bsum.edu.ng}', true),
  ('federal-polytechnic-nekede', 'Federal Polytechnic Nekede', 'Nekede Poly', 'polytechnic', 'IM', 'Owerri', '{fpno.edu.ng}', false),
  ('auchi-polytechnic', 'Auchi Polytechnic', 'Auchi Poly', 'polytechnic', 'ED', 'Auchi', '{auchipoly.edu.ng}', true),
  ('federal-polytechnic-ilaro', 'Federal Polytechnic Ilaro', 'Ilaro Poly', 'polytechnic', 'OG', 'Ilaro', '{federalpolyilaro.edu.ng}', true),
  ('lagos-state-university-college-of-medicine', 'Lagos State University College of Medicine', 'LASUCOM', 'college', 'LA', 'Ikeja', '{lasucom.edu.ng}', true),
  ('federal-college-of-education-technical-akoka', 'Federal College of Education (Technical), Akoka', 'FCE Akoka', 'college', 'LA', 'Akoka', '{}', false),
  ('adeniran-ogunsanya-college-of-education', 'Adeniran Ogunsanya College of Education', 'AOCOED', 'college', 'LA', 'Otto-Ijanikin', '{aocoed.edu.ng}', false)
on conflict (slug) do nothing;

commit;
