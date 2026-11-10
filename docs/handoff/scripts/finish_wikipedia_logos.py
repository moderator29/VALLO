"""Second pass for the schools whose first pass found an article but could not resolve the logo file.

usage: python3 -I finish_wikipedia_logos.py first_out.json schools.json out.json [log.txt]

harvest_wikipedia_images.py recorded wiki_title for every school whose article had a logo-named file
but whose file lookup failed (the API was rate limiting). This pass re-reads the files each such
article uses, applies the same rules (logo-named, not a flag, map, building or site icon; the file
name must share a distinctive word with the school or its article, or the article title must be the
school's own name), resolves a 128px thumbnail, fetches it, and keeps it only on HTTP 200 and an
image/* content type.
"""
import json, os, re, sys, time, urllib.parse, hashlib
sys.argv_backup = sys.argv
import importlib.util
spec = importlib.util.spec_from_file_location("h", os.path.join(os.path.dirname(os.path.abspath(__file__)), "harvest_wikipedia_images.py"))
src = open(spec.origin).read().replace("\nmain()\n", "\n")
h = type(sys)("h"); exec(compile(src, spec.origin, "exec"), h.__dict__)

h.PAUSE = 4.0
first = json.load(open(sys.argv[1])); schools = {s["slug"]: s for s in json.load(open(sys.argv[2]))}
log = open(sys.argv[4], "a") if len(sys.argv) > 4 else sys.stderr
# optional 5th argument: an earlier log; schools it already verified are skipped (a rerun after a rate-limit stall)
skip = set()
if len(sys.argv) > 5:
    for ln in open(sys.argv[5]):
        if ln.startswith("{") and '"ok": true' in ln:
            skip.add(json.loads(ln)["slug"])
L = lambda *a: print(*a, file=log, flush=True)
todo = {slug: r for slug, r in first.items() if r["wiki_title"]}
known = {slug: urllib.parse.unquote(r["logo_source"].split("File:", 1)[1]).replace("_", " ") for slug, r in first.items() if r["logo_url"]}
L(f"{len(todo)} schools to finish")
titles = sorted({r["wiki_title"] for slug, r in todo.items() if slug not in known})
files = {}
for i in range(0, len(titles), 5):
    chunk = titles[i : i + 5]
    cont = {}
    while True:
        d = h.api(action="query", titles="|".join(chunk), prop="description|images", imlimit="max", **cont)
        for p in d.get("query", {}).get("pages", []):
            e = files.setdefault(p["title"], dict(desc=p.get("description", ""), files=[]))
            e["desc"] = e["desc"] or p.get("description", "")
            e["files"] += [im["title"][5:] for im in p.get("images", [])]
        if "continue" in d:
            cont = d["continue"]
        else:
            break
    L(f"articles {i + len(chunk)}/{len(titles)}")
GENERIC = {"university", "college", "polytechnic", "federal", "state", "of", "the", "and", "technology", "education", "science", "sciences", "institute", "school", "nigeria", "logo", "seal", "crest", "emblem", "badge", "png", "jpg", "jpeg", "svg", "gif", "coat", "arms", "new", "old", "wordmark", "insignia", "technical", "management", "agriculture"}
def distinct(*texts):
    w = set()
    for t in texts:
        w |= {x for x in h.fold(t).split() if len(x) >= 3 and x not in GENERIC}
    return w
chosen = {}
for slug, r in todo.items():
    if slug in known:
        chosen[slug] = known[slug]
        continue
    s = schools[slug]; title = r["wiki_title"]; e = files.get(title)
    if not e:
        continue
    cands = [f for f in e["files"] if h.IMG.search(f) and h.LOGOISH.search(f) and not h.NOTLOGO.search(f)]
    want = distinct(s["name"], s.get("short_name") or "", title)
    for f in cands:
        if distinct(f) & want or h.sim(title, s["name"].split(",")[0]) >= 0.9:
            chosen[slug] = f
            break
L(f"{len(chosen)} with a usable file name")
wanted = sorted(set(chosen.values()))
info = {}
for i in range(0, len(wanted), 20):
    chunk = wanted[i : i + 20]
    d = {}
    for _ in range(4):
        d = h.api(action="query", titles="|".join("File:" + f for f in chunk), prop="imageinfo", iiprop="url|mime|size")
        if d.get("query"):
            break
        time.sleep(10)
    q = d.get("query", {})
    norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
    byt = {p["title"]: p["imageinfo"][0] for p in q.get("pages", []) if p.get("imageinfo")}
    for f in chunk:
        t = norm.get("File:" + f, "File:" + f)
        if t in byt:
            ii = byt[t]
            info[f] = (ii.get("url", "").split("?")[0], ii.get("descriptionurl"), ii.get("width", 0), ii.get("mime", ""))
    L(f"imageinfo {i + len(chunk)}/{len(wanted)}")
def thumb(url, width, mime):
    """The 120px thumbnail address on upload.wikimedia.org (Wikimedia serves standard widths only)."""
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/([a-z]+)/(\w/\w\w)/(.+)$", url)
    if not m:
        return None
    repo, path, name = m.groups()
    suffix = ".png" if name.lower().endswith(".svg") else ""
    return f"https://upload.wikimedia.org/wikipedia/{repo}/thumb/{path}/{name}/{width}px-{name}{suffix}"

out = {}
for slug, f in chosen.items():
    if slug in skip:
        continue
    if f not in info or not info[f][0].startswith("https://upload.wikimedia.org/"):
        L(f"no file info for {slug} {f}")
        continue
    url, desc, width, mime = info[f]
    tries = []
    if mime == "image/svg+xml" or width > 120:
        t = thumb(url, 120, mime)
        if t:
            tries.append(t)
    tries.append(url)
    for cand in tries:
        time.sleep(h.PAUSE)
        st, ct, body = h.get(cand, binary=True, tries=2)
        ok = st == 200 and ct.lower().startswith("image/") and len(body) > 100
        L(json.dumps(dict(slug=slug, url=cand, status=st, type=ct, ok=ok)))
        if ok:
            out[slug] = dict(slug=slug, logo_url=cand, logo_source=desc, wiki_title=todo[slug]["wiki_title"], note="ok")
            break
json.dump(out, open(sys.argv[3], "w"), indent=1)
L(f"done: {len(out)} more verified")
