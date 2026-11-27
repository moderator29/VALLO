-- ONE HUNDRED EXAMPLE LISTINGS, so the catalogue is not empty while real
-- supply is recruited. Founder's brief, 26 November 2026: "fill the empty
-- platform with 100 clearly labelled EXAMPLE listings that look real".
--
-- WHAT IT ADDS, all of it is_demo = true:
--   40 yearly tenancies   public.listings, property_type 'rental'
--   25 shortlets          public.listings, property_type 'shortlet'
--   20 places to stay     public.businesses + accommodations + room types
--   15 restaurants        public.businesses + restaurant_profiles + windows
--  415 photographs        Unsplash, hotlinked, each credited to its photographer
--
-- REVERSIBLE BY is_demo, exactly as the set deleted on 16 November was. Every
-- business, accommodation, room type, rate plan, calendar row, inventory row,
-- photo, amenity link, restaurant profile and service window hangs off a
-- demo parent by cascading foreign key, so
--
--   delete from public.conversations c using public.listings l
--    where l.id = c.listing_id and l.is_demo;
--   delete from public.listings where is_demo;
--   delete from public.room_types where is_demo;
--   delete from public.accommodations where is_demo;
--   delete from public.businesses where is_demo;
--   delete from public.catalogue_entries where is_demo;
--
-- takes the whole thing down again. supabase/drafts/delete_demo_data_2026-11-16.sql
-- is that file, and it still works against this set unchanged.
--
-- THE OWNER IS A NEW ACCOUNT OF ITS OWN, and that is the point of this file
-- as much as the rows are. The "Vallo Examples" agent on the live project
-- today (e0000000-0000-4000-8000-000000000002) hangs off
-- phantomfcalls+qamember@gmail.com, which is a QA account of the founder's:
-- read live, read-only, on 26 November. An example listed by a QA account is
-- a real person's account standing behind a property that does not exist. So
-- this file creates e0000000-0000-4000-8000-000000000001
-- ("Vallo Examples", examples@vallo.ng, no password, no sign-in) and agent
-- e0000000-0000-4000-8000-000000000003 on it, and lists all 100 there.
-- The stale QA-backed agent is LEFT ALONE: it owns nothing now, and deleting
-- another account's row is the founder's call, not this file's. It is worth
-- retiring separately so two agents do not both read "Vallo Examples".
--
-- NOTHING EARNS A BADGE. The agent is is_demo with verification_tier 0, which
-- `agents_demo_is_never_verified` enforces and which
-- `enforce_demo_listing_has_unverified_lister` checks on every row. The demo
-- predicate also exempts the publish gates on purpose, each in its own words:
-- b3_rate_agreement_gate, edd_gate and listing_supply_proof_gate all return
-- early on is_demo, so these rows go live without a fee acceptance, an EDD
-- clearance or a mandate, and no real one ever can.
--
-- RETIREMENT. demo_retire_after is written as 2027-05-07 on every listing,
-- the date in lib/listings/retirement.ts, rather than the current_date + 90
-- the trigger would stamp. The code and the rows then say the same day.
--
-- PHOTOGRAPHS ARE HOTLINKED FROM images.unsplash.com, which the app already
-- allows in next.config.ts remotePatterns, in lib/security/csp.ts img-src and
-- in lib/images/optimisable.ts. Unsplash's API terms require hotlinking rather
-- than copying the files onto our own server, and require the photographer to
-- be credited, so section 2 adds public.photo_credits and section 10 fills it:
-- one row per photograph with the photographer's name and the two links
-- Unsplash asks for. The ixid on each URL is kept because that is what
-- attributes the view to this application.
--
-- SECTION 2 ALSO NARROWS ONE CONSTRAINT, and it is the only schema change in
-- this file. listing_photos, accommodation_photos and business_photos each
-- carry `*_path_not_url`, added on 29 September so that "an absolute or
-- protocol-relative value" could not make "the server fetch, and every viewer
-- load, an address the lister chose". That reason is sound and survives: the
-- check is rewritten to refuse every scheme and host as before, with one
-- literal exception for https://images.unsplash.com/. A lister still cannot
-- write an address of their own choosing.
--
-- NO PERSON IS PART OF A LISTING (founder, 26 November 2026). A listing shows
-- the property, so every photograph with a person in it was dropped, down to
-- the small figures crossing a hotel lobby in the distance.
--
-- AND NO REAL BRAND, for the same reason the names here are invented: a
-- Domino's sign behind "Lekki Suya Garden" attaches a real company to a
-- restaurant that does not exist, which is the same error as a real person's
-- name on an invented hotel. Three photographs of a Lagos mall food court went
-- for this, and they were the best Nigerian restaurant interiors in the set.
--
-- BOTH WERE FOUND BY AUDITING THE SET THAT ACTUALLY LANDED IN THE DATABASE
-- rather than the set that was picked, which is the only audit that counts.
-- The first pass of this file shipped a lobby with people in it and those
-- three branded counters, because the pick list was checked and the result
-- was not.
--
-- WHICH PHOTOGRAPH GOES ON WHICH ROW was chosen by looking, not by keyword.
-- lib/listings/example-imagery.ts is the standing rule and it is obeyed:
-- a modest example wears ordinary imagery, never an aspirational render, so
-- "Mini flat in Oke Ilewo" shows a plain bedroom and a tiled bathroom and not
-- a villa at sunset. Candidates were searched per room, reviewed as contact
-- sheets, and anything that showed a person, a building site, a drone view of
-- a district, a 3D render, a derelict house, a gate with no house behind it or
-- a sliver of roof against open sky was dropped. A house wears a photograph of
-- a real house, seen from its gate or its compound, the way one is actually
-- seen in Nigeria. Nigerian
-- photographers and Nigerian places are ordered first within every set, so
-- they take the cover, but a photograph that does not show the room is not a
-- listing photograph whoever took it: Unsplash's Nigerian catalogue is
-- street and portrait work, and it has almost no Nigerian interiors at all.
-- Of the photographers used, the Nigeria-based ones carry the restaurants,
-- the food, a hotel pool and a block of flats.
--
-- MONEY IS INTEGER KOBO, and every naira figure is cast to bigint before it is
-- multiplied: a VALUES literal types as integer, and an eighteen million naira
-- rent times a hundred overflows it.
--
-- THE MOVE-IN BREAKDOWN IS DERIVED HERE, not typed: caution a fifth of the
-- rent, agency and legal a tenth each, agreement and the service charge a
-- twentieth each, and the total one and a half times the rent. The parts and
-- the total can then never disagree, which is the whole reason that breakdown
-- is worth trusting.
--
-- SAFE TO RUN TWICE. Every insert ends in `on conflict do nothing` on its
-- natural key, and section 11 refuses to commit unless the counts come out
-- right.
--
-- TESTED, NOT GUESSED: applied and counted on a local Postgres 16 built from
-- all 778 migrations in this repository. It has NOT been run against
-- uccixoonmbhrnyczyigt; the founder runs it.
--
-- Run it in the Supabase SQL editor as one paste.

