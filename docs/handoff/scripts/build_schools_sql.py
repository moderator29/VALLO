"""Write the two pending SQL files for the schools directory follow-up.

usage: python3 -I build_schools_sql.py seed.json more.json logos.json aliases.json outdir

  seed.json    the 545 rows already in roommates_5 and roommates_schools_full_list
  more.json    the new schools (slug, name, short_name, kind, state_code, city, email_domains, email_verify_on)
  logos.json   slug -> {logo_url, logo_source}   (only verified entries)
  aliases.json slug -> [alias, ...]
Checks (it refuses to write on any failure): unique slugs, no duplicate normalised
name or (short name, state), ISO state codes, kinds from the allowed set, https
logo addresses, slugs match the table's check.
"""
import json, re, sys, unicodedata
from collections import Counter

STATES = set("AB AD AK AN BA BY BE BO CR DE EB ED EK EN GO IM JI KD KN KT KE KO KW LA NA NI OG ON OS OY PL RI SO TA YO ZA FC".split())
KINDS = {"university", "polytechnic", "college", "other"}

def q(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"[^a-z0-9]+", "", "".join(c for c in s if not unicodedata.combining(c)).lower())

def slugify(name):
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80].strip("-")

def check(seed, more, logos, aliases):
    problems = []
    allrows = seed + more
    slugs = Counter(r["slug"] for r in allrows)
    problems += [f"duplicate slug {s}" for s, n in slugs.items() if n > 1]
    names = Counter(fold(r["name"]) for r in allrows)
    problems += [f"duplicate name {s}" for s, n in names.items() if n > 1]
    shorts = Counter((fold(r["short_name"]), r["state_code"]) for r in allrows if r["short_name"])
    problems += [f"duplicate short name {s}" for s, n in shorts.items() if n > 1]
    for r in more:
        if r["state_code"] not in STATES: problems.append(f"bad state {r['slug']} {r['state_code']}")
        if r["kind"] not in KINDS: problems.append(f"bad kind {r['slug']}")
        if not re.fullmatch(r"[a-z0-9-]{2,80}", r["slug"]): problems.append(f"bad slug {r['slug']}")
        if not 3 <= len(r["name"]) <= 140: problems.append(f"bad name length {r['slug']}")
        if r["short_name"] and len(r["short_name"]) > 30: problems.append(f"short name too long {r['slug']}")
        if r["city"] and len(r["city"]) > 80: problems.append(f"city too long {r['slug']}")
        if r["email_verify_on"] and not r["email_domains"]: problems.append(f"verify on without domain {r['slug']}")
    known = {r["slug"] for r in allrows}
    for slug, l in logos.items():
        if slug not in known: problems.append(f"logo for unknown slug {slug}")
        if not l["logo_url"].startswith("https://") or len(l["logo_url"]) > 500: problems.append(f"bad logo url {slug}")
        if not l["logo_source"].startswith("https://") or len(l["logo_source"]) > 500: problems.append(f"bad logo source {slug}")
    for slug, a in aliases.items():
        if slug not in known: problems.append(f"alias for unknown slug {slug}")
        if len(a) > 20 or any(len(x) > 60 for x in a): problems.append(f"alias limits {slug}")
    return problems

def row_sql(r):
    doms = "{" + ",".join(r["email_domains"]) + "}"
    return f"  ({q(r['slug'])}, {q(r['name'])}, {q(r['short_name'])}, {q(r['kind'])}, {q(r['state_code'])}, {q(r['city'])}, '{doms}', {'true' if r['email_verify_on'] else 'false'})"

def main():
    seed = json.load(open(sys.argv[1])); more = json.load(open(sys.argv[2]))
    logos = json.load(open(sys.argv[3])); aliases = json.load(open(sys.argv[4])); out = sys.argv[5]
    problems = check(seed, more, logos, aliases)
    if problems:
        print("\n".join(problems[:60])); sys.exit(1)
    open(out + "/_more_rows.sql", "w").write(",\n".join(row_sql(r) for r in more))
    vals = ",\n".join(f"  ({q(s)}, {q(l['logo_url'])}, {q(l['logo_source'])})" for s, l in sorted(logos.items()))
    avals = ",\n".join("  (" + q(s) + ", array[" + ", ".join(q(x) for x in a) + "]::text[])" for s, a in sorted(aliases.items()))
    open(out + "/_logo_values.sql", "w").write(vals)
    open(out + "/_alias_values.sql", "w").write(avals)
    print(len(more), "new rows;", len(logos), "logos;", len(aliases), "alias rows")

main()
