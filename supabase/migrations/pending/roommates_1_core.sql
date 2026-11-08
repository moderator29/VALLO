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