begin;

do $before$
begin
  raise notice 'before: % listings (% demo), % stays, % businesses, % catalogue rows',
    (select count(*) from public.listings),
    (select count(*) from public.listings where is_demo),
    (select count(*) from public.accommodations),
    (select count(*) from public.businesses),
    (select count(*) from public.catalogue_entries);
end;
$before$;


-- PART 1 of 4: the account, the credits table and the 91 photographs. Run the four parts in order.

begin;

-- ONE HUNDRED EXAMPLE LISTINGS, so the catalogue is not empty while real
-- supply is recruited. Founder's brief, 26 November 2026: "fill the empty
-- platform with 100 clearly labelled EXAMPLE listings that look real".
--
-- WHAT IT ADDS, all of it is_demo = true:
--   40 yearly tenancies   public.listings, property_type 'rental'
--   25 shortlets          public.listings, property_type 'shortlet'
--   20 places to stay     public.businesses + accommodations + room types
--   15 restaurants        public.businesses + restaurant_profiles + windows
--  415 photographs        Unsplash, hotlinked, each credited to its photographer
--
-- REVERSIBLE BY is_demo, exactly as the set deleted on 16 November was. Every
-- business, accommodation, room type, rate plan, calendar row, inventory row,
-- photo, amenity link, restaurant profile and service window hangs off a
-- demo parent by cascading foreign key, so
--
--   delete from public.conversations c using public.listings l
--    where l.id = c.listing_id and l.is_demo;
--   delete from public.listings where is_demo;
--   delete from public.room_types where is_demo;
--   delete from public.accommodations where is_demo;
--   delete from public.businesses where is_demo;
--   delete from public.catalogue_entries where is_demo;
--
-- takes the whole thing down again. supabase/drafts/delete_demo_data_2026-11-16.sql
-- is that file, and it still works against this set unchanged.
--
-- THE OWNER IS A NEW ACCOUNT OF ITS OWN, and that is the point of this file
-- as much as the rows are. The "Vallo Examples" agent on the live project
-- today (e0000000-0000-4000-8000-000000000002) hangs off
-- phantomfcalls+qamember@gmail.com, which is a QA account of the founder's:
-- read live, read-only, on 26 November. An example listed by a QA account is
-- a real person's account standing behind a property that does not exist. So
-- this file creates e0000000-0000-4000-8000-000000000001
-- ("Vallo Examples", examples@vallo.ng, no password, no sign-in) and agent
-- e0000000-0000-4000-8000-000000000003 on it, and lists all 100 there.
-- The stale QA-backed agent is LEFT ALONE: it owns nothing now, and deleting
-- another account's row is the founder's call, not this file's. It is worth
-- retiring separately so two agents do not both read "Vallo Examples".
--
-- NOTHING EARNS A BADGE. The agent is is_demo with verification_tier 0, which
-- `agents_demo_is_never_verified` enforces and which
-- `enforce_demo_listing_has_unverified_lister` checks on every row. The demo
-- predicate also exempts the publish gates on purpose, each in its own words:
-- b3_rate_agreement_gate, edd_gate and listing_supply_proof_gate all return
-- early on is_demo, so these rows go live without a fee acceptance, an EDD
-- clearance or a mandate, and no real one ever can.
--
-- RETIREMENT. demo_retire_after is written as 2027-05-07 on every listing,
-- the date in lib/listings/retirement.ts, rather than the current_date + 90
-- the trigger would stamp. The code and the rows then say the same day.
--
-- PHOTOGRAPHS ARE HOTLINKED FROM images.unsplash.com, which the app already
-- allows in next.config.ts remotePatterns, in lib/security/csp.ts img-src and
-- in lib/images/optimisable.ts. Unsplash's API terms require hotlinking rather
-- than copying the files onto our own server, and require the photographer to
-- be credited, so section 2 adds public.photo_credits and section 10 fills it:
-- one row per photograph with the photographer's name and the two links
-- Unsplash asks for. The ixid on each URL is kept because that is what
-- attributes the view to this application.
--
-- SECTION 2 ALSO NARROWS ONE CONSTRAINT, and it is the only schema change in
-- this file. listing_photos, accommodation_photos and business_photos each
-- carry `*_path_not_url`, added on 29 September so that "an absolute or
-- protocol-relative value" could not make "the server fetch, and every viewer
-- load, an address the lister chose". That reason is sound and survives: the
-- check is rewritten to refuse every scheme and host as before, with one
-- literal exception for https://images.unsplash.com/. A lister still cannot
-- write an address of their own choosing.
--
-- NO PERSON IS PART OF A LISTING (founder, 26 November 2026). A listing shows
-- the property, so every photograph with a person in it was dropped, down to
-- the small figures crossing a hotel lobby in the distance.
--
-- AND NO REAL BRAND, for the same reason the names here are invented: a
-- Domino's sign behind "Lekki Suya Garden" attaches a real company to a
-- restaurant that does not exist, which is the same error as a real person's
-- name on an invented hotel. Three photographs of a Lagos mall food court went
-- for this, and they were the best Nigerian restaurant interiors in the set.
--
-- BOTH WERE FOUND BY AUDITING THE SET THAT ACTUALLY LANDED IN THE DATABASE
-- rather than the set that was picked, which is the only audit that counts.
-- The first pass of this file shipped a lobby with people in it and those
-- three branded counters, because the pick list was checked and the result
-- was not.
--
-- WHICH PHOTOGRAPH GOES ON WHICH ROW was chosen by looking, not by keyword.
-- lib/listings/example-imagery.ts is the standing rule and it is obeyed:
-- a modest example wears ordinary imagery, never an aspirational render, so
-- "Mini flat in Oke Ilewo" shows a plain bedroom and a tiled bathroom and not
-- a villa at sunset. Candidates were searched per room, reviewed as contact
-- sheets, and anything that showed a person, a building site, a drone view of
-- a district, a 3D render, a derelict house, a gate with no house behind it or
-- a sliver of roof against open sky was dropped. A house wears a photograph of
-- a real house, seen from its gate or its compound, the way one is actually
-- seen in Nigeria. Nigerian
-- photographers and Nigerian places are ordered first within every set, so
-- they take the cover, but a photograph that does not show the room is not a
-- listing photograph whoever took it: Unsplash's Nigerian catalogue is
-- street and portrait work, and it has almost no Nigerian interiors at all.
-- Of the photographers used, the Nigeria-based ones carry the restaurants,
-- the food, a hotel pool and a block of flats.
--
-- MONEY IS INTEGER KOBO, and every naira figure is cast to bigint before it is
-- multiplied: a VALUES literal types as integer, and an eighteen million naira
-- rent times a hundred overflows it.
--
-- THE MOVE-IN BREAKDOWN IS DERIVED HERE, not typed: caution a fifth of the
-- rent, agency and legal a tenth each, agreement and the service charge a
-- twentieth each, and the total one and a half times the rent. The parts and
-- the total can then never disagree, which is the whole reason that breakdown
-- is worth trusting.
--
-- SAFE TO RUN TWICE. Every insert ends in `on conflict do nothing` on its
-- natural key, and section 11 refuses to commit unless the counts come out
-- right.
--
-- TESTED, NOT GUESSED: applied and counted on a local Postgres 16 built from
-- all 778 migrations in this repository. It has NOT been run against
-- uccixoonmbhrnyczyigt; the founder runs it.
--
-- Run it in the Supabase SQL editor as one paste.

