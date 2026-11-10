"""Turn the NMCN approved-schools PDF text (pdftotext -layout) into school rows.

usage: python3 -I parse_nmcn_schools.py nmcn.txt out.json

Source: https://www.nmcn.gov.ng/docs/New_List_of_Approved_Schools_Dec_2025.pdf
Departments of nursing inside a university, schools with accreditation
withdrawn, and entries with no readable town are left out.
"""
import json, re, sys

STATES = {"abia":"AB","adamawa":"AD","akwa":"AK","anambra":"AN","bauchi":"BA","bayelsa":"BY","benue":"BE","borno":"BO","cross":"CR","delta":"DE","ebonyi":"EB","edo":"ED","ekiti":"EK","enugu":"EN","gombe":"GO","imo":"IM","jigawa":"JI","kaduna":"KD","kano":"KN","katsina":"KT","kebbi":"KE","kogi":"KO","kwara":"KW","lagos":"LA","nasarawa":"NA","niger":"NI","ogun":"OG","ondo":"ON","osun":"OS","oyo":"OY","plateau":"PL","rivers":"RI","sokoto":"SO","taraba":"TA","yobe":"YO","zamfara":"ZA","fct":"FC","federal":"FC","abuja":"FC"}
STATUS = re.compile(r"\s{2,}(Full|Provisional|Withdrawn|Pending|Not|Accreditation|Awaiting|Under|Embargo)\b.*$", re.I)

# The PDF numbers the states 1 to 37 in this order (one heading, Benue, is missing in the text).
ORDER = "AB AD AK AN BA BY BE BO CR DE EB ED EK EN GO IM JI KD KN KT KE KO KW LA NA NI OG ON OS OY PL RI SO TA YO ZA FC".split()
JUNK = re.compile(r"\s*(\bProgramme\b|\bprogramme\b|\bProgram\b|\bprogram\b|\bFull\b|\bProvisional\b|\bProv\.|Nursing Training Institutions|\b20\d\d\b|\d+ ?\| ?P).*$")

def tidy(raw):
    raw = JUNK.sub("", raw)
    raw = re.sub(r"\s+(Midwifery|Nursing)\s*$", "", raw) if re.search(r"(College|School) of", raw) and raw.count("Nursing") + raw.count("Midwifery") > 1 else raw
    return re.sub(r"\s+", " ", raw).strip(" ,.-")

def clean_line(l):
    l = l.replace("", "\u0001")
    if "\u0001" in l:
        return None  # a programme line, not the school name
    if re.search(r"\|Page|ACCREDITATION|S/N\s+NAME OF SCHOOL|STATUS/DATE", l):
        return None
    l = re.split(r"\s{3,}", l.strip())[0]
    l = STATUS.sub("", l)
    l = re.sub(r"\b(NEW|New)\s*$", "", l).strip()
    return l.strip()

def main():
    lines = open(sys.argv[1], encoding="utf-8").read().split("\n")
    state, cur, out = None, None, []
    def flush():
        nonlocal cur
        if cur:
            raw = " ".join(x for x in cur["parts"] if x)
            cur["raw"] = raw
            out.append(cur)
        cur = None
    stop = False
    for ln in lines:
        m = re.match(r"^\s*(\d+)\.(\d+)\s+(.*)$", ln)
        if m:
            flush()
            n = int(m.group(1))
            if n < 1 or n > 37:
                continue
            state = ORDER[n - 1]
            if m.group(2) == "0":
                cur = None
                continue
            body = ln[m.end(2) + 1:]
            withdrawn = bool(re.search(r"Withdrawn", ln))
            first = clean_line(body)
            cur = dict(sn=m.group(1) + "." + m.group(2), state=state, withdrawn=withdrawn, parts=[first])
        elif cur is not None and ln.strip():
            if "Withdrawn" in ln:
                cur["withdrawn"] = True
            c = clean_line(ln)
            if c:
                cur["parts"].append(c)
    flush()
    rows = []
    for e in out:
        raw = tidy(re.sub(r"\s+", " ", e["raw"]))
        raw = re.sub(r"-\s+", "-", raw)
        if e["withdrawn"] or not raw or not e["state"]:
            continue
        if re.match(r"(Department|Faculty|Dept)\b", raw, re.I):
            continue
        rows.append(dict(sn=e["sn"], state_code=e["state"], raw=raw))
    json.dump(rows, open(sys.argv[2], "w"), indent=1)
    print(len(rows), "entries kept")

main()
