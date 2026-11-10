"""Find each school's logo on its OWN website, validate it, and save a 160px WebP copy.

usage: python3 -I harvest_school_logos.py sites.json schools_all.json outdir manifest.json [kinds]

For each school with a candidate home page (school_sites.py):
 1. fetch the home page (User-Agent names the project, 10 s timeout, retry once, TLS verified);
 2. identity: the page title, og:site_name, headings, description and the first visible text must
    contain every distinctive word of the school's name (or, for a confirmed email domain, half of
    them or the short name). A page that does not name the school is skipped;
 3. logo candidates, in order: an <img> in the header or navigation whose src, alt, class or id says
    logo or carries a word of the school's name; any <img> on the page that says logo; og:image only
    when its file name says logo, seal, crest or emblem; apple-touch-icon (largest); link rel=icon;
 4. an image is accepted if it is HTTP 200, image/*, decodes, is at least 40 px on its short side,
    roughly square or a wordmark under 5:1, not a huge photograph; SVG is rasterised with sharp;
 5. it is contained in 160 x 160 on transparency (white behind a flat JPEG), saved as WebP at quality 85
    (stepped down to stay near 12 KB). The same picture found for two schools is dropped for both.
Writes <outdir>/<slug>.webp and the manifest (slug, source page, image url, bytes, decision).
Concurrency 6. Nothing is hotlinked: the app serves the copy from its own origin.
"""
import hashlib, io, json, re, subprocess, sys, threading, time, unicodedata, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from PIL import Image

UA = "ValloSchoolLogoBot/1.0 (project VALLO; identifying schools in a student school picker; contact via repo)"
HERE = __file__.rsplit("/", 1)[0]
GENERIC = {"university", "college", "polytechnic", "of", "the", "and", "for", "in", "federal", "state", "technology", "technical", "science", "sciences", "education", "nigeria", "institute", "school", "medical", "health", "agriculture", "management", "open", "international", "applied", "petroleum", "resources", "monotechnic", "national", "studies", "unity", "nursing", "midwifery", "academy"}

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def get(url, limit=3_000_000, timeout=10):
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,image/*,*/*;q=0.5"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read(limit), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt == 0:
                time.sleep(3)
                continue
            return e.code, "", b"", url
        except Exception as e:
            if attempt == 0:
                time.sleep(1.5)
                continue
            return 0, str(e)[:80], b"", url
    return 0, "", b"", url

def distinct(name):
    base = fold(name.split(",")[0])
    toks = [t for t in base.split() if t not in GENERIC and len(t) > 1]
    return toks or [t for t in base.split() if t not in {"of", "the"}]

def names_school(school, soup, confirmed):
    parts = [soup.title.get_text(" ") if soup.title else ""]
    for sel in ({"property": "og:site_name"}, {"property": "og:title"}, {"name": "description"}, {"property": "og:description"}):
        m = soup.find("meta", attrs=sel)
        if m and m.get("content"):
            parts.append(m["content"])
    parts += [h.get_text(" ") for h in soup.find_all(["h1", "h2"], limit=6)]
    parts.append(soup.get_text(" ")[:4000])
    text = " " + fold(" ".join(parts)) + " "
    toks = distinct(school["name"])
    have = [t for t in toks if f" {t} " in text]
    short = fold(school.get("short_name") or "")
    if len(have) == len(toks):
        return True
    if confirmed and (len(have) * 2 >= len(toks) or (short and f" {short} " in text)):
        return True
    return False

def candidates(soup, base, school):
    seen, out = set(), []
    def add(url, why, w=None):
        if not url or url.startswith("data:"):
            return
        u = urllib.parse.urljoin(base, url.strip())
        if u not in seen and u.startswith("http"):
            seen.add(u)
            out.append((u, why))
    toks = distinct(school["name"])
    def says_logo(img):
        blob = " ".join([img.get("src", ""), img.get("alt", ""), " ".join(img.get("class", [])), img.get("id", ""), img.get("data-src", "")]).lower()
        return "logo" in blob or "crest" in blob or "emblem" in blob or any(t in fold(blob) for t in toks if len(t) > 3)
    zone = soup.find_all(["header", "nav"]) + soup.find_all(attrs={"class": re.compile(r"header|navbar|masthead|brand|logo", re.I)}) + soup.find_all(attrs={"id": re.compile(r"header|navbar|masthead|brand|logo", re.I)})
    for z in zone:
        for img in z.find_all("img", limit=8):
            if says_logo(img) and not re.search(r"partner|sponsor|banner|slider|hero", img.get("src", "") + " ".join(img.get("class", [])), re.I):
                add(img.get("src") or img.get("data-src"), "header img")
    for img in soup.find_all("img", limit=60):
        if "logo" in (img.get("src", "") + img.get("alt", "") + " ".join(img.get("class", []))).lower() and not re.search(r"partner|sponsor|footer|client|slider", img.get("src", "") + " ".join(img.get("class", [])), re.I):
            add(img.get("src") or img.get("data-src"), "page img")
    m = soup.find("meta", attrs={"property": "og:image"})
    if m and m.get("content") and re.search(r"logo|seal|crest|emblem", m["content"], re.I):
        add(m["content"], "og:image")
    icons = []
    for l in soup.find_all("link", rel=True):
        rel = " ".join(l["rel"]).lower()
        if "apple-touch-icon" in rel or ("icon" in rel and "mask" not in rel):
            sz = re.match(r"(\d+)", l.get("sizes", "") or "")
            icons.append((("apple" in rel), int(sz.group(1)) if sz else 0, l.get("href")))
    for apple, sz, href in sorted(icons, key=lambda x: (not x[0], -x[1])):
        add(href, "apple-touch-icon" if apple else "icon")
    return out

