"""Confirm a school's email domain from its OWN official site. Never guesses.

usage: python3 -I confirm_email_domains.py sites.json schools_all.json out.json

Only schools whose row has no email domain yet are looked at. A domain is confirmed when
 (1) the candidate site's home page was fetched and its title, headings or text name the
     school (the same identity rule the logo pass uses),
 (2) the site's domain, after redirects, is a .edu.ng or .edu name (a subdomain such as
     portal.school.edu.ng counts as school.edu.ng; one label below edu.ng or edu), and
 (3) any e-mail addresses printed on the home page or its contact page are on that same
     domain or a subdomain of it. If the pages show addresses on a different .edu.ng or .edu
     domain, the school is left blank (ambiguous: the mail domain may differ from the site).
Everything else stays blank.
"""
import json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
path = __file__.rsplit("/", 1)[0] + "/harvest_school_logos.py"
src = open(path).read().replace("\nmain()\n", "\n")
h = type(sys)("h"); h.__dict__["__file__"] = path; exec(compile(src, path, "exec"), h.__dict__)
from bs4 import BeautifulSoup

def registrable(host):
    host = host.lower().split(":")[0]
    host = re.sub(r"^www\.", "", host)
    labels = host.split(".")
    if host.endswith(".edu.ng") and len(labels) >= 3:
        return ".".join(labels[-3:])
    if host.endswith(".edu") and len(labels) >= 2:
        return ".".join(labels[-2:])
    return None

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)")

def check(school, sites):
    for c in sites:
        for variant in dict.fromkeys([c["url"], re.sub(r"^(https?://)(?!www\.)", r"\1www.", c["url"])]):
            st, ct, body, final = h.get(variant)
            if st == 200 and "html" in ct.lower() and body:
                break
        else:
            continue
        soup = BeautifulSoup(body, "lxml")
        if not h.names_school(school, soup, c["via"].startswith("confirmed")):
            continue
        dom = registrable(urllib.parse.urlparse(final).hostname or "")
        if not dom:
            return dict(slug=school["slug"], domain=None, note=f"site {urllib.parse.urlparse(final).hostname} is not .edu.ng or .edu")
        texts = [soup.get_text(" ")] + [a.get("href", "") for a in soup.find_all("a", href=True) if a["href"].startswith("mailto:")]
        for a in soup.find_all("a", href=True):
            if re.search(r"contact", a["href"] + a.get_text(" "), re.I):
                u = urllib.parse.urljoin(final, a["href"])
                if urllib.parse.urlparse(u).hostname and registrable(urllib.parse.urlparse(u).hostname) == dom:
                    st2, ct2, b2, _ = h.get(u)
                    if st2 == 200 and "html" in ct2.lower():
                        texts.append(BeautifulSoup(b2, "lxml").get_text(" "))
                break
        doms = {m.group(1).lower() for t in texts for m in EMAIL.finditer(t)}
        other = {d for d in doms if (d.endswith(".edu.ng") or d.endswith(".edu")) and not (d == dom or d.endswith("." + dom))}
        if other:
            return dict(slug=school["slug"], domain=None, note=f"ambiguous: pages show addresses on {sorted(other)[:3]}")
        same = sorted(d for d in doms if d == dom or d.endswith("." + dom))
        return dict(slug=school["slug"], domain=dom, page=final, seen_addresses_on=same[:3], note="confirmed: official site names the school, domain is .edu.ng/.edu")
    return dict(slug=school["slug"], domain=None, note="no reachable page that names the school")

def main():
    sites = json.load(open(sys.argv[1]))
    schools = [s for s in json.load(open(sys.argv[2])) if s["slug"] in sites and not s.get("email_domains")]
    out = []
    def run(s):
        try:
            r = check(s, sites[s["slug"]]["candidates"])
        except Exception as e:
            r = dict(slug=s["slug"], domain=None, note=f"error {type(e).__name__}")
        out.append(r)
        print(len(out), len(schools), s["slug"], r["domain"], file=sys.stderr, flush=True)
        json.dump(out, open(sys.argv[3], "w"), indent=1)
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(run, schools))
    print(sum(1 for r in out if r["domain"]), "confirmed of", len(out))

main()
