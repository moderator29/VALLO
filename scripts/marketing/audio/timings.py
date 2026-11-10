#!/usr/bin/env python3
"""Deliverable 1 - word and sentence timings for the Vallo voiceover.

Pipeline (all offline; pocketsphinx 5 ships its own US-English model):

1. Decode the MP3 (ffmpeg, encoder delay removed, t=0 = first real sample).
2. Silence map: exact re-implementation of ffmpeg `silencedetect=noise=-35dB:d=0.35`
   -> speech islands.
3. Free recognition of every island with pocketsphinx's default English LM.
4. Map script words to islands with a dynamic programme that scores each
   candidate chunk by (a) phone-level edit distance to the recogniser's
   hypothesis, (b) duration plausibility at the speaker's measured syllable
   rate and (c) whether the island edge falls on punctuation. Script words the
   voice never reaches (e.g. a cut last line) come out as "unspoken".
5. Island-level forced alignment (pass A) -> sentence split points inside islands.
6. Sentence-by-sentence forced alignment inside those windows (pass B, the
   final timings), two-pass (word search, then state-level Viterbi) so trailing
   silence is not glued to the last word, then word edges are snapped to the
   energy envelope.
7. QA: A-vs-B agreement, optional whole-file alignment cross-check, per-sentence
   speech rate, recogniser-vs-script score gap, very short (elided?) words,
   sentence edges vs the silence map, and an explicit test of the unspoken
   lines against the final islands.

Outputs: <out>/timings.json and <out>/timings.srt

    python timings.py --voice voice.mp3 --script vo_script.txt --out out
"""
from __future__ import annotations

import argparse
import difflib
import math
import re
import statistics
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ffmpeg_decode, rms_envelope_db, silence_map, write_json  # noqa: E402

try:
    from pocketsphinx import Decoder, get_model_path
except ImportError:  # pragma: no cover
    sys.exit("pocketsphinx is required: pip install pocketsphinx==5.0.3")

try:
    from rapidfuzz.distance import Levenshtein as _Lev

    def norm_edit(a: str, b: str) -> float:
        return _Lev.normalized_distance(a, b)
except ImportError:  # slower fallback
    def norm_edit(a: str, b: str) -> float:
        if not a and not b:
            return 0.0
        return 1.0 - difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()

ASR_SR = 16_000
DEBUG = bool(__import__("os").environ.get("VALLO_ALIGN_DEBUG"))
FRAME = 0.01  # pocketsphinx frame rate is 100/s
VOWELS = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}
PHONES = ("AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH "
          "T TH UH UW V W Y Z ZH").split()
PHONE_CHR = {p: chr(0x41 + i) for i, p in enumerate(PHONES)}
PUNCT_END = re.compile(r"[,.;:?!…—-]+[\"'”’)]*$")

# Pronunciations for brand / Nigerian / compound words (ASCII tokens). The CMU
# dictionary already has vallo (V AE L OW), yoruba, hausa, nigeria, iphone.
EXTRA_PRON = {
    "vallo": ["V AE L OW", "V AA L OW", "V AH L OW"],
    "shortlets": ["SH AO R T L AH T S", "SH AO R T L EH T S"],
    "shortlet": ["SH AO R T L AH T", "SH AO R T L EH T"],
    "move-in": ["M UW V IH N"],
    "a_i": ["EY AY"],  # "AI" read as letters
    "yoruba": ["Y AO R UW B AA", "Y AO R UW B AH", "Y AH R UW B AH"],
    "igbo": ["IY B OW", "IH G B OW", "IY G B OW"],
    "hausa": ["HH AW S AH", "HH AW S AA"],
    "naija": ["N AY JH AA"],
    "lagos": ["L EY G AA S", "L AA G OW S"],
    "abuja": ["AH B UW JH AH"],
}


# ------------------------------------------------------------------ lexicon
class Lexicon:
    def __init__(self, dict_path: str):
        self.p: dict[str, list[str]] = {}
        with open(dict_path, encoding="utf-8", errors="replace") as f:
            for line in f:
                parts = line.split()
                if len(parts) < 2:
                    continue
                w = re.sub(r"\(\d+\)$", "", parts[0])
                self.p.setdefault(w, []).append(" ".join(parts[1:]))
        self.added: dict[str, list[str]] = {}
        self.guessed: dict[str, str] = {}

    def prons(self, w: str) -> list[str]:
        return self.p.get(w, [])

    def ensure(self, w: str, prons: list[str]):
        have = self.p.setdefault(w, [])
        for pr in prons:
            if pr not in have:
                have.append(pr)
                self.added.setdefault(w, []).append(pr)

    def guess(self, w: str) -> str:
        """Tiny fallback letter-to-sound so an edited script never crashes."""
        for k in range(len(w) - 2, 1, -1):  # compound of two known words
            a, b = w[:k], w[k:]
            if a in self.p and b in self.p:
                return self.p[a][0] + " " + self.p[b][0]
        if w.endswith("s") and w[:-1] in self.p:
            return self.p[w[:-1]][0] + " Z"
        rules = [("tion", "SH AH N"), ("sh", "SH"), ("ch", "CH"), ("th", "TH"), ("ng", "NG"),
                 ("ph", "F"), ("ck", "K"), ("qu", "K W"), ("ee", "IY"), ("oo", "UW"),
                 ("ou", "AW"), ("ai", "EY"), ("ay", "EY"), ("ea", "IY"), ("oa", "OW"),
                 ("gb", "G B"), ("kp", "K P"),
                 ("a", "AA"), ("b", "B"), ("c", "K"), ("d", "D"), ("e", "EH"), ("f", "F"),
                 ("g", "G"), ("h", "HH"), ("i", "IY"), ("j", "JH"), ("k", "K"), ("l", "L"),
                 ("m", "M"), ("n", "N"), ("o", "OW"), ("p", "P"), ("q", "K"), ("r", "R"),
                 ("s", "S"), ("t", "T"), ("u", "UW"), ("v", "V"), ("w", "W"), ("x", "K S"),
                 ("y", "Y"), ("z", "Z")]
        s, out = w.replace("'", "").replace("-", ""), []
        if s.endswith("e") and len(s) > 3:
            s = s[:-1]
        i = 0
        while i < len(s):
            for g, ph in rules:
                if s.startswith(g, i):
                    out.append(ph)
                    i += len(g)
                    break
            else:
                i += 1
        return " ".join(out) or "AH"


