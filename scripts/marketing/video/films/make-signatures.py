#!/usr/bin/env python3
"""
Rewrites films/<proj>/signature.json on the installed voice clock.

    python3 films/make-signatures.py <proj> [sfx-<proj>-<film>.json]

Each payoff hangs on a word; with the render's cue list, the window snaps to
the nearest cue of the same sound within 1.5 s of that word, so the lift sits
exactly on the sound the picture registered. The end card rides the music up
from just before the logo hit.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAYOFFS = {
    "how2": [("success", 6, "million", 2, 7, 0.3), ("lock_click", 17, "never", 1, 6, 0.25)],
    "vision2": [("ding_pay", 4, "added", 1, 8, 0.4), ("success", 10, "circle", 1, 6, 0.4), ("stamp", 16, "confirmed", 1, 5, 0.3), ("chime_notify", 18, "workspace", 1, 6, 0.4)],
    "signup": [("stamp", 3, "form", 1, 5, 0.3), ("stamp", 3, "pay", 1, 6, 0.3), ("chime_notify", 4, "email", 1, 8, 0.4)],
    "listing": [("lock_click", 7, "never", 1, 6, 0.25)],
    "referral": [("ding_pay", 3, "eighty", 1, 7, 0.4)],
}

proj = sys.argv[1]
cues = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else []
cues = cues.get("cues", cues) if isinstance(cues, dict) else cues
t = json.load(open(os.path.join(HERE, proj, "timeline.json")))


def word(i, w, n):
    hits = [x for x in t["words"] if x["sentence"] == i and x["word"].lower().strip(".,?!:;") == w]
    return hits[n - 1]["start"] if len(hits) >= n else None


out = []
for name, i, w, n, lift, dur in PAYOFFS[proj]:
    at = word(i, w, n)
    if at is None:
        continue
    near = [c for c in cues if c.get("name") == name and abs(c.get("t", c.get("at", -99)) - at) < 1.5]
    if near:
        at = min(near, key=lambda c: abs(c.get("t", c.get("at")) - at)).get("t", near[0].get("at"))
    out.append({"name": name, "from": round(at - 0.05, 3), "to": round(at - 0.05 + dur, 3), "lift_db": lift})

sig = json.load(open(os.path.join(HERE, proj, "signature.json")))
sig["end_ride"] = {"from": round(t["music"]["logo_hit"] - 0.3, 3), "ramp": 0.6, "db": 6.5}
sig["cues"] = out
json.dump(sig, open(os.path.join(HERE, proj, "signature.json"), "w"), indent=1)
print(proj, "signature:", [(c["name"], c["from"]) for c in out], "ride", sig["end_ride"]["from"])
