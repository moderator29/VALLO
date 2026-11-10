"""Second pass over parse_nmcn_schools.py output: keep real, named nursing and
midwifery colleges and schools, tidy the name, and write school rows.

usage: python3 -I build_nmcn_rows.py nmcn_rows.json existing_seed.json out.json
Hospital-run entries with no school name of their own (a teaching hospital,
a department inside a university) are dropped, not guessed at.
"""
import json, re, sys

MONTHS = r"(January|February|March|April|May|June|July|August|September|October|November|December)"
KEEP = re.compile(r"College of Nursing|School of (Basic |Post Basic |Psychiatric )?(Nursing|Midwifery)|College of Health Technology|Nursing and Midwifery", re.I)
TOWN_FIX = {"portharcourt": "Port Harcourt", "port harcourt": "Port Harcourt"}

def tidy(raw):
    s = re.sub(r"\s+" + MONTHS + r"$", "", raw).strip(" ,.")
    s = re.sub(r"\bScieences\b", "Sciences", s)
    s = re.sub(r"\bPortHarcourt\b|\bPortharcourt\b", "Port Harcourt", s)
    s = re.sub(r"^COLLEGE", "College", s)
    s = s.replace("COLLEGE OF NURSING SCIENCES", "College of Nursing Sciences").replace("MODIBO ADAMA UNIVERSITY TEACHING HOSPITAL, YOLA", "Modibbo Adama University Teaching Hospital, Yola")
    s = re.sub(r"(\b[A-Za-z-]+)\s+\1$", r"\1", s)  # trailing repeated town
    return s.strip(" ,.")

def city_of(name):
    parts = [p.strip() for p in name.split(",")]
    if len(parts) > 1:
        c = parts[-1]
        c = re.sub(r"\b(Rivers|Taraba|Akwa Ibom|Plateau|Oyo|Kebbi|Benue) State\b", "", c).strip()
        if c and len(c) <= 40 and not re.search(r"Hospital|University|Sciences|Nursing", c):
            return c
    m = re.search(r"(?:College|School) of [A-Za-z ]+? ([A-Z][a-z]+(?:-[A-Z][a-z]+)?)$", name)
    return None