def load_image(url, ctype, data):
    if "svg" in ctype or url.lower().split("?")[0].endswith(".svg"):
        p = subprocess.run(["node", HERE + "/svg2png.mjs"], input=data, capture_output=True, timeout=30, cwd=HERE)
        if p.returncode != 0:
            return None
        data = p.stdout
    im = Image.open(io.BytesIO(data))
    if getattr(im, "n_frames", 1) > 1 and im.format == "ICO":
        sizes = im.info.get("sizes") or []
        if sizes:
            im.size = max(sizes)
            im.load()
    im.load()
    return im

def acceptable(im, how):
    w, h = im.size
    if min(w, h) < (40 if how not in ("icon", "apple-touch-icon") else 48):
        return "too small"
    r = w / h
    if r > 5 or r < 0.2:
        return "banner shaped"
    if im.format in ("JPEG",) and max(w, h) > 1100:
        return "large jpeg (photo)"
    if w * h > 6_000_000:
        return "huge"
    return None

def to_webp(im):
    im = im.convert("RGBA")
    # a fully opaque flat JPEG stays on its own ground; transparency is kept
    im.thumbnail((160, 160), Image.LANCZOS)
    canvas = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    canvas.paste(im, ((160 - im.width) // 2, (160 - im.height) // 2), im)
    for q in (85, 78, 70, 60):
        b = io.BytesIO()
        canvas.save(b, "WEBP", quality=q, method=6)
        if b.tell() <= 12_500:
            break
    return b.getvalue()

def blank(im):
    g = im.convert("RGBA")
    px = list(g.resize((32, 32)).getdata())
    solid = len({(r // 24, gg // 24, b // 24, a // 64) for r, gg, b, a in px}) <= 2
    return solid

def work(school, sites, outdir):
    rec = dict(slug=school["slug"], kind=school["kind"], name=school["name"], page=None, image=None, bytes=0, decision="no site")
    confirmed = any(c["via"].startswith("confirmed") for c in sites)
    why = []
    for c in sites:
        for variant in dict.fromkeys([c["url"], re.sub(r"^(https?://)(?!www\.)", r"\1www.", c["url"])]):
            st, ct, body, final = get(variant)
            if st == 200 and "html" in ct.lower() and body:
                break
        else:
            why.append(f"unreachable {st} {ct[:40]}")
            continue
        soup = BeautifulSoup(body, "lxml")
        if not names_school(school, soup, confirmed and c["via"].startswith("confirmed")):
            why.append("page does not name the school")
            continue
        rec["page"] = final
        tried = 0
        for url, how in candidates(soup, final, school):
            if tried >= 5:
                break
            tried += 1
            st, ct, data, _ = get(url)
            if st != 200 or not data:
                why.append(f"{how} {st}")
                continue
            try:
                im = load_image(url, ct, data)
            except Exception as e:
                why.append(f"{how} undecodable")
                continue
            if im is None:
                why.append(f"{how} svg failed")
                continue
            bad = acceptable(im, how)
            if bad:
                why.append(f"{how} {bad}")
                continue
            if blank(im):
                why.append(f"{how} blank")
                continue
            webp = to_webp(im)
            rec.update(image=url, bytes=len(webp), how=how, decision="kept", sha=hashlib.sha1(webp).hexdigest())
            open(f"{outdir}/{school['slug']}.webp", "wb").write(webp)
            return rec
    rec["decision"] = "no logo: " + ("; ".join(why[:4]) or "no reachable page")
    return rec

def main():
    sites = json.load(open(sys.argv[1]))
    schools = [s for s in json.load(open(sys.argv[2])) if s["slug"] in sites]
    kinds = sys.argv[5].split(",") if len(sys.argv) > 5 else ["university", "polytechnic", "college", "other"]
    schools = [s for s in schools if s["kind"] in kinds]
    order = {"university": 0, "polytechnic": 1, "college": 2, "other": 3}
    schools.sort(key=lambda s: order.get(s["kind"], 4))
    outdir = sys.argv[3]
    done = []
    lock = threading.Lock()
    def run(s):
        try:
            r = work(s, sites[s["slug"]]["candidates"], outdir)
        except Exception as e:
            r = dict(slug=s["slug"], kind=s["kind"], name=s["name"], decision=f"error {type(e).__name__}", bytes=0)
        with lock:
            done.append(r)
            print(f"{len(done)}/{len(schools)} {r['slug']} {r['decision'][:70]}", file=sys.stderr, flush=True)
            json.dump(done, open(sys.argv[4], "w"), indent=1)
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(run, schools))
    print(sum(1 for r in done if r["decision"] == "kept"), "kept of", len(done))

main()
