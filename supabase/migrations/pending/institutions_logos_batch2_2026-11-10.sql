-- VALLO ROOMMATES: SCHOOL LOGOS, BATCH 2, AND CONFIRMED EMAIL DOMAINS (10 November 2026).
--
-- DEPENDS ON institutions_logos_and_aliases_2026-11-10.sql (the logo_url, logo_source and
-- aliases columns; already live) and on the school rows from roommates_5, the full list and
-- roommates_schools_more. Not run against live or a local copy. Additive and safe to run twice.
--
-- 1. 221 logos. Each was taken from the school's OWN website (the logo image in the page
--    header, else a clearly logo-named og:image, else its apple-touch-icon or favicon), only
--    from a page whose title or text names the school, then reviewed by eye on contact sheets
--    (photographs, generic site icons, another body's mark and illegible marks were dropped;
--    a picture found for several schools was dropped for all of them). Each was converted to a
--    160 x 160 WebP (under 13 KB) and is served from this app's own origin:
--    apps/web/public/schools/<slug>.webp, so logo_url is https://www.vallospaces.com/schools/<slug>.webp
--    and logo_source is the school page it came from. Nothing is hotlinked from the school.
--    A logo is set where logo_url is null, and also where it still holds the earlier
--    upload.wikimedia.org link (the hosted copy replaces the hotlink). A logo a staff member
--    set to anything else is never overwritten.
--    LICENSING: a school's logo is its trademark. Showing it to identify the school in a picker
--    is ordinary use, but hosting a copy is a step beyond linking to it. The founder should
--    decide whether to keep the copies, and can remove any one by setting logo_url to null and
--    deleting its file. The manifest of what was fetched, from where, and what was rejected is
--    docs/handoff/scripts/school_logos_manifest.json.
-- 2. 28 email domains, each confirmed from the school's own site: its home page was fetched on
--    10 November 2026 and names the school, the site's domain is a .edu.ng or .edu name (a
--    subdomain counts: a student address like name@live.school.edu.ng fits school.edu.ng), and
--    any addresses printed on the page or its contact page are on that same domain. Only rows
--    whose email_domains is empty are touched, and the check is switched on only with a domain.

begin;

