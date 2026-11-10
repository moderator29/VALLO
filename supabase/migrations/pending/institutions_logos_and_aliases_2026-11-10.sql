-- VALLO ROOMMATES: SCHOOL LOGOS AND SEARCH ALIASES (10 November 2026).
--
-- DEPENDS ON roommates_5_institutions.sql, roommates_schools_full_list_2026-11-10.sql and
-- roommates_schools_more_2026-11-10.sql being applied first (logos and aliases are set by
-- slug, so a school that is not there yet is simply skipped, and a later run fills it).
-- Not run against live or a local copy. Additive and safe to run twice.
--
-- 1. Three new columns on public.institutions: logo_url, logo_source, aliases.
--    The table's grants (select to anon and authenticated, staff-only write through
--    RLS, roommates_1_core.sql) are table level, so the new columns are readable exactly
--    like the existing ones and no grant changes.
-- 2. 27 logos, found on the English Wikipedia article for each school (the file
--    its page uses for the logo, seal or crest), recorded as a 128px thumbnail on
--    upload.wikimedia.org and the file's description page as logo_source. Each address
--    was fetched on 10 November 2026 and answered HTTP 200 with an image content type.
--    Schools with no verified logo keep logo_url null and the app draws a neutral
--    school icon. Never overwrites a logo staff set (where logo_url is null).
--    LICENSING: a school's logo is its trademark. Recording the address to identify the
--    school in a picker is ordinary use, but many of these files are non-free and hosted
--    on en.wikipedia, not Commons, with their own file page terms. The founder should
--    review licensing, and may prefer to copy the files into a Vallo storage bucket and
--    repoint logo_url (the app's image policy already trusts the Vallo bucket).
-- 3. 41 schools get aliases people type ('OAU Ife', 'Unilag Akoka', 'FUTA Akure',
--    'Poly Ibadan', 'Ife', 'Ibadan'). Existing aliases are kept; new ones are added.
-- 4. private.rm_institution (the small institution object inside roommate and room
--    cards) is replaced with create or replace to add logoUrl; same signature, so its
--    grants stay.

alter table public.institutions
  add column if not exists logo_url text check (logo_url is null or (logo_url like 'https://%' and char_length(logo_url) <= 500)),
  add column if not exists logo_source text check (logo_source is null or (logo_source like 'https://%' and char_length(logo_source) <= 500)),
  add column if not exists aliases text[] not null default '{}' check (cardinality(aliases) <= 20);

create or replace function private.rm_institution(p_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'name', i.name, 'shortName', i.short_name, 'kind', i.kind, 'stateCode', i.state_code, 'city', i.city, 'logoUrl', i.logo_url)
    from public.institutions i where i.id = p_id;
$$;

update public.institutions i
   set logo_url = v.logo_url, logo_source = v.logo_source
  from (values
  ('abia-state-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Abia_State_University_logo.svg/120px-Abia_State_University_logo.svg.png', 'https://en.wikipedia.org/wiki/File:Abia_State_University_logo.svg'),
  ('abubakar-tafawa-balewa-university-bauchi', 'https://upload.wikimedia.org/wikipedia/en/6/6e/Abubakar_Tafawa_Balewa_University_%28crest%29.png', 'https://en.wikipedia.org/wiki/File:Abubakar_Tafawa_Balewa_University_(crest).png'),
  ('adeleke-university-ede', 'https://upload.wikimedia.org/wikipedia/en/0/04/Logo_of_Adeleke_University.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Adeleke_University.png'),
  ('ahmadu-bello-university', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/ABU_Zaria_logo.jpg/120px-ABU_Zaria_logo.jpg', 'https://commons.wikimedia.org/wiki/File:ABU_Zaria_logo.jpg'),
  ('akwa-ibom-state-university-ikot-akpaden', 'https://upload.wikimedia.org/wikipedia/en/1/1f/Akwa_Ibom_State_University_Logo.jpg', 'https://en.wikipedia.org/wiki/File:Akwa_Ibom_State_University_Logo.jpg'),
  ('babcock-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ea/Babcock_University_Logo.jpg/120px-Babcock_University_Logo.jpg', 'https://en.wikipedia.org/wiki/File:Babcock_University_Logo.jpg'),
  ('bayero-university-kano', 'https://upload.wikimedia.org/wikipedia/en/0/04/Bayerouniversitylogo.jpg', 'https://en.wikipedia.org/wiki/File:Bayerouniversitylogo.jpg'),
  ('baze-university', 'https://upload.wikimedia.org/wikipedia/en/d/d9/Logo_of_Baze_University_Abuja%2C_Nigeri.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Baze_University_Abuja%2C_Nigeri.png'),
  ('clifford-university-owerrinta', 'https://upload.wikimedia.org/wikipedia/en/0/0a/Logo_of_Clifford_University.jpg', 'https://en.wikipedia.org/wiki/File:Logo_of_Clifford_University.jpg'),
  ('federal-college-of-education-technical-akoka', 'https://upload.wikimedia.org/wikipedia/en/2/28/FCE%2C_Akoka_logo.png', 'https://en.wikipedia.org/wiki/File:FCE,_Akoka_logo.png'),
  ('federal-polytechnic-offa', 'https://upload.wikimedia.org/wikipedia/en/9/9d/Federal_Polytechnic%2C_Offa_%28logo%29.png', 'https://en.wikipedia.org/wiki/File:Federal_Polytechnic,_Offa_(logo).png'),
  ('federal-university-of-agriculture-abeokuta', 'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/FUNAAB_Logo.jpg/120px-FUNAAB_Logo.jpg', 'https://en.wikipedia.org/wiki/File:FUNAAB_Logo.jpg'),
  ('federal-university-of-technology-owerri', 'https://upload.wikimedia.org/wikipedia/en/thumb/1/16/FUTO_logo.png/120px-FUTO_logo.png', 'https://en.wikipedia.org/wiki/File:FUTO_logo.png'),
  ('glorious-vision-university-ogwa', 'https://upload.wikimedia.org/wikipedia/en/8/8e/Samuel_Adegboyega_University_%28emblem%29.png', 'https://en.wikipedia.org/wiki/File:Samuel_Adegboyega_University_(emblem).png'),
  ('godfrey-okoye-university-enugu', 'https://upload.wikimedia.org/wikipedia/en/a/ab/GOUniversity_logo.jpg', 'https://en.wikipedia.org/wiki/File:GOUniversity_logo.jpg'),
  ('kwara-state-polytechnic', 'https://upload.wikimedia.org/wikipedia/en/thumb/3/32/Kwara_State_Polytechnic_%28logo%29.jpg/120px-Kwara_State_Polytechnic_%28logo%29.jpg', 'https://en.wikipedia.org/wiki/File:Kwara_State_Polytechnic_%28logo%29.jpg'),
  ('lagos-state-university', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Lagos_State_University_logo.png/120px-Lagos_State_University_logo.png', 'https://commons.wikimedia.org/wiki/File:Lagos_State_University_logo.png'),
  ('mcpherson-university-seriki-sotayo', 'https://upload.wikimedia.org/wikipedia/en/a/a8/The_McPherson_University_logo.png', 'https://en.wikipedia.org/wiki/File:The_McPherson_University_logo.png'),
  ('michael-okpara-university-of-agriculture', 'https://upload.wikimedia.org/wikipedia/en/5/5a/Moua_logo.jpg', 'https://en.wikipedia.org/wiki/File:Moua_logo.jpg'),
  ('nile-university-of-nigeria', 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Logo_of_Nile_University_Abuja_Nigeria.svg/120px-Logo_of_Nile_University_Abuja_Nigeria.svg.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Nile_University_Abuja_Nigeria.svg'),
  ('nnamdi-azikiwe-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Badge_of_Nnamdi_Azikiwe_University.png/120px-Badge_of_Nnamdi_Azikiwe_University.png', 'https://en.wikipedia.org/wiki/File:Badge_of_Nnamdi_Azikiwe_University.png'),
  ('pan-atlantic-university', 'https://upload.wikimedia.org/wikipedia/en/thumb/6/66/Logo_of_Pan-Atlantic_University.png/120px-Logo_of_Pan-Atlantic_University.png', 'https://en.wikipedia.org/wiki/File:Logo_of_Pan-Atlantic_University.png'),
  ('paul-university-awka', 'https://upload.wikimedia.org/wikipedia/en/2/25/Paul_University%2C_Awka_school_logo.jpg', 'https://en.wikipedia.org/wiki/File:Paul_University,_Awka_school_logo.jpg'),
  ('renaissance-university-enugu', 'https://upload.wikimedia.org/wikipedia/en/8/8b/Renaissance_University_logo.png', 'https://en.wikipedia.org/wiki/File:Renaissance_University_logo.png'),
  ('university-of-abuja', 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ec/Logo_of_the_University_of_Abuja%2C_Nigeria.png/120px-Logo_of_the_University_of_Abuja%2C_Nigeria.png', 'https://en.wikipedia.org/wiki/File:Logo_of_the_University_of_Abuja%2C_Nigeria.png'),
  ('university-of-ibadan', 'https://upload.wikimedia.org/wikipedia/en/7/7e/University_of_Ibadan_logo.jpeg', 'https://en.wikipedia.org/wiki/File:University_of_Ibadan_logo.jpeg'),
  ('university-of-jos', 'https://upload.wikimedia.org/wikipedia/en/e/ef/University_of_Jos_logo.jpg', 'https://en.wikipedia.org/wiki/File:University_of_Jos_logo.jpg')
  ) as v(slug, logo_url, logo_source)
 where i.slug = v.slug and i.logo_url is null;

update public.institutions i
   set aliases = (select coalesce(array_agg(distinct a), '{}') from unnest(i.aliases || v.aliases) as a)
  from (values
  ('abubakar-tafawa-balewa-university-bauchi', array['ATBU Bauchi', 'Tafawa Balewa University']::text[]),
  ('afe-babalola-university-ado-ekiti', array['ABUAD Ado-Ekiti']::text[]),
  ('ahmadu-bello-university', array['ABU Zaria', 'Zaria']::text[]),
  ('ambrose-alli-university', array['AAU Ekpoma', 'Ekpoma']::text[]),
  ('auchi-polytechnic', array['Auchi']::text[]),
  ('bayero-university-kano', array['BUK Kano']::text[]),
  ('covenant-university', array['CU Ota', 'Covenant Ota']::text[]),
  ('delta-state-university', array['DELSU Abraka', 'Abraka']::text[]),
  ('ekiti-state-university', array['EKSU Ado-Ekiti', 'Ado Ekiti']::text[]),
  ('federal-polytechnic-ilaro', array['Fedpolyilaro']::text[]),
  ('federal-polytechnic-nekede', array['Nekede', 'Fedpolynekede']::text[]),
  ('federal-university-of-agriculture-abeokuta', array['FUNAAB Abeokuta', 'Abeokuta']::text[]),
  ('federal-university-of-petroleum-resources-effurun', array['FUPRE Effurun', 'Effurun']::text[]),
  ('federal-university-of-technology-akure', array['FUTA Akure', 'Akure']::text[]),
  ('federal-university-of-technology-minna', array['FUT Minna', 'Gidan Kwano']::text[]),
  ('federal-university-of-technology-owerri', array['FUT Owerri']::text[]),
  ('federal-university-oye-ekiti', array['FUOYE Oye']::text[]),
  ('joseph-ayo-babalola-university-ikeji-arakeji', array['JABU Ikeji']::text[]),
  ('kwara-state-polytechnic', array['Kwarapoly']::text[]),
  ('ladoke-akintola-university-of-technology', array['LAUTECH Ogbomoso', 'Ogbomoso', 'Ladoke Akintola']::text[]),
  ('lagos-state-university', array['LASU Ojo', 'Ojo']::text[]),
  ('michael-okpara-university-of-agriculture', array['MOUAU Umudike', 'Umudike']::text[]),
  ('moshood-abiola-polytechnic-abeokuta', array['MAPOLY Abeokuta']::text[]),
  ('nigerian-defence-academy', array['NDA Kaduna']::text[]),
  ('nnamdi-azikiwe-university', array['Unizik Awka', 'Awka', 'Nnamdi Azikiwe']::text[]),
  ('obafemi-awolowo-university', array['OAU Ife', 'Ife', 'Ile-Ife', 'Awolowo University', 'Obafemi Awolowo']::text[]),
  ('olabisi-onabanjo-university', array['OOU Ago-Iwoye', 'Ago Iwoye']::text[]),
  ('olusegun-agagu-university-of-science-and-technology-okitipupa', array['OAUSTECH Okitipupa', 'Okitipupa']::text[]),
  ('redeemers-university-ede', array['RUN Ede', 'Redeemers']::text[]),
  ('rivers-state-university', array['RSU Port Harcourt', 'Rivers State University of Science and Technology']::text[]),
  ('the-polytechnic-ibadan', array['Ibadan Poly', 'Ibadan Polytechnic', 'Poly Ibadan']::text[]),
  ('university-of-benin', array['UNIBEN Benin', 'Ugbowo', 'Benin University']::text[]),
  ('university-of-calabar', array['Unical Calabar']::text[]),
  ('university-of-ibadan', array['Ibadan', 'UI Ibadan', 'Ibadan University']::text[]),
  ('university-of-ilorin', array['Unilorin Ilorin']::text[]),
  ('university-of-lagos', array['Unilag Akoka', 'Lagos University', 'Akoka']::text[]),
  ('university-of-maiduguri', array['Unimaid']::text[]),
  ('university-of-nigeria-nsukka', array['UNN Nsukka', 'Nsukka']::text[]),
  ('university-of-port-harcourt', array['Uniport Choba', 'UPH', 'Choba']::text[]),
  ('usmanu-danfodiyo-university', array['UDUS Sokoto', 'Sokoto University', 'UDU']::text[]),
  ('yaba-college-of-technology', array['Yaba Tech', 'Yaba Poly']::text[])
  ) as v(slug, aliases)
 where i.slug = v.slug and not (i.aliases @> v.aliases);

do $check$
declare
  bad int;
begin
  select count(*) into bad from public.institutions where logo_url is not null and logo_url not like 'https://%';
  if bad > 0 then
    raise exception 'logo_url must be https: % rows are not', bad;
  end if;
end
$check$;
