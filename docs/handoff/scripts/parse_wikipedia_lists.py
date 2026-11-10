"""Rows from the Wikipedia list pages that the first schools agent could not place.

usage: python3 -I parse_wikipedia_lists.py polytechnics.wiki colleges.wiki out.json

Sources (raw wikitext, read 10 Nov 2026):
  https://en.wikipedia.org/wiki/List_of_polytechnics_in_Nigeria   federal, state and private tables, and "Colleges of Nursing"
  https://en.wikipedia.org/wiki/List_of_colleges_of_education_in_Nigeria   the "Private colleges" table
Each row is name, state, town and (polytechnics) the school's web address. State names
become ISO codes of public.states. The caller drops rows already in the seed.
"""
import json, re, sys

CODES = {"abia":"AB","adamawa":"AD","akwa ibom":"AK","anambra":"AN","bauchi":"BA","bayelsa":"BY","benue":"BE","borno":"BO","cross river":"CR","delta":"DE","ebonyi":"EB","edo":"ED","ekiti":"EK","enugu":"EN","gombe":"GO","imo":"IM","jigawa":"JI","kaduna":"KD","kano":"KN","katsina":"KT","kebbi":"KE","kogi":"KO","kwara":"KW","lagos":"LA","nasarawa":"NA","niger":"NI","ogun":"OG","ondo":"ON","osun":"OS","oyo":"OY","plateau":"PL","rivers":"RI","sokoto":"SO","taraba":"TA","yobe":"YO","zamfara":"ZA","fct":"FC","federal capital territory":"FC","abuja":"FC"}

def clean(s):
    s = re.sub(r"<ref[^>]*?/>|<ref[^>]*?>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s.replace("'''", "").replace("''", "")).strip(" .")

def state(s):
    k = clean(s).lower().replace(" state", "").replace("(abuja)", "").strip()
    k = re.sub(r"\bfederal capital territory.*", "fct", k)
    return CODES.get(k)

def tables(text):
    for t in re.split(r"\n\{\|", text)[1:]:
        t = t.split("\n|}")[0]
        yield [[c for c in re.split(r"\n\|(?!\|)", r)[1:]] if False else r for r in re.split(r"\n\|-[^\n]*", t)]

def cells(row):
    out = []
    for line in row.strip().split("\n"):
        if line.startswith("|") and not line.startswith("|-") and not line.startswith("|}"):
            out.append(line[1:].strip())
        elif line.startswith("!") or line.startswith("{|"):
            continue
        elif out:
            out[-1] += " " + line.strip()
    return out

def sections(text):
    parts = re.split(r"\n==([^=\n]+)==\n", text)
    return {parts[i].strip(): parts[i + 1] for i in range(1, len(parts) - 1, 2)}

def main():
    poly = open(sys.argv[1], encoding="utf-8").read()
    coll = open(sys.argv[2], encoding="utf-8").read()
    out = []
    for sec, kind in (("Federal Institutions", "polytechnic"), ("State Institutions", "polytechnic"), ("Private Institutions", "polytechnic")):
        for row in re.split(r"\n\|-[^\n]*", sections(poly)[sec]):
            c = cells(row)
            if len(c) >= 3:
                web = clean(c[3]) if len(c) > 3 else ""
                out.append(dict(name=clean(c[0]), state_code=state(c[1]), city=clean(c[2]) or None, web=web if web.startswith("http") else None, kind=kind, source="Wikipedia, List of polytechnics in Nigeria, " + sec.split()[0].lower()))
    for row in re.split(r"\n\|-[^\n]*", sections(poly)["Colleges of Nursing"]):
        c = cells(row)
        if len(c) >= 4:
            out.append(dict(name=clean(c[0]), state_code=state(c[1]), city=clean(c[3]) or None, web=None, kind="college", source="Wikipedia, List of polytechnics in Nigeria, colleges of nursing"))
    for row in re.split(r"\n\|-+[^\n]*", sections(coll)["Private colleges"]):
        c = cells(row)
        if len(c) >= 4:
            out.append(dict(name=clean(c[0]), state_code=state(c[3]), city=clean(c[1]) or None, web=None, kind="college", source="Wikipedia, List of colleges of education in Nigeria, private colleges"))
    out = [r for r in out if r["name"] and r["state_code"]]
    json.dump(out, open(sys.argv[3], "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(len(out), dict(Counter(r["source"] for r in out)))

main()
