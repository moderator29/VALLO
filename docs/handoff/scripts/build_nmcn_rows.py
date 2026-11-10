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

def main():
    rows = json.load(open(sys.argv[1]))
    seed = json.load(open(sys.argv[2]))
    names = {re.sub(r"[^a-z0-9]", "", r["name"].lower()) for r in seed}
    out, seen = [], set()
    for r in rows:
        raw = tidy(r["raw"])
        if not KEEP.search(raw) or re.search(r"\bTeaching Hospital\b.*\bUniversity\b|^University|Department", raw) or len(raw) < 14:
            continue
        key = (re.sub(r"[^a-z0-9]", "", raw.lower()), r["state_code"])
        if key in seen:
            continue
        seen.add(key)
        kind = "college" if re.search(r"College", raw, re.I) else "other"
        out.append(dict(name=raw, kind=kind, state_code=r["state_code"], city=city_of(raw), source="NMCN approved schools, December 2025", sn=r["sn"]))
    json.dump(out, open(sys.argv[3], "w"), indent=1, ensure_ascii=False)
    print(len(out))

main()
