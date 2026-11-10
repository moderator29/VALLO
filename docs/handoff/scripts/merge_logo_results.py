"""Merge the verified logo results into one slug -> {logo_url, logo_source} file.

usage: python3 -I merge_logo_results.py first_out.json out.json finish.log [finish2.log ...]

Takes every address that finish_wikipedia_logos.py fetched with HTTP 200 and an image
content type (read from its log), falls back to the first pass's verified address for a
school whose second-pass fetch did not complete, and drops entries a person judged to be
the wrong institution (DROP below, with the reason).
"""
import json, re, sys, urllib.parse

DROP = {
    "african-university-of-science-and-technology-abuja": "the file is the African Institute of Science and Technology logo, a different body",
}

first = json.load(open(sys.argv[1]))
out = {}
lines = [ln for path in sys.argv[3:] for ln in open(path)]
for line in lines:
    if not line.startswith("{"):
        continue
    r = json.loads(line)
    if not r.get("ok"):
        continue
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/([a-z]+)/(?:thumb/)?\w/\w\w/([^/]+)", r["url"])
    repo, name = m.groups()
    host = "commons.wikimedia.org" if repo == "commons" else "en.wikipedia.org"
    out[r["slug"]] = dict(logo_url=r["url"], logo_source=f"https://{host}/wiki/File:{name}")
for slug, r in first.items():
    if r["logo_url"] and slug not in out:
        out[slug] = dict(logo_url=r["logo_url"], logo_source=r["logo_source"])
for slug in DROP:
    out.pop(slug, None)
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(out), "logos")
