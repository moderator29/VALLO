"""Shared helper: read the (slug, name, short_name, kind, state, city, domains, verify)
rows out of the pending schools SQL files."""
import re, sys, json

ROW = re.compile(r"^\s*\('((?:[^']|'')+)', '((?:[^']|'')+)', (null|'(?:[^']|'')*'), '(\w+)', '(\w+)', (null|'(?:[^']|'')*'), '\{([^}]*)\}', (true|false)\)", re.M)

def unq(s):
    if s == "null":
        return None
    if s.startswith("'"):
        s = s[1:-1]
    return s.replace("''", "'")

def parse(path):
    out = []
    for m in ROW.finditer(open(path, encoding="utf-8").read()):
        slug, name, short, kind, state, city, doms, ver = m.groups()
        out.append(dict(slug=unq("'" + slug + "'"), name=unq("'" + name + "'"), short_name=unq(short), kind=kind,
                        state_code=state, city=unq(city), email_domains=[d for d in doms.split(",") if d], email_verify_on=ver == "true"))
    return out

if __name__ == "__main__":
    rows = []
    for p in sys.argv[1:]:
        rows += parse(p)
    print(len(rows), file=sys.stderr)
    json.dump(rows, sys.stdout, indent=1)
