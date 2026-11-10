"""
Places a film's voiceover on its timeline and writes <film>/timeline.json, the
one clock the picture, the captions and the mix share (the October films).

    python3 scripts/marketing/video/films/plan.py <how|vision> <timings.json>

The music runs at 104 BPM from t = 0. The voice enters on bar 2. Each sentence
keeps its recorded gap to the one before (never shorter). A sentence listed in
the film's OPEN set opens a shot: it moves to the next beat, with at least
`pause` seconds before it. A sentence in BAR lands on the next bar line (the
music's lifts, the drop, the logo hit). Nothing is cut; only pauses are added.
"""
import json
import math
import sys
from pathlib import Path

BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
HERE = Path(__file__).resolve().parent

FILMS = {
    "how": {
        "drop": 2,
        "bar": {2, 4, 15, 22, 27, 33},
        "open": {7, 9, 11, 14, 18, 20, 24, 28, 31, 35},
        "pause": {4: 0.7, 15: 0.6, 22: 0.6, 27: 0.6, 33: 0.8, 35: 0.5},
        "logo": 33,
        "lifts": [4, 15, 22, 27],
    },
    "vision": {
        "drop": 3,
        "bar": {3, 6, 9, 12, 16, 19, 21, 24, 28, 31, 38, 42},
        "open": {4, 7, 11, 14, 17, 20, 23, 25, 26, 27, 29, 30, 32, 33, 34, 35, 36, 37, 39, 41, 44},
        "pause": {3: 0.6, 6: 0.7, 9: 0.5, 12: 0.5, 16: 0.7, 19: 0.5, 21: 0.6, 24: 0.6, 28: 0.7, 31: 0.7, 38: 0.8, 42: 0.9},
        "logo": 42,
        "lifts": [6, 16, 24, 31],
    },
}


def next_beat(t):
    return math.ceil(t / BEAT - 1e-6) * BEAT


def next_bar(t):
    return math.ceil(t / BAR - 1e-6) * BAR


name, src = sys.argv[1], sys.argv[2]
F = FILMS[name]
timings = json.loads(Path(src).read_text())
S = {s["i"]: s for s in timings["sentences"]}

plan, prev_end = [], None
for i in sorted(S):
    s = S[i]
    if prev_end is None:
        start = BAR
    else:
        gap = max(s["start"] - S[i - 1]["end"], F["pause"].get(i, 0.35 if i in F["open"] else 0))
        earliest = prev_end + gap
        if i in F["bar"]:
            start = next_bar(earliest - 0.05)
        elif i in F["open"]:
            start = next_beat(earliest - 0.05)
        else:
            start = earliest
    plan.append({"i": i, "src_start": round(s["start"], 4), "src_end": round(s["end"], 4), "dst_start": round(start, 4)})
    prev_end = start + (s["end"] - s["start"])

shift = {p["i"]: p["dst_start"] - p["src_start"] for p in plan}
sentences = [
    {"i": p["i"], "start": round(p["dst_start"], 4), "end": round(p["dst_start"] + p["src_end"] - p["src_start"], 4), "text": S[p["i"]]["text"]}
    for p in plan
]
words = [
    {"start": round(w["start"] + shift[w["sentence"]], 4), "end": round(w["end"] + shift[w["sentence"]], 4), "word": w["word"], "sentence": w["sentence"]}
    for w in timings["words"]
]
at = {s["i"]: s["start"] for s in sentences}
logo = at[F["logo"]]
voice_end = sentences[-1]["end"]
duration = next_bar(voice_end + 4.2)
music = {
    "bpm": BPM,
    "beat": BEAT,
    "bar": BAR,
    "intro_end": BAR,
    "drop": at[F["drop"]],
    "lifts": [at[i] for i in F["lifts"]],
    "logo_hit": logo,
    "resolve": logo + BAR,
    "badges": next_bar(at[F["logo"] + 2] - 0.1),
    "url": duration - BAR,
    "duration": duration,
}
out = {"fps": 60, "duration": duration, "voice": {"plan": plan, "end": round(voice_end, 4)}, "music": music, "sentences": sentences, "words": words}
(HERE / name).mkdir(exist_ok=True)
(HERE / name / "timeline.json").write_text(json.dumps(out, indent=1) + "\n")
print(f"{name}: {len(sentences)} sentences, voice ends {voice_end:.2f} s, film {duration:.2f} s ({int(duration // 60)}:{duration % 60:05.2f})")
