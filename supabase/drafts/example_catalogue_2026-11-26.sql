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
-- WHICH PHOTOGRAPH GOES ON WHICH ROW was chosen by looking, not by keyword.
-- lib/listings/example-imagery.ts is the standing rule and it is obeyed:
-- a modest example wears ordinary imagery, never an aspirational render, so
-- "Mini flat in Oke Ilewo" shows a plain bedroom and a tiled bathroom and not
-- a villa at sunset. Candidates were searched per room, reviewed as contact
-- sheets, and anything that showed a person, a building site, a drone view of
-- a district, a 3D render or a derelict house was dropped. Nigerian
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

/* ------------------------------------------ 3. cancellation policies */

-- The same two the example stays used in September. Reference data with no
-- is_demo column, so a reversal drops them by id or leaves them.
insert into public.cancellation_policies (id, name, summary, rules, is_free_until_hours)
values
  ('ef000000-0000-4000-8000-000000000001',
   'Free cancellation until 48 hours before',
   'Cancel free of charge up to 48 hours before check-in. Inside 48 hours the first night is kept and the rest is returned to your wallet.',
   '[{"hours_before": 48, "refund_bps": 10000}, {"hours_before": 0, "refund_bps": 0}]'::jsonb,
   48),
  ('ef000000-0000-4000-8000-000000000002',
   'Non-refundable',
   'The lowest rate, paid in full when you book. Nothing is returned if you cancel.',
   '[{"hours_before": 0, "refund_bps": 0}]'::jsonb,
   null)
on conflict (id) do nothing;

/* ----------------------------------------------- 4. forty tenancies */