begin;

do $before$
begin
  raise notice 'before: % listings (% demo), % stays, % businesses, % catalogue rows',
    (select count(*) from public.listings),
    (select count(*) from public.listings where is_demo),
    (select count(*) from public.accommodations),
    (select count(*) from public.businesses),
    (select count(*) from public.catalogue_entries);
end;
$before$;

/* ------------------------------------------- 1. the examples account */

-- No password, no identity row, so nobody can sign in as it. It exists to own
-- the example collection and to put a name other than a real person's on the
-- "Listed by" line.
-- `confirmed_at` is NOT in this list on purpose: on the platform it is
-- `generated always as (least(email_confirmed_at, phone_confirmed_at))`, and
-- an insert that names a generated column is refused.
--
-- `email_confirmed_at` is left null on purpose too. Confirming an address
-- fires `enqueue_welcome_email`, and a welcome to a mailbox that does not
-- exist is a bounce and a queue row for nothing. Nothing signs in as this
-- account, so there is nothing for a confirmation to unlock.
--
-- The name arrives as first_name and surname because `handle_new_user`
-- composes `profiles.display_name` from those, so the profile is right the
-- first time and no UPDATE is needed. An UPDATE here would fire
-- `sync_social_identity_from_profile`, which revalidates the handle, and the
-- handle validator refuses anything containing "vallo".
insert into auth.users (
  instance_id, id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  'e0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'examples@vallo.ng',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"first_name": "Vallo", "surname": "Examples"}'::jsonb,
  now(), now(), false, false
)
on conflict (id) do nothing;

-- A fallback only: `handle_new_user` has normally made this row already.
insert into public.profiles (id, display_name)
values ('e0000000-0000-4000-8000-000000000001', 'Vallo Examples')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values ('e0000000-0000-4000-8000-000000000001', 'user'), ('e0000000-0000-4000-8000-000000000001', 'agent')
on conflict do nothing;

-- role 'owner': Vallo is not acting as anybody's agent here, and an agent row
-- would be claiming a mandate from a landlord who does not exist.
--
-- `agents.user_id` is unique, so one account holds one agent row. If the
-- examples account somehow already holds a different one, stop and say which,
-- rather than failing on the raw constraint and leaving the founder to read a
-- key name. On the live project as counted on 26 November this account does
-- not exist at all, so the insert below is the first row it gets.
do $agent$
declare
  v_other uuid;
begin
  select id into v_other from public.agents
   where user_id = 'e0000000-0000-4000-8000-000000000001' and id <> 'e0000000-0000-4000-8000-000000000003' limit 1;
  if v_other is not null then
    raise exception 'the examples account already holds agent %. Retire that row, or point this file at it, before running this.', v_other;
  end if;

  insert into public.agents (id, user_id, display_name, type, status, verified, verification_tier, is_demo, role)
  values ('e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Vallo Examples', 'individual', 'APPROVED', false, 0, true, 'owner')
  on conflict (id) do nothing;
end
$agent$;

/* -------------------------------- 2. photo credits, and the one check */

-- Reference data: who took a photograph, keyed by the path or URL the photo
-- rows carry. Keyed by the value rather than by a photo row id because one
-- photograph is used by several listings and the credit belongs to the
-- photograph, not to the row.
create table if not exists public.photo_credits (
  storage_path       text primary key,
  source             text not null,
  source_id          text,
  photographer       text not null,
  photographer_url   text,
  photo_url          text,
  alt_text           text,
  created_at         timestamptz not null default now(),
  constraint photo_credits_source_known check (source in ('unsplash', 'own', 'lister'))
);

comment on table public.photo_credits is
  'Who took a photograph, by the path or URL the photo rows carry. Unsplash requires the credit; a lister''s own photograph does not need one.';

alter table public.photo_credits enable row level security;

drop policy if exists photo_credits_select_all on public.photo_credits;
create policy photo_credits_select_all on public.photo_credits for select using (true);

grant select on public.photo_credits to anon, authenticated;

-- The narrowing. Same refusal as before for every scheme and every host, with
-- one literal exception. See the header.
alter table public.listing_photos drop constraint if exists listing_photos_path_not_url;
alter table public.listing_photos add constraint listing_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

alter table public.accommodation_photos drop constraint if exists accommodation_photos_path_not_url;
alter table public.accommodation_photos add constraint accommodation_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

alter table public.business_photos drop constraint if exists business_photos_path_not_url;
alter table public.business_photos add constraint business_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

/* ------------------------------- 2b. the photographs, each written once */

-- EVERY PHOTOGRAPH IN THIS FILE, AND NOTHING ELSE KNOWS AN ADDRESS.
--
-- 91 photographs carry the 415 rows below, so each one is used four or
-- five times. Written out at every use they made this file 250 KB of mostly
-- repeated text, and put the same long URL in a dozen places where one typo
-- would make a photo row and its credit row point at different pictures.
--
-- So each is written once here, under a short key, and every listing, stay
-- and restaurant refers to it by that key. Section 16 fills public.photo_credits
-- from this same table, which is what makes the credit and the photograph
-- impossible to disagree.
--
-- An ordinary table rather than a temporary one, and dropped in section 17.
-- A temporary table dies at COMMIT, which is right for one paste and wrong
-- the moment this file is run in parts, and being run in parts is the only
-- way 168 KB reaches a phone. Named so it cannot collide with anything.
create table if not exists public.vallo_example_photo (
  key              text primary key,
  url              text not null,
  source_id        text,
  photographer     text not null,
  photographer_url text,
  photo_url        text,
  alt_text         text
);