def syllables(pron: str) -> int:
    return max(1, sum(1 for p in pron.split() if p in VOWELS))


def phone_str(pron: str) -> str:
    return "".join(PHONE_CHR.get(p, "") for p in pron.split())


# ------------------------------------------------------------------ script
@dataclass
class Word:
    idx: int
    sentence: int  # 1-based sentence number
    display: str   # exactly as in the script (with punctuation)
    token: str     # ASCII aligner token
    pron: str
    syl: int
    punct_after: bool
    start: float = math.nan
    end: float = math.nan
    island: int = -1


@dataclass
class Sentence:
    i: int
    text: str
    words: list = field(default_factory=list)


def normalize_token(display: str) -> str:
    raw = display.strip()
    core = re.sub(r"^[^\w]+|[^\w]+$", "", raw)
    if core in ("AI", "A.I", "A.I."):
        return "a_i"
    t = unicodedata.normalize("NFKD", core)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = t.replace("’", "'")
    t = re.sub(r"[^a-z0-9'\-]", "", t)
    return t.strip("-'")


def parse_script(text: str, lex: Lexicon) -> list[Sentence]:
    text = text.replace("...", "…").replace("’", "'")
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.?!])\s+(?=[\"'“]?[A-Z0-9])", text)
    sents, widx = [], 0
    for si, p in enumerate([q.strip() for q in parts if q.strip()], start=1):
        s = Sentence(si, p)
        disp = p.split(" ")
        for j, d in enumerate(disp):
            tok = normalize_token(d)
            if not tok:
                if s.words:  # stray punctuation: glue to previous word
                    s.words[-1].display += " " + d
                continue
            if tok not in lex.p:
                g = lex.guess(tok)
                lex.guessed[tok] = g
                lex.ensure(tok, [g])
            pron = lex.prons(tok)[0]
            s.words.append(Word(widx, si, d, tok, pron, syllables(pron),
                                bool(PUNCT_END.search(d)) or j == len(disp) - 1))
            widx += 1
        sents.append(s)
    return sents


# ------------------------------------------------------------------ decoder
class Aligner:
    """pocketsphinx wrapper: free recognition + robust two-pass forced alignment.

    Pass 1 is the FSG word alignment (`set_align_text`); pass 2 is the
    state-level Viterbi (`set_alignment`) which also models the silence after
    the last word.  Pass 2 underflows on windows longer than ~8 s, so long
    windows are cut at the pauses pass 1 found and aligned piecewise.  A
    decoder that failed is rebuilt, because it stays wedged in alignment mode.
    """

    MAX_PASS2 = 6.0  # seconds

    def __init__(self, lex: Lexicon, audio16: np.ndarray):
        self.lex = lex
        self.x = audio16
        self.dec = self._make(beam=1e-80, pbeam=1e-80, wbeam=1e-60)
        self.free = self._make()  # default English LM
        self.resets = 0

    def _make(self, **kw) -> Decoder:
        d = Decoder(loglevel="FATAL", **kw)
        for w, prons in self.lex.added.items():
            have = set()
            base = d.lookup_word(w)
            if base:
                have.add(base)
            k = 2
            for pr in prons:
                if pr in have:
                    continue
                name = w if not base and not have else f"{w}({k})"
                while d.lookup_word(name) is not None:
                    k += 1
                    name = f"{w}({k})"
                d.add_word(name, pr, update=False)
                have.add(pr)
        d.add_word("zzvallodummy", "D AH M IY", update=True)  # flush updates
        return d

    def _reset(self, why: str = ""):
        self.resets += 1
        if DEBUG:
            print(f"    [aligner] reset after: {why}", file=sys.stderr)
        self.dec = self._make(beam=1e-80, pbeam=1e-80, wbeam=1e-60)

    def buf(self, t0: float, t1: float) -> tuple[bytes, float]:
        s = max(0, int(round(t0 * ASR_SR)))
        e = min(len(self.x), int(round(t1 * ASR_SR)))
        return self.x[s:e].tobytes(), s / ASR_SR

    def recognize(self, t0: float, t1: float) -> list[tuple[str, float, float]]:
        b, off = self.buf(t0, t1)
        self.free.start_utt()
        self.free.process_raw(b, full_utt=True)
        self.free.end_utt()
        out = []
        for sg in self.free.seg() or []:
            w = re.sub(r"\(\d+\)$", "", sg.word)
            if w.startswith(("<", "[")):
                continue
            out.append((w, off + sg.start_frame * FRAME, off + (sg.end_frame + 1) * FRAME))
        return out

    def _pass1(self, tokens, b, off):
        d = self.dec
        try:
            d.set_align_text(" ".join(tokens))
            d.start_utt()
            d.process_raw(b, full_utt=True)
            d.end_utt()
            segs = d.seg()
        except (RuntimeError, ValueError) as ex:
            self._reset(f"pass1 {ex} ({len(tokens)} words, {len(b) / 2 / ASR_SR:.2f}s)")
            return None
        if segs is None:
            self._reset(f"pass1 no segmentation ({len(tokens)} words, {len(b) / 2 / ASR_SR:.2f}s)")
            return None
        out = [(re.sub(r"\(\d+\)$", "", s.word), off + s.start_frame * FRAME,
                off + (s.end_frame + 1) * FRAME) for s in segs]
        if [o[0] for o in out if not o[0].startswith(("<", "["))] != list(tokens):
            self._reset("pass1 incomplete path (text does not fit the audio)")
            return None
        return out

    def _pass2(self, tokens, b, off):
        d = self.dec
        try:
            d.set_alignment()
            d.start_utt()
            d.process_raw(b, full_utt=True)
            d.end_utt()
            al = d.get_alignment()
        except (RuntimeError, ValueError) as ex:
            self._reset(f"pass2 {ex} ({len(tokens)} words, {len(b) / 2 / ASR_SR:.2f}s)")
            return None
        if al is None:
            self._reset("pass2 no alignment")
            return None
        words, total, nfr = [], 0, 0
        for w in al.words():
            total += w.score
            nfr += w.duration
            name = re.sub(r"\(\d+\)$", "", w.name)
            if name.startswith(("<", "[")):
                continue
            words.append((name, off + w.start * FRAME, off + (w.start + w.duration) * FRAME))
        if [w[0] for w in words] != list(tokens):
            if DEBUG:
                print(f"    [aligner] pass2 word mismatch: {[w[0] for w in words]}", file=sys.stderr)
            return None
        return {"words": words, "score": total, "frames": nfr}

    def align(self, tokens: list[str], t0: float, t1: float, _depth: int = 0, _retried: bool = False):
        """Forced alignment of `tokens` inside [t0, t1]. Returns dict(words=
        [(tok, start, end)], score_per_frame (None if only pass 1 worked),
        passes) or None when the text cannot be aligned to that audio."""
        if not tokens:
            return None
        b, off = self.buf(t0, t1)
        p1 = self._pass1(tokens, b, off)
        if p1 is None:
            if not _retried and _depth == 0:  # fresh decoder, one more try
                return self.align(tokens, t0, t1, _depth, True)
            return None
        p1_words = [(n, s, e) for n, s, e in p1 if not n.startswith(("<", "["))]
        target = self.MAX_PASS2
        if t1 - t0 <= self.MAX_PASS2:
            p2 = self._pass2(tokens, b, off)
            if p2:
                return {"words": p2["words"], "score_per_frame": p2["score"] / max(p2["frames"], 1),
                        "score": p2["score"], "frames": p2["frames"], "passes": 2}
            if not _retried:  # _pass2 rebuilt the decoder; retry once from scratch
                return self.align(tokens, t0, t1, _depth, True)
            if t1 - t0 < 2.0 or _depth > 3:
                return {"words": p1_words, "score_per_frame": None, "passes": 1}
            target = 0.6 * (t1 - t0)  # still failing: split it in two at a pause
        elif _depth > 3:
            return {"words": p1_words, "score_per_frame": None, "passes": 1}
        return self._split_align(tokens, t0, t1, p1, p1_words, target, _depth)

    def _split_align(self, tokens, t0, t1, p1, p1_words, target, depth):
        """Cut the window at pauses found by pass 1 so each piece is <= target s."""
        cuts, piece_start, last_pause, wi = [], t0, None, 0
        for n, s, e in p1:
            if n == "<sil>" and 0 < wi < len(tokens):
                last_pause = ((s + e) / 2, wi)
            elif not n.startswith(("<", "[")):
                wi += 1
                if e - piece_start > target - 0.2 and last_pause and last_pause[0] > piece_start + 0.4:
                    cuts.append(last_pause)
                    piece_start = last_pause[0]
                    last_pause = None
        if not cuts:  # no usable pause: cut at word boundaries
            n_words = len(p1_words)
            n_pieces = max(2, int(math.ceil((t1 - t0) / max(target - 0.5, 1.0))))
            for q in range(1, n_pieces):
                k = min(max(1, round(q * n_words / n_pieces)), n_words - 1)
                if n_words > 1 and (not cuts or k > cuts[-1][1]):
                    cuts.append(((p1_words[k - 1][2] + p1_words[k][1]) / 2, k))
        if not cuts:
            return {"words": p1_words, "score_per_frame": None, "passes": 1}
        bounds = [(t0, 0)] + cuts + [(t1, len(tokens))]
        words, score, frames, passes = [], 0.0, 0, 2
        for (a, i), (z, j) in zip(bounds[:-1], bounds[1:]):
            r = self.align(tokens[i:j], a, z, depth + 1)
            if r is None:  # piece failed: keep pass-1 times for it
                words += p1_words[i:j]
                passes = 1
                continue
            words += r["words"]
            if r.get("score_per_frame") is None:
                passes = 1
            else:
                score += r["score"]
                frames += r["frames"]
        if passes == 2 and frames:
            return {"words": words, "score_per_frame": score / frames, "score": score,
                    "frames": frames, "passes": 2}
        return {"words": words, "score_per_frame": None, "passes": 1}


# ------------------------------------------------------------------ mapping
def map_words_to_islands(words: list[Word], islands, hyps, rate: float, unspoken_pen=0.08):
    """DP: split the script word sequence into one chunk per island (+ unspoken
    head/tail). Returns list of (i, j) word ranges per island and total cost."""
    W, K = len(words), len(islands)
    ph = [phone_str(w.pron) for w in words]
    syl = np.cumsum([0] + [w.syl for w in words])
    pun = np.cumsum([0] + [1 if w.punct_after else 0 for w in words])
    hyp_ph = ["".join(phone_str(h[1]) for h in hy) for hy in hyps]
    INF = float("inf")
    D = np.full((K + 1, W + 1), INF)
    B = np.zeros((K + 1, W + 1), dtype=int)
    D[0, :] = unspoken_pen * np.arange(W + 1)
    maxlen = 60
    for k in range(1, K + 1):
        a, b = islands[k - 1]
        dur = b - a
        for j in range(W + 1):
            best, arg = D[k - 1, j] + 1.5, j  # empty island (noise/breath)
            for i in range(max(0, j - maxlen), j):
                if D[k - 1, i] == INF:
                    continue
                n_syl = syl[j] - syl[i]
                internal_pauses = pun[j - 1] - pun[i]  # punctuation inside chunk
                exp = n_syl / rate + 0.25 * internal_pauses
                ratio = dur / max(exp, 1e-3)
                if ratio < 0.33 or ratio > 3.0:
                    continue
                text = norm_edit(hyp_ph[k - 1], "".join(ph[i:j]))
                c = text + 0.35 * abs(math.log(ratio)) + (0.0 if words[j - 1].punct_after else 0.6)
                if D[k - 1, i] + c < best:
                    best, arg = D[k - 1, i] + c, i
            D[k, j], B[k, j] = best, arg
    tail = D[K, :] + unspoken_pen * (W - np.arange(W + 1))
    j = int(np.argmin(tail))
    total = float(tail[j])
    chunks = []
    for k in range(K, 0, -1):
        i = int(B[k, j])
        chunks.append((i, j))
        j = i
    chunks.reverse()
    return chunks, total


# ------------------------------------------------------------------ helpers
def snap_edges(words, env_t, env_db, thr=-55.0, min_dur=0.04):
    """Move word starts/ends that sit in silence onto the nearest speech
    energy (RMS envelope above `thr` dBFS) inside the word."""
    for w in words:
        m = (env_t >= w.start) & (env_t <= w.end)
        if not m.any():
            continue
        loud = np.where(env_db[m] > thr)[0]
        if len(loud) == 0:
            continue
        tt = env_t[m]
        s_new = max(w.start, tt[loud[0]] - 0.01)
        e_new = min(w.end, tt[loud[-1]] + 0.01)
        if e_new - s_new >= min_dur:
            w.start, w.end = round(s_new, 3), round(e_new, 3)


def internal_pauses(env_t, env_db, t0, t1, thr=-45.0, min_len=0.10):
    m = (env_t >= t0) & (env_t <= t1)
    tt, q = env_t[m], env_db[m] < thr
    e = np.diff(np.concatenate([[0], q.astype(int), [0]]))
    ss, ee = np.where(e == 1)[0], np.where(e == -1)[0]
    return [(float(tt[s]), float(tt[e - 1])) for s, e in zip(ss, ee) if tt[e - 1] - tt[s] >= min_len]


def srt_time(t: float) -> str:
    ms = int(round(max(t, 0) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def wrap2(text: str, width: int = 42) -> str:
    if len(text) <= width:
        return text
    words = text.split(" ")
    best, cut = None, 1
    for k in range(1, len(words)):
        a, b = " ".join(words[:k]), " ".join(words[k:])
        score = max(len(a), len(b))
        if best is None or score < best:
            best, cut = score, k
    return " ".join(words[:cut]) + "\n" + " ".join(words[cut:])


def write_srt(path: Path, sentences: list[dict], hold: float = 0.4, min_gap: float = 0.04):
    lines = []
    for n, s in enumerate(sentences):
        start = s["start"]
        end = s["end"] + hold
        if n + 1 < len(sentences):
            end = min(end, sentences[n + 1]["start"] - min_gap)
        end = max(end, s["end"])
        lines += [str(n + 1), f"{srt_time(start)} --> {srt_time(end)}", wrap2(s["text"]), ""]
    path.write_text("\n".join(lines), encoding="utf-8")


# ------------------------------------------------------------------ main
def run(voice: str, script_path: str, out_dir: str, full_check: bool = True) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    model = get_model_path()
    lex = Lexicon(str(Path(model) / "en-us" / "cmudict-en-us.dict"))
    for w, prons in EXTRA_PRON.items():
        lex.ensure(w, prons)

    xn, sr_n = ffmpeg_decode(voice)                          # native rate, float
    x16, _ = ffmpeg_decode(voice, sr=ASR_SR, fmt="s16le")    # for the recogniser
    duration = round(len(xn) / sr_n, 3)
    sil, islands = silence_map(xn, sr_n, -35.0, 0.35)
    env_t, env_db = rms_envelope_db(xn, sr_n, 0.02, 0.005)
    print(f"voice: {duration:.3f}s @ {sr_n} Hz, {len(islands)} speech islands")

    sents = parse_script(Path(script_path).read_text(encoding="utf-8"), lex)
    words = [w for s in sents for w in s.words]
    if lex.guessed:
        print("  guessed pronunciations:", lex.guessed)

    al = Aligner(lex, x16)

    # -- 3. free recognition per island
    hyps = []
    for a, b in islands:
        rec = al.recognize(a - 0.12, b + 0.12)
        hyps.append([(w, lex.prons(w)[0] if lex.prons(w) else "", s, e) for w, s, e in rec])
    hyps_simple = [[(h[0], h[1]) for h in hy] for hy in hyps]

    # -- 4. map script -> islands (rate estimated, then refined once)
    speech_total = sum(b - a for a, b in islands)
    rate = sum(w.syl for w in words) / speech_total
    for _ in range(2):
        chunks, cost = map_words_to_islands(words, islands, hyps_simple, rate)
        used = [(i, j, islands[k]) for k, (i, j) in enumerate(chunks) if j > i]
        n_syl = sum(sum(w.syl for w in words[i:j]) for i, j, _ in used)
        rate = n_syl / sum(b - a for _, _, (a, b) in used)
    for k, (i, j) in enumerate(chunks):
        for w in words[i:j]:
            w.island = k
    spoken = [w for w in words if w.island >= 0]
    unspoken = [w for w in words if w.island < 0]
    print(f"  mapped {len(spoken)}/{len(words)} words, rate {rate:.2f} syl/s, DP cost {cost:.2f}")

    def win_edges(k):
        a, b = islands[k]
        left = a - min(0.25, (a - (islands[k - 1][1] if k else 0.0)) / 2) if k else max(0.0, a - 0.25)
        nxt = islands[k + 1][0] if k + 1 < len(islands) else duration
        right = b + min(0.25, (nxt - b) / 2)
        return max(0.0, left), min(duration, right)

    # -- 5. pass A: island-level alignment (gives split points inside islands)
    passA: dict[int, tuple[float, float]] = {}
    island_rows = []
    for k, (i, j) in enumerate(chunks):
        a, b = islands[k]
        l, r = win_edges(k)
        toks = [w.token for w in words[i:j]]
        res = al.align(toks, l, r) if toks else None
        hyp_txt = " ".join(h[0] for h in hyps[k])
        hyp_res = al.align([h[0] for h in hyps[k]], l, r) if hyps[k] else None
        row = {"island": k + 1, "start": round(a, 3), "end": round(b, 3),
               "recognized": hyp_txt, "script": " ".join(w.display for w in words[i:j])}
        if res:
            for w, (_, s, e) in zip(words[i:j], res["words"]):
                passA[w.idx] = (s, e)
            if hyp_res and res["score_per_frame"] is not None and hyp_res["score_per_frame"] is not None:
                row["score_gap_vs_recognizer"] = round(res["score_per_frame"] - hyp_res["score_per_frame"], 2)
        else:
            row["alignment"] = "FAILED"
        exp_ph = "".join(phone_str(w.pron) for w in words[i:j])
        hyp_ph = "".join(phone_str(h[1]) for h in hyps[k])
        row["phone_similarity"] = round(1 - norm_edit(hyp_ph, exp_ph), 3) if exp_ph else 0.0
        row["word_similarity"] = round(difflib.SequenceMatcher(
            None, [h[0] for h in hyps[k]], [w.token for w in words[i:j]]).ratio(), 3)
        n_syl = sum(w.syl for w in words[i:j])
        row["syllables"] = n_syl
        row["syl_per_s_island"] = round(n_syl / (b - a), 2)
        island_rows.append(row)

    # -- 6. pass B: sentence-by-sentence alignment inside windows
    flags: list[str] = []
    info: list[str] = []
    sent_out, word_out = [], []
    passB_dev, passB_out = [], []
    for s in sents:
        sw = [w for w in s.words if w.island >= 0]
        if not sw:
            continue
        first, last = sw[0], sw[-1]
        k0, k1 = first.island, last.island
        prev_in_island = [w for w in words if w.island == k0 and w.idx < first.idx]
        if not prev_in_island:
            l = win_edges(k0)[0]
        else:  # sentence starts inside an island: split in the pause pass A found
            pe = passA.get(prev_in_island[-1].idx, (None, None))[1]
            fs = passA.get(first.idx, (None, None))[0]
            l = (pe + fs) / 2 if pe is not None and fs is not None else islands[k0][0]
        next_in_island = [w for w in words if w.island == k1 and w.idx > last.idx]
        if not next_in_island:
            r = win_edges(k1)[1]
        else:
            le = passA.get(last.idx, (None, None))[1]
            ns = passA.get(next_in_island[0].idx, (None, None))[0]
            r = (le + ns) / 2 if le is not None and ns is not None else islands[k1][1]
        res = al.align([w.token for w in sw], l, r)
        method = "sentence"
        if res is None:
            flags.append(f"S{s.i}: sentence alignment failed; fell back to island alignment")
            method = "island"
            for w in sw:
                w.start, w.end = passA.get(w.idx, (math.nan, math.nan))
        else:
            method += f" ({res['passes']}-pass)"
            for w, (_, st, en) in zip(sw, res["words"]):
                w.start, w.end = st, en
                if w.idx in passA:
                    passB_dev.append(abs(st - passA[w.idx][0]))
                    passB_dev.append(abs(en - passA[w.idx][1]))
                    if max(abs(st - passA[w.idx][0]), abs(en - passA[w.idx][1])) > 0.1:
                        passB_out.append(f"S{s.i} '{w.display}': sentence {st:.2f}-{en:.2f} vs island "
                                         f"{passA[w.idx][0]:.2f}-{passA[w.idx][1]:.2f}")
        snap_edges(sw, env_t, env_db)
        sent_out.append({"i": s.i, "start": round(sw[0].start, 3), "end": round(sw[-1].end, 3),
                         "text": s.text, "method": method, "window": [round(l, 3), round(r, 3)],
                         "islands": sorted({w.island + 1 for w in sw})})
        for w in sw:
            word_out.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": w.display,
                             "sentence": s.i, "token": w.token})

    # -- 6b. A word the island fallback could not place (NaN) is spread over the
    # gap between its placed neighbours, by letter count; the sentence edges follow.
    n_w = len(word_out)
    k = 0
    while k < n_w:
        if math.isfinite(word_out[k]["start"]) and math.isfinite(word_out[k]["end"]):
            k += 1
            continue
        j = k
        while j < n_w and not (math.isfinite(word_out[j]["start"]) and math.isfinite(word_out[j]["end"])):
            j += 1
        lo = word_out[k - 1]["end"] if k > 0 else 0.0
        hi = word_out[j]["start"] if j < n_w else lo + 0.35 * (j - k)
        sizes = [max(1, len(w["word"])) for w in word_out[k:j]]
        tot, acc = sum(sizes), 0
        for w, size in zip(word_out[k:j], sizes):
            w["start"] = round(lo + (hi - lo) * acc / tot, 3)
            acc += size
            w["end"] = round(lo + (hi - lo) * acc / tot - 0.02, 3)
        flags.append(f"words {k}-{j - 1} placed by interpolation")
        k = j
    for so in sent_out:
        ws = [w for w in word_out if w["sentence"] == so["i"]]
        so["start"], so["end"] = ws[0]["start"], ws[-1]["end"]

    # -- 7. QA
    qa: dict = {"decoder_resets": 0}
    # 7a sentence edges vs silence map: nearest island edge / internal pause edge,
    #    and whatever lies between that edge and the aligned edge must be quiet
    starts_ok = [a for a, _ in islands]
    ends_ok = [b for _, b in islands]
    for a, b in islands:
        for p0, p1 in internal_pauses(env_t, env_db, a, b):
            ends_ok.append(p0)
            starts_ok.append(p1)

    def loudest(edge, aligned):
        """Loudest 20 ms RMS strictly between the silence-map edge and the
        aligned edge (30 ms guard so the decaying edge itself is not counted)."""
        lo, hi = (edge + 0.03, aligned) if aligned > edge else (aligned, edge - 0.03)
        m = (env_t >= lo) & (env_t <= hi)
        return float(env_db[m].max()) if m.any() else -120.0

    worst = 0.0
    for s in sent_out:
        e_s = min(starts_ok, key=lambda e: abs(e - s["start"]))
        e_e = min(ends_ok, key=lambda e: abs(e - s["end"]))
        ds, de = s["start"] - e_s, s["end"] - e_e
        s["edge_offsets_ms"] = [round(1000 * ds), round(1000 * de)]
        worst = max(worst, abs(ds), abs(de))
        for label, d, t0, t1 in (("start", ds, e_s, s["start"]), ("end", de, e_e, s["end"])):
            if abs(d) > 0.06:
                lvl = loudest(t0, t1)
                msg = (f"S{s['i']}: sentence {label} is {1000*d:+.0f} ms from the silence-map edge; "
                       f"loudest audio in between {lvl:.0f} dBFS")
                if lvl > -36:
                    flags.append(msg + " (vowel-level energy: check)")
                else:
                    info.append(msg + " (only a decaying tail / weak consonant release: consistent)")
    qa["sentence_edge_vs_silence_map_max_ms"] = round(1000 * worst, 1)

    # 7b per-sentence speech rate (syllables per second of phonation)
    rates = []
    for s in sent_out:
        sw = [w for w in words if w.sentence == s["i"] and w.island >= 0]
        dur = s["end"] - s["start"]
        for p0, p1 in internal_pauses(env_t, env_db, s["start"], s["end"], -45.0, 0.15):
            dur -= (p1 - p0)
        r_ = sum(w.syl for w in sw) / max(dur, 1e-3)
        s["syl_per_s"] = round(r_, 2)
        rates.append(r_)
    med = statistics.median(rates)
    qa["speech_rate_median_syl_per_s"] = round(med, 2)
    qa["speech_rate_range_syl_per_s"] = [round(min(rates), 2), round(max(rates), 2)]
    for s in sent_out:
        if not (0.65 * med <= s["syl_per_s"] <= 1.5 * med):
            flags.append(f"S{s['i']}: speech rate {s['syl_per_s']} syl/s is far from the median {med:.2f}")

    # 7c recogniser agreement per island
    for row in island_rows:
        g = row.get("score_gap_vs_recognizer")
        if row.get("alignment") == "FAILED":
            flags.append(f"island {row['island']}: forced alignment of its script text failed")
        elif g is not None and g < -2.5:
            flags.append(f"island {row['island']}: script text fits {g}/frame worse than the "
                         f"recogniser's own guess '{row['recognized']}' - check the wording")
        elif row["phone_similarity"] < 0.45 and (g is None or g < 0):
            flags.append(f"island {row['island']}: low phone similarity {row['phone_similarity']} "
                         f"between '{row['recognized']}' and '{row['script']}'")

    # 7d very short words: TTS reduced them to a minimum-length schwa/merge
    for w in words:
        if w.island >= 0 and (w.end - w.start) <= 0.035:
            info.append(f"S{w.sentence}: '{w.display}' is only {1000*(w.end-w.start):.0f} ms at {w.start:.2f}s "
                        f"(reduced or merged with its neighbour)")

    # 7e pass A (island) vs pass B (sentence) agreement
    if passB_dev:
        qa["island_vs_sentence_alignment_ms"] = {
            "median": round(1000 * statistics.median(passB_dev), 1),
            "p95": round(1000 * float(np.percentile(passB_dev, 95)), 1),
            "max": round(1000 * max(passB_dev), 1), "raw_edges_over_100ms": passB_out}

    # 7e' word starts vs the free recogniser's own segmentation (independent decoder)
    rec_dev = []
    for k, hy in enumerate(hyps):
        iw = [w for w in words if w.island == k]
        sm = difflib.SequenceMatcher(None, [h[0] for h in hy], [w.token for w in iw], autojunk=False)
        for blk in sm.get_matching_blocks():
            for q in range(blk.size):
                if blk.b + q == 0:
                    continue  # island-initial words: edge snapping makes them differ by design
                rec_dev.append(iw[blk.b + q].start - hy[blk.a + q][2])
    if rec_dev:
        ad = np.abs(rec_dev)
        qa["word_starts_vs_free_recognizer_ms"] = {
            "matched_words": len(rec_dev), "median": round(1000 * float(np.median(ad)), 1),
            "p90": round(1000 * float(np.percentile(ad, 90)), 1), "max": round(1000 * float(ad.max()), 1)}

    # 7f whole-file alignment cross-check (independent of the island map)
    if full_check:
        full = al.align([w.token for w in spoken], 0.0, duration)
        if full:
            dev_s, dev_e, outl = [], [], []
            for w, (_, st, en) in zip(spoken, full["words"]):
                dev_s.append(abs(st - w.start))
                dev_e.append(abs(en - w.end))
                if max(dev_s[-1], dev_e[-1]) > 0.1:
                    outl.append(f"S{w.sentence} '{w.display}': final {w.start:.2f}-{w.end:.2f} vs "
                                f"whole-file {st:.2f}-{en:.2f}")
            dev = dev_s + dev_e
            big = sum(1 for d_ in dev_s if d_ > 0.1)
            qa["whole_file_alignment_vs_final_ms"] = {
                "word_starts_median": round(1000 * statistics.median(dev_s), 1),
                "word_starts_p95": round(1000 * float(np.percentile(dev_s, 95)), 1),
                "all_edges_max": round(1000 * max(dev), 1),
                "word_starts_off_by_more_than_100ms": big, "edges_over_100ms": outl,
                "passes": full["passes"]}
        else:
            qa["whole_file_alignment_vs_final_ms"] = "whole-file alignment failed"

    # 7g unspoken lines: try them explicitly against the tail of the audio
    unspoken_sents = []
    last_end = max(w.end for w in spoken)
    qa["silence_after_last_word_s"] = round(duration - last_end, 3)
    if unspoken:
        by_s: dict[int, list[Word]] = {}
        for w in unspoken:
            by_s.setdefault(w.sentence, []).append(w)
        for si, ws in by_s.items():
            full_s = next(s for s in sents if s.i == si)
            unspoken_sents.append({"i": si, "text": " ".join(w.display for w in ws),
                                   "complete_sentence": len(ws) == len(full_s.words)})

        def sc(tokens, l, r):
            rr = al.align(tokens, l, r)
            if rr is None:
                return "cannot align"
            return round(rr["score_per_frame"], 2) if rr["score_per_frame"] is not None else "aligned (1-pass)"

        un_toks = [w.token for w in unspoken]
        tests = []
        k_last = max(w.island for w in spoken)
        l, r = win_edges(k_last)
        tail_ws = [w for w in spoken if w.island == k_last]
        tests.append({"window": [round(l, 3), round(r, 3)], "hypotheses": {
            " ".join(w.token for w in tail_ws): sc([w.token for w in tail_ws], l, r),
            " ".join(w.token for w in tail_ws + unspoken): sc([w.token for w in tail_ws] + un_toks, l, r),
            " ".join(un_toks): sc(un_toks, l, r)}})
        tail_sents = sorted({w.sentence for w in spoken})[-2:]
        tws = [w for w in spoken if w.sentence in tail_sents]
        l2 = win_edges(tws[0].island)[0]
        hyp2 = {" ".join(w.token for w in tws): [w.token for w in tws],
                " ".join(un_toks): un_toks,
                " ".join([tws[0].token] + un_toks): [tws[0].token] + un_toks,
                " ".join(w.token for w in tws + unspoken): [w.token for w in tws] + un_toks}
        tests.append({"window": [round(l2, 3), round(duration, 3)],
                      "hypotheses": {k_: sc(v, l2, duration) for k_, v in hyp2.items()}})
        qa["unspoken_alignment_tests"] = tests
        spoken_tail_syl = sum(w.syl for w in tws)
        un_syl = sum(w.syl for w in unspoken)
        n_pauses = len(tail_sents) - 1 + sum(1 for w in tws[:-1] if w.punct_after)
        exp_said = spoken_tail_syl / med + 0.4 * n_pauses
        exp_all = (spoken_tail_syl + un_syl) / med + 0.4 * (n_pauses + len(unspoken_sents))
        actual = last_end - tws[0].start
        qa["tail_duration_check_s"] = {"actual_speech_span": round(actual, 2),
                                       "expected_if_as_mapped": round(exp_said, 2),
                                       "expected_if_script_tail_included": round(exp_all, 2)}

    qa["decoder_resets"] = al.resets
    qa["islands"] = island_rows

    # phrases (split at punctuation) - handy for kinetic type
    phrases, cur = [], []
    for n, w in enumerate(word_out):
        cur.append(w)
        nxt = word_out[n + 1] if n + 1 < len(word_out) else None
        if PUNCT_END.search(w["word"]) or nxt is None or nxt["sentence"] != w["sentence"]:
            phrases.append({"start": cur[0]["start"], "end": cur[-1]["end"], "sentence": w["sentence"],
                            "text": " ".join(c["word"] for c in cur)})
            cur = []

    notes = [
        f"Times are seconds on the voice file's own timeline (t=0 = first decoded sample; the MP3 decodes "
        f"to {duration:.3f}s - ffprobe's 87.64s container duration includes the 25 ms encoder delay).",
        "sentences[].i is 1-based; words[].sentence refers to sentences[].i; joining a sentence's "
        "words[].word with spaces reproduces its text exactly (punctuation stays on the words).",
        "Method: pocketsphinx 5.0.3 forced alignment sentence by sentence inside the ffmpeg-silencedetect "
        "speech islands (-35 dB, 0.35 s); word edges snapped to the RMS envelope (-55 dBFS).",
        f"Median speech rate {med:.2f} syllables/s.",
    ]
    if unspoken_sents:
        notes.append("NOT SPOKEN in the audio: '" + " | ".join(u["text"] for u in unspoken_sents)
                     + f"'. The voice ends with '{sent_out[-1]['text']}' at {sent_out[-1]['end']:.2f}s, "
                     f"followed by {qa['silence_after_last_word_s']:.2f}s of silence to the end of the file.")
    if flags:
        notes.append("FLAGS: " + " / ".join(flags))
    if info:
        notes.append("Info: " + " / ".join(info))
    result = {"duration": duration,
              "sentences": [{k: s[k] for k in ("i", "start", "end", "text")} for s in sent_out],
              "words": [{k: w[k] for k in ("start", "end", "word", "sentence")} for w in word_out],
              "notes": " ".join(notes),
              "unspoken": unspoken_sents,
              "phrases": phrases,
              "silence_map": {"noise_db": -35, "min_silence_s": 0.35,
                              "silences": [[round(a, 3), round(b, 3)] for a, b in sil],
                              "islands": [[round(a, 3), round(b, 3)] for a, b in islands]},
              "qa": {**qa, "flags": flags, "info": info,
                     "sentences": [{k: s[k] for k in ("i", "start", "end", "syl_per_s", "edge_offsets_ms",
                                                     "islands", "window", "method")} for s in sent_out],
                     "pronunciations_added": lex.added, "pronunciations_guessed": lex.guessed}}
    write_json(out / "timings.json", result)
    write_srt(out / "timings.srt", result["sentences"])
    return result


def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voice", required=True, help="voiceover audio (mp3/wav)")
    ap.add_argument("--script", default=str(here / "vo_script.txt"), help="script text the VO was read from")
    ap.add_argument("--out", default="out", help="output directory")
    ap.add_argument("--no-full-check", action="store_true", help="skip the whole-file alignment cross-check")
    a = ap.parse_args()
    r = run(a.voice, a.script, a.out, full_check=not a.no_full_check)
    print(f"\n{'#':>3} {'start':>7} {'end':>7}  text")
    for s in r["sentences"]:
        print(f"{s['i']:>3} {s['start']:7.2f} {s['end']:7.2f}  {s['text']}")
    if r["unspoken"]:
        print("\nUNSPOKEN:", " | ".join(u["text"] for u in r["unspoken"]))
    print("\nQA:", {k: v for k, v in r["qa"].items() if k not in ("islands", "sentences", "flags",
                                                                 "pronunciations_added", "pronunciations_guessed")})
    for f in r["qa"]["flags"]:
        print("  FLAG:", f)
    print(f"\nwrote {Path(a.out) / 'timings.json'} and {Path(a.out) / 'timings.srt'}")


if __name__ == "__main__":
    main()
