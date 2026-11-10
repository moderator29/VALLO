"""Candidate official home pages per school.

usage: python3 -I school_sites.py seed.json more.json nuc.json polytechnics.wiki out.json

Order of trust: (1) the school's confirmed email domain (its own site, home page fetched
10 Nov 2026), (2) the web address on the NUC federal, state and private university lists
(nuc.edu.ng, 10 Nov 2026) when the university's name matches on its words (Jaccard 0.6),
(3) the web address in Wikipedia's polytechnic list (Wikipedia, 10 Nov 2026) on the same rule.
A page is only used later if its own title or text names the school (see harvest_school_logos.py).
"""
import json, re, sys, unicodedata

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def words(s):
    return set(fold(s).split()) - {"the", "state", "nigeria"}

def sim(a, b):
    A, B = words(a), words(b)
    return len(A & B) / len(A | B) if A and B else 0.0

def main():
    schools = json.load(open(sys.argv[1])) + json.load(open(sys.argv[2]))
    nuc = json.load(open(sys.argv[3]))
    refs = []
    for rows in nuc.values():
        for r in rows:
            if len(r) > 1 and len(r[1]) > 2 and r[1][2].startswith("http"):
                refs.append((r[1][0], r[1][2], "nuc.edu.ng"))
    txt = open(sys.argv[4], encoding="utf-8").read()
    for block in re.split(r"\n\|-[^\n]*", txt):
        cells = [l[1:].strip() for l in block.strip().split("\n") if l.startswith("|") and not l.startswith("|}")]
        if len(cells) >= 4 and cells[3].startswith("http"):
            name = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", cells[0])
            refs.append((name, cells[3].split()[0], "wikipedia polytechnic list"))
    out = {}
    for s in schools:
        c = []
        for d in s.get("email_domains", []):
            c.append(dict(url="https://" + d, via="confirmed email domain"))
        base = s["name"].split(",")[0]
        # the full name decides (a state or town in the NUC name is part of it); the part before the comma only breaks ties
        scored = sorted(((max(sim(n, s["name"]), 0.95 * sim(n.split(",")[0], base) if sim(n, s["name"]) >= 0.5 else 0), sim(n.split(",")[0] + " " + (n.split(",")[1] if "," in n else ""), s["name"]), n, u, v) for n, u, v in refs), reverse=True)
        GEN = {"university", "college", "polytechnic", "of", "the", "and", "for", "federal", "state", "technology", "science", "sciences", "education", "nigeria", "institute", "school", "medical", "health", "agriculture", "management", "open", "applied", "technical"}
        need = {t for t in words(s["name"].split(",")[0]) | words(s["name"].split(",")[-1]) if t not in GEN}
        for sc, _tie, n, u, v in scored[:1]:
            # one NUC or Wikipedia candidate: it must match well AND carry every distinctive word of the name (the town, the founder)
            if sc >= 0.6 and need <= words(n) and all(u.rstrip("/") != x["url"].rstrip("/") for x in c):
                c.append(dict(url=u, via=f"{v}: {n} (match {sc:.2f}; every distinctive word of the name is in the listed name)"))
        if c:
            out[s["slug"]] = dict(name=s["name"], kind=s["kind"], candidates=c)
    json.dump(out, open(sys.argv[5], "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(len(out), "of", len(schools), dict(Counter(v["kind"] for v in out.values())))

main()
