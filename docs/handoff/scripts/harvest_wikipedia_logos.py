"""Find a public logo for each school from the English Wikipedia infobox.

usage: python3 -I harvest_wikipedia_logos.py schools.json out.json [log.txt]

For every school: resolve an article (name variants, then a search whose title
must be close to the school name and whose text must mention Nigeria), read the
infobox `logo` / `seal` / `coat_of_arms` / `crest` parameter, ask the MediaWiki
API for a 128px thumbnail of that file, then GET the thumbnail and require HTTP
200 and an image/* content type before recording it. Nothing is guessed: a
school without a verified logo gets logo_url null.

Recorded per school: logo_url (https://upload.wikimedia.org/...), logo_source
(the file's description page), wiki_title. Rate limited, single thread.
"""
import json, re, sys, time, urllib.parse, urllib.request, urllib.error

UA = "ValloSchoolLogoBot/1.0 (project VALLO; contact via repo)"
API = "https://en.wikipedia.org/w/api.php"
PAUSE = 0.35

def get(url, binary=False, tries=4):
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read(200000 if binary else None)
                return r.status, r.headers.get("Content-Type", ""), body
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(5 * (i + 1))
                continue
            return e.code, e.headers.get("Content-Type", "") if e.headers else "", b""
        except Exception as e:  # network
            time.sleep(2 * (i + 1))
    return 0, "", b""

def api(**params):
    params["format"] = "json"
    params["formatversion"] = "2"
    time.sleep(PAUSE)
    st, ct, body = get(API + "?" + urllib.parse.urlencode(params))
    if st != 200:
        return {}
    try:
        return json.loads(body)
    except Exception:
        return {}

def fold(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

GENERIC = {"of", "the", "and", "for", "in", "university", "college", "polytechnic", "federal", "state", "nigeria", "technology", "education", "science", "sciences"}

def sim(a, b):
    A, B = set(fold(a).split()), set(fold(b).split())
    if not A or not B:
        return 0
    return len(A & B) / len(A | B)

def variants(school):
    name = school["name"]
    base = name.split(",")[0].strip()
    city = (school.get("city") or "").split(",")[0].strip()
    out = [name, base]
    if city:
        out += [f"{base}, {city}", f"{base} {city}"]
    seen, res = set(), []
    for v in out:
        if v and v not in seen:
            seen.add(v)
            res.append(v)
    return res

LOGO_PARAMS = ("logo", "seal", "coat_of_arms", "crest", "logo_image", "image_name_logo")

def infobox_logo(text):
    for p in LOGO_PARAMS:
        m = re.search(r"^\s*\|\s*" + p + r"\s*=\s*(.*?)\s*$", text, re.M | re.I)
        if not m:
            continue
        v = m.group(1)
        m2 = re.search(r"(?:File|Image):([^|\]\n]+)", v, re.I)
        name = m2.group(1) if m2 else v.split("|")[0].split("<")[0]
        name = name.strip().replace("_", " ")
        if re.search(r"\.(png|jpe?g|svg|gif|webp)$", name, re.I):
            return name
    return None

def pages_with_content(titles):
    """title -> (resolved_title, wikitext) for existing pages, redirects followed."""
    res = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i : i + 20]
        d = api(action="query", titles="|".join(chunk), redirects=1, prop="revisions", rvprop="content", rvslots="main")
        q = d.get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        redir = {r["from"]: r["to"] for r in q.get("redirects", [])}
        byt = {}
        for p in q.get("pages", []):
            if p.get("missing") or "revisions" not in p:
                continue
            byt[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
        for t in chunk:
            r = norm.get(t, t)
            r = redir.get(r, r)
            if r in byt:
                res[t] = (r, byt[r])
    return res

def search_titles(school):
    d = api(action="query", list="search", srsearch=f'{school["name"].split(",")[0]} Nigeria', srlimit=3, srprop="")
    return [h["title"] for h in d.get("query", {}).get("search", [])]

def file_info(files):
    """File name -> (thumburl, descriptionurl, mime)."""
    out = {}
    for i in range(0, len(files), 40):
        chunk = files[i : i + 40]
        d = api(action="query", titles="|".join("File:" + f for f in chunk), prop="imageinfo", iiprop="url|mime|size", iiurlwidth=128)
        q = d.get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        byt = {}
        for p in q.get("pages", []):
            ii = p.get("imageinfo")
            if ii:
                byt[p["title"]] = ii[0]
        for f in chunk:
            t = norm.get("File:" + f, "File:" + f)
            if t in byt:
                ii = byt[t]
                out[f] = (ii.get("thumburl") or ii.get("url"), ii.get("descriptionurl"), ii.get("mime", ""))
    return out

def verify_image(url):
    st, ct, body = get(url, binary=True)
    time.sleep(PAUSE)
    return st == 200 and ct.lower().startswith("image/") and len(body) > 100, st, ct

def main():
    schools = json.load(open(sys.argv[1]))
    outp = sys.argv[2]
    log = open(sys.argv[3], "a") if len(sys.argv) > 3 else sys.stderr
    def L(*a):
        print(*a, file=log, flush=True)
    # 1. direct title candidates
    cand = {}
    allt = []
    for s in schools:
        cand[s["slug"]] = variants(s)
        allt += cand[s["slug"]]
    allt = list(dict.fromkeys(allt))
    L(f"resolving {len(allt)} candidate titles")
    found = pages_with_content(allt)
    result = {}
    need_files = {}
    def accept(s, title, text, how):
        if "nigeria" not in text.lower():
            return False
        f = infobox_logo(text)
        if not f:
            return False
        need_files[s["slug"]] = (f, title, how)
        return True
    for s in schools:
        for v in cand[s["slug"]]:
            if v in found:
                title, text = found[v]
                if sim(title, s["name"].split(",")[0]) >= 0.5 and accept(s, title, text, "title"):
                    break
    L(f"direct hits with a logo parameter: {len(need_files)}")
    # 2. search fallback for the rest
    rest = [s for s in schools if s["slug"] not in need_files]
    for n, s in enumerate(rest):
        titles = search_titles(s)
        cs = {t: sim(t, s["name"].split(",")[0]) for t in titles}
        good = [t for t in titles if cs[t] >= 0.6]
        if not good:
            continue
        got = pages_with_content(good)
        for t in good:
            if t in got and accept(s, got[t][0], got[t][1], "search"):
                break
        if n % 25 == 0:
            L(f"search {n}/{len(rest)}")
    # 3. file info + verification
    files = list({f for f, _, _ in need_files.values()})
    info = file_info(files)
    L(f"files wanted {len(files)}, resolved {len(info)}")
    verified = {}
    for s in schools:
        e = need_files.get(s["slug"])
        r = dict(slug=s["slug"], logo_url=None, logo_source=None, wiki_title=None, note="no infobox logo found")
        if e:
            f, title, how = e
            r["wiki_title"] = title
            fi = info.get(f)
            if not fi or not fi[0] or not fi[0].startswith("https://upload.wikimedia.org/"):
                r["note"] = "file info unavailable"
            else:
                url, desc, mime = fi
                if url not in verified:
                    verified[url] = verify_image(url)
                ok, st, ct = verified[url]
                if ok:
                    r.update(logo_url=url, logo_source=desc, note=f"ok via {how}")
                else:
                    r["note"] = f"image check failed {st} {ct}"
        result[s["slug"]] = r
        L(json.dumps(r))
    json.dump(result, open(outp, "w"), indent=1)
    L(f"done: {sum(1 for r in result.values() if r['logo_url'])} of {len(schools)} with a verified logo")

main()
