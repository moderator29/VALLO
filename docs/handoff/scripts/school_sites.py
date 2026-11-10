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
        scored = sorted(((max(sim(n.split(",")[0], base), sim(n, s["name"])), n, u, v) for n, u, v in refs), reverse=True)
        for sc, n, u, v in scored[:2]:
            if sc >= 0.5 and all(u.rstrip("/") != x["url"].rstrip("/") for x in c):
                c.append(dict(url=u, via=f"{v}: {n} (match {sc:.2f})"))
        if c:
            out[s["slug"]] = dict(name=s["name"], kind=s["kind"], candidates=c)
    json.dump(out, open(sys.argv[5], "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(len(out), "of", len(schools), dict(Counter(v["kind"] for v in out.values())))

main()
