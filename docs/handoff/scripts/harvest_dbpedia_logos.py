"""Find a public logo for each school from DBpedia (the structured copy of the
Wikipedia infobox), then confirm it on Wikipedia/Commons.

usage: python3 -I harvest_dbpedia_logos.py schools.json dbpedia.json out.json [log.txt]

1. dbpedia.json is one SPARQL result from https://dbpedia.org/sparql (the query is
   in docs/handoff/SCHOOLS_DIRECTORY_SOURCES.md): every Nigerian educational
   institution with its English label, infobox `logo` / `image` file name and website.
2. Each school is matched by its name (accents, case, punctuation, a trailing
   town folded away; a Jaccard similarity of 0.8 or better on the words, and the
   website domain when the school has a confirmed email domain).
3. The file name is resolved with the MediaWiki API (iiurlwidth=128) in batches of
   40; the 128px thumbnail address is fetched and must answer HTTP 200 with an
   image/* content type. Anything else leaves logo_url null.
Recorded per school: logo_url (upload.wikimedia.org, no query string), logo_source
(the file's description page), dbpedia_label, match score. Single thread, paused.
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error

UA = "ValloSchoolLogoBot/1.0 (project VALLO; contact via repo)"
API = "https://en.wikipedia.org/w/api.php"
PAUSE = 1.5
IMG = re.compile(r"\.(png|jpe?g|svg|gif|webp)$", re.I)
LOGOISH = re.compile(r"logo|seal|crest|emblem|coat[ _]of[ _]arms|insignia|badge|shield|wordmark", re.I)
NOTLOGO = re.compile(r"flag of|map of|location|campus|building|gate|aerial|hostel|library|chapel|banner", re.I)

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

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def words(s):
    return set(fold(s).split()) - {"the"}

def sim(a, b):
    A, B = words(a), words(b)
    return len(A & B) / len(A | B) if A and B else 0.0

def file_name(v):
    v = (v or "").strip().replace("_", " ")
    m = re.search(r"(?:File|Image):([^|\]\n]+)", v, re.I)
    if m:
        v = m.group(1).strip()
    return v if IMG.search(v) else None

def main():
    schools = json.load(open(sys.argv[1]))
    rows = json.load(open(sys.argv[2]))["results"]["bindings"]
    log = open(sys.argv[4], "a") if len(sys.argv) > 4 else sys.stderr
    L = lambda *a: print(*a, file=log, flush=True)
    items = {}
    for b in rows:
        lab = b["label"]["value"]
        e = items.setdefault(lab, dict(label=lab, uri=b["s"]["value"], logos=set(), images=set(), web=set()))
        if "logo" in b and file_name(b["logo"]["value"]):
            e["logos"].add(file_name(b["logo"]["value"]))
        if "img" in b:
            f = file_name(b["img"]["value"])
            if f and LOGOISH.search(f) and not NOTLOGO.search(f):
                e["images"].add(f)
        if "web" in b:
            e["web"].add(re.sub(r"^https?://(www\.)?", "", b["web"]["value"]).split("/")[0].lower())
    L(f"{len(items)} DBpedia institutions, {sum(1 for e in items.values() if e['logos'] or e['images'])} with a logo file name")
    pick = {}
    for s in schools:
        best, score = None, 0.0
        base = s["name"].split(",")[0]
        for e in items.values():
            if not (e["logos"] or e["images"]):
                continue
            sc = max(sim(e["label"], s["name"]), sim(e["label"], base) if "," in s["name"] else 0)
            dom = any(d and any(d == w or d.endswith("." + w) or w.endswith("." + d) for w in e["web"]) for d in s.get("email_domains", []))
            if dom:
                sc = max(sc, 0.9)
            # when both names carry a town, the towns must agree
            if sc > score:
                best, score = e, sc
        if best and score >= 0.8:
            pick[s["slug"]] = (best, score)
    L(f"{len(pick)} schools matched to a DBpedia institution with a logo file")
    files = sorted({(sorted(e["logos"]) or sorted(e["images"]))[0] for e, _ in pick.values()})
    info = {}
    for i in range(0, len(files), 40):
        chunk = files[i : i + 40]
        time.sleep(PAUSE)
        st, ct, body = get(API + "?" + urllib.parse.urlencode(dict(action="query", titles="|".join("File:" + f for f in chunk), prop="imageinfo", iiprop="url|mime", iiurlwidth=128, format="json", formatversion="2")))
        if st != 200:
            L("imageinfo batch failed", st)
            continue
        q = json.loads(body).get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        byt = {p["title"]: p["imageinfo"][0] for p in q.get("pages", []) if p.get("imageinfo")}
        for f in chunk:
            t = norm.get("File:" + f, "File:" + f)
            if t in byt:
                ii = byt[t]
                info[f] = ((ii.get("thumburl") or ii.get("url") or "").split("?")[0], ii.get("descriptionurl"))
        L(f"imageinfo {i + len(chunk)}/{len(files)}")
    ok = {}
    result = {}
    for s in schools:
        r = dict(slug=s["slug"], logo_url=None, logo_source=None, dbpedia_label=None, score=None, note="no logo file on a matching DBpedia page")
        if s["slug"] in pick:
            e, sc = pick[s["slug"]]
            r.update(dbpedia_label=e["label"], score=round(sc, 2))
            f = (sorted(e["logos"]) or sorted(e["images"]))[0]
            if f not in info or not info[f][0].startswith("https://upload.wikimedia.org/"):
                r["note"] = "file not found on Wikipedia/Commons"
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
    json.dump(result, open(sys.argv[3], "w"), indent=1)
    L(f"done: {sum(1 for r in result.values() if r['logo_url'])} of {len(schools)} with a verified logo")

main()
