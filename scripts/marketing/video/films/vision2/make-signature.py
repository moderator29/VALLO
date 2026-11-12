#!/usr/bin/env python3
"""
Writes films/vision2/signature.json from films/vision2/timeline.json.

The signature cues are the few payoff sounds the mixer lifts over the bed:
the move-in total landing, Circle opening, a badge confirmed, the workspace.
They hang on words, so run this again after the real recording replaces the
provisional clock (films/install-voice.mjs vision2 ... --logo-line 25):

    python3 films/vision2/make-signature.py
"""
import json
import os

here = os.path.dirname(os.path.abspath(__file__))
t = json.load(open(os.path.join(here, "timeline.json")))


def w(i, word, n=1):
    hits = [x for x in t["words"] if x["sentence"] == i and x["word"].lower().strip(".,?!") == word.lower()]
    return hits[n - 1]["start"]


roll_end = w(4, "added") + 1.0
sig = {
    "about": "Video Two's payoffs lifted over the bed: the move-in total landing, Circle opening, a badge confirmed, the workspace. The end card rides the music back up from the logo hit.",
    "dip_db": -3,
    "dip_s": 0.25,
    "end_ride": {"from": round(t["music"]["logo_hit"] - 0.3, 3), "ramp": 0.6, "db": 6.5},
    "cues": [
        {"name": "ding_pay", "from": round(roll_end - 0.05, 3), "to": round(roll_end + 0.35, 3), "lift_db": 8},
        {"name": "success", "from": round(w(10, "circle") - 0.1, 3), "to": round(w(10, "circle") + 0.3, 3), "lift_db": 6},
        {"name": "stamp", "from": round(w(16, "confirmed") - 0.05, 3), "to": round(w(16, "confirmed") + 0.25, 3), "lift_db": 5},
        {"name": "chime_notify", "from": round(w(18, "workspace") - 0.05, 3), "to": round(w(18, "workspace") + 0.35, 3), "lift_db": 6},
    ],
}
json.dump(sig, open(os.path.join(here, "signature.json"), "w"), indent=1)
print("wrote signature.json")