update public.institutions i
   set logo_url = v.logo_url, logo_source = v.logo_source
  from (values
  ('abia-state-university', 'https://www.vallospaces.com/schools/abia-state-university.webp', 'https://abiastateuniversity.edu.ng'),
  ('abiola-ajimobi-technical-university-ibadan', 'https://www.vallospaces.com/schools/abiola-ajimobi-technical-university-ibadan.webp', 'https://tech-u.edu.ng'),
  ('abraham-adesanya-polytechnic-ijebu-igbo', 'https://www.vallospaces.com/schools/abraham-adesanya-polytechnic-ijebu-igbo.webp', 'https://aapoly.edu.ng'),
  ('abubakar-tafawa-balewa-university-bauchi', 'https://www.vallospaces.com/schools/abubakar-tafawa-balewa-university-bauchi.webp', 'https://atbu.edu.ng/'),
  ('abubakar-tatari-ali-polytechnic-bauchi', 'https://www.vallospaces.com/schools/abubakar-tatari-ali-polytechnic-bauchi.webp', 'https://atapoly.edu.ng/'),
  ('achievers-university-owo', 'https://www.vallospaces.com/schools/achievers-university-owo.webp', 'https://achievers.edu.ng'),
  ('adamawa-state-polytechnic-yola', 'https://www.vallospaces.com/schools/adamawa-state-polytechnic-yola.webp', 'https://adamawapoly.edu.ng'),
  ('adeleke-university-ede', 'https://www.vallospaces.com/schools/adeleke-university-ede.webp', 'https://adelekeuniversity.edu.ng'),
  ('adeseun-ogundoyin-polytechnic-eruwa', 'https://www.vallospaces.com/schools/adeseun-ogundoyin-polytechnic-eruwa.webp', 'https://aope.edu.ng/website/'),
  ('admiralty-university-ibusa', 'https://www.vallospaces.com/schools/admiralty-university-ibusa.webp', 'https://adun.edu.ng'),
  ('afe-babalola-university-ado-ekiti', 'https://www.vallospaces.com/schools/afe-babalola-university-ado-ekiti.webp', 'https://www.abuad.edu.ng/'),
  ('african-aviation-and-aerospace-university', 'https://www.vallospaces.com/schools/african-aviation-and-aerospace-university.webp', 'https://aaau.edu.ng'),
  ('african-university-of-science-and-technology-abuja', 'https://www.vallospaces.com/schools/african-university-of-science-and-technology-abuja.webp', 'https://aust.edu.ng/'),
  ('ahmadu-bello-university', 'https://www.vallospaces.com/schools/ahmadu-bello-university.webp', 'https://abu.edu.ng'),
  ('ajayi-polytechnic-ikere-ekiti', 'https://www.vallospaces.com/schools/ajayi-polytechnic-ikere-ekiti.webp', 'https://ajayipolytechnic.edu.ng'),
  ('akwa-ibom-state-polytechnic-ikot-osurua', 'https://www.vallospaces.com/schools/akwa-ibom-state-polytechnic-ikot-osurua.webp', 'https://akwaibompoly.edu.ng'),
  ('akwa-ibom-state-university-ikot-akpaden', 'https://www.vallospaces.com/schools/akwa-ibom-state-university-ikot-akpaden.webp', 'https://aksu.edu.ng/web/'),
  ('alex-ekwueme-federal-university-ndufu-alike', 'https://www.vallospaces.com/schools/alex-ekwueme-federal-university-ndufu-alike.webp', 'https://funai.edu.ng'),
  ('ambrose-alli-university', 'https://www.vallospaces.com/schools/ambrose-alli-university.webp', 'https://aauekpoma.edu.ng'),
  ('american-university-of-nigeria-yola', 'https://www.vallospaces.com/schools/american-university-of-nigeria-yola.webp', 'https://aun.edu.ng'),
  ('anambra-state-polytechnic-mgbakwu', 'https://www.vallospaces.com/schools/anambra-state-polytechnic-mgbakwu.webp', 'https://anspoly.edu.ng'),
  ('arthur-jarvis-university-akpabuyo', 'https://www.vallospaces.com/schools/arthur-jarvis-university-akpabuyo.webp', 'https://arthurjarvisuniversity.edu.ng'),
  ('auchi-polytechnic', 'https://www.vallospaces.com/schools/auchi-polytechnic.webp', 'https://auchipoly.edu.ng/ap/'),
  ('babcock-university', 'https://www.vallospaces.com/schools/babcock-university.webp', 'https://babcock.edu.ng'),
  ('bayelsa-medical-university', 'https://www.vallospaces.com/schools/bayelsa-medical-university.webp', 'https://bmu.edu.ng'),
  ('baze-university', 'https://www.vallospaces.com/schools/baze-university.webp', 'https://bazeuniversity.edu.ng'),
  ('bellarks-polytechnic-kwale', 'https://www.vallospaces.com/schools/bellarks-polytechnic-kwale.webp', 'https://bellarkspoly.edu.ng'),
  ('bells-university-of-technology-ota', 'https://www.vallospaces.com/schools/bells-university-of-technology-ota.webp', 'https://www.bellsuniversity.edu.ng/'),
  ('benson-idahosa-university-benin-city', 'https://www.vallospaces.com/schools/benson-idahosa-university-benin-city.webp', 'https://biu.edu.ng'),
  ('benue-state-polytechnic-ugbokolo', 'https://www.vallospaces.com/schools/benue-state-polytechnic-ugbokolo.webp', 'https://benpolyonline.edu.ng/host/'),
  ('best-solution-polytechnic-akure', 'https://www.vallospaces.com/schools/best-solution-polytechnic-akure.webp', 'https://www.bestpotech.edu.ng/'),
  ('bingham-university-karu', 'https://www.vallospaces.com/schools/bingham-university-karu.webp', 'https://binghamuni.edu.ng/v2/'),
  ('binyaminu-usman-polytechnic-hadejia', 'https://www.vallospaces.com/schools/binyaminu-usman-polytechnic-hadejia.webp', 'https://bupoly.edu.ng/'),
  ('bolmor-polytechnic-ibadan', 'https://www.vallospaces.com/schools/bolmor-polytechnic-ibadan.webp', 'https://bpi.edu.ng'),
  ('bowen-university-iwo', 'https://www.vallospaces.com/schools/bowen-university-iwo.webp', 'https://bowen.edu.ng'),
  ('brainfill-polytechnic-ikot-ekpene', 'https://www.vallospaces.com/schools/brainfill-polytechnic-ikot-ekpene.webp', 'https://brainfillpolytechnic.edu.ng'),
  ('british-transatlantic-polytechnic-akure', 'https://www.vallospaces.com/schools/british-transatlantic-polytechnic-akure.webp', 'https://www.britishpoly.edu.ng/'),
  ('caleb-university', 'https://www.vallospaces.com/schools/caleb-university.webp', 'https://calebuniversity.edu.ng'),
  ('calvary-polytechnic', 'https://www.vallospaces.com/schools/calvary-polytechnic.webp', 'https://calvarypoly.edu.ng/'),
  ('captain-elechi-amadi-polytechnic-port-harcourt', 'https://www.vallospaces.com/schools/captain-elechi-amadi-polytechnic-port-harcourt.webp', 'https://ceapoly.edu.ng/'),
  ('caritas-university-enugu', 'https://www.vallospaces.com/schools/caritas-university-enugu.webp', 'https://caritasuni.edu.ng'),
  ('chrisland-university-abeokuta', 'https://www.vallospaces.com/schools/chrisland-university-abeokuta.webp', 'https://www.chrislanduniversity.edu.ng'),
  ('christopher-university-mowe', 'https://www.vallospaces.com/schools/christopher-university-mowe.webp', 'https://christopheruniversity.edu.ng/'),
  ('chukwuemeka-odumegwu-ojukwu-university-uli', 'https://www.vallospaces.com/schools/chukwuemeka-odumegwu-ojukwu-university-uli.webp', 'https://coou.edu.ng'),
  ('coal-city-university-enugu', 'https://www.vallospaces.com/schools/coal-city-university-enugu.webp', 'https://ccu.edu.ng'),
  ('coastal-polytechnic-badagry', 'https://www.vallospaces.com/schools/coastal-polytechnic-badagry.webp', 'https://coastalpoly.edu.ng/'),
  ('college-of-agriculture-science-and-technology-lafia', 'https://www.vallospaces.com/schools/college-of-agriculture-science-and-technology-lafia.webp', 'https://coastlafia.edu.ng'),
  ('confluence-university-of-science-and-technology-osara', 'https://www.vallospaces.com/schools/confluence-university-of-science-and-technology-osara.webp', 'https://custech.edu.ng'),
  ('covenant-polytechnic-aba', 'https://www.vallospaces.com/schools/covenant-polytechnic-aba.webp', 'https://covenantpolytechnic.com/'),
  ('covenant-university', 'https://www.vallospaces.com/schools/covenant-university.webp', 'https://covenantuniversity.edu.ng'),
  ('crawford-university-igbesa', 'https://www.vallospaces.com/schools/crawford-university-igbesa.webp', 'https://crawforduniversity.edu.ng'),
  ('crescent-university-abeokuta', 'https://www.vallospaces.com/schools/crescent-university-abeokuta.webp', 'https://cuab.edu.ng/'),
  ('crown-polytechnic-ado-ekiti', 'https://www.vallospaces.com/schools/crown-polytechnic-ado-ekiti.webp', 'https://crownpolytechnic.edu.ng/'),
  ('d-s-adegbenro-ict-polytechnic-itori', 'https://www.vallospaces.com/schools/d-s-adegbenro-ict-polytechnic-itori.webp', 'https://dsadegbenropoly.edu.ng/'),
  ('daboss-polytechnic', 'https://www.vallospaces.com/schools/daboss-polytechnic.webp', 'https://www.dabosspolytechnic.edu.ng/'),
  ('david-umahi-federal-university-of-health-sciences-uburu', 'https://www.vallospaces.com/schools/david-umahi-federal-university-of-health-sciences-uburu.webp', 'https://kdums.edu.ng'),
  ('delta-state-maritime-polytechnic-burutu', 'https://www.vallospaces.com/schools/delta-state-maritime-polytechnic-burutu.webp', 'https://dsmt.edu.ng/'),
  ('delta-state-polytechnic-ogwashi-uku', 'https://www.vallospaces.com/schools/delta-state-polytechnic-ogwashi-uku.webp', 'https://mydspg.edu.ng'),
  ('delta-state-university', 'https://www.vallospaces.com/schools/delta-state-university.webp', 'https://delsu.edu.ng'),
  ('dominican-university-ibadan', 'https://www.vallospaces.com/schools/dominican-university-ibadan.webp', 'https://www.dui.edu.ng/'),
  ('dominion-university-ibadan', 'https://www.vallospaces.com/schools/dominion-university-ibadan.webp', 'https://dominionuniversity.edu.ng'),
  ('eastern-polytechnic-port-harcourt', 'https://www.vallospaces.com/schools/eastern-polytechnic-port-harcourt.webp', 'https://easternpolytechnic.org/'),
  ('edo-state-polytechnic-usen', 'https://www.vallospaces.com/schools/edo-state-polytechnic-usen.webp', 'https://edopoly.edu.ng'),
  ('edo-state-university-iyamho', 'https://www.vallospaces.com/schools/edo-state-university-iyamho.webp', 'https://edouniversity.edu.ng'),
  ('edwin-clark-university-kiagbodo', 'https://www.vallospaces.com/schools/edwin-clark-university-kiagbodo.webp', 'https://edwinclarkuniversity.edu.ng'),
  ('eko-college-of-management-and-technology-ikotun', 'https://www.vallospaces.com/schools/eko-college-of-management-and-technology-ikotun.webp', 'https://new.ekocity.edu.ng/'),
  ('el-thomp-polytechnic-abak', 'https://www.vallospaces.com/schools/el-thomp-polytechnic-abak.webp', 'https://el-thomp-edu.ng/'),
  ('elizade-university-ilara-mokin', 'https://www.vallospaces.com/schools/elizade-university-ilara-mokin.webp', 'https://elizadeuniversity.edu.ng'),
  ('enugu-state-university-of-science-and-technology', 'https://www.vallospaces.com/schools/enugu-state-university-of-science-and-technology.webp', 'https://www.esut.edu.ng/'),
  ('eranova-university-abuja', 'https://www.vallospaces.com/schools/eranova-university-abuja.webp', 'https://eranova.edu.ng'),
  ('federal-polytechnic-ado-ekiti', 'https://www.vallospaces.com/schools/federal-polytechnic-ado-ekiti.webp', 'https://fedpolyado.edu.ng/'),
  ('federal-polytechnic-bali', 'https://www.vallospaces.com/schools/federal-polytechnic-bali.webp', 'https://fedpolybali.edu.ng/'),
  ('federal-polytechnic-bauchi', 'https://www.vallospaces.com/schools/federal-polytechnic-bauchi.webp', 'https://fptb.edu.ng'),
  ('federal-polytechnic-bida', 'https://www.vallospaces.com/schools/federal-polytechnic-bida.webp', 'https://fedpolybida.edu.ng'),
  ('federal-polytechnic-damaturu', 'https://www.vallospaces.com/schools/federal-polytechnic-damaturu.webp', 'https://www.fedpodam.edu.ng/'),
  ('federal-polytechnic-daura', 'https://www.vallospaces.com/schools/federal-polytechnic-daura.webp', 'https://fedpolydaura.edu.ng/'),
  ('federal-polytechnic-ilaro', 'https://www.vallospaces.com/schools/federal-polytechnic-ilaro.webp', 'https://federalpolyilaro.edu.ng'),
  ('federal-polytechnic-of-oil-and-gas-bonny', 'https://www.vallospaces.com/schools/federal-polytechnic-of-oil-and-gas-bonny.webp', 'https://fedpolybonny.edu.ng'),
  ('federal-polytechnic-offa', 'https://www.vallospaces.com/schools/federal-polytechnic-offa.webp', 'https://fedpoffaonline.edu.ng'),
  ('federal-polytechnic-ohodo', 'https://www.vallospaces.com/schools/federal-polytechnic-ohodo.webp', 'https://fedpod.edu.ng'),
  ('federal-polytechnic-oko', 'https://www.vallospaces.com/schools/federal-polytechnic-oko.webp', 'https://federalpolyoko.edu.ng'),
  ('federal-polytechnic-orogun', 'https://www.vallospaces.com/schools/federal-polytechnic-orogun.webp', 'https://www.fepo.edu.ng/'),
  ('federal-polytechnic-ukana', 'https://www.vallospaces.com/schools/federal-polytechnic-ukana.webp', 'https://fedpolyukana.edu.ng'),
  ('federal-university-birnin-kebbi', 'https://www.vallospaces.com/schools/federal-university-birnin-kebbi.webp', 'https://fubk.edu.ng'),
  ('federal-university-dutse', 'https://www.vallospaces.com/schools/federal-university-dutse.webp', 'https://fud.edu.ng'),
  ('federal-university-gashua', 'https://www.vallospaces.com/schools/federal-university-gashua.webp', 'https://fugashua.edu.ng'),
  ('federal-university-gusau', 'https://www.vallospaces.com/schools/federal-university-gusau.webp', 'https://www.fugusau.edu.ng'),
  ('federal-university-kashere', 'https://www.vallospaces.com/schools/federal-university-kashere.webp', 'https://fukashere.edu.ng/'),
  ('federal-university-lafia', 'https://www.vallospaces.com/schools/federal-university-lafia.webp', 'https://fulafia.edu.ng'),
  ('federal-university-lokoja', 'https://www.vallospaces.com/schools/federal-university-lokoja.webp', 'https://fulokoja.edu.ng'),
  ('federal-university-of-agriculture-abeokuta', 'https://www.vallospaces.com/schools/federal-university-of-agriculture-abeokuta.webp', 'https://funaab.edu.ng'),
  ('federal-university-of-petroleum-resources-effurun', 'https://www.vallospaces.com/schools/federal-university-of-petroleum-resources-effurun.webp', 'https://fupre.edu.ng/'),
  ('federal-university-of-science-and-technology-kabo', 'https://www.vallospaces.com/schools/federal-university-of-science-and-technology-kabo.webp', 'https://fustkabo.edu.ng'),
  ('federal-university-of-technology-owerri', 'https://www.vallospaces.com/schools/federal-university-of-technology-owerri.webp', 'https://futo.edu.ng'),
  ('federal-university-of-transportation-daura', 'https://www.vallospaces.com/schools/federal-university-of-transportation-daura.webp', 'https://futd.edu.ng'),
  ('federal-university-otuoke', 'https://www.vallospaces.com/schools/federal-university-otuoke.webp', 'https://fuotuoke.edu.ng'),
  ('first-city-polytechnic-abeokuta', 'https://www.vallospaces.com/schools/first-city-polytechnic-abeokuta.webp', 'https://firstcitypoly.edu.ng'),
  ('fountain-university-osogbo', 'https://www.vallospaces.com/schools/fountain-university-osogbo.webp', 'https://fuo.edu.ng'),
  ('gateway-polytechnic-saapade', 'https://www.vallospaces.com/schools/gateway-polytechnic-saapade.webp', 'https://new.gaposa.edu.ng/'),
  ('gboko-polytechnic', 'https://www.vallospaces.com/schools/gboko-polytechnic.webp', 'https://gbokopoly.edu.ng'),
  ('godfrey-okoye-university-enugu', 'https://www.vallospaces.com/schools/godfrey-okoye-university-enugu.webp', 'https://gouni.edu.ng/'),
  ('gombe-state-polytechnic-bajoga', 'https://www.vallospaces.com/schools/gombe-state-polytechnic-bajoga.webp', 'https://gspb.edu.ng/'),
  ('gozie-anyachebelu-oragram-polytechnic-oraukwu', 'https://www.vallospaces.com/schools/gozie-anyachebelu-oragram-polytechnic-oraukwu.webp', 'https://gozpoly.com/about-us/'),
  ('greenfield-university-kaduna', 'https://www.vallospaces.com/schools/greenfield-university-kaduna.webp', 'https://gfu.edu.ng'),
  ('grundtvig-polytechnic-oba', 'https://www.vallospaces.com/schools/grundtvig-polytechnic-oba.webp', 'https://grundtvigpolytechnic.com/'),
  ('harvard-polytechnic-ilorin', 'https://www.vallospaces.com/schools/harvard-polytechnic-ilorin.webp', 'https://harvardpolytechnic.edu.ng'),
  ('havilla-university-nde-ikom', 'https://www.vallospaces.com/schools/havilla-university-nde-ikom.webp', 'https://havillauniversity.edu.ng'),
  ('heritage-polytechnic-eket', 'https://www.vallospaces.com/schools/heritage-polytechnic-eket.webp', 'https://heritagepoly.edu.ng/'),
  ('hezekiah-university-umudi', 'https://www.vallospaces.com/schools/hezekiah-university-umudi.webp', 'https://hezekiah.edu.ng'),
  ('hillside-university-of-science-and-technology-okemisi', 'https://www.vallospaces.com/schools/hillside-university-of-science-and-technology-okemisi.webp', 'https://hust.edu.ng'),
  ('hussaini-adamu-federal-polytechnic-kazaure', 'https://www.vallospaces.com/schools/hussaini-adamu-federal-polytechnic-kazaure.webp', 'https://hafedpoly.edu.ng'),
  ('ibadan-city-polytechnic', 'https://www.vallospaces.com/schools/ibadan-city-polytechnic.webp', 'https://icp.edu.ng'),
  ('ibrahim-badamasi-babangida-university-lapai', 'https://www.vallospaces.com/schools/ibrahim-badamasi-babangida-university-lapai.webp', 'https://ibbu.edu.ng/'),
  ('igbajo-polytechnic', 'https://www.vallospaces.com/schools/igbajo-polytechnic.webp', 'https://www.igbajopolytechnic.edu.ng/'),
  ('igbinedion-university-okada', 'https://www.vallospaces.com/schools/igbinedion-university-okada.webp', 'https://iuokada.edu.ng'),
  ('ignatius-ajuru-university-of-education-rumuolumeni', 'https://www.vallospaces.com/schools/ignatius-ajuru-university-of-education-rumuolumeni.webp', 'https://iaue.edu.ng'),
  ('imo-state-university', 'https://www.vallospaces.com/schools/imo-state-university.webp', 'https://imsu.edu.ng'),
  ('inspire-polytechnic-yaba', 'https://www.vallospaces.com/schools/inspire-polytechnic-yaba.webp', 'https://inspirepolytechnic.edu.ng'),
  ('institute-of-management-and-technology', 'https://www.vallospaces.com/schools/institute-of-management-and-technology.webp', 'https://imt.edu.ng'),
  ('intercontinental-college-of-technology-makurdi', 'https://www.vallospaces.com/schools/intercontinental-college-of-technology-makurdi.webp', 'https://ictmakurdi.com/starme.php?hidf=5574896n46kn4kyb6n6nm77mu75m7u5m5'),
  ('isa-mustapha-agwai-i-polytechnic-lafia', 'https://www.vallospaces.com/schools/isa-mustapha-agwai-i-polytechnic-lafia.webp', 'https://imap.edu.ng/'),
  ('james-hope-university-lagos', 'https://www.vallospaces.com/schools/james-hope-university-lagos.webp', 'https://jhu.edu.ng'),
  ('jigawa-state-polytechnic-dutse', 'https://www.vallospaces.com/schools/jigawa-state-polytechnic-dutse.webp', 'https://jigpoly.edu.ng'),
  ('kaduna-state-university', 'https://www.vallospaces.com/schools/kaduna-state-university.webp', 'https://kasu.edu.ng'),
  ('kano-state-polytechnic', 'https://www.vallospaces.com/schools/kano-state-polytechnic.webp', 'https://kanopoly.edu.ng'),
  ('katsina-institute-of-technology-and-management', 'https://www.vallospaces.com/schools/katsina-institute-of-technology-and-management.webp', 'https://ksitm.edu.ng'),
  ('kebbi-state-polytechnic-dakingari', 'https://www.vallospaces.com/schools/kebbi-state-polytechnic-dakingari.webp', 'https://kespodak.edu.ng/'),
  ('kebbi-state-university-of-science-and-technology-aliero', 'https://www.vallospaces.com/schools/kebbi-state-university-of-science-and-technology-aliero.webp', 'https://ksusta.edu.ng'),
  ('kings-polytechnic-ubiaja', 'https://www.vallospaces.com/schools/kings-polytechnic-ubiaja.webp', 'https://kingspolytechnic.com/'),
  ('kings-university-ode-omu', 'https://www.vallospaces.com/schools/kings-university-ode-omu.webp', 'https://kingsuniversity.edu.ng'),
  ('kogi-state-polytechnic-lokoja', 'https://www.vallospaces.com/schools/kogi-state-polytechnic-lokoja.webp', 'https://kogistatepolytechnic.edu.ng'),
  ('kola-daisi-university-ibadan', 'https://www.vallospaces.com/schools/kola-daisi-university-ibadan.webp', 'https://koladaisiuniversity.edu.ng'),
  ('kwara-state-polytechnic', 'https://www.vallospaces.com/schools/kwara-state-polytechnic.webp', 'https://kwarastatepolytechnic.edu.ng'),
  ('ladoke-akintola-university-of-technology', 'https://www.vallospaces.com/schools/ladoke-akintola-university-of-technology.webp', 'https://lautech.edu.ng'),
  ('lagos-state-university', 'https://www.vallospaces.com/schools/lagos-state-university.webp', 'https://lasu.edu.ng/home/'),
  ('lagos-state-university-college-of-medicine', 'https://www.vallospaces.com/schools/lagos-state-university-college-of-medicine.webp', 'https://lasucom.edu.ng'),
  ('lagos-state-university-of-science-and-technology', 'https://www.vallospaces.com/schools/lagos-state-university-of-science-and-technology.webp', 'https://lasustech.edu.ng'),
  ('landmark-polytechnic-aiyetoro', 'https://www.vallospaces.com/schools/landmark-polytechnic-aiyetoro.webp', 'https://landmarkpolytechnic.edu.ng'),
  ('legacy-university-okija', 'https://www.vallospaces.com/schools/legacy-university-okija.webp', 'https://www.legacyuniversity.edu.ng/'),
  ('loam-polytechnic', 'https://www.vallospaces.com/schools/loam-polytechnic.webp', 'https://www.loampolytechnic.edu.ng/'),
  ('madonna-university-okija', 'https://www.vallospaces.com/schools/madonna-university-okija.webp', 'https://www.madonnauniversity.edu.ng/'),
  ('mai-idris-alooma-polytechnic-geidam', 'https://www.vallospaces.com/schools/mai-idris-alooma-polytechnic-geidam.webp', 'https://miapoly.edu.ng'),
  ('maryam-abacha-american-university-of-nigeria-kano', 'https://www.vallospaces.com/schools/maryam-abacha-american-university-of-nigeria-kano.webp', 'https://maaun.edu.ng'),
  ('michael-and-cecilia-ibru-university-agbara-otor', 'https://www.vallospaces.com/schools/michael-and-cecilia-ibru-university-agbara-otor.webp', 'https://mciu.edu.ng'),
  ('michael-okpara-university-of-agriculture', 'https://www.vallospaces.com/schools/michael-okpara-university-of-agriculture.webp', 'https://mouau.edu.ng'),
  ('miva-open-university-abuja', 'https://www.vallospaces.com/schools/miva-open-university-abuja.webp', 'https://miva.edu.ng:443/'),
  ('modibbo-adama-university', 'https://www.vallospaces.com/schools/modibbo-adama-university.webp', 'https://mau.edu.ng'),
  ('montgomery-polytechnic-ikere-ekiti', 'https://www.vallospaces.com/schools/montgomery-polytechnic-ikere-ekiti.webp', 'https://montgomerypolytechnic.edu.ng'),
  ('moshood-abiola-polytechnic-abeokuta', 'https://www.vallospaces.com/schools/moshood-abiola-polytechnic-abeokuta.webp', 'https://mapoly.edu.ng'),
  ('mustibrah-polytechnic-kano', 'https://www.vallospaces.com/schools/mustibrah-polytechnic-kano.webp', 'https://mustibrah.edu.ng/'),
  ('nacabs-polytechnic-akwanga', 'https://www.vallospaces.com/schools/nacabs-polytechnic-akwanga.webp', 'https://nacabspoly.edu.ng'),
  ('nasarawa-state-university-keffi', 'https://www.vallospaces.com/schools/nasarawa-state-university-keffi.webp', 'https://nsuk.edu.ng'),
  ('nation-builders-polytechnic-asaba', 'https://www.vallospaces.com/schools/nation-builders-polytechnic-asaba.webp', 'https://nabcotech.edu.ng'),
  ('national-institute-of-construction-technology-and-management-uromi', 'https://www.vallospaces.com/schools/national-institute-of-construction-technology-and-management-uromi.webp', 'https://www.nict.edu.ng/'),
  ('national-open-university-of-nigeria', 'https://www.vallospaces.com/schools/national-open-university-of-nigeria.webp', 'https://nou.edu.ng'),
  ('newland-polytechnic-ilorin', 'https://www.vallospaces.com/schools/newland-polytechnic-ilorin.webp', 'https://newlandpolytechnic.edu.ng'),
  ('niger-delta-university', 'https://www.vallospaces.com/schools/niger-delta-university.webp', 'https://www.ndu.edu.ng/'),
  ('nigeria-police-academy-wudil', 'https://www.vallospaces.com/schools/nigeria-police-academy-wudil.webp', 'https://polac.edu.ng'),
  ('nigerian-army-university-biu', 'https://www.vallospaces.com/schools/nigerian-army-university-biu.webp', 'https://naub.edu.ng/'),
  ('nigerian-british-university-asa', 'https://www.vallospaces.com/schools/nigerian-british-university-asa.webp', 'https://www.nbu.edu.ng/'),
  ('nigerian-defence-academy', 'https://www.vallospaces.com/schools/nigerian-defence-academy.webp', 'https://www.nda.edu.ng'),
  ('nile-university-of-nigeria', 'https://www.vallospaces.com/schools/nile-university-of-nigeria.webp', 'https://nileuniversity.edu.ng'),
  ('nnamdi-azikiwe-university', 'https://www.vallospaces.com/schools/nnamdi-azikiwe-university.webp', 'https://unizik.edu.ng'),
  ('novena-university-ogume', 'https://www.vallospaces.com/schools/novena-university-ogume.webp', 'https://novenauniversity.edu.ng'),
  ('nuhu-bamalli-polytechnic-zaria', 'https://www.vallospaces.com/schools/nuhu-bamalli-polytechnic-zaria.webp', 'https://nubapoly.edu.ng/'),
  ('obafemi-awolowo-university', 'https://www.vallospaces.com/schools/obafemi-awolowo-university.webp', 'https://oauife.edu.ng'),
  ('osun-state-college-of-education-ilesa', 'https://www.vallospaces.com/schools/osun-state-college-of-education-ilesa.webp', 'https://oscotechesaoke.edu.ng/oscosite/'),
  ('osun-state-college-of-technology-esa-oke', 'https://www.vallospaces.com/schools/osun-state-college-of-technology-esa-oke.webp', 'https://oscotechesaoke.edu.ng/home/index.html'),
  ('osun-state-university-osogbo', 'https://www.vallospaces.com/schools/osun-state-university-osogbo.webp', 'https://uniosun.edu.ng'),
  ('our-saviour-institute-of-science-and-technology-enugu', 'https://www.vallospaces.com/schools/our-saviour-institute-of-science-and-technology-enugu.webp', 'https://osisat.edu.ng/poly/'),
  ('pan-atlantic-university', 'https://www.vallospaces.com/schools/pan-atlantic-university.webp', 'https://pau.edu.ng'),
  ('paramount-polytechnic-ejigbo', 'https://www.vallospaces.com/schools/paramount-polytechnic-ejigbo.webp', 'https://paramountpolytechnic.edu.ng'),
  ('paul-university-awka', 'https://www.vallospaces.com/schools/paul-university-awka.webp', 'https://pauluniversity.edu.ng'),
  ('petroleum-training-institute-effurun', 'https://www.vallospaces.com/schools/petroleum-training-institute-effurun.webp', 'https://pti.edu.ng'),
  ('plateau-state-polytechnic-barkin-ladi', 'https://www.vallospaces.com/schools/plateau-state-polytechnic-barkin-ladi.webp', 'https://plapoly.edu.ng/'),
  ('plateau-state-university-bokkos', 'https://www.vallospaces.com/schools/plateau-state-university-bokkos.webp', 'https://plasu.edu.ng'),
  ('renaissance-university-enugu', 'https://www.vallospaces.com/schools/renaissance-university-enugu.webp', 'https://rnu.edu.ng'),
  ('rev-fr-moses-orshio-adasu-university-makurdi', 'https://www.vallospaces.com/schools/rev-fr-moses-orshio-adasu-university-makurdi.webp', 'https://bsum.edu.ng'),
  ('rhema-university-obeama-asa', 'https://www.vallospaces.com/schools/rhema-university-obeama-asa.webp', 'https://rhemauniversity.edu.ng'),
  ('ritman-university-ikot-ekpene', 'https://www.vallospaces.com/schools/ritman-university-ikot-ekpene.webp', 'https://ritmanuniversity.edu.ng'),
  ('ronik-polytechnic-ejigbo', 'https://www.vallospaces.com/schools/ronik-polytechnic-ejigbo.webp', 'https://ronikpolytechnic.edu.ng'),
  ('saf-polytechnic-iseyin', 'https://www.vallospaces.com/schools/saf-polytechnic-iseyin.webp', 'https://safpolytechnic.edu.ng/'),
  ('salem-university-lokoja', 'https://www.vallospaces.com/schools/salem-university-lokoja.webp', 'https://salemuniversity.edu.ng/'),
  ('skyline-university-nigeria-kano', 'https://www.vallospaces.com/schools/skyline-university-nigeria-kano.webp', 'https://sun.edu.ng'),
  ('sokoto-state-university', 'https://www.vallospaces.com/schools/sokoto-state-university.webp', 'https://www.ssu.edu.ng/'),
  ('spiritan-university-nneochi', 'https://www.vallospaces.com/schools/spiritan-university-nneochi.webp', 'https://spiritanuniversity.edu.ng'),
  ('stars-polytechnic-ota', 'https://www.vallospaces.com/schools/stars-polytechnic-ota.webp', 'https://starspoly.edu.ng'),
  ('sule-lamido-university-kafin-hausa', 'https://www.vallospaces.com/schools/sule-lamido-university-kafin-hausa.webp', 'https://slu.edu.ng'),
  ('summit-university-offa', 'https://www.vallospaces.com/schools/summit-university-offa.webp', 'https://summituniversity.edu.ng'),
  ('tansian-university-umunya', 'https://www.vallospaces.com/schools/tansian-university-umunya.webp', 'https://tansianuniversity.edu.ng/'),
  ('taraba-state-university-jalingo', 'https://www.vallospaces.com/schools/taraba-state-university-jalingo.webp', 'https://www.tsuniversity.edu.ng/'),
  ('temple-gate-polytechnic-aba', 'https://www.vallospaces.com/schools/temple-gate-polytechnic-aba.webp', 'https://tgp.edu.ng'),
  ('the-oke-ogun-polytechnic-saki', 'https://www.vallospaces.com/schools/the-oke-ogun-polytechnic-saki.webp', 'https://tops.edu.ng'),
  ('the-polytechnic-ibadan', 'https://www.vallospaces.com/schools/the-polytechnic-ibadan.webp', 'https://polyibadan.edu.ng'),
  ('the-polytechnic-igbo-owu', 'https://www.vallospaces.com/schools/the-polytechnic-igbo-owu.webp', 'https://thepolytechnicigboowu.edu.ng'),
  ('the-polytechnic-iresi', 'https://www.vallospaces.com/schools/the-polytechnic-iresi.webp', 'https://thepolytechniciresi.edu.ng'),
  ('thomas-adewumi-university-oko-irese', 'https://www.vallospaces.com/schools/thomas-adewumi-university-oko-irese.webp', 'https://tau.edu.ng'),
  ('trinity-polytechnic-uyo', 'https://www.vallospaces.com/schools/trinity-polytechnic-uyo.webp', 'https://trinitypoly.edu.ng'),
  ('trinity-university-ogun-state', 'https://www.vallospaces.com/schools/trinity-university-ogun-state.webp', 'https://www.trinityuniversity.edu.ng/'),
  ('umaru-ali-shinkafi-polytechnic-sokoto', 'https://www.vallospaces.com/schools/umaru-ali-shinkafi-polytechnic-sokoto.webp', 'https://uasp.edu.ng'),
  ('umaru-musa-yaradua-university-katsina', 'https://www.vallospaces.com/schools/umaru-musa-yaradua-university-katsina.webp', 'https://umyu.edu.ng'),
  ('university-of-abuja', 'https://www.vallospaces.com/schools/university-of-abuja.webp', 'https://www.uniabuja.edu.ng'),
  ('university-of-agriculture-and-environmental-sciences-umuagwo', 'https://www.vallospaces.com/schools/university-of-agriculture-and-environmental-sciences-umuagwo.webp', 'https://uaes.edu.ng'),
  ('university-of-benin', 'https://www.vallospaces.com/schools/university-of-benin.webp', 'https://uniben.edu'),
  ('university-of-calabar', 'https://www.vallospaces.com/schools/university-of-calabar.webp', 'https://unical.edu.ng'),
  ('university-of-delta-agbor', 'https://www.vallospaces.com/schools/university-of-delta-agbor.webp', 'https://unidel.edu.ng/'),
  ('university-of-ibadan', 'https://www.vallospaces.com/schools/university-of-ibadan.webp', 'https://ui.edu.ng'),
  ('university-of-ilorin', 'https://www.vallospaces.com/schools/university-of-ilorin.webp', 'https://www.unilorin.edu.ng/'),
  ('university-of-jos', 'https://www.vallospaces.com/schools/university-of-jos.webp', 'https://www.unijos.edu.ng'),
  ('university-of-lagos', 'https://www.vallospaces.com/schools/university-of-lagos.webp', 'https://unilag.edu.ng'),
  ('university-of-maiduguri', 'https://www.vallospaces.com/schools/university-of-maiduguri.webp', 'https://unimaid.edu.ng'),
  ('university-of-nigeria-nsukka', 'https://www.vallospaces.com/schools/university-of-nigeria-nsukka.webp', 'https://www.unn.edu.ng/'),
  ('university-of-port-harcourt', 'https://www.vallospaces.com/schools/university-of-port-harcourt.webp', 'https://www.uniport.edu.ng/'),
  ('usmanu-danfodiyo-university', 'https://www.vallospaces.com/schools/usmanu-danfodiyo-university.webp', 'https://www.udusok.edu.ng/'),
  ('veritas-university', 'https://www.vallospaces.com/schools/veritas-university.webp', 'https://www.veritas.edu.ng/'),
  ('waziri-umaru-federal-polytechnic-birnin-kebbi', 'https://www.vallospaces.com/schools/waziri-umaru-federal-polytechnic-birnin-kebbi.webp', 'https://wufpbk.edu.ng/index/'),
  ('wesley-university-ondo', 'https://www.vallospaces.com/schools/wesley-university-ondo.webp', 'https://wesleyuni.edu.ng'),
  ('western-delta-university-oghara', 'https://www.vallospaces.com/schools/western-delta-university-oghara.webp', 'https://wdu.edu.ng'),
  ('wigwe-university-isiokpo', 'https://www.vallospaces.com/schools/wigwe-university-isiokpo.webp', 'https://www.wigweuniversity.edu.ng/'),
  ('yaba-college-of-technology', 'https://www.vallospaces.com/schools/yaba-college-of-technology.webp', 'https://yabatech.edu.ng'),
  ('yobe-state-university-damaturu', 'https://www.vallospaces.com/schools/yobe-state-university-damaturu.webp', 'https://ysu.edu.ng/ysu/')
  ) as v(slug, logo_url, logo_source)
 where i.slug = v.slug
   and (i.logo_url is null or i.logo_url like 'https://upload.wikimedia.org/%');

