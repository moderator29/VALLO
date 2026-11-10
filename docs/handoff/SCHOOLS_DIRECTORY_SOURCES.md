SCHOOLS DIRECTORY: SOURCE LOG

Date: 10 November 2026. Feeds supabase/migrations/pending/roommates_schools_full_list_2026-11-10.sql (NOT APPLIED).

SOURCES USED

1. https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/ : 77 federal universities, with websites. Read 10 Nov 2026.
2. https://www.nuc.edu.ng/nigerian-univerisities/state-univerisity/ : 69 state universities. Read 10 Nov 2026.
3. https://www.nuc.edu.ng/nigerian-univerisities/private-univeristies/ : 182 private universities. Read 10 Nov 2026.
4. https://en.wikipedia.org/wiki/List_of_universities_in_Nigeria : cross-check, state, town and acronym columns. Wikipedia-only addition: Gombe State University of Science and Technology, Kumo. Not on the NUC page and left out: CETEP City University, Khadija University, Nok University (now federal, Kachia).
5. https://en.wikipedia.org/wiki/List_of_polytechnics_in_Nigeria : federal, state and private polytechnics with school web addresses.
6. https://en.wikipedia.org/wiki/List_of_colleges_of_education_in_Nigeria : federal and state colleges of education.
7. https://www.nbte.gov.ng/ : only totals (91 public and 103 private polytechnics at the time read); the institution list page was not available, so NBTE could not be used as a name list.
8. Each school's own home page (the address from sources 1 to 5), fetched 10 Nov 2026, to confirm email domains.

COUNTS (new rows in this file)

Universities: 285
Polytechnics and monotechnics: 147
Colleges of education: 58
Total new: 490 (55 already seeded by roommates_5_institutions.sql)
All 329 universities found in the sources are covered once the first seed is included.

KNOWN GAPS

- Private colleges of education, nursing and health colleges, innovation enterprise institutions and most other monotechnics: no clear list, not included.
- Private polytechnics: only those on the Wikipedia list that could be placed; about 60 are not included (for example Allover Central, Ashi, Edward Olaseni, Fidei, Gloryland, Grace, Graceland, Harry Pass, Hope, Al-Hikmah (Nasarawa)).
- The Wikipedia polytechnic list may lag the NBTE register. Staff can add schools at /admin/roommates (Schools).
- Short names are empty where no acronym students use could be found.
- Towns for some 2022 to 2026 universities and for state colleges of education come from the school's own name; check them.
- Several universities were NOT checked for email domains because the site could not be fetched through our proxy (blocked or timed out); they are left empty, not guessed.
- Email domain equals the school's website domain. Some schools mail from a different domain; staff should confirm before relying on a check for a school.

EMAIL DOMAINS CONFIRMED (144): domain taken from the school's own site address, home page fetched on 10 Nov 2026 and naming the right institution on that domain.