with spec(n, state_code, city, area, lat, lng, shape, title, beds, baths, toilets,
          parking, sqm, built, furn, cond, grid, backup, bh, water, prepaid,
          estate, rent_naira, floor_at, floors_of, ensuite, bq, serviced,
          flats, descr) as (values
  (1, 'LA', 'Lagos', 'Lekki Phase 1', 6.4419, 3.4699, 'flat',
   'Three bedroom flat in Lekki Phase 1',
   3, 3, 4, 2, 145, 2019, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 20, 'PUMPED_STORAGE', true, 'gated_compound', 7500000::bigint,
   2, 4, 3, true, true, 8,
   'Three bedrooms, all en suite, in a block of eight off Admiralty Way. The compound keeps a 40 kVA generator on a changeover, there is a boys quarters off the kitchen, and the service charge covers diesel, security and the lift.'),
  (2, 'LA', 'Lagos', 'Lekki Phase 1', 6.4455, 3.4712, 'mini_flat',
   'Mini flat in Lekki Phase 1',
   1, 1, 1, 1, 52, 2017, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 12, 'BOREHOLE', true, 'gated_compound', 2400000::bigint,
   1, 3, 0, false, false, 6,
   'One bedroom with its own kitchen and bathroom, on the first floor of a small block behind the Lekki roundabout. Water is from a borehole with a treatment tank, and the generator runs from 7pm.'),
  (3, 'LA', 'Lagos', 'Lekki Phase 1', 6.4402, 3.466, 'terrace',
   'Four bedroom terrace in Lekki Phase 1',
   4, 4, 5, 2, 210, 2021, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 24, 'PUMPED_STORAGE', true, 'gated_estate', 12000000::bigint,
   1, 3, 4, true, true, 12,
   'Four bedrooms over three floors with a maids room off the kitchen and a rooftop terrace. The estate runs twenty four hour power on an inverter bank behind the generator, so the lights do not blink at the changeover.'),
  (4, 'LA', 'Lagos', 'Ikoyi', 6.4523, 3.4356, 'flat',
   'Three bedroom flat in Ikoyi',
   3, 3, 4, 2, 180, 2020, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS', true, 'gated_compound', 18000000::bigint,
   5, 8, 3, true, true, 16,
   'Three bedrooms with fitted wardrobes on the fifth floor of a serviced tower off Bourdillon, with a lift, a gym in the block and treated mains water. Service charge is billed yearly and covers diesel, water treatment, cleaning and the lift.'),
  (5, 'LA', 'Lagos', 'Ikoyi', 6.4487, 3.4401, 'flat',
   'Two bedroom flat in Ikoyi',
   2, 2, 3, 1, 110, 2016, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 16, 'TREATED_MAINS', true, 'gated_compound', 9000000::bigint,
   3, 5, 2, false, false, 10,
   'Two bedrooms, both en suite, in a quiet block on a side street off Awolowo Road. Parking is inside the gate and the compound has its own borehole as a backup to the mains.'),
  (6, 'LA', 'Lagos', 'Victoria Island', 6.4281, 3.4219, 'flat',
   'Two bedroom flat on Victoria Island',
   2, 2, 3, 2, 120, 2018, 'semi_furnished', 'renovated',
   'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS', true, 'gated_compound', 11000000::bigint,
   4, 7, 2, false, true, 14,
   'Two bedrooms a short walk from the Adeola Odeku offices, in a block with a lift, a generator that carries the whole building and a water treatment plant in the compound.'),
  (7, 'LA', 'Lagos', 'Victoria Island', 6.431, 3.4265, 'self_contain',
   'Self contained on Victoria Island',
   1, 1, 1, 1, 40, 2015, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 14, 'TREATED_MAINS', true, 'gated_compound', 2800000::bigint,
   2, 4, 0, false, false, 8,
   'A single room with its own bathroom and a kitchenette, in a small block off Ligali Ayorinde. Useful for somebody who works on the island and does not want the bridge twice a day.'),
  (8, 'LA', 'Lagos', 'Yaba', 6.5095, 3.3711, 'mini_flat',
   'Mini flat in Yaba',
   1, 1, 1, 1, 44, 2016, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'open_street', 1400000::bigint,
   1, 3, 0, false, false, 6,
   'One room, its own kitchen and bathroom, on the first floor of a small block off Commercial Avenue. Ten minutes from the Yaba bus stop and the tech offices around Herbert Macaulay.'),
  (9, 'LA', 'Lagos', 'Yaba', 6.5131, 3.3785, 'self_contain',
   'Self contained in Akoka',
   1, 1, 1, 0, 28, 2018, 'unfurnished', 'newly_built',
   'PATCHY', 'GENERATOR', 8, 'BOREHOLE', true, 'open_street', 850000::bigint,
   3, 3, 0, false, false, 9,
   'A single room with its own bathroom and a kitchenette, five minutes from the university gate. The landlord keeps a generator for the compound and the borehole pumps to a tank on the roof.'),
  (10, 'LA', 'Lagos', 'Yaba', 6.5062, 3.3669, 'room_parlour',
   'Room and parlour in Yaba',
   1, 1, 2, 1, 58, 2012, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 9, 'BOREHOLE', true, 'gated_compound', 1200000::bigint,
   2, 3, 0, false, false, 8,
   'A sitting room, one bedroom and a kitchen off a shared corridor, in a compound of eight flats with a gate house. Prepaid meter, and the compound generator runs in the evening.'),
  (11, 'LA', 'Lagos', 'Surulere', 6.4969, 3.3481, 'flat',
   'Three bedroom flat in Surulere',
   3, 2, 3, 1, 105, 2010, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'open_street', 2200000::bigint,
   2, 4, 1, false, false, 8,
   'Three bedrooms on the second floor of a well kept block off Adeniran Ogunsanya, with a fitted kitchen and a balcony over the street. Market, banks and the stadium are all walking distance.'),
  (12, 'OG', 'Abeokuta', 'Oke Ilewo', 7.1557, 3.3451, 'mini_flat',
   'Mini flat in Oke Ilewo',
   1, 1, 1, 1, 46, 2016, 'unfurnished', 'renovated',
   'PATCHY', 'GENERATOR', 9, 'BOREHOLE', true, 'gated_compound', 750000::bigint,
   1, 3, 0, false, false, 6,
   'One bedroom, a small sitting room and its own kitchen, in a compound off the Oke Ilewo road with parking for one car inside the gate and a borehole that fills a tank on the roof.'),
  (13, 'LA', 'Lagos', 'Ikeja GRA', 6.5793, 3.3487, 'flat',
   'Two bedroom flat in Ikeja GRA',
   2, 2, 3, 1, 88, 2012, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 14, 'BOREHOLE', true, 'gated_compound', 2800000::bigint,
   2, 4, 2, false, false, 6,
   'Two bedrooms, both en suite, in a gated compound of six flats with a shared generator. Isaac John and the airport road are both a few minutes away.'),
  (14, 'LA', 'Lagos', 'Ikeja', 6.6018, 3.3515, 'flat',
   'Three bedroom flat in Ikeja',
   3, 3, 4, 2, 128, 2017, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR_INVERTER', 18, 'BOREHOLE', true, 'gated_compound', 3600000::bigint,
   3, 5, 2, true, false, 10,
   'Three bedrooms with a separate dining area and a boys quarters, in a block with a lift off Oba Akran. The compound generator is on a changeover and the inverter carries the lights between.'),
  (15, 'LA', 'Lagos', 'Ajah', 6.4698, 3.5852, 'flat',
   'Two bedroom flat in Ajah',
   2, 2, 3, 1, 86, 2019, 'unfurnished', 'newly_built',
   'PATCHY', 'GENERATOR', 12, 'BOREHOLE', true, 'gated_estate', 1800000::bigint,
   1, 3, 1, false, false, 12,
   'Two bedrooms in a new block inside an estate off the Lekki Epe expressway, with a borehole, a treatment tank and a gate house that logs visitors.'),
  (16, 'LA', 'Lagos', 'Ajah', 6.4661, 3.5721, 'mini_flat',
   'Mini flat in Ajah',
   1, 1, 1, 1, 48, 2020, 'unfurnished', 'newly_built',
   'PATCHY', 'GENERATOR', 10, 'BOREHOLE', true, 'gated_compound', 950000::bigint,
   2, 3, 0, false, false, 8,
   'One bedroom with its own kitchen and bathroom, newly finished, in a compound behind Abraham Adesanya. Prepaid meter and parking inside the gate.'),
  (17, 'LA', 'Lagos', 'Ajah', 6.4712, 3.5904, 'duplex',
   'Four bedroom duplex in Ajah',
   4, 4, 5, 2, 230, 2021, 'unfurnished', 'newly_built',
   'PATCHY', 'GENERATOR_INVERTER', 16, 'BOREHOLE', true, 'gated_estate', 4500000::bigint,
   1, 2, 4, true, false, 24,
   'Four bedrooms over two floors with a boys quarters and a small lawn, in an estate with its own borehole and treatment plant. The estate charges a yearly due for security and waste.'),
  (18, 'LA', 'Lagos', 'Gbagada', 6.5544, 3.3892, 'flat',
   'Three bedroom flat in Gbagada',
   3, 3, 4, 2, 132, 2015, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 12, 'BOREHOLE', true, 'gated_compound', 2600000::bigint,
   1, 4, 2, true, false, 8,
   'Three bedrooms in a block off Diya Street with a boys quarters, parking for two cars and a borehole in the compound. The third mainland bridge is ten minutes away at the right hour.'),
  (19, 'LA', 'Lagos', 'Gbagada', 6.5601, 3.3831, 'mini_flat',
   'Mini flat in Gbagada',
   1, 1, 1, 1, 45, 2013, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 9, 'BOREHOLE', true, 'open_street', 1000000::bigint,
   2, 3, 0, false, false, 6,
   'One bedroom with its own kitchen and bathroom on a quiet street in Gbagada Phase 2, with a prepaid meter and a tap in the compound that runs off the borehole.'),
  (20, 'LA', 'Lagos', 'Magodo', 6.6183, 3.3711, 'bungalow',
   'Three bedroom bungalow in Magodo',
   3, 3, 4, 2, 150, 2014, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 16, 'BOREHOLE', true, 'gated_estate', 3400000::bigint,
   1, 1, 2, true, false, 1,
   'A detached bungalow on its own plot inside Magodo Phase 2, with a gate house, a lawn and a boys quarters at the back. The estate runs its own security and the roads are tarred.'),
  (21, 'LA', 'Lagos', 'Magodo', 6.6221, 3.3768, 'duplex',
   'Five bedroom duplex in Magodo',
   5, 5, 6, 3, 320, 2018, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 20, 'BOREHOLE', true, 'gated_estate', 6500000::bigint,
   1, 2, 5, true, false, 1,
   'Five bedrooms over two floors with a study, staff quarters and parking for three cars behind an electric gate, inside Magodo Phase 1.'),
  (22, 'FC', 'Abuja', 'Maitama', 9.0846, 7.4951, 'flat',
   'Three bedroom flat in Maitama',
   3, 3, 4, 2, 170, 2019, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS', true, 'gated_compound', 14000000::bigint,
   2, 4, 3, true, true, 8,
   'Three bedrooms, all en suite, in a serviced block on a tree lined Maitama street. Twenty four hour power, treated mains water and a boys quarters, with the service charge covering diesel, cleaning and the gardener.'),
  (23, 'FC', 'Abuja', 'Asokoro', 9.0392, 7.5244, 'duplex',
   'Four bedroom duplex in Asokoro',
   4, 4, 5, 3, 300, 2017, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR_INVERTER', 20, 'TREATED_MAINS', true, 'gated_compound', 11000000::bigint,
   1, 2, 4, true, false, 4,
   'Four bedrooms over two floors with a study, staff quarters and parking for three cars, in a compound of four units behind an electric gate.'),
  (24, 'FC', 'Abuja', 'Wuse 2', 9.0765, 7.4744, 'flat',
   'Three bedroom flat in Wuse 2',
   3, 3, 4, 2, 140, 2019, 'semi_furnished', 'newly_built',
   'BAND_A', 'GENERATOR_INVERTER', 20, 'TREATED_MAINS', true, 'gated_compound', 5500000::bigint,
   3, 5, 3, false, true, 10,
   'Three bedrooms with fitted wardrobes, a separate dining area and a lift in the block, a few minutes from the Wuse 2 shops and the business district.'),
  (25, 'FC', 'Abuja', 'Wuse 2', 9.082, 7.4691, 'mini_flat',
   'Mini flat in Wuse 2',
   1, 1, 1, 1, 52, 2016, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 14, 'TREATED_MAINS', true, 'gated_compound', 2200000::bigint,
   2, 4, 0, false, false, 8,
   'One bedroom with its own kitchen and bathroom in a block off Aminu Kano Crescent, with parking inside the compound and a generator for the evenings.'),
  (26, 'FC', 'Abuja', 'Gwarinpa', 9.1095, 7.4046, 'flat',
   'Three bedroom flat in Gwarinpa',
   3, 3, 4, 2, 130, 2015, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 14, 'BOREHOLE', true, 'gated_estate', 3200000::bigint,
   1, 3, 2, true, false, 12,
   'Three bedrooms in a block inside the estate, with a boys quarters, a borehole in the compound and parking for two cars. Shops and a clinic are inside the estate.'),
  (27, 'FC', 'Abuja', 'Gwarinpa', 9.1142, 7.3988, 'self_contain',
   'Self contained in Gwarinpa',
   1, 1, 1, 1, 30, 2019, 'unfurnished', 'newly_built',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'gated_compound', 900000::bigint,
   2, 3, 0, false, false, 10,
   'A single room with its own bathroom and a kitchenette in 6th Avenue, with a prepaid meter and a tap in the compound.'),
  (28, 'FC', 'Abuja', 'Jabi', 9.0642, 7.4192, 'flat',
   'Two bedroom flat in Jabi',
   2, 2, 3, 1, 95, 2018, 'unfurnished', 'renovated',
   'BAND_A', 'GENERATOR', 16, 'TREATED_MAINS', true, 'gated_compound', 3800000::bigint,
   2, 4, 2, false, false, 8,
   'Two bedrooms, both en suite, in a block a short walk from Jabi Lake, with a lift, parking inside the gate and a generator on a changeover.'),
  (29, 'RI', 'Port Harcourt', 'GRA Phase 2', 4.8095, 7.018, 'flat',
   'Three bedroom flat in GRA Phase 2',
   3, 3, 4, 2, 128, 2016, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 14, 'BOREHOLE', true, 'gated_compound', 3600000::bigint,
   1, 3, 2, true, false, 6,
   'Three bedrooms in a compound off Tombia Street with a boys quarters, parking for two cars and a borehole with a treatment tank.'),
  (30, 'RI', 'Port Harcourt', 'Rumuokoro', 4.8618, 6.9931, 'bungalow',
   'Two bedroom bungalow in Rumuokoro',
   2, 2, 2, 2, 96, 2011, 'unfurnished', 'renovated',
   'PATCHY', 'GENERATOR', 12, 'BOREHOLE', false, 'open_street', 1500000::bigint,
   1, 1, 0, false, false, 1,
   'A standalone bungalow in a fenced yard with room for two cars and a small garden at the back. The landlord lives in the next compound and keeps the borehole running.'),
  (31, 'RI', 'Port Harcourt', 'New GRA', 4.8242, 7.0336, 'duplex',
   'Four bedroom duplex in New GRA',
   4, 4, 5, 3, 265, 2017, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 18, 'BOREHOLE', true, 'gated_estate', 5000000::bigint,
   1, 2, 4, true, false, 8,
   'A duplex on a corner plot with a walled compound, a borehole and a treatment tank, inside an estate with a gate house and tarred roads.'),
  (32, 'OY', 'Ibadan', 'Bodija', 7.4306, 3.9105, 'flat',
   'Three bedroom flat in Bodija',
   3, 2, 3, 2, 118, 2015, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'open_street', 1600000::bigint,
   0, 2, 1, false, false, 4,
   'Ground floor of a two storey house on a quiet street in Old Bodija, with a fitted kitchen, a back yard and a borehole in the compound.'),
  (33, 'OY', 'Ibadan', 'Jericho', 7.4056, 3.879, 'bungalow',
   'Three bedroom bungalow in Jericho',
   3, 3, 3, 2, 170, 2010, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 12, 'BOREHOLE', false, 'gated_compound', 2000000::bigint,
   1, 1, 1, true, false, 1,
   'An older house kept in good order, with mature trees in the compound, a separate boys quarters and parking for two cars.'),
  (34, 'EN', 'Enugu', 'Independence Layout', 6.4413, 7.5203, 'flat',
   'Two bedroom flat in Independence Layout',
   2, 2, 2, 1, 84, 2013, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 9, 'BOREHOLE', true, 'gated_estate', 1200000::bigint,
   2, 3, 1, false, false, 6,
   'Two bedrooms in a well kept block with a security post at the estate entrance, a borehole in the compound and a prepaid meter.'),
  (35, 'KN', 'Kano', 'Nassarawa GRA', 12.0022, 8.542, 'bungalow',
   'Three bedroom bungalow in Nassarawa GRA',
   3, 3, 3, 2, 165, 2012, 'unfurnished', 'renovated',
   'PATCHY', 'GENERATOR', 12, 'BOREHOLE', true, 'gated_compound', 1800000::bigint,
   1, 1, 1, true, false, 1,
   'A bungalow in a walled compound on a quiet GRA street, with a boys quarters, mature trees and a borehole that fills a tank on the roof.'),
  (36, 'KD', 'Kaduna', 'Barnawa', 10.4806, 7.4165, 'flat',
   'Two bedroom flat in Barnawa',
   2, 2, 2, 1, 78, 2011, 'unfurnished', 'renovated',
   'PATCHY', 'GENERATOR', 10, 'BOREHOLE', true, 'open_street', 900000::bigint,
   1, 2, 0, false, false, 4,
   'Two bedrooms on the ground floor of a small block in Barnawa, with a fitted kitchen, a prepaid meter and parking in front of the compound.'),
  (37, 'CR', 'Calabar', 'State Housing', 4.9589, 8.3269, 'flat',
   'Two bedroom flat in State Housing',
   2, 2, 2, 1, 82, 2014, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'gated_estate', 1100000::bigint,
   1, 2, 1, false, false, 6,
   'Two bedrooms in a block inside State Housing, with a borehole, a gate house and a short run to the Marian Road shops.'),
  (38, 'AK', 'Uyo', 'Ewet Housing', 5.0167, 7.9214, 'flat',
   'Three bedroom flat in Ewet Housing',
   3, 3, 3, 2, 112, 2016, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 12, 'BOREHOLE', true, 'gated_estate', 1500000::bigint,
   1, 2, 2, false, false, 8,
   'Three bedrooms in a block inside Ewet Housing Estate, with parking for two cars, a borehole in the compound and a prepaid meter.'),
  (39, 'ED', 'Benin City', 'GRA', 6.335, 5.6217, 'bungalow',
   'Three bedroom bungalow in Benin GRA',
   3, 3, 3, 2, 160, 2012, 'unfurnished', 'renovated',
   'MOSTLY_ON', 'GENERATOR', 10, 'BOREHOLE', true, 'gated_compound', 1400000::bigint,
   1, 1, 1, true, false, 1,
   'A bungalow in a walled compound off Sapele Road, with a boys quarters, a borehole and room for two cars inside the gate.'),
  (40, 'IM', 'Owerri', 'New Owerri', 5.4836, 7.0333, 'flat',
   'Two bedroom flat in New Owerri',
   2, 2, 2, 1, 80, 2017, 'unfurnished', 'renovated',
   'PATCHY', 'GENERATOR', 10, 'BOREHOLE', true, 'gated_compound', 1100000::bigint,
   2, 3, 1, false, false, 6,
   'Two bedrooms in a newer block in New Owerri, with a borehole, a prepaid meter and parking inside the compound.')
)
insert into public.listings (
  id, agent_id, title, description, property_type, unit_shape, status,
  state_code, city, area, latitude, longitude,
  bedrooms, bathrooms, toilets, parking_spaces, parking_type, size_sqm, year_built,
  furnished, condition, power_grid, power_backup, power_backup_hours, water_supply,
  prepaid_meter, has_estate_access, estate_type, floor, total_floors,
  ensuite_count, has_bq, flats_in_compound,
  listing_intent, listing_role, rent_amount_minor, rent_period, rent_negotiable,
  caution_deposit_minor, service_charge_minor, service_charge_period,
  service_charge_covers, agency_fee_minor, legal_fee_minor, agreement_fee_minor,
  total_move_in_cost_minor, minimum_tenancy_months, available_from,
  rate_minor, shared_living_ok,
  submitted_at, reviewed_at, published_at, is_demo, demo_retire_after
)
select
  ('ed000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  'e0000000-0000-4000-8000-000000000003'::uuid,
  title, descr, 'rental'::public.property_type, shape::public.unit_shape,
  'PUBLISHED'::public.listing_status,
  state_code, city, area, lat, lng,
  beds, baths, toilets::smallint, parking::smallint,
  case when parking > 0 then 'inside' else 'street' end,
  sqm, built::smallint,
  furn::public.furnishing, cond::public.build_condition,
  grid::public.power_grid, backup::public.power_backup, bh::smallint,
  water::public.water_supply, prepaid, estate <> 'open_street', estate,
  /* A house is not on a floor of anything. `floor` is which floor of a block
     the unit sits on, so it is null where the whole building IS the unit and
     `total_floors` is the house's own storeys. Getting this wrong put a
     balcony on every bungalow, because the amenity below reads `floor`. */
  case when shape in ('bungalow', 'duplex', 'terrace', 'semi_detached', 'detached')
       then null else floor_at::smallint end,
  floors_of::smallint, ensuite::smallint, bq,
  flats::smallint,
  'rent'::public.listing_intent, 'owner'::public.listing_role,
  rent_naira * 100, 'year'::public.rent_period, false,
  /* Derived, never typed: caution a fifth, agency and legal a tenth each,
     agreement and the service charge a twentieth each, the total one and a
     half times the rent. */
  (rent_naira * 20 / 100) * 100,
  (rent_naira *  5 / 100) * 100, 'year'::public.rent_period,
  /* `listings.is_serviced` is generated from the service charge and from this
     array holding diesel, water and security, so what a serviced block covers
     is stated here and the flag follows from it. */
  case when serviced then array['diesel','security','water','cleaning']
       else array['security','waste'] end,
  (rent_naira * 10 / 100) * 100,
  (rent_naira * 10 / 100) * 100,
  (rent_naira *  5 / 100) * 100,
  (rent_naira * 150 / 100) * 100,
  12::smallint, current_date + 14,
  0, false,
  now(), now(), now(), true, date '2027-05-07'
from spec
on conflict (id) do nothing;

/* -------------------------------------------- 5. twenty five shortlets */

with spec(n, state_code, city, area, lat, lng, shape, title, beds, baths, sqm,
          built, grid, backup, bh, water, estate, night_naira, floor_at,
          floors_of, max_occ, descr) as (values
  (41, 'LA', 'Lagos', 'Victoria Island', 6.4281, 3.4219, 'flat',
   'One bedroom shortlet on Victoria Island',
   1, 1, 55, 2021, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 95000::bigint, 6, 10, 3,
   'One bedroom with a kitchen, a work desk and a balcony, in a serviced block a street back from the water. Cleaned between stays, and the power does not go off.'),
  (42, 'LA', 'Lagos', 'Victoria Island', 6.4297, 3.4241, 'flat',
   'Two bedroom shortlet on Victoria Island',
   2, 2, 98, 2020, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 150000::bigint, 8, 12, 4,
   'Two bedrooms, both en suite, a living room that seats six and a kitchen with a washing machine. Ten minutes from the Eko Hotel roundabout on foot.'),
  (43, 'LA', 'Lagos', 'Ikoyi', 6.4523, 3.4356, 'self_contain',
   'Studio shortlet in Ikoyi',
   1, 1, 38, 2022, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 70000::bigint, 3, 6, 2,
   'A studio with a full kitchen and fast internet, cleaned between stays, with parking in the compound and a guard at the gate.'),
  (44, 'LA', 'Lagos', 'Ikoyi', 6.4498, 3.4392, 'flat',
   'One bedroom shortlet in Ikoyi',
   1, 1, 62, 2021, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 110000::bigint, 5, 9, 2,
   'One bedroom on the fifth floor of a tower on the waterfront, with a balcony over the water, a gym in the block and housekeeping three times a week.'),
  (45, 'LA', 'Lagos', 'Lekki Phase 1', 6.446, 3.4738, 'flat',
   'Two bedroom shortlet in Lekki Phase 1',
   2, 2, 92, 2020, 'BAND_A', 'GENERATOR_INVERTER', 24, 'PUMPED_STORAGE',
   'gated_estate', 120000::bigint, 2, 4, 4,
   'Two bedrooms, both en suite, a living room that seats six, and twenty four hour power in the estate. Parking inside the gate and a pool on the ground floor.'),
  (46, 'LA', 'Lagos', 'Lekki Phase 1', 6.4431, 3.4681, 'mini_flat',
   'One bedroom shortlet in Lekki Phase 1',
   1, 1, 54, 2019, 'BAND_A', 'GENERATOR', 16, 'BOREHOLE',
   'gated_compound', 65000::bigint, 1, 3, 2,
   'One bedroom kept for short stays off Admiralty Way, with a kitchen, a smart television and a generator that runs through the night.'),
  (47, 'LA', 'Lagos', 'Ajah', 6.4698, 3.5852, 'flat',
   'Two bedroom shortlet in Ajah',
   2, 2, 88, 2021, 'PATCHY', 'GENERATOR_INVERTER', 18, 'BOREHOLE',
   'gated_estate', 55000::bigint, 2, 3, 4,
   'Two bedrooms in a new estate off the Lekki Epe expressway, furnished for short stays, with an inverter that carries the fans and lights when the generator is off.'),
  (48, 'LA', 'Lagos', 'Ikeja', 6.6018, 3.3515, 'flat',
   'One bedroom shortlet in Ikeja',
   1, 1, 50, 2018, 'BAND_A', 'GENERATOR', 18, 'TREATED_MAINS',
   'gated_compound', 48000::bigint, 2, 4, 2,
   'A one bedroom flat twenty minutes from the airport, furnished and cleaned between stays, with parking inside the compound and a guard at night.'),
  (49, 'LA', 'Lagos', 'Ikeja GRA', 6.5793, 3.3487, 'flat',
   'Two bedroom shortlet in Ikeja GRA',
   2, 2, 86, 2019, 'BAND_A', 'GENERATOR_INVERTER', 20, 'BOREHOLE',
   'gated_compound', 75000::bigint, 1, 3, 4,
   'Two bedrooms on a quiet GRA street, furnished for a family or two colleagues, with a kitchen, a washing machine and parking for two cars.'),
  (50, 'LA', 'Lagos', 'Gbagada', 6.5544, 3.3892, 'mini_flat',
   'One bedroom shortlet in Gbagada',
   1, 1, 46, 2020, 'MOSTLY_ON', 'GENERATOR', 14, 'BOREHOLE',
   'gated_compound', 40000::bigint, 2, 3, 2,
   'One bedroom furnished for short stays off Diya Street, ten minutes from the third mainland bridge at the right hour, with a generator for the evening.'),
  (51, 'LA', 'Lagos', 'Yaba', 6.5095, 3.3711, 'self_contain',
   'Studio shortlet in Yaba',
   1, 1, 34, 2021, 'MOSTLY_ON', 'GENERATOR_INVERTER', 16, 'BOREHOLE',
   'gated_compound', 38000::bigint, 3, 4, 2,
   'A studio with a kitchenette and a desk, five minutes from the Yaba tech offices, with fast internet and an inverter for the laptop when the power drops.'),
  (52, 'LA', 'Lagos', 'Surulere', 6.4969, 3.3481, 'mini_flat',
   'One bedroom shortlet in Surulere',
   1, 1, 44, 2019, 'MOSTLY_ON', 'GENERATOR', 12, 'BOREHOLE',
   'gated_compound', 32000::bigint, 1, 3, 2,
   'One bedroom furnished for short stays off Adeniran Ogunsanya, with a kitchen, air conditioning in the bedroom and the market a few minutes away.'),
  (53, 'LA', 'Lagos', 'Magodo', 6.6183, 3.3711, 'duplex',
   'Three bedroom shortlet in Magodo',
   3, 3, 180, 2020, 'BAND_A', 'GENERATOR_INVERTER', 20, 'BOREHOLE',
   'gated_estate', 95000::bigint, 1, 2, 6,
   'A furnished duplex inside Magodo Phase 2 for a family or a group, with three bedrooms, a lawn, parking for two cars and estate security on the gate.'),
  (54, 'FC', 'Abuja', 'Wuse 2', 9.082, 7.4691, 'flat',
   'One bedroom shortlet in Wuse 2',
   1, 1, 48, 2019, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 72000::bigint, 3, 6, 2,
   'A one bedroom flat kept for short stays, ten minutes from the business district, with a gym in the block and twenty four hour power.'),
  (55, 'FC', 'Abuja', 'Maitama', 9.0846, 7.4951, 'flat',
   'Two bedroom shortlet in Maitama',
   2, 2, 105, 2021, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 140000::bigint, 2, 4, 4,
   'Two bedrooms, both en suite, on a quiet Maitama street, with a full kitchen, housekeeping on request and parking inside the compound.'),
  (56, 'FC', 'Abuja', 'Jabi', 9.0642, 7.4192, 'flat',
   'One bedroom shortlet in Jabi',
   1, 1, 52, 2020, 'BAND_A', 'GENERATOR_INVERTER', 20, 'TREATED_MAINS',
   'gated_compound', 65000::bigint, 4, 7, 2,
   'One bedroom a short walk from Jabi Lake, furnished and cleaned between stays, with a desk by the window and a lift in the block.'),
  (57, 'FC', 'Abuja', 'Gwarinpa', 9.1095, 7.4046, 'flat',
   'Two bedroom shortlet in Gwarinpa',
   2, 2, 90, 2019, 'MOSTLY_ON', 'GENERATOR', 18, 'BOREHOLE',
   'gated_estate', 55000::bigint, 1, 3, 4,
   'Two bedrooms in the estate, furnished for a family, with a kitchen, a washing machine and parking for two cars inside the compound.'),
  (58, 'FC', 'Abuja', 'Asokoro', 9.0392, 7.5244, 'flat',
   'Two bedroom shortlet in Asokoro',
   2, 2, 110, 2021, 'BAND_A', 'GENERATOR_INVERTER', 24, 'TREATED_MAINS',
   'gated_compound', 130000::bigint, 1, 3, 4,
   'Two bedrooms in a serviced block on a quiet Asokoro street, with a generator that carries the whole building and a guard at the gate day and night.'),
  (59, 'RI', 'Port Harcourt', 'GRA Phase 2', 4.8095, 7.018, 'flat',
   'Two bedroom shortlet in GRA Phase 2',
   2, 2, 78, 2018, 'MOSTLY_ON', 'GENERATOR', 18, 'BOREHOLE',
   'gated_compound', 58000::bigint, 1, 3, 4,
   'Two bedrooms in a quiet compound with a generator that runs through the night and parking for two cars inside the gate.'),
  (60, 'RI', 'Port Harcourt', 'New GRA', 4.8242, 7.0336, 'flat',
   'One bedroom shortlet in New GRA',
   1, 1, 54, 2020, 'MOSTLY_ON', 'GENERATOR_INVERTER', 18, 'BOREHOLE',
   'gated_estate', 45000::bigint, 2, 3, 2,
   'One bedroom furnished for short stays inside the estate, with an inverter for the lights, a kitchen and a gate house that logs visitors.'),
  (61, 'OY', 'Ibadan', 'Bodija', 7.4306, 3.9105, 'flat',
   'Two bedroom shortlet in Bodija',
   2, 2, 82, 2019, 'MOSTLY_ON', 'GENERATOR', 14, 'BOREHOLE',
   'gated_compound', 40000::bigint, 1, 2, 4,
   'Two bedrooms on a quiet Old Bodija street, furnished for a family, with a back yard, a borehole and parking for two cars.'),
  (62, 'EN', 'Enugu', 'Independence Layout', 6.4413, 7.5203, 'flat',
   'One bedroom shortlet in Independence Layout',
   1, 1, 50, 2020, 'MOSTLY_ON', 'GENERATOR', 14, 'BOREHOLE',
   'gated_estate', 35000::bigint, 2, 3, 2,
   'One bedroom furnished for short stays, with a kitchen, air conditioning in the bedroom and a security post at the estate entrance.'),
  (63, 'PL', 'Jos', 'Rayfield', 9.8167, 8.8833, 'bungalow',
   'Two bedroom shortlet in Rayfield',
   2, 2, 96, 2017, 'PATCHY', 'GENERATOR', 12, 'BOREHOLE',
   'gated_compound', 38000::bigint, 1, 1, 4,
   'A furnished bungalow in a walled compound in Rayfield, with a garden, parking inside the gate and the cool Jos evenings that need no air conditioning.'),
  (64, 'DE', 'Asaba', 'Okpanam Road', 6.227, 6.6834, 'flat',
   'Two bedroom shortlet on Okpanam Road',
   2, 2, 86, 2021, 'MOSTLY_ON', 'GENERATOR_INVERTER', 16, 'BOREHOLE',
   'gated_estate', 42000::bigint, 2, 4, 4,
   'Two bedrooms in a newer block off Okpanam Road, furnished and cleaned between stays, with an inverter, a kitchen and parking inside the estate.'),
  (65, 'DE', 'Warri', 'Effurun', 5.556, 5.7836, 'flat',
   'One bedroom shortlet in Effurun',
   1, 1, 52, 2019, 'PATCHY', 'GENERATOR', 16, 'BOREHOLE',
   'gated_compound', 40000::bigint, 1, 3, 2,
   'One bedroom furnished for short stays near the Effurun roundabout, with a generator that runs through the night and a guard on the gate.')
)
insert into public.listings (
  id, agent_id, title, description, property_type, unit_shape, status,
  state_code, city, area, latitude, longitude,
  bedrooms, bathrooms, toilets, parking_spaces, parking_type, size_sqm, year_built,
  furnished, condition, power_grid, power_backup, power_backup_hours, water_supply,
  prepaid_meter, has_estate_access, estate_type, floor, total_floors,
  ensuite_count, max_occupants,
  listing_intent, listing_role, rate_minor, rate_period, shared_living_ok,
  submitted_at, reviewed_at, published_at, is_demo, demo_retire_after
)
select
  ('ed000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  'e0000000-0000-4000-8000-000000000003'::uuid,
  title, descr, 'shortlet'::public.property_type, shape::public.unit_shape,
  'PUBLISHED'::public.listing_status,
  state_code, city, area, lat, lng,
  beds, baths, baths::smallint, 1::smallint, 'inside', sqm, built::smallint,
  'fully_furnished'::public.furnishing, 'newly_built'::public.build_condition,
  grid::public.power_grid, backup::public.power_backup, bh::smallint,
  water::public.water_supply, true, estate <> 'open_street', estate,
  /* Same rule as the tenancies: a whole house sits on no floor of a block. */
  case when shape in ('bungalow', 'duplex', 'terrace', 'semi_detached', 'detached')
       then null else floor_at::smallint end,
  floors_of::smallint, baths::smallint, max_occ::smallint,
  'rent'::public.listing_intent, 'owner'::public.listing_role,
  night_naira * 100, 'night'::public.rate_period, false,
  now(), now(), now(), true, date '2027-05-07'
from spec
on conflict (id) do nothing;

/* ------------------------------------------------ 6. what each one has */

-- By market rather than by row, and nothing claims a pool or a gym on a place
-- that has not said it has one. Every home gets water and security; a serviced
-- block adds the lift and the gym; anything let by the night is furnished with
-- wifi, air conditioning and a television, because that is what a shortlet is.
insert into public.listing_amenities (listing_id, amenity_id)
select l.id, a.id
from public.listings l
join public.amenities a on a.code = any (
  case
    when l.property_type = 'shortlet'
      then array['water','security','kitchen','wifi','ac','tv','furnished','parking','generator']
    when l.is_serviced
      then array['water','security','kitchen','generator','parking','elevator','gym','ac']
    when l.unit_shape in ('duplex','bungalow','terrace','semi_detached','detached')
      then array['water','security','kitchen','generator','parking','garden']
    else array['water','security','kitchen','generator','parking']
  end
)
where l.agent_id = 'e0000000-0000-4000-8000-000000000003'
  and l.is_demo
on conflict do nothing;

-- A balcony only on a flat above the ground floor. A bungalow has none, and
-- neither does a ground floor flat.
insert into public.listing_amenities (listing_id, amenity_id)
select l.id, a.id
from public.listings l
join public.amenities a on a.code = 'balcony'
where l.agent_id = 'e0000000-0000-4000-8000-000000000003' and l.is_demo and coalesce(l.floor, 0) > 0
on conflict do nothing;

/* ------------------------------------------------- 7. the photographs */

insert into public.listing_photos (listing_id, storage_path, position)
values
  ('ed000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000015', 'https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000015', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000015', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000015', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000015', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000016', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000016', 'https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000016', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000016', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000016', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000017', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000017', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000017', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000017', 'https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000017', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000018', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000018', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000018', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000018', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000018', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000019', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000019', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000019', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000019', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001a', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001a', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001a', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001a', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001a', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000001b', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001b', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001b', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001b', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001c', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001c', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001c', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001c', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001c', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000001d', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001d', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001d', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001d', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001d', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000001e', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001e', 'https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001e', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001e', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001e', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000001f', 'https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000001f', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000001f', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000001f', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000001f', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000020', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000020', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000020', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000020', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000020', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000021', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000021', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000021', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000021', 'https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000021', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000022', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000022', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000022', 'https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000022', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000022', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000023', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000023', 'https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000023', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000023', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000023', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000024', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000024', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000024', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000024', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000024', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000025', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000025', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000025', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000025', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000025', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000026', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000026', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000026', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000026', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000026', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000027', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000027', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000027', 'https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000027', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000027', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000028', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000028', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000028', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000028', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000028', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000029', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000029', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000029', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000029', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002a', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002a', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002a', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002a', 'https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002a', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000002b', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002b', 'https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002b', 'https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002b', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002c', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002c', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002c', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002c', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002d', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002d', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002d', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002d', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002d', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000002e', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002e', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002e', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002e', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002f', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000002f', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000002f', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000002f', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000002f', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000030', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000030', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000030', 'https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000030', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000031', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000031', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000031', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000031', 'https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000031', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000032', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000032', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000032', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000032', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000033', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000033', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000033', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000033', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000034', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000034', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000034', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000034', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000035', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000035', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000035', 'https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000035', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000035', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000036', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000036', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000036', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000036', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000037', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000037', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000037', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000037', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000037', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000038', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000038', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000038', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000038', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000039', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000039', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000039', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000039', 'https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000039', 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000003a', 'https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003a', 'https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003a', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003a', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003a', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000003b', 'https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003b', 'https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003b', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003b', 'https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003b', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000003c', 'https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003c', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003c', 'https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003c', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003d', 'https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003d', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003d', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003d', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003d', 'https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-00000000003e', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003e', 'https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003e', 'https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003e', 'https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003f', 'https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-00000000003f', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-00000000003f', 'https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-00000000003f', 'https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-00000000003f', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000040', 'https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000040', 'https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000040', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000040', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ed000000-0000-4000-8000-000000000040', 'https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 4),
  ('ed000000-0000-4000-8000-000000000041', 'https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ed000000-0000-4000-8000-000000000041', 'https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ed000000-0000-4000-8000-000000000041', 'https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ed000000-0000-4000-8000-000000000041', 'https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3)
on conflict (listing_id, position) do nothing;

/* ----------------------- 8. twenty places to stay and fifteen kitchens */

-- Every name is invented and none is a real brand. The address is null on all
-- of them: a street address on a property that does not exist is somebody's
-- actual building. The coordinates are real points inside the named area, so
-- the map puts the pin where the area is.
insert into public.businesses (
  id, owner_id, agent_id, kind, name, slug, description, source, status,
  state_code, city, area, address, latitude, longitude, phone, email,
  is_demo, published_at
) values
  ('eb000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Harbour Point Hotel', 'harbour-point-hotel',
   '1',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Victoria Island', null, 6.4281, 3.4219, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', null, 'serviced_apartments', 'Ikoyi Quay Residences', 'ikoyi-quay-residences',
   '1',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Ikoyi', null, 6.4498, 3.4392, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', null, 'resort', 'Lagoon Crest Resort', 'lagoon-crest-resort',
   '1',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Lekki', null, 6.4386, 3.521, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Airport View Hotel', 'airport-view-hotel',
   '1',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Ikeja', null, 6.6018, 3.3515, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', null, 'guest_house', 'Ogba Garden Guest House', 'ogba-garden-guest-house',
   '2',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Ikeja GRA', null, 6.5793, 3.3487, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Marina Crest Hotel', 'marina-crest-hotel',
   '1',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Lekki Phase 1', null, 6.4419, 3.4699, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000001', null, 'guest_house', 'Maitama Court Guest House', 'maitama-court-guest-house',
   '2',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Maitama', null, 9.0868, 7.4972, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Wuse Skyline Suites', 'wuse-skyline-suites',
   '1',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Wuse 2', null, 9.077, 7.4716, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Asokoro Hill Hotel', 'asokoro-hill-hotel',
   '1',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Asokoro', null, 9.0392, 7.5244, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-000000000001', null, 'serviced_apartments', 'Jabi Lake Apartments', 'jabi-lake-apartments',
   '1',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Jabi', null, 9.0642, 7.4192, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-000000000001', null, 'guest_house', 'Gwarinpa Rest House', 'gwarinpa-rest-house',
   '2',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Gwarinpa', null, 9.1095, 7.4046, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000c', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Garden City Hotel', 'garden-city-hotel',
   '1',
   'first_party', 'PUBLISHED', 'RI', 'Port Harcourt', 'GRA Phase 2', null, 4.8095, 7.018, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000d', 'e0000000-0000-4000-8000-000000000001', null, 'guest_house', 'Rumuokoro Lodge', 'rumuokoro-lodge',
   '2',
   'first_party', 'PUBLISHED', 'RI', 'Port Harcourt', 'Rumuokoro', null, 4.8618, 6.9931, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Bodija Park Hotel', 'bodija-park-hotel',
   '1',
   'first_party', 'PUBLISHED', 'OY', 'Ibadan', 'Bodija', null, 7.4306, 3.9105, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000000f', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Jericho Heights Hotel', 'jericho-heights-hotel',
   '1',
   'first_party', 'PUBLISHED', 'OY', 'Ibadan', 'Jericho', null, 7.4056, 3.879, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Independence Layout Hotel', 'independence-layout-hotel',
   '1',
   'first_party', 'PUBLISHED', 'EN', 'Enugu', 'Independence Layout', null, 6.4413, 7.5203, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Nassarawa GRA Hotel', 'nassarawa-gra-hotel',
   '1',
   'first_party', 'PUBLISHED', 'KN', 'Kano', 'Nassarawa GRA', null, 12.0022, 8.542, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', null, 'hotel', 'Barnawa Court Hotel', 'barnawa-court-hotel',
   '1',
   'first_party', 'PUBLISHED', 'KD', 'Kaduna', 'Barnawa', null, 10.4806, 7.4165, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000001', null, 'resort', 'Marina Resort Calabar', 'marina-resort-calabar',
   '1',
   'first_party', 'PUBLISHED', 'CR', 'Calabar', 'Marian', null, 4.9589, 8.3269, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000014', 'e0000000-0000-4000-8000-000000000001', null, 'guest_house', 'Rayfield Guest House', 'rayfield-guest-house',
   '2',
   'first_party', 'PUBLISHED', 'PL', 'Jos', 'Rayfield', null, 9.8167, 8.8833, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000065', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Harbour Lights Kitchen', 'harbour-lights-kitchen',
   'Seafood and grills on the Victoria Island waterfront, lunch and dinner, with a bar that stays open late on Fridays and Saturdays.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Victoria Island', null, 6.431, 3.4265, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000066', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Ikoyi Table', 'ikoyi-table',
   'A small dining room off Awolowo Road with a short menu that changes with the market, and a chef who comes out to the tables.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Ikoyi', null, 6.4523, 3.4356, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000067', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Lekki Suya Garden', 'lekki-suya-garden',
   'Suya, pepper soup and grilled fish under the trees off Admiralty Way, with family tables at the weekend and a generator that never lets the fans stop.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Lekki Phase 1', null, 6.4431, 3.4681, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000068', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Yaba Rice House', 'yaba-rice-house',
   'Jollof, ofada and white rice with stew, served from a counter off Commercial Avenue from morning until the pots are finished.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Yaba', null, 6.5095, 3.3711, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000069', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Surulere Amala Spot', 'surulere-amala-spot',
   'Amala, ewedu and gbegiri with the usual meats, on a corner off Bode Thomas. Benches outside, a fan over every table.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Surulere', null, 6.4969, 3.3481, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006a', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Ikeja Grill House', 'ikeja-grill-house',
   'A grill on a quiet GRA street with a terrace at the back, open for lunch and dinner and busy with the office crowd on a Friday.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Ikeja GRA', null, 6.5793, 3.3487, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006b', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Gbagada Pepper Soup Joint', 'gbagada-pepper-soup-joint',
   'Catfish and goat pepper soup, roast fish and plantain, served from the evening into the night off Diya Street.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Gbagada', null, 6.5544, 3.3892, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006c', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Magodo Breakfast Room', 'magodo-breakfast-room',
   'Akara and pap, yam and egg, pancakes and good coffee, inside Magodo Phase 2. Quiet on a weekday, full by ten on a Saturday.',
   'first_party', 'PUBLISHED', 'LA', 'Lagos', 'Magodo', null, 6.6183, 3.3711, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006d', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Jabi Lakeside Grill', 'jabi-lakeside-grill',
   'Suya, pepper soup and grilled fish by Jabi Lake, with outdoor seating under the trees and family tables on Sundays.',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Jabi', null, 9.0642, 7.4192, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006e', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Maitama Dining Room', 'maitama-dining-room',
   'A quiet dining room on a Maitama street, white cloths and a wine list, with a set lunch on weekdays and a longer card at dinner.',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Maitama', null, 9.0846, 7.4951, null, null, true, now()),
  ('eb000000-0000-4000-8000-00000000006f', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Wuse Shawarma Bar', 'wuse-shawarma-bar',
   'Shawarma, grilled chicken and chips off Aminu Kano Crescent, with a few tables on the pavement and a queue after nine.',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Wuse 2', null, 9.082, 7.4691, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000070', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Asokoro Garden Restaurant', 'asokoro-garden-restaurant',
   'Lunch and dinner in a walled garden in Asokoro, with a grill by the lawn and a dining room inside for the harmattan.',
   'first_party', 'PUBLISHED', 'FC', 'Abuja', 'Asokoro', null, 9.0392, 7.5244, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000071', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Garden City Kitchen', 'garden-city-kitchen',
   'Native soups, roast fish and plantain off Tombia Street, with a bar under the trees and live music on a Friday.',
   'first_party', 'PUBLISHED', 'RI', 'Port Harcourt', 'GRA Phase 2', null, 4.8095, 7.018, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000072', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Bodija Market Kitchen', 'bodija-market-kitchen',
   'Amala and ewedu, ofada rice and stew, cooked through the day near Bodija market. Plain benches, good food, no ceremony.',
   'first_party', 'PUBLISHED', 'OY', 'Ibadan', 'Bodija', null, 7.4306, 3.9105, null, null, true, now()),
  ('eb000000-0000-4000-8000-000000000073', 'e0000000-0000-4000-8000-000000000001', null, 'restaurant', 'Effurun Roundabout Grill', 'effurun-roundabout-grill',
   'Starch and banga, roast fish and goat meat near the Effurun roundabout, with seating under a canopy and a generator for the fans.',
   'first_party', 'PUBLISHED', 'DE', 'Warri', 'Effurun', null, 5.556, 5.7836, null, null, true, now())
on conflict (id) do nothing;

/* ------------------------------------------------- 9. the stays themselves */

insert into public.accommodations (
  id, business_id, name, slug, description, star_rating, check_in_from, check_out_by,
  house_rules, cancellation_policy_id, status, state_code, city, area, address,
  latitude, longitude, featured, is_demo, published_at
) values
  ('ea000000-0000-4000-8000-000000000001', 'eb000000-0000-4000-8000-000000000001', 'Harbour Point Hotel', 'harbour-point-hotel',
   'Ninety rooms over eleven floors a short walk from the Adeola Odeku offices, with a rooftop bar over the lagoon, a small gym and a restaurant on the ground floor. Power stays on.',
   4, '14:00', '12:00', 'No smoking in the rooms. Visitors sign in at reception.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'LA', 'Lagos', 'Victoria Island', null, 6.4281, 3.4219, false, true, now()),
  ('ea000000-0000-4000-8000-000000000002', 'eb000000-0000-4000-8000-000000000002', 'Ikoyi Quay Residences', 'ikoyi-quay-residences',
   'Serviced one and two bedroom apartments in a tower on the Ikoyi waterfront, with housekeeping three times a week, a gym and pool on the fourth floor and treated mains water.',
   null, '15:00', '11:00', 'No parties. Quiet after 22:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'LA', 'Lagos', 'Ikoyi', null, 6.4498, 3.4392, false, true, now()),
  ('ea000000-0000-4000-8000-000000000003', 'eb000000-0000-4000-8000-000000000003', 'Lagoon Crest Resort', 'lagoon-crest-resort',
   'Garden rooms around the pool deck and six villas on the water with their own terraces. Breakfast is served by the lagoon, there are kayaks at the jetty and a spa in the main house.',
   5, '14:00', '12:00', 'Children welcome. The pool closes at 21:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'LA', 'Lagos', 'Lekki', null, 6.4386, 3.521, false, true, now()),
  ('ea000000-0000-4000-8000-000000000004', 'eb000000-0000-4000-8000-000000000004', 'Airport View Hotel', 'airport-view-hotel',
   'Sixty rooms twenty minutes from the international terminal, with a restaurant, a car park inside the gate and a shuttle to the airport on request.',
   3, '14:00', '12:00', 'Reception is staffed through the night.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'LA', 'Lagos', 'Ikeja', null, 6.6018, 3.3515, false, true, now()),
  ('ea000000-0000-4000-8000-000000000005', 'eb000000-0000-4000-8000-000000000005', 'Ogba Garden Guest House', 'ogba-garden-guest-house',
   'Fourteen rooms in a converted family house on a quiet GRA street, with breakfast in the dining room, a garden at the back and parking behind the gate.',
   3, '13:00', '11:00', 'Breakfast is served from 07:00 to 10:00.',
   'ef000000-0000-4000-8000-000000000002', 'PUBLISHED', 'LA', 'Lagos', 'Ikeja GRA', null, 6.5793, 3.3487, false, true, now()),
  ('ea000000-0000-4000-8000-000000000006', 'eb000000-0000-4000-8000-000000000006', 'Marina Crest Hotel', 'marina-crest-hotel',
   'Seventy rooms off Admiralty Way with a pool on the third floor, a gym, two meeting rooms and a kitchen that serves until late.',
   4, '14:00', '12:00', 'No smoking in the rooms.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'LA', 'Lagos', 'Lekki Phase 1', null, 6.4419, 3.4699, false, true, now()),
  ('ea000000-0000-4000-8000-000000000007', 'eb000000-0000-4000-8000-000000000007', 'Maitama Court Guest House', 'maitama-court-guest-house',
   'Twelve rooms in a converted family house on a tree lined Maitama street, with breakfast in the dining room and parking inside the compound.',
   3, '13:00', '11:00', 'Breakfast is served from 07:00 to 10:00.',
   'ef000000-0000-4000-8000-000000000002', 'PUBLISHED', 'FC', 'Abuja', 'Maitama', null, 9.0868, 7.4972, false, true, now()),
  ('ea000000-0000-4000-8000-000000000008', 'eb000000-0000-4000-8000-000000000008', 'Wuse Skyline Suites', 'wuse-skyline-suites',
   'Forty rooms on eight floors in central Wuse 2, with a top floor lounge, a business centre and a generator that covers the whole building.',
   4, '14:00', '12:00', 'Visitors sign in at reception.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'FC', 'Abuja', 'Wuse 2', null, 9.077, 7.4716, false, true, now()),
  ('ea000000-0000-4000-8000-000000000009', 'eb000000-0000-4000-8000-000000000009', 'Asokoro Hill Hotel', 'asokoro-hill-hotel',
   'Fifty rooms on the Asokoro slope with a pool in the garden, a spa, two restaurants and a view over the city from the upper floors.',
   5, '14:00', '12:00', 'Children welcome. The pool closes at 21:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'FC', 'Abuja', 'Asokoro', null, 9.0392, 7.5244, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000a', 'eb000000-0000-4000-8000-00000000000a', 'Jabi Lake Apartments', 'jabi-lake-apartments',
   'Serviced studios and one bedroom apartments a short walk from Jabi Lake, with housekeeping twice a week, a gym in the block and parking inside the compound.',
   null, '15:00', '11:00', 'No parties. Quiet after 22:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'FC', 'Abuja', 'Jabi', null, 9.0642, 7.4192, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000b', 'eb000000-0000-4000-8000-00000000000b', 'Gwarinpa Rest House', 'gwarinpa-rest-house',
   'Ten rooms in a house inside the estate, plain and clean, with breakfast on request and parking for four cars inside the gate.',
   2, '13:00', '11:00', 'Reception closes at 23:00. Call ahead for a late arrival.',
   'ef000000-0000-4000-8000-000000000002', 'PUBLISHED', 'FC', 'Abuja', 'Gwarinpa', null, 9.1095, 7.4046, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000c', 'eb000000-0000-4000-8000-00000000000c', 'Garden City Hotel', 'garden-city-hotel',
   'Fifty five rooms off Tombia Street with a pool, a bar under the trees and a generator that carries the building through the night.',
   4, '14:00', '12:00', 'No smoking in the rooms.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'RI', 'Port Harcourt', 'GRA Phase 2', null, 4.8095, 7.018, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000d', 'eb000000-0000-4000-8000-00000000000d', 'Rumuokoro Lodge', 'rumuokoro-lodge',
   'Eighteen plain rooms near the Rumuokoro roundabout, with parking inside the compound and a kitchen that cooks to order.',
   2, '13:00', '11:00', 'Reception is staffed through the night.',
   'ef000000-0000-4000-8000-000000000002', 'PUBLISHED', 'RI', 'Port Harcourt', 'Rumuokoro', null, 4.8618, 6.9931, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000e', 'eb000000-0000-4000-8000-00000000000e', 'Bodija Park Hotel', 'bodija-park-hotel',
   'Thirty rooms on a quiet Old Bodija street with a garden, a restaurant and a car park shaded by mango trees.',
   3, '14:00', '12:00', 'Breakfast is served from 07:00 to 10:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'OY', 'Ibadan', 'Bodija', null, 7.4306, 3.9105, false, true, now()),
  ('ea000000-0000-4000-8000-00000000000f', 'eb000000-0000-4000-8000-00000000000f', 'Jericho Heights Hotel', 'jericho-heights-hotel',
   'Forty rooms on the Jericho ridge with a pool, a gym and a dining room that looks over the city.',
   4, '14:00', '12:00', 'No smoking in the rooms.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'OY', 'Ibadan', 'Jericho', null, 7.4056, 3.879, false, true, now()),
  ('ea000000-0000-4000-8000-000000000010', 'eb000000-0000-4000-8000-000000000010', 'Independence Layout Hotel', 'independence-layout-hotel',
   'Twenty eight rooms in Independence Layout with a restaurant, a bar in the garden and parking inside the gate.',
   3, '14:00', '12:00', 'Visitors sign in at reception.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'EN', 'Enugu', 'Independence Layout', null, 6.4413, 7.5203, false, true, now()),
  ('ea000000-0000-4000-8000-000000000011', 'eb000000-0000-4000-8000-000000000011', 'Nassarawa GRA Hotel', 'nassarawa-gra-hotel',
   'Thirty two rooms in a walled compound on a quiet GRA street, with a garden, a dining room and parking for a dozen cars.',
   3, '14:00', '12:00', 'No smoking in the rooms.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'KN', 'Kano', 'Nassarawa GRA', null, 12.0022, 8.542, false, true, now()),
  ('ea000000-0000-4000-8000-000000000012', 'eb000000-0000-4000-8000-000000000012', 'Barnawa Court Hotel', 'barnawa-court-hotel',
   'Twenty four rooms in Barnawa with a restaurant, a small conference room and a generator on a changeover.',
   3, '14:00', '12:00', 'Reception is staffed through the night.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'KD', 'Kaduna', 'Barnawa', null, 10.4806, 7.4165, false, true, now()),
  ('ea000000-0000-4000-8000-000000000013', 'eb000000-0000-4000-8000-000000000013', 'Marina Resort Calabar', 'marina-resort-calabar',
   'Thirty six rooms and eight chalets in gardens near the Marina, with a pool, a terrace restaurant and the river a short walk away.',
   4, '14:00', '12:00', 'Children welcome. The pool closes at 21:00.',
   'ef000000-0000-4000-8000-000000000001', 'PUBLISHED', 'CR', 'Calabar', 'Marian', null, 4.9589, 8.3269, false, true, now()),
  ('ea000000-0000-4000-8000-000000000014', 'eb000000-0000-4000-8000-000000000014', 'Rayfield Guest House', 'rayfield-guest-house',
   'Sixteen rooms in a stone house in Rayfield, with a garden, a fireplace in the sitting room and the cool Jos evenings that need no air conditioning.',
   3, '13:00', '11:00', 'Breakfast is served from 07:00 to 10:00.',
   'ef000000-0000-4000-8000-000000000002', 'PUBLISHED', 'PL', 'Jos', 'Rayfield', null, 9.8167, 8.8833, false, true, now())
on conflict (id) do nothing;

insert into public.accommodation_amenities (accommodation_id, amenity_id)
select s.accommodation_id, am.id
from (values
  ('ea000000-0000-4000-8000-000000000001'::uuid, array['wifi','ac','parking','gym','generator','security','elevator','tv']),
  ('ea000000-0000-4000-8000-000000000002'::uuid, array['wifi','ac','parking','gym','pool','generator','security','elevator','kitchen','laundry','balcony']),
  ('ea000000-0000-4000-8000-000000000003'::uuid, array['wifi','ac','parking','pool','generator','security','garden','balcony']),
  ('ea000000-0000-4000-8000-000000000004'::uuid, array['wifi','ac','parking','generator','security','tv','elevator']),
  ('ea000000-0000-4000-8000-000000000005'::uuid, array['wifi','ac','parking','generator','security','garden','tv']),
  ('ea000000-0000-4000-8000-000000000006'::uuid, array['wifi','ac','parking','pool','gym','generator','security','elevator','tv']),
  ('ea000000-0000-4000-8000-000000000007'::uuid, array['wifi','ac','parking','generator','security','garden','tv']),
  ('ea000000-0000-4000-8000-000000000008'::uuid, array['wifi','ac','parking','generator','security','elevator','tv','gym']),
  ('ea000000-0000-4000-8000-000000000009'::uuid, array['wifi','ac','parking','pool','gym','generator','security','elevator','garden']),
  ('ea000000-0000-4000-8000-00000000000a'::uuid, array['wifi','ac','parking','gym','generator','security','elevator','kitchen','laundry']),
  ('ea000000-0000-4000-8000-00000000000b'::uuid, array['wifi','ac','parking','generator','security','tv']),
  ('ea000000-0000-4000-8000-00000000000c'::uuid, array['wifi','ac','parking','pool','generator','security','elevator','tv']),
  ('ea000000-0000-4000-8000-00000000000d'::uuid, array['wifi','ac','parking','generator','security','tv']),
  ('ea000000-0000-4000-8000-00000000000e'::uuid, array['wifi','ac','parking','generator','security','garden','tv']),
  ('ea000000-0000-4000-8000-00000000000f'::uuid, array['wifi','ac','parking','pool','gym','generator','security','elevator']),
  ('ea000000-0000-4000-8000-000000000010'::uuid, array['wifi','ac','parking','generator','security','tv','garden']),
  ('ea000000-0000-4000-8000-000000000011'::uuid, array['wifi','ac','parking','generator','security','garden','tv']),
  ('ea000000-0000-4000-8000-000000000012'::uuid, array['wifi','ac','parking','generator','security','tv']),
  ('ea000000-0000-4000-8000-000000000013'::uuid, array['wifi','ac','parking','pool','generator','security','garden','balcony']),
  ('ea000000-0000-4000-8000-000000000014'::uuid, array['wifi','parking','generator','security','garden','tv'])
) as s(accommodation_id, codes)
join public.amenities am on am.code = any (s.codes)
on conflict do nothing;

/* ------------------------------------------------------- 10. the rooms */

insert into public.room_types (
  id, accommodation_id, name, category, description, sleeps, beds, size_sqm,
  units_total, base_rate_minor, status, is_demo
) values
  ('ec000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-000000000001', 'Classic Double', 'double',
   'A queen bed, a desk and a city view.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 26, 40, 85000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000002', 'ea000000-0000-4000-8000-000000000001', 'Twin Room', 'twin',
   'Two single beds, for colleagues travelling together.',
   2, '[{"kind":"single","count":2}]'::jsonb, 26, 30, 95000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000003', 'ea000000-0000-4000-8000-000000000001', 'Executive Suite', 'suite',
   'A separate sitting room, a king bed and the lagoon from both.',
   3, '[{"kind":"king","count":1}]'::jsonb, 52, 12, 180000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000004', 'ea000000-0000-4000-8000-000000000002', 'One Bedroom Apartment', 'suite',
   'A bedroom, a living room with a full kitchen and a balcony over the water.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 68, 18, 120000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000005', 'ea000000-0000-4000-8000-000000000002', 'Two Bedroom Apartment', 'family',
   'Two bedrooms, two bathrooms, a full kitchen and a dining table for six.',
   4, '[{"kind":"queen","count":2}]'::jsonb, 110, 10, 210000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000006', 'ea000000-0000-4000-8000-000000000003', 'Garden Room', 'double',
   'A king bed and a private patio onto the gardens, a minute from the pool.',
   2, '[{"kind":"king","count":1}]'::jsonb, 34, 24, 150000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000007', 'ea000000-0000-4000-8000-000000000003', 'Lagoon Villa', 'family',
   'Two bedrooms, a living room and a terrace on the water with its own plunge pool.',
   4, '[{"kind":"king","count":1},{"kind":"queen","count":1}]'::jsonb, 120, 6, 320000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000008', 'ea000000-0000-4000-8000-000000000004', 'Standard Double', 'double',
   'A double bed, a desk and blackout curtains for a day sleep.',
   2, '[{"kind":"double","count":1}]'::jsonb, 24, 34, 45000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000009', 'ea000000-0000-4000-8000-000000000004', 'Executive Room', 'double',
   'A queen bed, a sitting corner and a bath as well as a shower.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 32, 18, 68000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000a', 'ea000000-0000-4000-8000-000000000005', 'Standard Single', 'single',
   'A single bed, a desk and a window onto the garden.',
   1, '[{"kind":"single","count":1}]'::jsonb, 16, 6, 28000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000b', 'ea000000-0000-4000-8000-000000000005', 'Standard Double', 'double',
   'A double bed and a small sitting corner.',
   2, '[{"kind":"double","count":1}]'::jsonb, 22, 8, 38000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000c', 'ea000000-0000-4000-8000-000000000006', 'Deluxe Double', 'double',
   'A queen bed, a work desk and a balcony over the pool deck.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 28, 36, 92000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000d', 'ea000000-0000-4000-8000-000000000006', 'Junior Suite', 'suite',
   'A king bed with a sitting area and a bath by the window.',
   3, '[{"kind":"king","count":1}]'::jsonb, 46, 14, 165000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000e', 'ea000000-0000-4000-8000-000000000007', 'Standard Single', 'single',
   'A single bed, a desk and a window onto the garden.',
   1, '[{"kind":"single","count":1}]'::jsonb, 16, 6, 35000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000000f', 'ea000000-0000-4000-8000-000000000007', 'Standard Double', 'double',
   'A double bed and a small sitting corner.',
   2, '[{"kind":"double","count":1}]'::jsonb, 22, 6, 48000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000010', 'ea000000-0000-4000-8000-000000000008', 'Deluxe Double', 'double',
   'A queen bed, a work desk and blackout curtains.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 28, 28, 70000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000011', 'ea000000-0000-4000-8000-000000000008', 'Junior Suite', 'suite',
   'A king bed with a sitting area and the city from the top floors.',
   3, '[{"kind":"king","count":1}]'::jsonb, 44, 12, 125000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000012', 'ea000000-0000-4000-8000-000000000009', 'Classic King', 'double',
   'A king bed, a desk and a window seat over the garden.',
   2, '[{"kind":"king","count":1}]'::jsonb, 36, 30, 140000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000013', 'ea000000-0000-4000-8000-000000000009', 'Hill Suite', 'suite',
   'A sitting room, a king bed and a terrace facing the hill.',
   3, '[{"kind":"king","count":1}]'::jsonb, 64, 10, 260000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000014', 'ea000000-0000-4000-8000-00000000000a', 'Studio Apartment', 'entire_flat',
   'A studio with a kitchen, a desk and a window over the trees.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 42, 16, 65000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000015', 'ea000000-0000-4000-8000-00000000000a', 'One Bedroom Apartment', 'suite',
   'A bedroom, a living room with a kitchen and a balcony.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 66, 12, 95000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000016', 'ea000000-0000-4000-8000-00000000000b', 'Standard Double', 'double',
   'A double bed, a fan and an air conditioner, and a window onto the street.',
   2, '[{"kind":"double","count":1}]'::jsonb, 20, 10, 25000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000017', 'ea000000-0000-4000-8000-00000000000c', 'Standard Double', 'double',
   'A double bed, a desk and a window over the garden.',
   2, '[{"kind":"double","count":1}]'::jsonb, 26, 30, 55000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000018', 'ea000000-0000-4000-8000-00000000000c', 'Executive Suite', 'suite',
   'A sitting room, a king bed and a bath by the window.',
   3, '[{"kind":"king","count":1}]'::jsonb, 48, 10, 120000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000019', 'ea000000-0000-4000-8000-00000000000d', 'Standard Double', 'double',
   'A double bed, an air conditioner and a shower.',
   2, '[{"kind":"double","count":1}]'::jsonb, 20, 18, 22000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001a', 'ea000000-0000-4000-8000-00000000000e', 'Standard Double', 'double',
   'A double bed, a desk and a window onto the garden.',
   2, '[{"kind":"double","count":1}]'::jsonb, 24, 22, 32000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001b', 'ea000000-0000-4000-8000-00000000000e', 'Family Room', 'family',
   'A double and two singles, for a family travelling together.',
   4, '[{"kind":"double","count":1},{"kind":"single","count":2}]'::jsonb, 38, 8, 52000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001c', 'ea000000-0000-4000-8000-00000000000f', 'Deluxe Double', 'double',
   'A queen bed, a work desk and a balcony.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 28, 28, 48000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001d', 'ea000000-0000-4000-8000-00000000000f', 'Junior Suite', 'suite',
   'A king bed with a sitting area and a bath as well as a shower.',
   3, '[{"kind":"king","count":1}]'::jsonb, 44, 8, 88000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001e', 'ea000000-0000-4000-8000-000000000010', 'Standard Double', 'double',
   'A double bed, an air conditioner and a desk.',
   2, '[{"kind":"double","count":1}]'::jsonb, 24, 20, 30000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-00000000001f', 'ea000000-0000-4000-8000-000000000010', 'Executive Room', 'double',
   'A queen bed, a sitting corner and a bath.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 32, 8, 45000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000020', 'ea000000-0000-4000-8000-000000000011', 'Standard Double', 'double',
   'A double bed, an air conditioner and a window onto the garden.',
   2, '[{"kind":"double","count":1}]'::jsonb, 24, 24, 28000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000021', 'ea000000-0000-4000-8000-000000000011', 'Family Room', 'family',
   'A double and two singles, with room for a cot.',
   4, '[{"kind":"double","count":1},{"kind":"single","count":2}]'::jsonb, 40, 8, 46000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000022', 'ea000000-0000-4000-8000-000000000012', 'Standard Double', 'double',
   'A double bed, an air conditioner and a desk.',
   2, '[{"kind":"double","count":1}]'::jsonb, 22, 20, 25000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000023', 'ea000000-0000-4000-8000-000000000013', 'Garden Room', 'double',
   'A queen bed and a patio onto the gardens.',
   2, '[{"kind":"queen","count":1}]'::jsonb, 30, 26, 42000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000024', 'ea000000-0000-4000-8000-000000000013', 'Chalet', 'family',
   'A separate chalet with two rooms and a veranda under the trees.',
   4, '[{"kind":"queen","count":1},{"kind":"single","count":2}]'::jsonb, 62, 8, 78000::bigint * 100, 'PUBLISHED', true),
  ('ec000000-0000-4000-8000-000000000025', 'ea000000-0000-4000-8000-000000000014', 'Standard Double', 'double',
   'A double bed, a heater for the harmattan and a window onto the garden.',
   2, '[{"kind":"double","count":1}]'::jsonb, 24, 16, 30000::bigint * 100, 'PUBLISHED', true)
on conflict (id) do nothing;

/* ----------------------------------- 11. two rates on every room type */

-- A flexible rate with breakfast at ten percent over the base, and the room
-- only non-refundable rate at the base. Integer kobo throughout.
insert into public.rate_plans (room_type_id, name, meal_plan, cancellation_policy_id, rate_minor, min_stay_nights, max_stay_nights, active)
select rt.id, 'Flexible with breakfast', 'breakfast', 'ef000000-0000-4000-8000-000000000001',
       rt.base_rate_minor * 110 / 100, 1, 30, true
from public.room_types rt
join public.accommodations a on a.id = rt.accommodation_id
join public.businesses bz on bz.id = a.business_id
where bz.owner_id = 'e0000000-0000-4000-8000-000000000001' and rt.is_demo
on conflict (room_type_id, name) do nothing;

insert into public.rate_plans (room_type_id, name, meal_plan, cancellation_policy_id, rate_minor, min_stay_nights, max_stay_nights, active)
select rt.id, 'Room only, non-refundable', 'room_only', 'ef000000-0000-4000-8000-000000000002',
       rt.base_rate_minor, 1, 30, true
from public.room_types rt
join public.accommodations a on a.id = rt.accommodation_id
join public.businesses bz on bz.id = a.business_id
where bz.owner_id = 'e0000000-0000-4000-8000-000000000001' and rt.is_demo
on conflict (room_type_id, name) do nothing;

/* --------------------- 12. ninety nights of rates and rooms to sell */

-- Fridays and Saturdays carry a fifteen percent uplift, in integer arithmetic.
-- Relative to the day this is applied, so a dated search finds rooms whenever
-- the founder runs it. A second run only adds the days that were not there.
insert into public.rate_calendar (rate_plan_id, date, rate_minor, closed)
select rp.id, d::date,
       case when extract(dow from d) in (5, 6) then rp.rate_minor * 115 / 100 else null end,
       false
from public.rate_plans rp
join public.room_types rt on rt.id = rp.room_type_id
join public.accommodations a on a.id = rt.accommodation_id and a.is_demo
join public.businesses bz on bz.id = a.business_id and bz.owner_id = 'e0000000-0000-4000-8000-000000000001'
cross join generate_series(current_date, current_date + 89, interval '1 day') d
on conflict (rate_plan_id, date) do nothing;

insert into public.room_inventory (room_type_id, date, units_open, units_booked)
select rt.id, d::date, rt.units_total, 0
from public.room_types rt
join public.accommodations a on a.id = rt.accommodation_id and a.is_demo
join public.businesses bz on bz.id = a.business_id and bz.owner_id = 'e0000000-0000-4000-8000-000000000001'
cross join generate_series(current_date, current_date + 89, interval '1 day') d
on conflict (room_type_id, date) do nothing;

/* -------------------------------------------- 13. photographs on the stays */

-- `accommodation_photos_accommodation_id_position_key` is DEFERRABLE, and
-- Postgres will not take a deferrable constraint as an ON CONFLICT arbiter,
-- so this one is made repeatable with a NOT EXISTS instead.
insert into public.accommodation_photos (accommodation_id, storage_path, position)
select v.accommodation_id, v.storage_path, v.position
from (values
  ('ea000000-0000-4000-8000-000000000001'::uuid, 'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000001', 'https://images.unsplash.com/photo-1742844552193-2fd3425cd26d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000002', 'https://images.unsplash.com/photo-1730367019960-9906d9cbbf05?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1678978866819-306ed8608e7f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1673687785095-f1b45db8a6cb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000003', 'https://images.unsplash.com/photo-1697823749604-70de24401346?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1631049552240-59c37f38802b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000004', 'https://images.unsplash.com/photo-1759462692354-404b2c995c99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1661872952496-e4e3833d2fdf?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000005', 'https://images.unsplash.com/photo-1743061339900-e40775a80524?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjByb29tJTIwaW50ZXJpb3IlMjBiZWR8ZW58MHwwfHx8MTc5NTY4MTkwMnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1794792480022-a05f2facccf0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000006', 'https://images.unsplash.com/photo-1710707919141-f02f9bbe3477?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MzB8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjByb29tJTIwaW50ZXJpb3IlMjBiZWR8ZW58MHwwfHx8MTc5NTY4MTkwMnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000007', 'https://images.unsplash.com/photo-1742844552193-2fd3425cd26d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000008', 'https://images.unsplash.com/photo-1723465302725-ff46b3e165f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1661872952496-e4e3833d2fdf?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1690529950980-bd438d373cf3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8aG90ZWwlMjBzd2ltbWluZyUyMHBvb2wlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000009', 'https://images.unsplash.com/photo-1730367019960-9906d9cbbf05?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000a', 'https://images.unsplash.com/photo-1710707919141-f02f9bbe3477?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MzB8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1678978866819-306ed8608e7f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000b', 'https://images.unsplash.com/photo-1697823749604-70de24401346?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1631049307485-2bfb23080676?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8aG90ZWwlMjBiZWRyb29tJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4MTY1Nnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1774284498049-eee34f796ce7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000c', 'https://images.unsplash.com/photo-1723465302725-ff46b3e165f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1631049552240-59c37f38802b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000d', 'https://images.unsplash.com/photo-1759462692354-404b2c995c99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1661872952496-e4e3833d2fdf?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000e', 'https://images.unsplash.com/photo-1730367019960-9906d9cbbf05?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1678978866819-306ed8608e7f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1774281267183-93e0632b50d1?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-00000000000f', 'https://images.unsplash.com/photo-1697823749604-70de24401346?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1631049552240-59c37f38802b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000010', 'https://images.unsplash.com/photo-1743061339900-e40775a80524?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1631049307485-2bfb23080676?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8aG90ZWwlMjBiZWRyb29tJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4MTY1Nnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000011', 'https://images.unsplash.com/photo-1723465302725-ff46b3e165f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000012', 'https://images.unsplash.com/photo-1742844552193-2fd3425cd26d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1631049307485-2bfb23080676?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8aG90ZWwlMjBiZWRyb29tJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4MTY1Nnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1695757928813-a87bfa2130f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGhvdGVsJTIwcG9vbCUyMGRlY2t8ZW58MHwwfHx8MTc5NTY4MTY1Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('ea000000-0000-4000-8000-000000000013', 'https://images.unsplash.com/photo-1759462692354-404b2c995c99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 3),
  ('ea000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjByb29tJTIwaW50ZXJpb3IlMjBiZWR8ZW58MHwwfHx8MTc5NTY4MTkwMnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('ea000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('ea000000-0000-4000-8000-000000000014', 'https://images.unsplash.com/photo-1710707919141-f02f9bbe3477?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MzB8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2)
) as v(accommodation_id, storage_path, position)
where not exists (
  select 1 from public.accommodation_photos p
   where p.accommodation_id = v.accommodation_id and p.position = v.position
);

/* ------------------------------------------------- 14. the restaurants */

insert into public.restaurant_profiles (business_id, cuisines, price_band, menu_url, dress_code, parking, power_backup, outdoor)
values
  ('eb000000-0000-4000-8000-000000000065', array['seafood','grill','nigerian'], 3, null, 'Smart casual', true, true, true),
  ('eb000000-0000-4000-8000-000000000066', array['continental','nigerian'], 4, null, 'Smart', true, true, false),
  ('eb000000-0000-4000-8000-000000000067', array['nigerian','grill','suya'], 2, null, null, true, true, true),
  ('eb000000-0000-4000-8000-000000000068', array['nigerian','rice'], 1, null, null, false, true, false),
  ('eb000000-0000-4000-8000-000000000069', array['nigerian','amala','soup'], 1, null, null, false, true, true),
  ('eb000000-0000-4000-8000-00000000006a', array['grill','continental','nigerian'], 3, null, 'Smart casual', true, true, true),
  ('eb000000-0000-4000-8000-00000000006b', array['nigerian','soup','grill'], 1, null, null, true, true, true),
  ('eb000000-0000-4000-8000-00000000006c', array['breakfast','continental','nigerian'], 2, null, null, true, true, true),
  ('eb000000-0000-4000-8000-00000000006d', array['nigerian','grill','suya'], 2, null, null, true, true, true),
  ('eb000000-0000-4000-8000-00000000006e', array['continental','nigerian'], 4, null, 'Smart', true, true, false),
  ('eb000000-0000-4000-8000-00000000006f', array['shawarma','grill','lebanese'], 1, null, null, true, true, true),
  ('eb000000-0000-4000-8000-000000000070', array['nigerian','continental','grill'], 3, null, 'Smart casual', true, true, true),
  ('eb000000-0000-4000-8000-000000000071', array['nigerian','seafood','grill'], 2, null, null, true, true, true),
  ('eb000000-0000-4000-8000-000000000072', array['nigerian','amala','rice'], 1, null, null, true, true, false),
  ('eb000000-0000-4000-8000-000000000073', array['nigerian','grill','seafood'], 2, null, null, true, true, true)
on conflict (business_id) do nothing;

-- When each kitchen is open, what the last seating is, and how many covers
-- that window holds. weekday 0 is Sunday.
insert into public.service_windows (business_id, weekday, opens, last_seating, closes, covers)
values
  ('eb000000-0000-4000-8000-000000000065', 1, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 2, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 3, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 4, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 5, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 6, '12:00', '14:30', '16:00', 60),
  ('eb000000-0000-4000-8000-000000000065', 1, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 2, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 3, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 4, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 5, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 6, '18:00', '21:30', '23:00', 80),
  ('eb000000-0000-4000-8000-000000000065', 0, '13:00', '20:00', '21:30', 70),
  ('eb000000-0000-4000-8000-000000000066', 2, '18:30', '21:00', '22:30', 40),
  ('eb000000-0000-4000-8000-000000000066', 3, '18:30', '21:00', '22:30', 40),
  ('eb000000-0000-4000-8000-000000000066', 4, '18:30', '21:00', '22:30', 40),
  ('eb000000-0000-4000-8000-000000000066', 5, '18:30', '21:00', '22:30', 40),
  ('eb000000-0000-4000-8000-000000000066', 6, '18:30', '21:00', '22:30', 40),
  ('eb000000-0000-4000-8000-000000000066', 0, '12:30', '15:00', '16:30', 40),
  ('eb000000-0000-4000-8000-000000000067', 0, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 1, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 2, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 3, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 4, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 5, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000067', 6, '16:00', '22:00', '23:30', 120),
  ('eb000000-0000-4000-8000-000000000068', 1, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000068', 2, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000068', 3, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000068', 4, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000068', 5, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000068', 6, '08:00', '17:30', '18:30', 45),
  ('eb000000-0000-4000-8000-000000000069', 0, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 1, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 2, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 3, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 4, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 5, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-000000000069', 6, '10:00', '19:30', '20:30', 60),
  ('eb000000-0000-4000-8000-00000000006a', 1, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 2, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 3, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 4, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 5, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 6, '12:00', '15:00', '16:00', 50),
  ('eb000000-0000-4000-8000-00000000006a', 1, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006a', 2, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006a', 3, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006a', 4, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006a', 5, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006a', 6, '18:00', '21:30', '23:00', 70),
  ('eb000000-0000-4000-8000-00000000006b', 0, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 1, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 2, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 3, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 4, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 5, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006b', 6, '17:00', '22:30', '23:30', 70),
  ('eb000000-0000-4000-8000-00000000006c', 0, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 1, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 2, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 3, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 4, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 5, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006c', 6, '07:30', '11:30', '12:30', 40),
  ('eb000000-0000-4000-8000-00000000006d', 0, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 1, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 2, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 3, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 4, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 5, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 6, '17:00', '21:30', '23:00', 90),
  ('eb000000-0000-4000-8000-00000000006d', 0, '12:00', '15:30', '16:30', 60),
  ('eb000000-0000-4000-8000-00000000006d', 6, '12:00', '15:30', '16:30', 60),
  ('eb000000-0000-4000-8000-00000000006e', 1, '12:30', '14:30', '15:30', 35),
  ('eb000000-0000-4000-8000-00000000006e', 2, '12:30', '14:30', '15:30', 35),
  ('eb000000-0000-4000-8000-00000000006e', 3, '12:30', '14:30', '15:30', 35),
  ('eb000000-0000-4000-8000-00000000006e', 4, '12:30', '14:30', '15:30', 35),
  ('eb000000-0000-4000-8000-00000000006e', 5, '12:30', '14:30', '15:30', 35),
  ('eb000000-0000-4000-8000-00000000006e', 1, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006e', 2, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006e', 3, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006e', 4, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006e', 5, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006e', 6, '19:00', '21:30', '23:00', 45),
  ('eb000000-0000-4000-8000-00000000006f', 0, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 1, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 2, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 3, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 4, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 5, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-00000000006f', 6, '16:00', '23:00', '23:59', 30),
  ('eb000000-0000-4000-8000-000000000070', 1, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 2, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 3, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 4, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 5, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 6, '12:00', '15:00', '16:00', 55),
  ('eb000000-0000-4000-8000-000000000070', 0, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 1, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 2, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 3, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 4, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 5, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000070', 6, '18:00', '21:30', '22:30', 75),
  ('eb000000-0000-4000-8000-000000000071', 1, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 2, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 3, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 4, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 5, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 6, '12:00', '15:30', '16:30', 50),
  ('eb000000-0000-4000-8000-000000000071', 0, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 1, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 2, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 3, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 4, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 5, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000071', 6, '18:00', '22:00', '23:30', 80),
  ('eb000000-0000-4000-8000-000000000072', 0, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 1, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 2, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 3, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 4, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 5, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000072', 6, '09:00', '18:30', '19:30', 55),
  ('eb000000-0000-4000-8000-000000000073', 0, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 1, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 2, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 3, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 4, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 5, '16:30', '22:00', '23:00', 65),
  ('eb000000-0000-4000-8000-000000000073', 6, '16:30', '22:00', '23:00', 65)
on conflict (business_id, weekday, opens) do nothing;

/* ------------------------------------- 15. photographs on the restaurants */

-- Deferrable unique again, so NOT EXISTS again. See section 13.
insert into public.business_photos (business_id, storage_path, position)
select v.business_id, v.storage_path, v.position
from (values
  ('eb000000-0000-4000-8000-000000000065'::uuid, 'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000065', 'https://images.unsplash.com/photo-1728414862776-9c96320e5762?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000065', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000066', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000066', 'https://images.unsplash.com/photo-1583579366395-c0a857d2182a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000066', 'https://images.unsplash.com/photo-1530799164-fe981d01a118?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000067', 'https://images.unsplash.com/photo-1560053608-13721e0d69e8?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000067', 'https://images.unsplash.com/photo-1610592309005-0f92c8e39cec?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000067', 'https://images.unsplash.com/photo-1580196515879-2d99ad7fd767?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMHRhYmxlcyUyMGNoYWlyc3xlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000068', 'https://images.unsplash.com/photo-1530799164-fe981d01a118?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000068', 'https://images.unsplash.com/photo-1664992960082-0ea299a9c53e?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000068', 'https://images.unsplash.com/photo-1560053608-13721e0d69e8?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000069', 'https://images.unsplash.com/photo-1706359541059-d14a2804fd24?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMGxhZ29zJTIwbmlnZXJpYXxlbnwwfDB8fHwxNzk1NjgxNjI5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000069', 'https://images.unsplash.com/photo-1653981608672-aea09b857b20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000069', 'https://images.unsplash.com/photo-1606836576983-8b458e75221d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006a', 'https://images.unsplash.com/photo-1606836576983-8b458e75221d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006a', 'https://images.unsplash.com/photo-1613526949297-1aba25022d0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006a', 'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006b', 'https://images.unsplash.com/photo-1706359541770-281609aec146?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006b', 'https://images.unsplash.com/photo-1593787614887-004b2ffb0057?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006b', 'https://images.unsplash.com/photo-1706359541059-d14a2804fd24?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMGxhZ29zJTIwbmlnZXJpYXxlbnwwfDB8fHwxNzk1NjgxNjI5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006c', 'https://images.unsplash.com/photo-1706359541036-f4fdb18ce9fc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006c', 'https://images.unsplash.com/photo-1666190092689-e3968aa0c32c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006c', 'https://images.unsplash.com/photo-1706359541770-281609aec146?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006d', 'https://images.unsplash.com/photo-1706359541059-d14a2804fd24?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMGxhZ29zJTIwbmlnZXJpYXxlbnwwfDB8fHwxNzk1NjgxNjI5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006d', 'https://images.unsplash.com/photo-1573225342366-135601b8185d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006d', 'https://images.unsplash.com/photo-1606836576983-8b458e75221d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006e', 'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006e', 'https://images.unsplash.com/photo-1593787614839-9b93c8998f25?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjd8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006e', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-00000000006f', 'https://images.unsplash.com/photo-1530799164-fe981d01a118?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-00000000006f', 'https://images.unsplash.com/photo-1604329756574-bda1f2cada6f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-00000000006f', 'https://images.unsplash.com/photo-1560053608-13721e0d69e8?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000070', 'https://images.unsplash.com/photo-1706359541036-f4fdb18ce9fc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000070', 'https://images.unsplash.com/photo-1664992960082-0ea299a9c53e?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000070', 'https://images.unsplash.com/photo-1706359541770-281609aec146?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000071', 'https://images.unsplash.com/photo-1580196515879-2d99ad7fd767?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMHRhYmxlcyUyMGNoYWlyc3xlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000071', 'https://images.unsplash.com/photo-1573225342366-135601b8185d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000071', 'https://images.unsplash.com/photo-1706359541036-f4fdb18ce9fc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000072', 'https://images.unsplash.com/photo-1580196515879-2d99ad7fd767?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMHRhYmxlcyUyMGNoYWlyc3xlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000072', 'https://images.unsplash.com/photo-1665332195309-9d75071138f0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000072', 'https://images.unsplash.com/photo-1706359541036-f4fdb18ce9fc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2),
  ('eb000000-0000-4000-8000-000000000073', 'https://images.unsplash.com/photo-1706359541770-281609aec146?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 0),
  ('eb000000-0000-4000-8000-000000000073', 'https://images.unsplash.com/photo-1593787614839-9b93c8998f25?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjd8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 1),
  ('eb000000-0000-4000-8000-000000000073', 'https://images.unsplash.com/photo-1706359541059-d14a2804fd24?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMGxhZ29zJTIwbmlnZXJpYXxlbnwwfDB8fHwxNzk1NjgxNjI5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 2)
) as v(business_id, storage_path, position)
where not exists (
  select 1 from public.business_photos p
   where p.business_id = v.business_id and p.position = v.position
);

/* --------------------------------------------------- 16. who took them */

insert into public.photo_credits (storage_path, source, source_id, photographer, photographer_url, photo_url, alt_text)
values
  ('https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'GZ5cKOgeIB0', 'Sven Brandsma',
   'https://unsplash.com/@seffen99', 'https://unsplash.com/photos/light-candle-on-round-white-coffee-table-and-sectional-sofa-GZ5cKOgeIB0', 'light candle on round white coffee table and sectional sofa'),
  ('https://images.unsplash.com/photo-1633505765486-e404bbbec654?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fHN0dWRpbyUyMGFwYXJ0bWVudCUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'IARlbQa6Kc8', 'Spacejoy',
   'https://unsplash.com/@spacejoy', 'https://unsplash.com/photos/a-bedroom-with-a-large-bed-in-a-room-IARlbQa6Kc8', 'a bedroom with a large bed in a room'),
  ('https://images.unsplash.com/photo-1682888818704-6dc91e9d7532?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'FiKcg6EMneY', 'Zac Gudakov',
   'https://unsplash.com/@zacgudakov', 'https://unsplash.com/photos/a-bathroom-with-green-cabinets-and-a-marble-shower-FiKcg6EMneY', 'a bathroom with green cabinets and a marble shower'),
  ('https://images.unsplash.com/photo-1675279200694-8529c73b1fd0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '8PKGjZ2GzuQ', 'Rafael Hoyos Weht',
   'https://unsplash.com/@rhweht', 'https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-next-to-a-window-8PKGjZ2GzuQ', 'a kitchen with a table and chairs next to a window'),
  ('https://images.unsplash.com/photo-1674200861576-bd10243fbdc7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '7taq4zr7yvI', 'Tim Maginery',
   'https://unsplash.com/@imaginaryoptics', 'https://unsplash.com/photos/a-blue-and-white-building-on-a-clear-day-7taq4zr7yvI', 'a blue and white building on a clear day'),
  ('https://images.unsplash.com/photo-1560185127-bdf08e449371?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTh8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'kDtuOUIkwrk', 'Francesca Tosolini',
   'https://unsplash.com/@fromitaly', 'https://unsplash.com/photos/rectangular-brown-and-white-sink-kDtuOUIkwrk', 'rectangular brown and white sink'),
  ('https://images.unsplash.com/photo-1633119713175-c53c29479984?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMG5pZ2VyaWF8ZW58MHwwfHx8MTc5NTY4MTYxN3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '70U9U4UG_bY', 'Emmanuel Ikwuegbu',
   'https://unsplash.com/@emmages', 'https://unsplash.com/photos/a-modern-kitchen-with-marble-counter-tops-and-stainless-steel-appliances-70U9U4UG_bY', 'a modern kitchen with marble counter tops and stainless steel appliances'),
  ('https://images.unsplash.com/photo-1745725427804-4d94df0c5eb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGJ1aWxkaW5nJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE3MTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'QYVarY4t49o', 'Vitalis Nwenyi',
   'https://unsplash.com/@vitalis_nwenyi', 'https://unsplash.com/photos/a-grand-building-with-palm-trees-QYVarY4t49o', 'A grand building with palm trees'),
  ('https://images.unsplash.com/photo-1618221770758-01929bf5ed39?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '4HUhp0vwkbM', 'Spacejoy',
   'https://unsplash.com/@spacejoy', 'https://unsplash.com/photos/white-bed-linen-near-brown-wooden-table-4HUhp0vwkbM', 'white bed linen near brown wooden table'),
  ('https://images.unsplash.com/photo-1560448075-57d0285fc59b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Sh22mtTd2GA', 'Francesca Tosolini',
   'https://unsplash.com/@fromitaly', 'https://unsplash.com/photos/bed-with-comforter-set-beside-table-lamps-on-nightstands-Sh22mtTd2GA', 'bed with comforter set beside table lamps on nightstands'),
  ('https://images.unsplash.com/photo-1601760561441-16420502c7e0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTl8fGtpdGNoZW4lMjBpbnRlcmlvciUyMGFwYXJ0bWVudHxlbnwwfDB8fHwxNzk1NjgxODk4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '1by_GbwEMwc', 'Clay Elliot',
   'https://unsplash.com/@ibidsy', 'https://unsplash.com/photos/white-wooden-kitchen-cabinet-with-white-pendant-lamp-1by_GbwEMwc', 'white wooden kitchen cabinet with white pendant lamp'),
  ('https://images.unsplash.com/photo-1629079447777-1e605162dc8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '1AF5hP6F4tI', 'Steven Ungermann',
   'https://unsplash.com/@steveungermann', 'https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI', 'white ceramic sink with mirror'),
  ('https://images.unsplash.com/photo-1694771170485-e01443be2643?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGhvdXNlJTIwZ2F0ZSUyMGNvbXBvdW5kJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE5MDF8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Wr6Vk7dEv54', 'Michael Ali',
   'https://unsplash.com/@michaeljfali', 'https://unsplash.com/photos/a-house-with-a-fountain-in-front-of-it-Wr6Vk7dEv54', 'a house with a fountain in front of it'),
  ('https://images.unsplash.com/photo-1616137148650-4aa14651e02b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '5oWo6A2IKTc', 'Spacejoy',
   'https://unsplash.com/@spacejoy', 'https://unsplash.com/photos/white-and-black-throw-pillow-on-white-couch-5oWo6A2IKTc', 'white and black throw pillow on white couch'),
  ('https://images.unsplash.com/photo-1606398016782-2f49b8c03e99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'mu9SXNL9n-E', 'Viktor Forgacs',
   'https://unsplash.com/@sonance', 'https://unsplash.com/photos/white-wooden-kitchen-cabinet-with-blue-and-white-electric-kettle-mu9SXNL9n-E', 'white wooden kitchen cabinet with blue and white electric kettle'),
  ('https://images.unsplash.com/photo-1709716539429-8e1beaa68f99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '2LYCkp7H1Ok', 'Mister Paps',
   'https://unsplash.com/@themisterpaps', 'https://unsplash.com/photos/a-tall-building-with-balconies-and-balconies-on-the-balconies-2LYCkp7H1Ok', 'a tall building with balconies and balconies on the balconies'),
  ('https://images.unsplash.com/photo-1600493505873-cddd69453072?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'SrioT6tdWII', 'Collov Home Design',
   'https://unsplash.com/@collovhome', 'https://unsplash.com/photos/brown-wooden-round-table-near-white-sofa-SrioT6tdWII', 'brown wooden round table near white sofa'),
  ('https://images.unsplash.com/photo-1613685703237-6628de38ddb7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'n9CzpBTNElo', 'Collov Home Design',
   'https://unsplash.com/@collovhome', 'https://unsplash.com/photos/white-bed-near-white-window-blinds-n9CzpBTNElo', 'white bed near white window blinds'),
  ('https://images.unsplash.com/photo-1613849925502-7b0f95cbdda0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTd8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'y79dt3dhTxc', 'Zac Gudakov',
   'https://unsplash.com/@zacgudakov', 'https://unsplash.com/photos/red-towel-on-stainless-steel-towel-rack-y79dt3dhTxc', 'red towel on stainless steel towel rack'),
  ('https://images.unsplash.com/photo-1706755347826-29868be54b37?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8YXBhcnRtZW50JTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGFmcmljYXxlbnwwfDB8fHwxNzk1NjgxOTAwfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'nPjaO3Cn62Y', 'Karan Suthar',
   'https://unsplash.com/@karan_suthar_', 'https://unsplash.com/photos/a-tall-building-with-lots-of-windows-and-palm-trees-nPjaO3Cn62Y', 'a tall building with lots of windows and palm trees'),
  ('https://images.unsplash.com/photo-1628592102751-ba83b0314276?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'AB-q9lwCVv8', 'Huy Nguyen',
   'https://unsplash.com/@huynguyen_pch', 'https://unsplash.com/photos/living-room-with-television-and-armchair-AB-q9lwCVv8', 'A modern living room with a television, armchair, and framed abstract art'),
  ('https://images.unsplash.com/photo-1616486532925-accce4930585?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'qGNgjHQjO2k', 'Spacejoy',
   'https://unsplash.com/@spacejoy', 'https://unsplash.com/photos/white-bed-linen-on-bed-qGNgjHQjO2k', 'white bed linen on bed'),
  ('https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'E7yGIdzNE3k', 'taufiq triadi',
   'https://unsplash.com/@mochamadtaufiq23', 'https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-next-to-a-window-E7yGIdzNE3k', 'a kitchen with a table and chairs next to a window'),
  ('https://images.unsplash.com/photo-1668910234725-67cf73dc3add?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'rodWEAfiJaY', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/a-bathroom-with-a-shower-unit-and-toilet-rodWEAfiJaY', 'a bathroom with a shower unit and toilet'),
  ('https://images.unsplash.com/photo-1638454668466-e8dbd5462f20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YmVkcm9vbSUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTd8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'WDUtNbot6Qw', 'Lotus Design N Print',
   'https://unsplash.com/@lotusdnp', 'https://unsplash.com/photos/a-bedroom-with-a-bed-desk-and-a-window-WDUtNbot6Qw', 'a bedroom with a bed, desk, and a window'),
  ('https://images.unsplash.com/photo-1639751898256-e80ef909ea8d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '8WG4EXvdM4M', 'Lotus Design N Print',
   'https://unsplash.com/@lotusdnp', 'https://unsplash.com/photos/a-bathroom-with-a-toilet-sink-shower-and-mirror-8WG4EXvdM4M', 'a bathroom with a toilet, sink, shower and mirror'),
  ('https://images.unsplash.com/photo-1616737833567-11ec6210c5a7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fHNpbXBsZSUyMGJlZHJvb20lMjBpbnRlcmlvciUyMGRheWxpZ2h0fGVufDB8MHx8fDE3OTU2ODE2NDh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'evwisOtjgMg', 'Deconovo',
   'https://unsplash.com/@deconovo', 'https://unsplash.com/photos/gray-textile-on-white-bed-evwisOtjgMg', 'gray textile on white bed'),
  ('https://images.unsplash.com/photo-1648631478953-1334ce24a24c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'XXA2mydQfiw', 'Steven Ungermann',
   'https://unsplash.com/@steveungermann', 'https://unsplash.com/photos/a-room-with-a-sink-and-a-mirror-XXA2mydQfiw', 'a room with a sink and a mirror'),
  ('https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8c2ltcGxlJTIwYmVkcm9vbSUyMGludGVyaW9yJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc5NTY4MTY0OHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'vOa-PSimwg4', 'Spacejoy',
   'https://unsplash.com/@spacejoy', 'https://unsplash.com/photos/bedroom-with-blue-walls-and-bed-vOa-PSimwg4', 'A bedroom with blue walls, a beige bed, and a yellow woven pendant light'),
  ('https://images.unsplash.com/flagged/photo-1556438758-84625859c6b6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwc2hvd2VyJTIwdGlsZXN8ZW58MHwwfHx8MTc5NTY4MTYxOHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'd-zkUcfJbWw', 'Steven Ungermann',
   'https://unsplash.com/@steveungermann', 'https://unsplash.com/photos/white-flush-toilet-d-zkUcfJbWw', 'white flush toilet'),
  ('https://images.unsplash.com/photo-1697291302946-60103b3dd3e3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fGFwYXJ0bWVudCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3IlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTkwMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '24n-oXcmqi4', 'Mauro Lima',
   'https://unsplash.com/@limamauro23', 'https://unsplash.com/photos/a-building-with-palm-trees-in-front-of-it-24n-oXcmqi4', 'a building with palm trees in front of it'),
  ('https://images.unsplash.com/photo-1641375741044-f24db0b79296?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fGFwYXJ0bWVudCUyMGJsb2NrJTIwYmFsY29uaWVzJTIwYWZyaWNhfGVufDB8MHx8fDE3OTU2ODE2NDl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Xw175OcSwzM', 'Karabo Mdluli',
   'https://unsplash.com/@kxrabo', 'https://unsplash.com/photos/a-large-white-building-with-a-mountain-in-the-background-Xw175OcSwzM', 'a large white building with a mountain in the background'),
  ('https://images.unsplash.com/photo-1757792859308-b8d2115a0010?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'KL_xnnjbRgs', 'Clay Banks',
   'https://unsplash.com/@claybanks', 'https://unsplash.com/photos/a-cozy-living-room-with-a-sofa-and-armchair-KL_xnnjbRgs', 'A cozy living room with a sofa and armchair'),
  ('https://images.unsplash.com/photo-1660599299319-0999e117b7ce?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8YXBhcnRtZW50JTIwYmxvY2slMjBiYWxjb25pZXMlMjBhZnJpY2F8ZW58MHwwfHx8MTc5NTY4MTY0OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'ZVe7S_jmX3s', 'Hennie Stander',
   'https://unsplash.com/@henniestander', 'https://unsplash.com/photos/a-building-with-satellite-dishes-ZVe7S_jmX3s', 'a building with satellite dishes'),
  ('https://images.unsplash.com/photo-1560184897-67f4a3f9a7fa?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8c21hbGwlMjBsaXZpbmclMjByb29tJTIwc29mYXxlbnwwfDB8fHwxNzk1NjgxNjUzfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'lLDh9JppH2c', 'Francesca Tosolini',
   'https://unsplash.com/@fromitaly', 'https://unsplash.com/photos/brown-couch-with-two-white-throw-pillows-lLDh9JppH2c', 'brown couch with two white throw pillows'),
  ('https://images.unsplash.com/photo-1702014861373-527115231f8c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMGludGVyaW9yJTIwYXBhcnRtZW50fGVufDB8MHx8fDE3OTU2ODE4OTh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'KUG5LLnuTbo', 'Aquilion Property',
   'https://unsplash.com/@aquilionproperty', 'https://unsplash.com/photos/a-kitchen-with-a-sink-stove-microwave-and-toaster-oven-KUG5LLnuTbo', 'a kitchen with a sink, stove, microwave and toaster oven'),
  ('https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8YXBhcnRtZW50JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE4OTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'VZ2z8ozzy10', 'Prydumano Design',
   'https://unsplash.com/@prydumanodesign', 'https://unsplash.com/photos/a-living-room-with-a-large-green-couch-VZ2z8ozzy10', 'A living room with a large green couch'),
  ('https://images.unsplash.com/photo-1773098587137-1a62971cfedb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8c21hbGwlMjBraXRjaGVuJTIwZ2FzJTIwY29va2VyfGVufDB8MHx8fDE3OTU2ODE2NTR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '6nyTL54GO8w', 'Franco Debartolo',
   'https://unsplash.com/@francotheshooter', 'https://unsplash.com/photos/a-modern-kitchen-with-stainless-steel-appliances-and-wooden-floors-6nyTL54GO8w', 'A modern kitchen with stainless steel appliances and wooden floors'),
  ('https://images.unsplash.com/photo-1643297550841-1386b3a10612?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8bmlnZXJpYSUyMGhvdXNlJTIwY29tcG91bmR8ZW58MHwwfHx8MTc5NTY4MTYyMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'YI5vG37d-Ig', 'Ferdinand Asakome',
   'https://unsplash.com/@oshorhenoya', 'https://unsplash.com/photos/a-white-building-with-columns-on-the-front-of-it-YI5vG37d-Ig', 'a white building with columns on the front of it'),
  ('https://images.unsplash.com/photo-1646592472335-fa6be8e9bc7c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '0qWd-IGUqv4', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/a-bathroom-with-a-toilet-sink-and-bathtub-0qWd-IGUqv4', 'a bathroom with a toilet, sink, and bathtub'),
  ('https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fHNtYWxsJTIwbGl2aW5nJTIwcm9vbSUyMHNvZmF8ZW58MHwwfHx8MTc5NTY4MTY1M3ww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '6japTIjUQoI', 'Francesca Tosolini',
   'https://unsplash.com/@fromitaly', 'https://unsplash.com/photos/living-room-interior-6japTIjUQoI', 'living room interior'),
  ('https://images.unsplash.com/photo-1630699294897-723e02620662?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTZ8fGFwYXJ0bWVudCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxODk2fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '-raUwtFMIpo', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/white-and-gray-sofa-chair-near-white-wall--raUwtFMIpo', 'white and gray sofa chair near white wall'),
  ('https://images.unsplash.com/photo-1605346576608-92f1346b67d6?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'fupf3-xAUqw', 'Albert Vincent Wu',
   'https://unsplash.com/@albertvincentwu', 'https://unsplash.com/photos/white-bed-linen-with-white-table-lamp-fupf3-xAUqw', 'white bed linen with white table lamp'),
  ('https://images.unsplash.com/photo-1634831083590-338cdcd1f160?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTN8fGJhdGhyb29tJTIwaW50ZXJpb3IlMjBzaG93ZXJ8ZW58MHwwfHx8MTc5NTY4MTg5OXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Nt_eOzl3p6o', 'Mike Newbry',
   'https://unsplash.com/@mikenewbry', 'https://unsplash.com/photos/a-bathroom-with-a-sink-mirror-and-bathtub-Nt_eOzl3p6o', 'a bathroom with a sink, mirror, and bathtub'),
  ('https://images.unsplash.com/photo-1742844552193-2fd3425cd26d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'SXePqzrArfY', 'Zoshua Colah',
   'https://unsplash.com/@zoshuacolah', 'https://unsplash.com/photos/a-grand-hotel-lobby-filled-with-sunlight-SXePqzrArfY', 'A grand hotel lobby filled with sunlight'),
  ('https://images.unsplash.com/photo-1730367019960-9906d9cbbf05?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'afEV1IhjkLY', 'Nereid Ndreu',
   'https://unsplash.com/@nereiq', 'https://unsplash.com/photos/a-room-with-a-lot-of-chairs-and-lights-afEV1IhjkLY', 'A room with a lot of chairs and lights'),
  ('https://images.unsplash.com/photo-1678978866819-306ed8608e7f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'H2NpsZJe2IA', 'Le Quan',
   'https://unsplash.com/@mrkheu', 'https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-round-mirror-on-the-wall-H2NpsZJe2IA', 'a bedroom with a large bed and a round mirror on the wall'),
  ('https://images.unsplash.com/photo-1613849925362-38fb4c16ff36?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8YmF0aHJvb20lMjBpbnRlcmlvciUyMHNob3dlcnxlbnwwfDB8fHwxNzk1NjgxODk5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'VCUbsNJdZpQ', 'Zac Gudakov',
   'https://unsplash.com/@zacgudakov', 'https://unsplash.com/photos/black-shower-head-on-white-ceramic-wall-tiles-VCUbsNJdZpQ', 'black shower head on white ceramic wall tiles'),
  ('https://images.unsplash.com/photo-1673687785095-f1b45db8a6cb?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'i8PoYjIp2so', 'Frugal Flyer',
   'https://unsplash.com/@frugalflyer', 'https://unsplash.com/photos/an-empty-swimming-pool-with-lounge-chairs-around-it-i8PoYjIp2so', 'an empty swimming pool with lounge chairs around it'),
  ('https://images.unsplash.com/photo-1697823749604-70de24401346?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTJ8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'qJcWoPTd3As', 'Tomasz Anusiewicz',
   'https://unsplash.com/@oxganggreen', 'https://unsplash.com/photos/a-lobby-with-red-chairs-and-a-spiral-staircase-qJcWoPTd3As', 'a lobby with red chairs and a spiral staircase'),
  ('https://images.unsplash.com/photo-1631049552240-59c37f38802b?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjl8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Kqpw00namok', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/white-bed-linen-on-bed-Kqpw00namok', 'white bed linen on bed'),
  ('https://images.unsplash.com/photo-1759462692354-404b2c995c99?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8aG90ZWwlMjBsb2JieSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE5MDR8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'KR4u_ejqQGw', 'Haris Illahi',
   'https://unsplash.com/@harisillahi', 'https://unsplash.com/photos/modern-lobby-with-contemporary-art-installation-and-seating-area-KR4u_ejqQGw', 'Modern lobby with contemporary art installation and seating area'),
  ('https://images.unsplash.com/photo-1661872952496-e4e3833d2fdf?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjN8fGhvdGVsJTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3OTU2ODE2NTZ8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'pwsHYiy6OPI', 'Andres Q',
   'https://unsplash.com/@aucqsm', 'https://unsplash.com/photos/a-room-with-orange-couches-and-a-black-lamp-pwsHYiy6OPI', 'a room with orange couches and a black lamp'),
  ('https://images.unsplash.com/photo-1743061339900-e40775a80524?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'VFYgT8aP7W0', 'Cristine Despares',
   'https://unsplash.com/@creativitine_1220', 'https://unsplash.com/photos/two-orange-chairs-face-a-painting-VFYgT8aP7W0', 'Two orange chairs face a painting'),
  ('https://images.unsplash.com/photo-1631049421450-348ccd7f8949?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8aG90ZWwlMjByb29tJTIwaW50ZXJpb3IlMjBiZWR8ZW58MHwwfHx8MTc5NTY4MTkwMnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '_Swg04CP0bU', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/white-bed-linen-on-bed-_Swg04CP0bU', 'white bed linen on bed'),
  ('https://images.unsplash.com/photo-1682888818696-906287d759f5?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8YmF0aHJvb20lMjBzaG93ZXIlMjB0aWxlc3xlbnwwfDB8fHwxNzk1NjgxNjE4fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'FPim6ZLM6fc', 'Zac Gudakov',
   'https://unsplash.com/@zacgudakov', 'https://unsplash.com/photos/a-bathroom-with-marble-counter-tops-and-green-cabinets-FPim6ZLM6fc', 'a bathroom with marble counter tops and green cabinets'),
  ('https://images.unsplash.com/photo-1794792480022-a05f2facccf0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '1VAj65FtqXA', 'Far Chinberdiev',
   'https://unsplash.com/@fardevio', 'https://unsplash.com/photos/swimming-pool-with-lounge-chairs-1VAj65FtqXA', 'A swimming pool with wooden lounge chairs under a covered patio with vertical gardens'),
  ('https://images.unsplash.com/photo-1710707919141-f02f9bbe3477?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MzB8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'GQT9PtnuFn4', 'Gene Giromini',
   'https://unsplash.com/@ewgino', 'https://unsplash.com/photos/a-lobby-with-a-lot-of-couches-and-trees-GQT9PtnuFn4', 'a lobby with a lot of couches and trees'),
  ('https://images.unsplash.com/photo-1723465302725-ff46b3e165f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjR8fGhvdGVsJTIwbG9iYnklMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'rpcvQHr2qsI', 'Rafi Thissen',
   'https://unsplash.com/@rafithissen', 'https://unsplash.com/photos/a-large-dining-room-with-a-chandelier-hanging-from-the-ceiling-rpcvQHr2qsI', 'A large dining room with a chandelier hanging from the ceiling'),
  ('https://images.unsplash.com/photo-1690529950980-bd438d373cf3?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8aG90ZWwlMjBzd2ltbWluZyUyMHBvb2wlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjh8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '5x_64oEur5I', 'Ben Iwara',
   'https://unsplash.com/@1hundredimages', 'https://unsplash.com/photos/a-swimming-pool-surrounded-by-trees-and-chairs-5x_64oEur5I', 'a swimming pool surrounded by trees and chairs'),
  ('https://images.unsplash.com/photo-1631049307485-2bfb23080676?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NXx8aG90ZWwlMjBiZWRyb29tJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc5NTY4MTY1Nnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'zTKN10KKQcc', 'Point3D Commercial Imaging Ltd.',
   'https://unsplash.com/@3dottawa', 'https://unsplash.com/photos/white-bed-linen-on-bed-zTKN10KKQcc', 'white bed linen on bed'),
  ('https://images.unsplash.com/photo-1774284498049-eee34f796ce7?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'xPyvA9jjFzw', 'Marc Wieland',
   'https://unsplash.com/@mawiswiss', 'https://unsplash.com/photos/rooftop-infinity-pool-overlooking-a-sprawling-cityscape-xPyvA9jjFzw', 'Rooftop infinity pool overlooking a sprawling cityscape'),
  ('https://images.unsplash.com/photo-1774281267183-93e0632b50d1?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8aG90ZWwlMjBwb29sJTIwZGVja3xlbnwwfDB8fHwxNzk1NjgxNjUyfDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '6w5XDQ9_IjY', 'Marc Wieland',
   'https://unsplash.com/@mawiswiss', 'https://unsplash.com/photos/rooftop-infinity-pool-with-lounge-chairs-and-city-view-6w5XDQ9_IjY', 'Rooftop infinity pool with lounge chairs and city view'),
  ('https://images.unsplash.com/photo-1695757928813-a87bfa2130f9?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fGhvdGVsJTIwcG9vbCUyMGRlY2t8ZW58MHwwfHx8MTc5NTY4MTY1Mnww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '-OgwN6ta6mk', 'Karsten Winegeart',
   'https://unsplash.com/@_karsten', 'https://unsplash.com/photos/an-open-door-leading-into-a-body-of-water--OgwN6ta6mk', 'an open door leading into a body of water'),
  ('https://images.unsplash.com/photo-1522336572468-97b06e8ef143?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTR8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'sQopSb2K0CU', 'Andrew Seaman',
   'https://unsplash.com/@amseaman', 'https://unsplash.com/photos/clear-glass-cup-on-brown-wooden-table-sQopSb2K0CU', 'clear glass cup on brown wooden table'),
  ('https://images.unsplash.com/photo-1728414862776-9c96320e5762?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjJ8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'C7UIhcX9UCw', 'Abdul Raheem Kannath',
   'https://unsplash.com/@raheemblacksnows', 'https://unsplash.com/photos/a-white-plate-topped-with-meat-and-rice-next-to-bowls-of-vegetables-C7UIhcX9UCw', 'A white plate topped with meat and rice next to bowls of vegetables'),
  ('https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8N3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '0uAVsDcyD0M', 'Zakaria Zayane',
   'https://unsplash.com/@kazizayane', 'https://unsplash.com/photos/brown-wooden-dining-set-inside-room-0uAVsDcyD0M', 'brown wooden dining set inside room'),
  ('https://images.unsplash.com/photo-1583579366395-c0a857d2182a?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjB8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '8U3MxqPEmJI', 'Markus Winkler',
   'https://unsplash.com/@markuswinkler', 'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-8U3MxqPEmJI', 'cooked food on white ceramic plate'),
  ('https://images.unsplash.com/photo-1530799164-fe981d01a118?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjV8fHJlc3RhdXJhbnQlMjBkaW5pbmclMjByb29tJTIwdGFibGVzfGVufDB8MHx8fDE3OTU2ODE2NTV8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Yx-lrVk1ZHY', 'Mitchell Hollander',
   'https://unsplash.com/@mitchures', 'https://unsplash.com/photos/empty-restaurant-Yx-lrVk1ZHY', 'empty restaurant'),
  ('https://images.unsplash.com/photo-1560053608-13721e0d69e8?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'wfM1Fi-kMaY', 'Igor Rand',
   'https://unsplash.com/@igorrand', 'https://unsplash.com/photos/restaurant-close-up-photography-wfM1Fi-kMaY', 'restaurant close-up photography'),
  ('https://images.unsplash.com/photo-1610592309005-0f92c8e39cec?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'FIGcCVQeGwE', 'Stephen Lartey',
   'https://unsplash.com/@pianisteve', 'https://unsplash.com/photos/pasta-with-meat-on-white-ceramic-plate-FIGcCVQeGwE', 'pasta with meat on white ceramic plate'),
  ('https://images.unsplash.com/photo-1580196515879-2d99ad7fd767?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTB8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMHRhYmxlcyUyMGNoYWlyc3xlbnwwfDB8fHwxNzk1NjgxOTA0fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'tHbWtMFzZZs', 'Nwar Igbariah',
   'https://unsplash.com/@nwarigb', 'https://unsplash.com/photos/brown-wooden-table-with-chairs-tHbWtMFzZZs', 'brown wooden table with chairs'),
  ('https://images.unsplash.com/photo-1664992960082-0ea299a9c53e?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mnx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'woC24wGXsQ8', 'Keesha''s Kitchen',
   'https://unsplash.com/@keeshasskitchen', 'https://unsplash.com/photos/a-bowl-of-food-woC24wGXsQ8', 'a bowl of food'),
  ('https://images.unsplash.com/photo-1706359541059-d14a2804fd24?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fHJlc3RhdXJhbnQlMjBpbnRlcmlvciUyMGxhZ29zJTIwbmlnZXJpYXxlbnwwfDB8fHwxNzk1NjgxNjI5fDA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '5YnAEuntaxc', 'Abraham Eli',
   'https://unsplash.com/@abrahamrayeli', 'https://unsplash.com/photos/the-inside-of-a-fast-food-restaurant-with-tables-and-stools-5YnAEuntaxc', 'the inside of a fast food restaurant with tables and stools'),
  ('https://images.unsplash.com/photo-1653981608672-aea09b857b20?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8NHx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '2MF31z_tJj8', 'mahsa shamshiri fard',
   'https://unsplash.com/@tpmagency', 'https://unsplash.com/photos/a-plate-of-rice-with-a-tomato-on-top-2MF31z_tJj8', 'a plate of rice with a tomato on top'),
  ('https://images.unsplash.com/photo-1606836576983-8b458e75221d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGRpbmluZyUyMHJvb20lMjB0YWJsZXN8ZW58MHwwfHx8MTc5NTY4MTY1NXww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'PYqzYhTNjho', 'Rodeo Project Management Software',
   'https://unsplash.com/@getrodeo', 'https://unsplash.com/photos/black-wooden-table-and-chairs-PYqzYhTNjho', 'black wooden table and chairs'),
  ('https://images.unsplash.com/photo-1613526949297-1aba25022d0c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTV8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'EXHIHvJu4VU', 'Nilantha Sanjeewa',
   'https://unsplash.com/@nila1992', 'https://unsplash.com/photos/cooked-rice-on-brown-wooden-bowl-EXHIHvJu4VU', 'cooked rice on brown wooden bowl'),
  ('https://images.unsplash.com/photo-1706359541770-281609aec146?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Nnx8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'jZn7VGy8W-g', 'Abraham Eli',
   'https://unsplash.com/@abrahamrayeli', 'https://unsplash.com/photos/the-inside-of-a-restaurant-with-tables-and-chairs-jZn7VGy8W-g', 'the inside of a restaurant with tables and chairs'),
  ('https://images.unsplash.com/photo-1593787614887-004b2ffb0057?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MTF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'W7x1gJtFZwM', 'Louis Hansel',
   'https://unsplash.com/@louishansel', 'https://unsplash.com/photos/cooked-food-on-red-ceramic-bowl-W7x1gJtFZwM', 'cooked food on red ceramic bowl'),
  ('https://images.unsplash.com/photo-1706359541036-f4fdb18ce9fc?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8cmVzdGF1cmFudCUyMGludGVyaW9yJTIwbGFnb3MlMjBuaWdlcmlhfGVufDB8MHx8fDE3OTU2ODE2Mjl8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'yzMkDQTWYq4', 'Abraham Eli',
   'https://unsplash.com/@abrahamrayeli', 'https://unsplash.com/photos/the-inside-of-a-restaurant-with-wooden-tables-and-benches-yzMkDQTWYq4', 'the inside of a restaurant with wooden tables and benches'),
  ('https://images.unsplash.com/photo-1666190092689-e3968aa0c32c?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8M3x8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'u8oFTbtcTQM', 'Umair Ali Asad',
   'https://unsplash.com/@umairaliasad', 'https://unsplash.com/photos/a-tray-of-food-u8oFTbtcTQM', 'a tray of food'),
  ('https://images.unsplash.com/photo-1573225342366-135601b8185d?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8OXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'fqujjJ7W4J0', 'Nerfee Mirandilla',
   'https://unsplash.com/@nerfee', 'https://unsplash.com/photos/shallow-focus-photo-of-boiled-egg-and-broccoli-on-brown-rice-fqujjJ7W4J0', 'shallow focus photo of boiled egg and broccoli on brown rice'),
  ('https://images.unsplash.com/photo-1593787614839-9b93c8998f25?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8Mjd8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'Yo8RWHcPwps', 'Louis Hansel',
   'https://unsplash.com/@louishansel', 'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-Yo8RWHcPwps', 'cooked food on white ceramic plate'),
  ('https://images.unsplash.com/photo-1604329756574-bda1f2cada6f?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MjF8fG5pZ2VyaWFuJTIwZm9vZCUyMGpvbGxvZiUyMHJpY2UlMjBzdXlhfGVufDB8MHx8fDE3OTU2ODE2MzB8MA&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', '_VRo59IsqLo', 'Femoree',
   'https://unsplash.com/@femoree', 'https://unsplash.com/photos/rice-with-tomato-and-egg-on-white-ceramic-plate-_VRo59IsqLo', 'rice with tomato and egg on white ceramic plate'),
  ('https://images.unsplash.com/photo-1665332195309-9d75071138f0?ixid=M3wxMTQ1MzYzfDB8MXxzZWFyY2h8MXx8bmlnZXJpYW4lMjBmb29kJTIwam9sbG9mJTIwcmljZSUyMHN1eWF8ZW58MHwwfHx8MTc5NTY4MTYzMHww&ixlib=rb-4.1.0&auto=format&fit=crop&w=1600&q=80', 'unsplash', 'PqG32DYCTM8', 'Keesha''s Kitchen',
   'https://unsplash.com/@keeshasskitchen', 'https://unsplash.com/photos/jollof-rice-with-grilled-fish-dinner-PqG32DYCTM8', 'Jollof rice in a white dish with grilled fish, skewers, and fresh vegetables')
on conflict (storage_path) do update set
  photographer = excluded.photographer,
  photographer_url = excluded.photographer_url,
  photo_url = excluded.photo_url,
  alt_text = excluded.alt_text;

/* ----------------------------------------------------- 17. the self-check */

-- Any failure here undoes the whole paste.
do $check$
declare
  v_listings  integer;
  v_stays     integer;
  v_rest      integer;
  v_rooms     integer;
  v_photos    integer;
  v_credits   integer;
  v_cat       integer;
  v_uncredited integer;
begin
  select count(*) into v_listings from public.listings
   where agent_id = 'e0000000-0000-4000-8000-000000000003' and is_demo and status = 'PUBLISHED';
  select count(*) into v_stays from public.accommodations a
    join public.businesses b on b.id = a.business_id
   where b.owner_id = 'e0000000-0000-4000-8000-000000000001' and a.is_demo;
  select count(*) into v_rest from public.businesses
   where owner_id = 'e0000000-0000-4000-8000-000000000001' and kind = 'restaurant' and is_demo;
  select count(*) into v_rooms from public.room_types rt
    join public.accommodations a on a.id = rt.accommodation_id
    join public.businesses b on b.id = a.business_id
   where b.owner_id = 'e0000000-0000-4000-8000-000000000001' and rt.is_demo;
  select count(*) into v_photos from public.listing_photos lp
    join public.listings l on l.id = lp.listing_id
   where l.agent_id = 'e0000000-0000-4000-8000-000000000003';
  select count(*) into v_credits from public.photo_credits where source = 'unsplash';

  if v_listings <> 65 then
    raise exception 'expected 65 example listings, found %', v_listings; end if;
  if v_stays <> 20 then
    raise exception 'expected 20 example stays, found %', v_stays; end if;
  if v_rest <> 15 then
    raise exception 'expected 15 example restaurants, found %', v_rest; end if;
  if v_rooms <> 37 then
    raise exception 'expected 37 example room types, found %', v_rooms; end if;

  -- Every example listing carries a cover and at least three photographs.
  if exists (
    select 1 from public.listings l
     where l.agent_id = 'e0000000-0000-4000-8000-000000000003' and l.is_demo
       and (select count(*) from public.listing_photos lp where lp.listing_id = l.id) < 3
  ) then
    raise exception 'an example listing has fewer than three photographs'; end if;

  if exists (
    select 1 from public.listings l
     where l.agent_id = 'e0000000-0000-4000-8000-000000000003' and l.is_demo
       and not exists (select 1 from public.listing_photos lp
                        where lp.listing_id = l.id and lp.position = 0)
  ) then
    raise exception 'an example listing has no cover photograph'; end if;

  -- Nothing hotlinked is uncredited. Unsplash requires the credit.
  select count(*) into v_uncredited from (
    select storage_path from public.listing_photos
    union select storage_path from public.accommodation_photos
    union select storage_path from public.business_photos
  ) p
   where p.storage_path like 'https://images.unsplash.com/%'
     and not exists (select 1 from public.photo_credits c where c.storage_path = p.storage_path);
  if v_uncredited > 0 then
    raise exception '% hotlinked photographs have no credit', v_uncredited; end if;

  -- The badge is structurally impossible on all of it.
  if exists (select 1 from public.listings
              where agent_id = 'e0000000-0000-4000-8000-000000000003' and (not is_demo or featured
                 or address_verified_at is not null or physically_inspected_at is not null)) then
    raise exception 'an example listing carries a trust mark or a feature slot'; end if;
  if exists (select 1 from public.agents where id = 'e0000000-0000-4000-8000-000000000003'
              and (verified or verification_tier > 0 or not is_demo)) then
    raise exception 'the examples agent is not an unverified example account'; end if;

  -- The search catalogue has projected every one of them, flagged as examples.
  select count(*) into v_cat from public.catalogue_entries
   where is_demo and status = 'PUBLISHED';
  if v_cat < 100 then
    raise exception 'the catalogue projected % example rows, expected at least %',
      v_cat, 100; end if;
  if exists (select 1 from public.catalogue_entries where is_demo and verified) then
    raise exception 'an example is marked verified in the catalogue'; end if;

  raise notice 'example catalogue in place: % listings, % stays, % restaurants, % room types, % photographs, % credits, % catalogue rows',
    v_listings, v_stays, v_rest, v_rooms, v_photos, v_credits, v_cat;
end;
$check$;

commit;

