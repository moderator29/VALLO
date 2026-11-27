-- THE EXAMPLE CATALOGUE, PART 2 OF 6: the first 45 photographs.
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
end
$part$;

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
   'https://unsplash.com/photos/dark-house-with-red-flowers-and-a-carport-I-rF9EqWEEM', 'Dark house with red flowers and a carport')
on conflict (key) do nothing;

commit;
