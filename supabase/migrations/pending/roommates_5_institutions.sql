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