# Hand fixes after reading the extracted names against the PDF layout: (state, parsed name) -> (clean name, town) or None to drop.
FIX = {
    ("AN", "College of Nursing Sciences, Ihiala Ihiala Midwifery, Ihiala"): ("College of Nursing Sciences, Ihiala", "Ihiala"),
    ("AN", "College of Nursing, St. Charles Borromeo Hospital, Onitsha St. Borromeo"): ("College of Nursing, St. Charles Borromeo Hospital, Onitsha", "Onitsha"),
    ("AD", "College OF NURSING SCIENCES, Modibbo Adama University Teaching Hospital, Yola"): ("College of Nursing Sciences, Modibbo Adama University Teaching Hospital, Yola", "Yola"),
    ("AD", "College of Nursing Science, Adamawa State"): ("Adamawa State College of Nursing Science", None),
    ("EB", "College of Nursing Sciences, Alex Ekwueme Federal University Teaching Hospital, Abakaliki AEFUTHA"): ("College of Nursing Sciences, Alex Ekwueme Federal University Teaching Hospital, Abakaliki", "Abakaliki"),
    ("ED", "College of Nursing Sciences, University of Benin Teaching Hospital (UBTH) UBTH"): ("College of Nursing Sciences, University of Benin Teaching Hospital", "Benin City"),
    ("OS", "Osogbo School of Nursing, Osogbo. School of Post Basic Midwifery, Osogbo"): ("School of Nursing, Osogbo", "Osogbo"),
    ("OG", "School of Psychiatric Nursing, Aro, Abeokuta Sacred Heart Hospital College of"): None,
    ("PL", "College of Nursing Sciences, Plateau State Jos Vom, Jos Jos MMH, Jos"): None,
    ("PL", "College of Nursing Sciences, University Teaching Hospital Jos"): None,
    ("PL", "Florence Nightingale College of Nursing, Jos, Plateau State"): ("Florence Nightingale College of Nursing, Jos", "Jos"),
    ("DE", "Midwifery College of Nursing Sapele"): ("College of Nursing, Sapele", "Sapele"),
    ("OG", "Chep College of Nursing Sciences"): None,
    ("OG", "College of Nursing Sciences, Jala Jalaaluka For Ahad (JAFAD) School of Nursing, Oru-Ijebu"): None,
    ("CR", "College of Health Technology Cross Rivers State. Public Health Nursing"): None,
    ("EB", "College of Nursing Sciences, Post Basic Oncology"): None,
    ("KD", "College of Nursing Science Kaduna State Campus Community"): None,
    ("KD", "College of Nursing Sciences Ahmadu Bello University Teaching Hospital (ABUTH) Zaria"): ("College of Nursing Sciences, Ahmadu Bello University Teaching Hospital, Zaria", "Zaria"),
    ("OS", "College of Nursing Sciences, Obafemi Awolowo University Teaching Hospitals Complex"): ("College of Nursing Sciences, Obafemi Awolowo University Teaching Hospitals Complex", "Ile-Ife"),
    ("RI", "Rivers State College of Nursing Sciences Harcourt"): ("Rivers State College of Nursing Sciences, Port Harcourt", "Port Harcourt"),
    ("RI", "College of Nursing Sciences, University of Port Harcourt Teaching Hospital, Rivers State"): ("College of Nursing Sciences, University of Port Harcourt Teaching Hospital", "Port Harcourt"),
    ("NI", "Niger State College of Nursing Sciences, Minna Campus"): ("Niger State College of Nursing Sciences, Minna", "Minna"),
    ("EN", "Enugu State College of Nursing Sciences, Awgu and Parklane Campuses"): ("Enugu State College of Nursing Sciences", "Enugu"),
    ("EN", "College of Nursing Sciences, National Orthopaedic Hospital, (NOH) Enugu"): ("College of Nursing Sciences, National Orthopaedic Hospital, Enugu", "Enugu"),
    ("KN", "Nafisatu College of Nursing Sciences, Kwankwaso Town, Madobi LGA"): ("Nafisatu College of Nursing Sciences, Kwankwaso", "Kwankwaso"),
    ("TA", "School of Basic Midwifery, Jalingo Community"): ("School of Basic Midwifery, Jalingo", "Jalingo"),
    ("ZA", "School of Nursing, Gusau Community"): ("School of Nursing, Gusau", "Gusau"),
    ("ZA", "School of Basic Midwifery, Gusau Community"): ("School of Basic Midwifery, Gusau", "Gusau"),
    ("LA", "College of Nursing Sciences, Lagos University Teaching Hospital (LUTH), Idi-Araba,Lagos"): ("College of Nursing Sciences, Lagos University Teaching Hospital, Idi-Araba", "Idi-Araba"),
    ("BA", "Adamu Adamu College of Nursing Sciences, FMC, Azare, Bauchi"): ("Adamu Adamu College of Nursing Sciences, Azare", "Azare"),
    ("BA", "Mama Yelwa College of Nursing Sciences, FMC, Misau, Bauchi"): ("Mama Yelwa College of Nursing Sciences, Misau", "Misau"),
    ("BA", "Sa\u2019ad Zungur College of Nursing Sciences, Bauchi, Dass"): ("Sa\u2019ad Zungur College of Nursing Sciences, Dass", "Dass"),
    ("BA", "College of Nursing Sciences, ATBUTH, Bauchi"): ("College of Nursing Sciences, Abubakar Tafawa Balewa University Teaching Hospital, Bauchi", "Bauchi"),
    ("BA", "Al-huda College of Nursing Federal Low coast, Bauchi"): ("Al-huda College of Nursing, Bauchi", "Bauchi"),
    ("EB", "College of Nursing Sciences, MMH, Afikpo"): ("College of Nursing Sciences, Afikpo", "Afikpo"),
    ("OY", "College of Nursing Sciences, MH Saki"): ("College of Nursing Sciences, Saki", "Saki"),
    ("OY", "Catholic Archbishop Dioleces of Ibadan, College of Nursing Sciences, Oluyoro"): ("Oluyoro Catholic College of Nursing Sciences, Ibadan", "Ibadan"),
    ("OY", "College of Nursing Sciences, LAUTECH, Ogbomoso, Oyo State"): ("College of Nursing Sciences, LAUTECH Teaching Hospital, Ogbomoso", "Ogbomoso"),
    ("OY", "Adeniyi College of Nursing Sciences, Igbope, Oyo State"): ("Adeniyi College of Nursing Sciences, Igbope", "Igbope"),
    ("KE", "Manga College of Nursing Sciences, Zuru, Kebbi State"): ("Manga College of Nursing Sciences, Zuru", "Zuru"),
    ("TA", "A.B Na\u2019ibi College of Nursing Sciences, Lau, Taraba State"): ("A.B Na\u2019ibi College of Nursing Sciences, Lau", "Lau"),
    ("AK", "Sure Foundation College of Nursing Sciences, Ikot Akai, Akwa Ibom State"): ("Sure Foundation College of Nursing Sciences, Ikot Akai", "Ikot Akai"),
    ("BE", "Makurdi College of Nursing Sciences, Benue State"): ("Makurdi College of Nursing Sciences", "Makurdi"),
    ("OY", "College of Nursing Sciences, Baptist Medical Centre, Saki"): None,
    ("ED", "School of Psychiatric Nursing"): None,
    ("SO", "College of Nursing Sciences, Federal Neuro-Psychiatry Hospital"): None,
    ("ED", "ST Mathew College of Nursing Sciences. Iruah"): ("St Mathew College of Nursing Sciences, Irrua", "Irrua"),
    ("AN", "College of Nursing Sciences Adazi-Nnukwu"): ("College of Nursing Sciences, Adazi-Nnukwu", "Adazi-Nnukwu"),
    ("BO", "College of Nursing Sciences Monguno"): ("College of Nursing Sciences, Monguno", "Monguno"),
    ("KN", "College of Nursing Sciences Kano"): ("College of Nursing Sciences, Kano", "Kano"),
    ("SO", "College of Nursing Science Sokoto"): ("College of Nursing Science, Sokoto", "Sokoto"),
    ("FC", "College of Nursing Sciences Jahi"): ("College of Nursing Sciences, Jahi", "Jahi"),
}