Spiritan University, Nneochi : spiritanuniversity.edu.ng
American University of Nigeria, Yola : aun.edu.ng
Akwa Ibom State University, Ikot Akpaden : aksu.edu.ng
Ritman University, Ikot Ekpene : ritmanuniversity.edu.ng
Chukwuemeka Odumegwu Ojukwu University, Uli : coou.edu.ng
Legacy University, Okija : legacyuniversity.edu.ng
Madonna University, Okija : madonnauniversity.edu.ng
Paul University, Awka : pauluniversity.edu.ng
Bayelsa Medical University : bmu.edu.ng
Federal University, Otuoke : fuotuoke.edu.ng
Arthur Jarvis University, Akpabuyo : arthurjarvisuniversity.edu.ng
Havilla University, Nde-Ikom : havillauniversity.edu.ng
Edwin Clark University, Kiagbodo : edwinclarkuniversity.edu.ng
Michael and Cecilia Ibru University, Agbara-Otor : mciu.edu.ng
Novena University, Ogume : novenauniversity.edu.ng
Western Delta University, Oghara : wdu.edu.ng
Alex Ekwueme Federal University, Ndufu-Alike : funai.edu.ng
David Umahi Federal University of Health Sciences, Uburu : kdums.edu.ng
Ebonyi State University, Abakaliki : ebsu.edu.ng
Evangel University, Akaeze : evangeluniversity.edu.ng
Benson Idahosa University, Benin City : biu.edu.ng
Edo State University, Iyamho : edouniversity.edu.ng
Igbinedion University, Okada : iuokada.edu.ng
Afe Babalola University, Ado-Ekiti : abuad.edu.ng
Hillside University of Science and Technology, Okemisi : hust.edu.ng
Caritas University, Enugu : caritasuni.edu.ng
Coal City University, Enugu : ccu.edu.ng
Federal University of Allied Health Sciences, Enugu : fuahse.edu.ng
Renaissance University, Enugu : rnu.edu.ng
African Aviation and Aerospace University : aaau.edu.ng
Eranova University, Abuja : eranova.edu.ng
National Open University of Nigeria : nou.edu.ng
Hezekiah University, Umudi : hezekiah.edu.ng
Kingsley Ozumba Mbadiwe University, Ogboko : komu.edu.ng
University of Agriculture and Environmental Sciences, Umuagwo : uaes.edu.ng
Federal University, Dutse : fud.edu.ng
Sule Lamido University, Kafin Hausa : slu.edu.ng
Franco British International University, Kaduna : fbiu.edu.ng
Greenfield University, Kaduna : gfu.edu.ng
Federal University, Birnin Kebbi : fubk.edu.ng
Kebbi State University of Science and Technology, Aliero : ksusta.edu.ng
Federal University of Science and Technology, Kabo : fustkabo.edu.ng
Maryam Abacha American University of Nigeria, Kano : maaun.edu.ng
Nigeria Police Academy, Wudil : polac.edu.ng
Skyline University Nigeria, Kano : sun.edu.ng
Confluence University of Science and Technology, Osara : custech.edu.ng
Federal University, Lokoja : fulokoja.edu.ng
Federal University of Transportation, Daura : futd.edu.ng
Umaru Musa Yar'adua University, Katsina : umyu.edu.ng
Summit University, Offa : summituniversity.edu.ng
Thomas Adewumi University, Oko-Irese : tau.edu.ng
Augustine University, Ilara-Epe : augustineuniversity.edu.ng
James Hope University, Lagos : jhu.edu.ng
Bingham University, Karu : binghamuni.edu.ng
Federal University, Lafia : fulafia.edu.ng
Nasarawa State University, Keffi : nsuk.edu.ng
Crawford University, Igbesa : crawforduniversity.edu.ng
Achievers University, Owo : achievers.edu.ng
Elizade University, Ilara-Mokin : elizadeuniversity.edu.ng
Wesley University, Ondo : wesleyuni.edu.ng
Adeleke University, Ede : adelekeuniversity.edu.ng
Bowen University, Iwo : bowen.edu.ng
Fountain University, Osogbo : fuo.edu.ng
Kings University, Ode Omu : kingsuniversity.edu.ng
Osun State University, Osogbo : uniosun.edu.ng
Abiola Ajimobi Technical University, Ibadan (formerly First Technical University) : tech-u.edu.ng
Dominican University, Ibadan : dui.edu.ng
Dominion University, Ibadan : dominionuniversity.edu.ng
Kola Daisi University, Ibadan : koladaisiuniversity.edu.ng
Lead City University, Ibadan : lcu.edu.ng
Plateau State University, Bokkos : plasu.edu.ng
Ignatius Ajuru University of Education, Rumuolumeni : iaue.edu.ng
PAMO University of Medical Sciences, Port Harcourt : pums.edu.ng
Rhema University, Obeama-Asa : rhemauniversity.edu.ng
Wigwe University, Isiokpo : wigweuniversity.edu.ng
Northwest University, Sokoto : nwus.edu.ng
Sokoto State University : ssu.edu.ng
Taraba State University, Jalingo : tsuniversity.edu.ng
Federal University, Gashua : fugashua.edu.ng
Yobe State University, Damaturu : ysu.edu.ng
Iheachukwu Madubuike Institute of Technology, Umunneochi : imit.edu.ng
Madonna College of Health Technology : macohtech.edu.ng
Temple Gate Polytechnic, Aba : tgp.edu.ng
Adamawa State Polytechnic, Yola : adamawapoly.edu.ng
Akwa Ibom State Polytechnic, Ikot Osurua : akwaibompoly.edu.ng
Brainfill Polytechnic, Ikot Ekpene : brainfillpolytechnic.edu.ng
Federal Polytechnic, Ukana : fedpolyukana.edu.ng
Loam Polytechnic : loampolytechnic.edu.ng
Trinity Polytechnic, Uyo : trinitypoly.edu.ng
Anambra State Polytechnic, Mgbakwu : anspoly.edu.ng
Federal Polytechnic, Oko : federalpolyoko.edu.ng
Federal Polytechnic, Bauchi : fptb.edu.ng
Bellarks Polytechnic, Kwale : bellarkspoly.edu.ng
Gboko Polytechnic : gbokopoly.edu.ng
Federal Polytechnic, Monguno : fedpolymonguno.edu.ng
Bayelsa State Polytechnic, Aguobiri : bayelsastatepoly.edu.ng
Federal Polytechnic, Ugep : fedpolyugep.edu.ng
Delta State Polytechnic, Ogwashi-Uku : mydspg.edu.ng
Nation Builders Polytechnic, Asaba : nabcotech.edu.ng
Petroleum Training Institute, Effurun : pti.edu.ng
Edo State Polytechnic, Usen : edopoly.edu.ng
Global Polytechnic, Benin City : theglobalpolytechnic.edu.ng
National Institute of Construction Technology and Management, Uromi : nict.edu.ng
Ajayi Polytechnic, Ikere-Ekiti : ajayipolytechnic.edu.ng
Montgomery Polytechnic, Ikere-Ekiti : montgomerypolytechnic.edu.ng
Federal Polytechnic, Ohodo : fedpod.edu.ng
Dorben Polytechnic, Bwari : dorbenpolytechnic.edu.ng
Hussaini Adamu Federal Polytechnic, Kazaure : hafedpoly.edu.ng
Jigawa State Polytechnic, Dutse : jigpoly.edu.ng
Waziri Umaru Federal Polytechnic, Birnin Kebbi : wufpbk.edu.ng
Federal Polytechnic, Kabo : fedpolykabo.edu.ng
Kano State Polytechnic : kanopoly.edu.ng
Kogi State Polytechnic, Lokoja : kogistatepolytechnic.edu.ng
Katsina Institute of Technology and Management : ksitm.edu.ng
Federal Polytechnic, Offa : fedpoffaonline.edu.ng
Harvard Polytechnic, Ilorin : harvardpolytechnic.edu.ng
Newland Polytechnic, Ilorin : newlandpolytechnic.edu.ng
The Polytechnic, Igbo-Owu : thepolytechnicigboowu.edu.ng
Enville Polytechnic, Ikeja : envillepoly.edu.ng
Inspire Polytechnic, Yaba : inspirepolytechnic.edu.ng
Paramount Polytechnic, Ejigbo : paramountpolytechnic.edu.ng
Ronik Polytechnic, Ejigbo : ronikpolytechnic.edu.ng
College of Agriculture, Science and Technology, Lafia : coastlafia.edu.ng
NACABS Polytechnic, Akwanga : nacabspoly.edu.ng
Federal Polytechnic, Bida : fedpolybida.edu.ng
Abraham Adesanya Polytechnic, Ijebu-Igbo : aapoly.edu.ng
First City Polytechnic, Abeokuta : firstcitypoly.edu.ng
Gateway Polytechnic, Saapade : gaposa.edu.ng
Landmark Polytechnic, Aiyetoro : landmarkpolytechnic.edu.ng
Moshood Abiola Polytechnic, Abeokuta : mapoly.edu.ng
Stars Polytechnic, Ota : starspoly.edu.ng
Best Solution Polytechnic, Akure : bestpotech.edu.ng
British Transatlantic Polytechnic, Akure : britishpoly.edu.ng
Daboss Polytechnic : dabosspolytechnic.edu.ng
Osun State College of Technology, Esa-Oke : oscotechesaoke.edu.ng
The Polytechnic, Iresi : thepolytechniciresi.edu.ng
Adeseun Ogundoyin Polytechnic, Eruwa : aope.edu.ng
Bolmor Polytechnic, Ibadan : bpi.edu.ng
Ibadan City Polytechnic : icp.edu.ng
Oyo State College of Agriculture and Technology, Igboora : oyscatech.edu.ng
The Oke-Ogun Polytechnic, Saki : tops.edu.ng
Federal Polytechnic of Oil and Gas, Bonny : fedpolybonny.edu.ng
Umaru Ali Shinkafi Polytechnic, Sokoto : uasp.edu.ng
Mai Idris Alooma Polytechnic, Geidam : miapoly.edu.ng
