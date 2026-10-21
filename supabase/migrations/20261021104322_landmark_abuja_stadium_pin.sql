-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). Check against the live row before applying:
--   select slug, latitude, longitude from public.landmarks
--    where slug = 'moshood-abiola-national-stadium';
-- It should still read 9.0007, 7.4170 (from 20261011142333_m08_landmarks_seed_abuja.sql).
--
-- WHAT IT FIXES. The Moshood Abiola National Stadium pin sat about six
-- kilometres south-west of the stadium, out past Kukwaba towards Lugbe. The
-- stadium is beside the Airport Road at about 9.040 N, 7.455 E, so "near the
-- stadium" pointed homes at the wrong part of Abuja. The location column is
-- derived from latitude and longitude by the landmarks_location_sync trigger,
-- so only the two numbers change.
--
-- The other pins in both seeds were read against known positions on
-- 17 October 2026; the uncertain ones are listed in
-- supabase/migrations/pending/LANDMARKS.md for a check on a map.

set lock_timeout = '5s';

update public.landmarks
   set latitude = 9.0400, longitude = 7.4550, updated_at = now()
 where slug = 'moshood-abiola-national-stadium'
   and latitude = 9.0007 and longitude = 7.4170;