insert into public.vallo_example_photo (key, url, source_id, photographer, photographer_url, photo_url, alt_text)
values
  ('p01', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'GZ5cKOgeIB0', 'Sven Brandsma', 'https://unsplash.com/@seffen99',
   'https://unsplash.com/photos/light-candle-on-round-white-coffee-table-and-sectional-sofa-GZ5cKOgeIB0', 'light candle on round white coffee table and sectional sofa'),
  ('p02', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'IARlbQa6Kc8', 'Spacejoy', 'https://unsplash.com/@spacejoy',
   'https://unsplash.com/photos/a-bedroom-with-a-large-bed-in-a-room-IARlbQa6Kc8', 'a bedroom with a large bed in a room'),
  ('p03', 'https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'FiKcg6EMneY', 'Zac Gudakov', 'https://unsplash.com/@zacgudakov',
   'https://unsplash.com/photos/a-bathroom-with-green-cabinets-and-a-marble-shower-FiKcg6EMneY', 'a bathroom with green cabinets and a marble shower'),
  ('p04', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '8PKGjZ2GzuQ', 'Rafael Hoyos Weht', 'https://unsplash.com/@rhweht',
   'https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-next-to-a-window-8PKGjZ2GzuQ', 'a kitchen with a table and chairs next to a window'),
  ('p05', 'https://images.unsplash.com/photo-1770386751962-d3bb928aeb7d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjF8fGFwYXJ0bWVudCUyMGJsb2NrJTIwZXh0ZXJpb3IlMjBiYWxjb25pZXN8ZW58MHwwfHx8MTc5NTY4NDE4Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'Z01OE9qwLH4', 'Zhen Yao', 'https://unsplash.com/@rex_filmer',
   'https://unsplash.com/photos/tall-apartment-building-with-many-windows-and-air-conditioners-Z01OE9qwLH4', 'Tall apartment building with many windows and air conditioners'),
  ('p06', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'kDtuOUIkwrk', 'Francesca Tosolini', 'https://unsplash.com/@fromitaly',
   'https://unsplash.com/photos/rectangular-brown-and-white-sink-kDtuOUIkwrk', 'rectangular brown and white sink'),
  ('p07', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '70U9U4UG_bY', 'Emmanuel Ikwuegbu', 'https://unsplash.com/@emmages',
   'https://unsplash.com/photos/a-modern-kitchen-with-marble-counter-tops-and-stainless-steel-appliances-70U9U4UG_bY', 'a modern kitchen with marble counter tops and stainless steel appliances'),
  ('p08', 'https://images.unsplash.com/photo-1776184681211-91fff462ae4f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwYmxvY2slMjBleHRlcmlvciUyMGJhbGNvbmllc3xlbnwwfDB8fHwxNzk1Njg0MTgyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'xCBWcwHf2RU', 'Muhammet Vardar', 'https://unsplash.com/@mvardar',
   'https://unsplash.com/photos/several-satellite-dishes-on-apartment-buildings-xCBWcwHf2RU', 'Several satellite dishes on apartment buildings'),
  ('p09', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '4HUhp0vwkbM', 'Spacejoy', 'https://unsplash.com/@spacejoy',
   'https://unsplash.com/photos/white-bed-linen-near-brown-wooden-table-4HUhp0vwkbM', 'white bed linen near brown wooden table'),
  ('p10', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'Sh22mtTd2GA', 'Francesca Tosolini', 'https://unsplash.com/@fromitaly',
   'https://unsplash.com/photos/bed-with-comforter-set-beside-table-lamps-on-nightstands-Sh22mtTd2GA', 'bed with comforter set beside table lamps on nightstands'),
  ('p11', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '1by_GbwEMwc', 'Clay Elliot', 'https://unsplash.com/@ibidsy',
   'https://unsplash.com/photos/white-wooden-kitchen-cabinet-with-white-pendant-lamp-1by_GbwEMwc', 'white wooden kitchen cabinet with white pendant lamp'),
  ('p12', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '1AF5hP6F4tI', 'Steven Ungermann', 'https://unsplash.com/@steveungermann',
   'https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI', 'white ceramic sink with mirror'),
  ('p13', 'https://images.unsplash.com/photo-1704513815318-b8a233c41955?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8bGFnb3MlMjBob3VzZSUyMGVzdGF0ZXxlbnwwfDB8fHwxNzk1Njg0MTc4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'kLVRWeEaP9s', 'Erin Doering', 'https://unsplash.com/@edoering',
   'https://unsplash.com/photos/a-house-with-a-stone-driveway-and-a-small-garden-in-front-of-it-kLVRWeEaP9s', 'a house with a stone driveway and a small garden in front of it'),
  ('p14', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '5oWo6A2IKTc', 'Spacejoy', 'https://unsplash.com/@spacejoy',
   'https://unsplash.com/photos/white-and-black-throw-pillow-on-white-couch-5oWo6A2IKTc', 'white and black throw pillow on white couch'),
  ('p15', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'mu9SXNL9n-E', 'Viktor Forgacs', 'https://unsplash.com/@sonance',
   'https://unsplash.com/photos/white-wooden-kitchen-cabinet-with-blue-and-white-electric-kettle-mu9SXNL9n-E', 'white wooden kitchen cabinet with blue and white electric kettle'),
  ('p16', 'https://images.unsplash.com/photo-1760413572129-f2b8a44d8991?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwZXh0ZXJpb3IlMjBiYWxjb25pZXN8ZW58MHwwfHx8MTc5NTY4NDE4Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'JBJZnfV0_Mk', 'Josh Marty', 'https://unsplash.com/@jaym30',
   'https://unsplash.com/photos/apartment-building-with-balconies-and-windows-JBJZnfV0_Mk', 'Apartment building with balconies and windows'),
  ('p17', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'SrioT6tdWII', 'Collov Home Design', 'https://unsplash.com/@collovhome',
   'https://unsplash.com/photos/brown-wooden-round-table-near-white-sofa-SrioT6tdWII', 'brown wooden round table near white sofa'),
  ('p18', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'n9CzpBTNElo', 'Collov Home Design', 'https://unsplash.com/@collovhome',
   'https://unsplash.com/photos/white-bed-near-white-window-blinds-n9CzpBTNElo', 'white bed near white window blinds'),
  ('p19', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'y79dt3dhTxc', 'Zac Gudakov', 'https://unsplash.com/@zacgudakov',
   'https://unsplash.com/photos/red-towel-on-stainless-steel-towel-rack-y79dt3dhTxc', 'red towel on stainless steel towel rack'),
  ('p20', 'https://images.unsplash.com/photo-1785632662536-be4251f51468?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJsb2NrJTIwZXh0ZXJpb3IlMjBiYWxjb25pZXN8ZW58MHwwfHx8MTc5NTY4NDE4Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'gSqoL6WVI3w', 'Far Chinberdiev', 'https://unsplash.com/@fardevio',
   'https://unsplash.com/photos/modern-apartment-building-with-balconies-and-lush-green-trees-gSqoL6WVI3w', 'Modern apartment building with balconies and lush green trees'),
  ('p21', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'AB-q9lwCVv8', 'Huy Nguyen', 'https://unsplash.com/@huynguyen_pch',
   'https://unsplash.com/photos/living-room-with-television-and-armchair-AB-q9lwCVv8', 'A modern living room with a television, armchair, and framed abstract art'),
  ('p22', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'qGNgjHQjO2k', 'Spacejoy', 'https://unsplash.com/@spacejoy',
   'https://unsplash.com/photos/white-bed-linen-on-bed-qGNgjHQjO2k', 'white bed linen on bed'),
  ('p23', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'E7yGIdzNE3k', 'taufiq triadi', 'https://unsplash.com/@mochamadtaufiq23',
   'https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-next-to-a-window-E7yGIdzNE3k', 'a kitchen with a table and chairs next to a window'),
  ('p24', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'rodWEAfiJaY', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/a-bathroom-with-a-shower-unit-and-toilet-rodWEAfiJaY', 'a bathroom with a shower unit and toilet'),
  ('p25', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'WDUtNbot6Qw', 'Lotus Design N Print', 'https://unsplash.com/@lotusdnp',
   'https://unsplash.com/photos/a-bedroom-with-a-bed-desk-and-a-window-WDUtNbot6Qw', 'a bedroom with a bed, desk, and a window'),
  ('p26', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '8WG4EXvdM4M', 'Lotus Design N Print', 'https://unsplash.com/@lotusdnp',
   'https://unsplash.com/photos/a-bathroom-with-a-toilet-sink-shower-and-mirror-8WG4EXvdM4M', 'a bathroom with a toilet, sink, shower and mirror'),
  ('p27', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'evwisOtjgMg', 'Deconovo', 'https://unsplash.com/@deconovo',
   'https://unsplash.com/photos/gray-textile-on-white-bed-evwisOtjgMg', 'gray textile on white bed'),
  ('p28', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'XXA2mydQfiw', 'Steven Ungermann', 'https://unsplash.com/@steveungermann',
   'https://unsplash.com/photos/a-room-with-a-sink-and-a-mirror-XXA2mydQfiw', 'a room with a sink and a mirror'),
  ('p29', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'vOa-PSimwg4', 'Spacejoy', 'https://unsplash.com/@spacejoy',
   'https://unsplash.com/photos/bedroom-with-blue-walls-and-bed-vOa-PSimwg4', 'A bedroom with blue walls, a beige bed, and a yellow woven pendant light'),
  ('p30', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'd-zkUcfJbWw', 'Steven Ungermann', 'https://unsplash.com/@steveungermann',
   'https://unsplash.com/photos/white-flush-toilet-d-zkUcfJbWw', 'white flush toilet'),
  ('p31', 'https://images.unsplash.com/photo-1779431085067-b7a78f485afa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGFwYXJ0bWVudCUyMGJsb2NrJTIwZXh0ZXJpb3IlMjBiYWxjb25pZXN8ZW58MHwwfHx8MTc5NTY4NDE4Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'EorzyqjiRE8', 'Gabriel Freitas', 'https://unsplash.com/@gbrlfrtssz',
   'https://unsplash.com/photos/residential-brick-building-featuring-an-outdoor-white-staircase-EorzyqjiRE8', 'Residential brick building featuring an outdoor white staircase'),
  ('p32', 'https://images.unsplash.com/photo-1790411748769-096452f4072d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwYmxvY2slMjBleHRlcmlvciUyMGJhbGNvbmllc3xlbnwwfDB8fHwxNzk1Njg0MTgyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'TZesBlFPNhQ', 'Jack Bodine', 'https://unsplash.com/@jackbodine',
   'https://unsplash.com/photos/apartment-building-with-balconies-and-wires-TZesBlFPNhQ', 'A multi-story apartment building with balconies and tangled overhead power lines'),
  ('p33', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'KL_xnnjbRgs', 'Clay Banks', 'https://unsplash.com/@claybanks',
   'https://unsplash.com/photos/a-cozy-living-room-with-a-sofa-and-armchair-KL_xnnjbRgs', 'A cozy living room with a sofa and armchair'),
  ('p34', 'https://images.unsplash.com/photo-1759073254456-06026e026c08?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YXBhcnRtZW50JTIwYmxvY2slMjBleHRlcmlvciUyMGJhbGNvbmllc3xlbnwwfDB8fHwxNzk1Njg0MTgyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'aAqVluPj-Sk', 'Joshua Fernandez', 'https://unsplash.com/@joshuafernandez',
   'https://unsplash.com/photos/modern-apartment-buildings-with-balconies-and-palm-trees-aAqVluPj-Sk', 'Modern apartment buildings with balconies and palm trees'),
  ('p35', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'lLDh9JppH2c', 'Francesca Tosolini', 'https://unsplash.com/@fromitaly',
   'https://unsplash.com/photos/brown-couch-with-two-white-throw-pillows-lLDh9JppH2c', 'brown couch with two white throw pillows'),
  ('p36', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'KUG5LLnuTbo', 'Aquilion Property', 'https://unsplash.com/@aquilionproperty',
   'https://unsplash.com/photos/a-kitchen-with-a-sink-stove-microwave-and-toaster-oven-KUG5LLnuTbo', 'a kitchen with a sink, stove, microwave and toaster oven'),
  ('p37', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'VZ2z8ozzy10', 'Prydumano Design', 'https://unsplash.com/@prydumanodesign',
   'https://unsplash.com/photos/a-living-room-with-a-large-green-couch-VZ2z8ozzy10', 'A living room with a large green couch'),
  ('p38', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '6nyTL54GO8w', 'Franco Debartolo', 'https://unsplash.com/@francotheshooter',
   'https://unsplash.com/photos/a-modern-kitchen-with-stainless-steel-appliances-and-wooden-floors-6nyTL54GO8w', 'A modern kitchen with stainless steel appliances and wooden floors'),
  ('p39', 'https://images.unsplash.com/photo-1783334418852-0b86d67d4c01?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGJ1bmdhbG93JTIwaG91c2UlMjBleHRlcmlvcnxlbnwwfDB8fHwxNzk1Njg0MTgwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'P5eImlBZhsw', 'Patrick PETIT', 'https://unsplash.com/@tontonpix',
   'https://unsplash.com/photos/tropical-wooden-house-with-a-deck-and-palm-trees-P5eImlBZhsw', 'Tropical wooden house with a deck and palm trees'),
  ('p40', 'https://images.unsplash.com/photo-1788145749384-f91374d3bb99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGJ1bmdhbG93JTIwaG91c2UlMjBleHRlcmlvcnxlbnwwfDB8fHwxNzk1Njg0MTgwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'ERELDM2UA3o', 'Vincent Yap', 'https://unsplash.com/@chonky_films',
   'https://unsplash.com/photos/colonial-house-with-green-trim-ERELDM2UA3o', 'A traditional colonial house with green trim and a tiled roof in a garden'),
  ('p41', 'https://images.unsplash.com/photo-1687431672479-3b8be9571bf2?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8Z2F0ZWQlMjBjb21wb3VuZCUyMGhvdXNlJTIwd2FsbHxlbnwwfDB8fHwxNzk1Njg0MTgxfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'TR8xfFxTvNc', 'ismail yazıcı', 'https://unsplash.com/@ismailhy',
   'https://unsplash.com/photos/a-house-with-a-white-fence-and-a-red-roof-TR8xfFxTvNc', 'a house with a white fence and a red roof'),
  ('p42', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '0qWd-IGUqv4', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/a-bathroom-with-a-toilet-sink-and-bathtub-0qWd-IGUqv4', 'a bathroom with a toilet, sink, and bathtub'),
  ('p43', 'https://images.unsplash.com/photo-1759355787118-92cce7fe9e90?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGJ1bmdhbG93JTIwaG91c2UlMjBleHRlcmlvcnxlbnwwfDB8fHwxNzk1Njg0MTgwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '0PPtQ8nWYHQ', 'ubeyonroad', 'https://unsplash.com/@ubeyonroad',
   'https://unsplash.com/photos/a-charming-house-with-blooming-red-flowers-and-orange-flowers-0PPtQ8nWYHQ', 'A charming house with blooming red flowers and orange flowers'),
  ('p44', 'https://images.unsplash.com/photo-1790607343959-a4c0ca8254a6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8YnVuZ2Fsb3clMjBob3VzZSUyMGV4dGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'hBCQYZRnULQ', 'Juan Pablo', 'https://unsplash.com/@who0ne',
   'https://unsplash.com/photos/house-with-blue-shutters-and-wall-hBCQYZRnULQ', 'A house with a tiled roof and blue shutters behind a weathered concrete wall'),
  ('p45', 'https://images.unsplash.com/photo-1759355787127-a9119f68204c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YnVuZ2Fsb3clMjBob3VzZSUyMGV4dGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'I-rF9EqWEEM', 'ubeyonroad', 'https://unsplash.com/@ubeyonroad',
   'https://unsplash.com/photos/dark-house-with-red-flowers-and-a-carport-I-rF9EqWEEM', 'Dark house with red flowers and a carport'),
  ('p46', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '6japTIjUQoI', 'Francesca Tosolini', 'https://unsplash.com/@fromitaly',
   'https://unsplash.com/photos/living-room-interior-6japTIjUQoI', 'living room interior'),
  ('p47', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '-raUwtFMIpo', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/white-and-gray-sofa-chair-near-white-wall--raUwtFMIpo', 'white and gray sofa chair near white wall'),
  ('p48', 'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'fupf3-xAUqw', 'Albert Vincent Wu', 'https://unsplash.com/@albertvincentwu',
   'https://unsplash.com/photos/white-bed-linen-with-white-table-lamp-fupf3-xAUqw', 'white bed linen with white table lamp'),
  ('p49', 'https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'Nt_eOzl3p6o', 'Mike Newbry', 'https://unsplash.com/@mikenewbry',
   'https://unsplash.com/photos/a-bathroom-with-a-sink-mirror-and-bathtub-Nt_eOzl3p6o', 'a bathroom with a sink, mirror, and bathtub'),
  ('p50', 'https://images.unsplash.com/photo-1774192620915-1b70a930351c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '2V9jiyXiT_s', 'Josh Hild', 'https://unsplash.com/@joshhild',
   'https://unsplash.com/photos/modern-hotel-lobby-with-red-seating-and-elevator-2V9jiyXiT_s', 'Modern hotel lobby with red seating and elevator'),
  ('p51', 'https://images.unsplash.com/photo-1793600582538-568d2812ece9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'CaVmNhTjE-o', 'sreesanth p', 'https://unsplash.com/@sreesanthfog',
   'https://unsplash.com/photos/hotel-lobby-with-vaulted-wooden-ceiling-CaVmNhTjE-o', 'A spacious hotel lobby with vaulted wooden ceilings, a large chandelier, and marble floors in warm light'),
  ('p52', 'https://images.unsplash.com/photo-1678978866819-306ed8608e7f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'H2NpsZJe2IA', 'Le Quan', 'https://unsplash.com/@mrkheu',
   'https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-round-mirror-on-the-wall-H2NpsZJe2IA', 'a bedroom with a large bed and a round mirror on the wall'),
  ('p53', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'VCUbsNJdZpQ', 'Zac Gudakov', 'https://unsplash.com/@zacgudakov',
   'https://unsplash.com/photos/black-shower-head-on-white-ceramic-wall-tiles-VCUbsNJdZpQ', 'black shower head on white ceramic wall tiles'),
  ('p54', 'https://images.unsplash.com/photo-1746333578342-3e661512a14d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjd8fHJlc29ydCUyMHN3aW1taW5nJTIwcG9vbCUyMHN1biUyMGxvdW5nZXJzfGVufDB8MHx8fDE3OTU2ODQxODV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'HhXZW8V2r_s', 'Andres Siimon', 'https://unsplash.com/@johnmcclane',
   'https://unsplash.com/photos/lounge-chairs-sit-by-a-pool-on-a-sunny-day-HhXZW8V2r_s', 'Lounge chairs sit by a pool on a sunny day'),
  ('p55', 'https://images.unsplash.com/photo-1768396747960-ae6ba3c855bc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjF8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'xzC31x_RmZI', 'Andy Wang', 'https://unsplash.com/@space_launch_system',
   'https://unsplash.com/photos/luxurious-hotel-corridor-with-reflective-floor-and-warm-lighting-xzC31x_RmZI', 'Luxurious hotel corridor with reflective floor and warm lighting'),
  ('p56', 'https://images.unsplash.com/photo-1631049552240-59c37f38802b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'Kqpw00namok', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/white-bed-linen-on-bed-Kqpw00namok', 'white bed linen on bed'),
  ('p57', 'https://images.unsplash.com/photo-1790501128960-c40ac4f2c764?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '1c0ut7Kvro8', 'Adrien Olichon', 'https://unsplash.com/@adrienolichon',
   'https://unsplash.com/photos/hotel-lobby-with-geometric-ceiling-light-1c0ut7Kvro8', 'A hotel lobby with dark seating areas under a large geometric ceiling light'),
  ('p58', 'https://images.unsplash.com/photo-1661872952496-e4e3833d2fdf?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'pwsHYiy6OPI', 'Andres Q', 'https://unsplash.com/@aucqsm',
   'https://unsplash.com/photos/a-room-with-orange-couches-and-a-black-lamp-pwsHYiy6OPI', 'a room with orange couches and a black lamp'),
  ('p59', 'https://images.unsplash.com/photo-1775324537644-ec90f40d7d35?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'hWWrF-XyQWk', 'Timofey Radkevich', 'https://unsplash.com/@beauty_is_everywhere',
   'https://unsplash.com/photos/modern-hotel-lobby-with-contemporary-furniture-and-natural-light-hWWrF-XyQWk', 'Modern hotel lobby with contemporary furniture and natural light'),
  ('p60', 'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjByb29tJTIwaW50ZXJpb3IlMjBiZWR8ZW58MHwwfHx8MTc5NTY4MTkwMnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '_Swg04CP0bU', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/white-bed-linen-on-bed-_Swg04CP0bU', 'white bed linen on bed'),
  ('p61', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'FPim6ZLM6fc', 'Zac Gudakov', 'https://unsplash.com/@zacgudakov',
   'https://unsplash.com/photos/a-bathroom-with-marble-counter-tops-and-green-cabinets-FPim6ZLM6fc', 'a bathroom with marble counter tops and green cabinets'),
  ('p62', 'https://images.unsplash.com/photo-1563493653502-9e270be23596?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8cmVzb3J0JTIwc3dpbW1pbmclMjBwb29sJTIwc3VuJTIwbG91bmdlcnN8ZW58MHwwfHx8MTc5NTY4NDE4NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '157NwUNEdxQ', 'Paulo Almeida', 'https://unsplash.com/@pralmeida',
   'https://unsplash.com/photos/three-white-deck-chairs-157NwUNEdxQ', 'three white deck chairs'),
  ('p63', 'https://images.unsplash.com/photo-1730367019960-9906d9cbbf05?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8ZW1wdHklMjBob3RlbCUyMGxvYmJ5JTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4NDE4NHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'afEV1IhjkLY', 'Nereid Ndreu', 'https://unsplash.com/@nereiq',
   'https://unsplash.com/photos/a-room-with-a-lot-of-chairs-and-lights-afEV1IhjkLY', 'A room with a lot of chairs and lights'),
  ('p64', 'https://images.unsplash.com/photo-1758931156918-b1671900a864?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '3yXmsLghPX4', 'Yanhao Fang', 'https://unsplash.com/@alamanga',
   'https://unsplash.com/photos/modern-lounge-area-with-comfortable-seating-and-lamps-3yXmsLghPX4', 'Modern lounge area with comfortable seating and lamps'),
  ('p65', 'https://images.unsplash.com/photo-1596178060810-72f53ce9a65c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzb3J0JTIwc3dpbW1pbmclMjBwb29sJTIwc3VuJTIwbG91bmdlcnN8ZW58MHwwfHx8MTc5NTY4NDE4NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'J9O3WcJ5N74', 'The Anam', 'https://unsplash.com/@theanamcxr',
   'https://unsplash.com/photos/white-and-brown-lounge-chairs-beside-swimming-pool-during-daytime-J9O3WcJ5N74', 'white and brown lounge chairs beside swimming pool during daytime'),
  ('p66', 'https://images.unsplash.com/photo-1755644046048-989506b73a5c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGVtcHR5JTIwaG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQxODR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'JhHiAtofX1U', 'Yanhao Fang', 'https://unsplash.com/@alamanga',
   'https://unsplash.com/photos/modern-lounge-area-with-comfortable-seating-and-floral-arrangement-JhHiAtofX1U', 'Modern lounge area with comfortable seating and floral arrangement'),
  ('p67', 'https://images.unsplash.com/photo-1631049307485-2bfb23080676?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8aG90ZWwlMjBiZWRyb29tJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4MTY1Nnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'zTKN10KKQcc', 'Point3D Commercial Imaging Ltd.', 'https://unsplash.com/@3dottawa',
   'https://unsplash.com/photos/white-bed-linen-on-bed-zTKN10KKQcc', 'white bed linen on bed'),
  ('p68', 'https://images.unsplash.com/photo-1552854123-c6e68de866c9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHJlc29ydCUyMHN3aW1taW5nJTIwcG9vbCUyMHN1biUyMGxvdW5nZXJzfGVufDB8MHx8fDE3OTU2ODQxODV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'PoIecS4wM8o', 'Colin Watts', 'https://unsplash.com/@colinwatts',
   'https://unsplash.com/photos/blue-sun-lounger-lot-PoIecS4wM8o', 'blue sun lounger lot'),
  ('p69', 'https://images.unsplash.com/photo-1789593847377-a0452ab3f3c9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fHJlc29ydCUyMHN3aW1taW5nJTIwcG9vbCUyMHN1biUyMGxvdW5nZXJzfGVufDB8MHx8fDE3OTU2ODQxODV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'y6SCShi9iqA', 'Greyy john', 'https://unsplash.com/@greyyjohn',
   'https://unsplash.com/photos/circular-swimming-pool-in-garden-y6SCShi9iqA', 'A circular blue swimming pool in a garden with palm trees and a pergola'),
  ('p70', 'https://images.unsplash.com/photo-1789593847389-80805c7ea5ab?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHJlc29ydCUyMHN3aW1taW5nJTIwcG9vbCUyMHN1biUyMGxvdW5nZXJzfGVufDB8MHx8fDE3OTU2ODQxODV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'mw0F8ieWKWM', 'Greyy john', 'https://unsplash.com/@greyyjohn',
   'https://unsplash.com/photos/lounge-chairs-by-round-swimming-pool-mw0F8ieWKWM', 'Two wooden lounge chairs on a stone patio beside a round blue swimming pool'),
  ('p71', 'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8ZW1wdHklMjByZXN0YXVyYW50JTIwaW50ZXJpb3IlMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4NDM3N3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'sQopSb2K0CU', 'Andrew Seaman', 'https://unsplash.com/@amseaman',
   'https://unsplash.com/photos/clear-glass-cup-on-brown-wooden-table-sQopSb2K0CU', 'clear glass cup on brown wooden table'),
  ('p72', 'https://images.unsplash.com/photo-1728414862776-9c96320e5762?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'C7UIhcX9UCw', 'Abdul Raheem Kannath', 'https://unsplash.com/@raheemblacksnows',
   'https://unsplash.com/photos/a-white-plate-topped-with-meat-and-rice-next-to-bowls-of-vegetables-C7UIhcX9UCw', 'A white plate topped with meat and rice next to bowls of vegetables'),
  ('p73', 'https://images.unsplash.com/photo-1739799120521-c5f44a9335a3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8ZW1wdHklMjBiYXIlMjBjb3VudGVyJTIwc3Rvb2xzJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4NDM4MHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'nsgzQHsxbXE', 'Shawn DENG', 'https://unsplash.com/@dzshawn',
   'https://unsplash.com/photos/a-dimly-lit-bar-with-stools-and-bottles-on-the-shelves-nsgzQHsxbXE', 'A dimly lit bar with stools and bottles on the shelves'),
  ('p74', 'https://images.unsplash.com/photo-1583579366395-c0a857d2182a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '8U3MxqPEmJI', 'Markus Winkler', 'https://unsplash.com/@markuswinkler',
   'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-8U3MxqPEmJI', 'cooked food on white ceramic plate'),
  ('p75', 'https://images.unsplash.com/photo-1720694924759-2a2daaa98987?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8ZW1wdHklMjBiYXIlMjBjb3VudGVyJTIwc3Rvb2xzJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4NDM4MHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'WK1Cf_A7nyY', 'Panos Katsigiannis', 'https://unsplash.com/@panos_kats',
   'https://unsplash.com/photos/a-bar-with-a-bunch-of-stools-in-front-of-it-WK1Cf_A7nyY', 'A bar with a bunch of stools in front of it'),
  ('p76', 'https://images.unsplash.com/photo-1608264928332-bc82fb207e69?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGVtcHR5JTIwYmFyJTIwY291bnRlciUyMHN0b29scyUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODQzODB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'acRNShhwOEs', 'Pamela Buenrostro', 'https://unsplash.com/@jp_shoots',
   'https://unsplash.com/photos/black-metal-frame-on-brown-wooden-table-acRNShhwOEs', 'black metal frame on brown wooden table'),
  ('p77', 'https://images.unsplash.com/photo-1610592309005-0f92c8e39cec?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'FIGcCVQeGwE', 'Stephen Lartey', 'https://unsplash.com/@pianisteve',
   'https://unsplash.com/photos/pasta-with-meat-on-white-ceramic-plate-FIGcCVQeGwE', 'pasta with meat on white ceramic plate'),
  ('p78', 'https://images.unsplash.com/photo-1530695801911-f188c516550a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8ZW1wdHklMjByZXN0YXVyYW50JTIwaW50ZXJpb3IlMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4NDM3N3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '0BIvjaQwvQQ', 'Gor Davtyan', 'https://unsplash.com/@gor918',
   'https://unsplash.com/photos/brown-wooden-tables-surrounded-chairs-0BIvjaQwvQQ', 'brown wooden tables surrounded chairs'),
  ('p79', 'https://images.unsplash.com/photo-1664992960082-0ea299a9c53e?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'woC24wGXsQ8', 'Keesha''s Kitchen', 'https://unsplash.com/@keeshasskitchen',
   'https://unsplash.com/photos/a-bowl-of-food-woC24wGXsQ8', 'a bowl of food'),
  ('p80', 'https://images.unsplash.com/photo-1696420690958-96c825a6b256?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGVtcHR5JTIwcmVzdGF1cmFudCUyMGludGVyaW9yJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODQzNzd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'mHVxkXNIlIE', 'Sergio Arteaga', 'https://unsplash.com/@saarteaga',
   'https://unsplash.com/photos/a-restaurant-filled-with-lots-of-wooden-tables-and-chairs-mHVxkXNIlIE', 'a restaurant filled with lots of wooden tables and chairs'),
  ('p81', 'https://images.unsplash.com/photo-1653981608672-aea09b857b20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '2MF31z_tJj8', 'mahsa shamshiri fard', 'https://unsplash.com/@tpmagency',
   'https://unsplash.com/photos/a-plate-of-rice-with-a-tomato-on-top-2MF31z_tJj8', 'a plate of rice with a tomato on top'),
  ('p82', 'https://images.unsplash.com/photo-1580196515879-2d99ad7fd767?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8ZW1wdHklMjByZXN0YXVyYW50JTIwaW50ZXJpb3IlMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4NDM3N3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'tHbWtMFzZZs', 'Nwar Igbariah', 'https://unsplash.com/@nwarigb',
   'https://unsplash.com/photos/brown-wooden-table-with-chairs-tHbWtMFzZZs', 'brown wooden table with chairs'),
  ('p83', 'https://images.unsplash.com/photo-1613526949297-1aba25022d0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'EXHIHvJu4VU', 'Nilantha Sanjeewa', 'https://unsplash.com/@nila1992',
   'https://unsplash.com/photos/cooked-rice-on-brown-wooden-bowl-EXHIHvJu4VU', 'cooked rice on brown wooden bowl'),
  ('p84', 'https://images.unsplash.com/photo-1696420691256-b325ec3ec3a1?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGVtcHR5JTIwcmVzdGF1cmFudCUyMGludGVyaW9yJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODQzNzd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'ZJsVCbFO8FU', 'Sergio Arteaga', 'https://unsplash.com/@saarteaga',
   'https://unsplash.com/photos/a-restaurant-with-wooden-tables-and-chairs-and-a-clock-ZJsVCbFO8FU', 'a restaurant with wooden tables and chairs and a clock'),
  ('p85', 'https://images.unsplash.com/photo-1593787614887-004b2ffb0057?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'W7x1gJtFZwM', 'Louis Hansel', 'https://unsplash.com/@louishansel',
   'https://unsplash.com/photos/cooked-food-on-red-ceramic-bowl-W7x1gJtFZwM', 'cooked food on red ceramic bowl'),
  ('p86', 'https://images.unsplash.com/photo-1608816042754-d69cb2271bea?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8ZW1wdHklMjByZXN0YXVyYW50JTIwaW50ZXJpb3IlMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4NDM3N3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'V2nhzJm-2FM', 'Vitor Paladini', 'https://unsplash.com/@vtrpldn',
   'https://unsplash.com/photos/brown-wooden-table-with-chairs-V2nhzJm-2FM', 'brown wooden table with chairs'),
  ('p87', 'https://images.unsplash.com/photo-1666190092689-e3968aa0c32c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'u8oFTbtcTQM', 'Umair Ali Asad', 'https://unsplash.com/@umairaliasad',
   'https://unsplash.com/photos/a-tray-of-food-u8oFTbtcTQM', 'a tray of food'),
  ('p88', 'https://images.unsplash.com/photo-1573225342366-135601b8185d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'fqujjJ7W4J0', 'Nerfee Mirandilla', 'https://unsplash.com/@nerfee',
   'https://unsplash.com/photos/shallow-focus-photo-of-boiled-egg-and-broccoli-on-brown-rice-fqujjJ7W4J0', 'shallow focus photo of boiled egg and broccoli on brown rice'),
  ('p89', 'https://images.unsplash.com/photo-1593787614839-9b93c8998f25?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjd8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'Yo8RWHcPwps', 'Louis Hansel', 'https://unsplash.com/@louishansel',
   'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-Yo8RWHcPwps', 'cooked food on white ceramic plate'),
  ('p90', 'https://images.unsplash.com/photo-1604329756574-bda1f2cada6f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   '_VRo59IsqLo', 'Femoree', 'https://unsplash.com/@femoree',
   'https://unsplash.com/photos/rice-with-tomato-and-egg-on-white-ceramic-plate-_VRo59IsqLo', 'rice with tomato and egg on white ceramic plate'),
  ('p91', 'https://images.unsplash.com/photo-1665332195309-9d75071138f0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80',
   'PqG32DYCTM8', 'Keesha''s Kitchen', 'https://unsplash.com/@keeshasskitchen',
   'https://unsplash.com/photos/jollof-rice-with-grilled-fish-dinner-PqG32DYCTM8', 'Jollof rice in a white dish with grilled fish, skewers, and fresh vegetables')
on conflict (key) do nothing;

commit;