update public.institutions i
   set email_domains = array[v.domain], email_verify_on = true
  from (values
  ('abubakar-tafawa-balewa-university-bauchi', 'atbu.edu.ng'),
  ('adamawa-state-university-mubi', 'adsu.edu.ng'),
  ('admiralty-university-ibusa', 'adun.edu.ng'),
  ('african-university-of-science-and-technology-abuja', 'aust.edu.ng'),
  ('calvary-polytechnic', 'calvarypoly.edu.ng'),
  ('christopher-university-mowe', 'christopheruniversity.edu.ng'),
  ('clifford-university-owerrinta', 'clifforduni.edu.ng'),
  ('federal-polytechnic-ado-ekiti', 'fedpolyado.edu.ng'),
  ('federal-polytechnic-bali', 'fedpolybali.edu.ng'),
  ('federal-polytechnic-damaturu', 'fedpodam.edu.ng'),
  ('federal-polytechnic-daura', 'fedpolydaura.edu.ng'),
  ('federal-polytechnic-orogun', 'fepo.edu.ng'),
  ('federal-university-gusau', 'fugusau.edu.ng'),
  ('federal-university-kashere', 'fukashere.edu.ng'),
  ('federal-university-of-petroleum-resources-effurun', 'fupre.edu.ng'),
  ('federal-university-wukari', 'fuwukari.edu.ng'),
  ('godfrey-okoye-university-enugu', 'gouni.edu.ng'),
  ('ibrahim-badamasi-babangida-university-lapai', 'ibbu.edu.ng'),
  ('igbajo-polytechnic', 'igbajopolytechnic.edu.ng'),
  ('miva-open-university-abuja', 'miva.edu.ng'),
  ('nigerian-army-university-biu', 'naub.edu.ng'),
  ('nigerian-british-university-asa', 'nbu.edu.ng'),
  ('nigerian-defence-academy', 'nda.edu.ng'),
  ('salem-university-lokoja', 'salemuniversity.edu.ng'),
  ('tansian-university-umunya', 'tansianuniversity.edu.ng'),
  ('trinity-university-ogun-state', 'trinityuniversity.edu.ng'),
  ('university-of-delta-agbor', 'unidel.edu.ng'),
  ('university-of-medical-sciences-ondo', 'unimed.edu.ng')
  ) as v(slug, domain)
 where i.slug = v.slug and cardinality(i.email_domains) = 0;

do $check$
declare
  bad int;
begin
  select count(*) into bad from public.institutions where logo_url is not null and logo_url not like 'https://%';
  if bad > 0 then
    raise exception 'logo_url must be https: % rows are not', bad;
  end if;
  select count(*) into bad from public.institutions where email_verify_on and cardinality(email_domains) = 0;
  if bad > 0 then
    raise exception 'email check on without a domain: % rows', bad;
  end if;
  select count(*) into bad from public.institutions where logo_url like 'https://www.vallospaces.com/schools/%';
  if bad < 198 then
    raise exception 'batch 2 logos missing: only % rows carry a hosted logo, expected about 221', bad;
  end if;
end
$check$;

commit;
