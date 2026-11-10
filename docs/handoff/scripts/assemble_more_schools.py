"""Assemble the NEW school rows for roommates_schools_more_2026-11-10.sql.

usage: python3 -I assemble_more_schools.py seed.json nmcn_final.json wl_new_rows.json out.json

Sources: NMCN approved schools list December 2025 (nursing and midwifery colleges
and schools), Wikipedia private polytechnics and private colleges of education the
first list left out, and three Wikipedia-only universities. Short names stay null
(no acronym students use was found), email domains stay empty except where the
school's own home page was fetched on 10 Nov 2026 and names the school.
"""
import json, re, sys, unicodedata

def slugify(name):
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80].strip("-")

# Wikipedia rows to take from the diff, with the name as it should read (town added the way the seed does) and the town.
POLY = {
    "Allover Central Polytechnic": ("Allover Central Polytechnic, Sango-Ota", "Sango-Ota"),
    "Ashi Polytechnic": ("Ashi Polytechnic, Anyin", "Anyin"),
    "Edward Olaseni Polytechnic": ("Edward Olaseni Polytechnic, Akoko", "Akoko"),
    "Fidei Polytechnic": ("Fidei Polytechnic, Gboko", "Gboko"),
    "Gloryland Polytechnic": ("Gloryland Polytechnic, Ankpa", "Ankpa"),
    "Grace Polytechnic": ("Grace Polytechnic, Surulere", "Surulere"),
    "Graceland Polytechnic": ("Graceland Polytechnic, Offa", "Offa"),
    "Harry Pass Polytechnic": ("Harry Pass Polytechnic, Mkar", "Mkar"),
    "Hope Polytechnic": ("Hope Polytechnic, Ikono", "Ikono"),
    "Lagos City Polytechnic": ("Lagos City Polytechnic, Ikeja", "Ikeja"),
    "Lighthouse Polytechnic": ("Lighthouse Polytechnic, Orhionmwon", "Orhionmwon"),
    "Marist Polytechnic": ("Marist Polytechnic, Enugu", "Enugu"),
    "NOGAK Polytechnic": ("NOGAK Polytechnic, Ikom", "Ikom"),
    "Novelty Polytechnic": ("Novelty Polytechnic, Kishi", "Kishi"),
    "Odaji Agbo Polytechnic": ("Odaji Agbo Polytechnic, Ayeko-Yala", "Ayeko-Yala"),
    "Prime Polytechnic": ("Prime Polytechnic, Ajaokuta", "Ajaokuta"),
    "Raindrops Institute of Management and Technology": ("Raindrops Institute of Management and Technology, Orsu", "Orsu"),
    "The Polytechnic, Adoka": ("The Polytechnic, Adoka", "Adoka"),
    "Ultra Excellence Polytechnic": ("Ultra Excellence Polytechnic, Ikono", "Ikono"),
    "Unique College of Management and Technology": ("Unique College of Management and Technology, Ikotun", "Ikotun"),
    "Villanova Polytechnic": ("Villanova Polytechnic, Obokun", "Obokun"),
    "Westland Polytechnic": ("Westland Polytechnic, Ilobu", "Ilobu"),
    "Al-Hikmah": ("Al-Hikma Polytechnic, Karu", "Karu"),
}
COLLEGE = {
    "AB Naibi College of Nursing Sciences": ("A.B Na’ibi College of Nursing Sciences, Lau", "Lau"),
    "Piaget College of Education": ("Piaget College of Education, Abeokuta", "Abeokuta"),
    "St. Augustine College of Education": ("St. Augustine College of Education, Akoka", "Akoka"),
    "Delar College of Education": ("Delar College of Education, Ibadan", "Ibadan"),
    "Yewa Central College of Education": ("Yewa Central College of Education, Ayetoro", "Ayetoro"),
    "Institute of Ecumenical Education, (Thinkers Corner), Enugu": ("Institute of Ecumenical Education, Thinkers Corner, Enugu", "Enugu"),
    "Ansar-Ud-Deen College of Education": ("Ansar-Ud-Deen College of Education, Isolo", "Isolo"),
    "African Thinkers Community of Inquiry College of Education": ("African Thinkers Community of Inquiry College of Education, Enugu", "Enugu"),
    "City College of Education, Mararaba": ("City College of Education, Mararaba", "Mararaba Gurku"),
    "Muftau Olanihun College of Education": ("Muftau Olanihun College of Education, Ibadan", "Ibadan"),
    "Havard Wilson College of Education": ("Havard Wilson College of Education, Aba", "Aba"),
    "College of Education Ilemona": ("College of Education, Ilemona", "Ilemona"),
    "Nigerian Army School of Education (NASE), Ilorin": ("Nigerian Army School of Education, Ilorin", "Ilorin"),
    "Nana Aishat Memorial College of Education": ("Nana Aishat Memorial College of Education, Ilorin", "Ilorin"),
    "AJETUNMOBI College of Education Irra": ("Ajetunmobi College of Education, Irra", "Irra"),
}
# Email domains confirmed from the school's own home page (fetched 10 Nov 2026, the page names the school on that domain).
DOMAINS = {"Al-Hikma Polytechnic, Karu": "alhikma.edu.ng"}

def main():
    seed = json.load(open(sys.argv[1])); nm = json.load(open(sys.argv[2])); wl = json.load(open(sys.argv[3]))
    out = []
    def add(name, kind, state, city, src, domain=None):
        out.append(dict(slug=slugify(name), name=name, short_name=None, kind=kind, state_code=state, city=city,
                        email_domains=[domain] if domain else [], email_verify_on=bool(domain), source=src))
    for r in wl:
        if r["name"] in POLY:
            name, city = POLY[r["name"]]
            add(name, "polytechnic" if "Polytechnic" in name or "Institute" in name or "College of Management" in name else "college", r["state_code"], city, r["source"], DOMAINS.get(name))
        elif r["name"] in COLLEGE:
            name, city = COLLEGE[r["name"]]
            add(name, "college", r["state_code"], city, r["source"])
    for r in nm:
        add(r["name"], r["kind"], r["state_code"], r["city"], r["source"])
    # Wikipedia-only universities are added by hand from the list page (see UNIVERSITIES below, filled after reading it).
    for u in json.load(open(sys.argv[5])) if len(sys.argv) > 5 else []:
        add(u["name"], "university", u["state_code"], u["city"], u["source"])
    # de-duplicate against the seed and within itself
    seen = {re.sub(r"[^a-z0-9]", "", s["name"].lower()) for s in seed} | {s["slug"] for s in seed}
    res = []
    for r in out:
        k = re.sub(r"[^a-z0-9]", "", r["name"].lower())
        if k in seen or r["slug"] in seen:
            continue
        seen.add(k); seen.add(r["slug"])
        res.append(r)
    json.dump(res, open(sys.argv[4], "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(len(res), dict(Counter(r["kind"] for r in res)))

main()
