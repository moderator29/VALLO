-- THE EXAMPLE CATALOGUE, PART 5 OF 6: the stays, the rooms and the rates.
--
-- supabase/drafts/example_catalogue_2026-11-26.sql cut into 6 pastes,
-- because 168 KB does not fit in a message. RUN THEM IN ORDER, one at a
-- time, each on its own. Every part is a transaction, so a part either
-- happens or it does not; parts 2 to 6 refuse to start out of order; and
-- part 6 counts everything and fails the paste if a number is wrong.
-- Running a part twice changes nothing.
--
-- Why each thing in here is the way it is: the header of the single-file
-- version in the repository.

begin;

do $part$
begin
  if not exists (select 1 from public.agents where id = 'e0000000-0000-4000-8000-000000000003') then
    raise exception 'Run part 1 first: the examples account is not there yet.';
  end if;
  if not exists (select 1 from pg_tables
                  where schemaname = 'public' and tablename = 'vallo_example_photo') then
    raise exception 'Run the parts in order. Part 2 creates the photograph table and part 6 drops it.';
  end if;
end
$part$;

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

commit;