def main():
    rows = json.load(open(sys.argv[1]))
    seed = json.load(open(sys.argv[2]))
    names = {re.sub(r"[^a-z0-9]", "", r["name"].lower()) for r in seed}
    out, seen, seen2 = [], set(), set()
    for r in rows:
        raw = tidy(r["raw"])
        if not KEEP.search(raw) or re.search(r"\bTeaching Hospital\b.*\bUniversity\b|^University|Department", raw) or len(raw) < 14:
            continue
        key = (re.sub(r"[^a-z0-9]", "", raw.lower()), r["state_code"])
        if key in seen:
            continue
        seen.add(key)
        fx = FIX.get((r["state_code"], raw), "none")
        if fx is None:
            continue
        city = city_of(raw)
        if fx != "none":
            raw, city = fx
        key = (re.sub(r"[^a-z0-9]", "", raw.lower()), r["state_code"])
        if key in seen2:
            continue
        seen2.add(key)
        kind = "college" if re.search(r"College", raw, re.I) else "other"
        out.append(dict(name=raw, kind=kind, state_code=r["state_code"], city=city, source="NMCN approved schools, December 2025", sn=r["sn"]))
    json.dump(out, open(sys.argv[3], "w"), indent=1, ensure_ascii=False)
    print(len(out))

main()
