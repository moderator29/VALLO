"""Find a public logo for each school from the files used on its English Wikipedia article.

usage: python3 -I harvest_wikipedia_images.py schools.json out.json [log.txt]

A light variant of harvest_wikipedia_logos.py: it never downloads article text.
For each school it asks for up to two article titles (the full name and the name
without its town), with redirects followed, and for each existing article takes
the short description (it must say Nigeria or a Nigerian state, so a same-named
school elsewhere is not taken) and the list of files the article uses. A file
whose name says logo, seal, crest, emblem, coat of arms, insignia or badge (and
not flag, map, campus, building...) is the candidate. The MediaWiki API then
gives a 128px thumbnail address, which is fetched and must answer HTTP 200 with
an image/* content type before it is recorded. Single thread, paused, honours
Retry-After. Nothing is guessed: no article, no logo-named file, or a failed
fetch leaves logo_url null.
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error

UA = "ValloSchoolLogoBot/1.0 (project VALLO; contact via repo)"
API = "https://en.wikipedia.org/w/api.php"
PAUSE = 1.2
IMG = re.compile(r"\.(png|jpe?g|svg|gif|webp)$", re.I)
LOGOISH = re.compile(r"logo|seal|crest|emblem|coat[ _]of[ _]arms|insignia|badge|wordmark", re.I)
NOTLOGO = re.compile(r"flag of|map of|location|campus|building|gate|aerial|hostel|library|chapel|banner|icon|commons-logo|wikimedia|edit-clear|question book|ambox|padlock|symbol support|increase|decrease|wiki", re.I)
PLACE = re.compile(r"nigeria|lagos|abuja|ibadan|kano|kaduna|enugu|abia|adamawa|akwa ibom|anambra|bauchi|bayelsa|benue|borno|cross river|delta|ebonyi|edo|ekiti|gombe|imo|jigawa|katsina|kebbi|kogi|kwara|nasarawa|niger|ogun|ondo|osun|oyo|plateau|rivers|sokoto|taraba|yobe|zamfara", re.I)

def get(url, binary=False, tries=6):
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read(300000 if binary else None)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                try:
                    w = int(e.headers.get("Retry-After", "0"))
                except Exception:
                    w = 0
                time.sleep(max(w, 8 * (i + 1)))
                continue
            return e.code, "", b""
        except Exception:
            time.sleep(3 * (i + 1))
    return 0, "", b""

def api(**p):
    p.update(format="json", formatversion="2")
    time.sleep(PAUSE)
    st, ct, body = get(API + "?" + urllib.parse.urlencode(p))
    try:
        return json.loads(body) if st == 200 else {}
    except Exception:
        return {}

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def sim(a, b):
    A, B = set(fold(a).split()) - {"the"}, set(fold(b).split()) - {"the"}
    return len(A & B) / len(A | B) if A and B else 0.0

def variants(s):
    name = s["name"]
    base = name.split(",")[0].strip()
    out = [name, base, name.replace(", ", " ", 1)]
    if s.get("short_name") and len(s["short_name"]) > 3 and " " not in s["short_name"]:
        out.append(s["short_name"])
    seen, res = set(), []
    for v in out:
        if v and v not in seen:
            seen.add(v)
            res.append(v)
    return res

def main():
    schools = json.load(open(sys.argv[1]))
    log = open(sys.argv[3], "a") if len(sys.argv) > 3 else sys.stderr
    L = lambda *a: print(*a, file=log, flush=True)
    titles = list(dict.fromkeys(t for s in schools for t in variants(s)))
    L(f"{len(titles)} candidate titles")
    pages = {}  # requested title -> (resolved title, description, files)
    for i in range(0, len(titles), 10):
        chunk = titles[i : i + 10]
        files = {}
        cont = {}
        q_all = {"pages": [], "normalized": [], "redirects": []}
        while True:
            d = api(action="query", titles="|".join(chunk), redirects=1, prop="description|images", imlimit="max", **cont)
            q = d.get("query", {})
            for k in ("normalized", "redirects"):
                q_all[k] += q.get(k, [])
            for p in q.get("pages", []):
                if p.get("missing"):
                    continue
                e = files.setdefault(p["title"], dict(desc=p.get("description", ""), files=[]))
                e["desc"] = e["desc"] or p.get("description", "")
                e["files"] += [im["title"][5:] for im in p.get("images", [])]
            if "continue" in d:
                cont = d["continue"]
            else:
                break
        norm = {n["from"]: n["to"] for n in q_all["normalized"]}
        redir = {r["from"]: r["to"] for r in q_all["redirects"]}
        for t in chunk:
            r = norm.get(t, t)
            r = redir.get(r, r)
            if r in files:
                pages[t] = (r, files[r]["desc"], files[r]["files"])
        if (i // 10) % 10 == 0:
            L(f"titles {i + len(chunk)}/{len(titles)}")
    GENERIC = {"university", "college", "polytechnic", "federal", "state", "of", "the", "and", "technology", "education", "science", "sciences", "institute", "school", "nigeria", "logo", "seal", "crest", "emblem", "badge", "png", "jpg", "jpeg", "svg", "gif", "coat", "arms", "new", "old", "wordmark", "insignia", "technical", "management", "agriculture"}
    def distinct(*texts):
        w = set()
        for t in texts:
            w |= {x for x in fold(t).split() if len(x) >= 3 and x not in GENERIC}
        return w
    def pick_file(s, title, desc, files):
        if not PLACE.search(desc or ""):
            return None
        if sim(title, s["name"]) < 0.6 and sim(title, s["name"].split(",")[0]) < 0.6:
            return None
        cands = [f for f in files if IMG.search(f) and LOGOISH.search(f) and not NOTLOGO.search(f)]
        want = distinct(s["name"], s.get("short_name") or "", title)
        for f in cands:
            if distinct(f) & want or sim(title, s["name"].split(",")[0]) >= 0.9:
                return f
        return None
    chosen = {}
    for s in schools:
        for v in variants(s):
            if v in pages:
                f = pick_file(s, *pages[v])
                if f:
                    chosen[s["slug"]] = (pages[v][0], f)
                    break
    L(f"{len(chosen)} from direct titles; searching for the rest")
    todo = [s for s in schools if s["slug"] not in chosen]
    for n, s in enumerate(todo):
        d = api(action="query", generator="search", gsrsearch=s["name"].split(",")[0] + " Nigeria", gsrlimit=2, prop="description|images", imlimit="max")
        for p in d.get("query", {}).get("pages", []):
            f = pick_file(s, p["title"], p.get("description", ""), [im["title"][5:] for im in p.get("images", [])])
            if f:
                chosen[s["slug"]] = (p["title"], f)
                break
        if n % 40 == 0:
            L(f"search {n}/{len(todo)}")
    L(f"{len(chosen)} schools with a logo-named file on a Nigerian article")
    wanted = sorted({f for _, f in chosen.values()})
    info = {}
    for i in range(0, len(wanted), 20):
        chunk = wanted[i : i + 20]
        d = {}
        for _try in range(4):
            d = api(action="query", titles="|".join("File:" + f for f in chunk), prop="imageinfo", iiprop="url|mime", iiurlwidth=128)
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
                info[f] = ((ii.get("thumburl") or ii.get("url") or "").split("?")[0], ii.get("descriptionurl"))
        L(f"imageinfo {i + len(chunk)}/{len(wanted)}")
    ok = {}
    result = {}
    for s in schools:
        r = dict(slug=s["slug"], logo_url=None, logo_source=None, wiki_title=None, note="no logo-named file on a matching Nigerian article")
        if s["slug"] in chosen:
            title, f = chosen[s["slug"]]
            r["wiki_title"] = title
            if f not in info or not info[f][0].startswith("https://upload.wikimedia.org/"):
                r["note"] = "file not found"
            else:
                url, desc = info[f]
                if url not in ok:
                    time.sleep(PAUSE)
                    st, ct, body = get(url, binary=True)
                    ok[url] = (st == 200 and ct.lower().startswith("image/") and len(body) > 100, st, ct)
                good, st, ct = ok[url]
                if good:
                    r.update(logo_url=url, logo_source=desc, note="ok")
                else:
                    r["note"] = f"image check failed {st} {ct}"
        result[s["slug"]] = r
        L(json.dumps(r))
    json.dump(result, open(sys.argv[2], "w"), indent=1)
    L(f"done: {sum(1 for r in result.values() if r['logo_url'])} of {len(schools)} with a verified logo")

main()
