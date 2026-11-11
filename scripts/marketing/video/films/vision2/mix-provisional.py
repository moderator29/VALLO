#!/usr/bin/env python3
"""
THE SOUND OF A FILM THAT HAS NO VOICE YET.

audio/mix.py is built around a recording: it levels the voice, ducks the bed
under it and caps every effect against it, so it cannot run on a silent
file. Until the recording lands (see docs/marketing/voiceover/VIDEO-2-ELEVENLABS.md)
this makes the same master without it: the music bed, the signature payoffs
lifted over it with the dip they make, the effect cues the film registered on
its real on-screen actions and transitions, the end card riding the bed back
up, all through mix.py's own master (-14 LUFS, true peak ceiling) and AAC
encode. Nothing is ducked, because there is nothing to duck for.

    python3 films/vision2/mix-provisional.py --timeline films/vision2/timeline.json \
        --music <music.wav> --sfx-events <picture dir>/sfx-vision2-mobile.json \
        --sfx-dir <sfx kit dir> --signature films/vision2/signature.json --out <dir>

Writes <dir>/final_mix.wav, final_mix.m4a and final_mix_report.json. When the
voice exists, use films/finish.sh instead (the same inputs plus the voice).
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

AUDIO = Path(__file__).resolve().parents[3] / "audio"
sys.path.insert(0, str(AUDIO))
import mix as M  # noqa: E402
from common import SR, read_audio  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--timeline", required=True)
ap.add_argument("--music", required=True)
ap.add_argument("--sfx-events", required=True)
ap.add_argument("--sfx-dir", required=True)
ap.add_argument("--signature", required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args()

out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
timeline = json.loads(Path(a.timeline).read_text())
events = json.loads(Path(a.sfx_events).read_text())
signature = json.loads(Path(a.signature).read_text())
N = int(round(timeline["duration"] * SR))

music = M.as2d(read_audio(a.music, SR, channels=2))
music = music[:N] if len(music) >= N else np.pad(music, ((0, N - len(music)), (0, 0)))

sfx_bus, kit_bus, placed, capped = M.build_sfx_bus(events, Path(a.sfx_dir), timeline, N, M.VOICE_LUFS, signature.get("cues", []))

# the bed makes room for each payoff, then rides back up over the end card
g = np.zeros(N)
dip, half = float(signature.get("dip_db", -3.0)), float(signature.get("dip_s", 0.25)) / 2
for row in placed:
    if row.get("signature"):
        c = row["peak_at_s"]
        lo, hi = max(0, int((c - half - 0.06) * SR)), min(N, int((c + half + 0.06) * SR))
        if hi > lo:
            x = np.linspace(-1, 1, hi - lo)
            g[lo:hi] = np.minimum(g[lo:hi], dip * np.clip((1 - np.abs(x)) * 3, 0, 1))
ride = signature.get("end_ride")
if ride:
    lo = int(ride["from"] * SR)
    r = max(1, int(ride.get("ramp", 0.6) * SR))
    if lo < N:
        up = np.full(N - lo, float(ride["db"]))
        up[:min(r, N - lo)] = np.linspace(0, float(ride["db"]), r)[:min(r, N - lo)]
        g[lo:] += up
music_d = music * M.undb_arr(g)[:, None]

final, meter = M.master(music_d + sfx_bus)
M.write_wav(out / "final_mix.wav", final, SR, 24)
report = M.loudness_report(final, out / "final_mix.wav", out / "final_mix.m4a", {
    "contents": "music bed + effects + signature payoffs, no voice (provisional)", **meter,
    "sfx_events": len(placed), "sfx_capped_count": len(capped),
})
(out / "final_mix_report.json").write_text(json.dumps(report, indent=1, default=str))
m4 = report.get("m4a", {})
print(f"final_mix  I {report['integrated_lufs']:.2f} LUFS  TP {report['true_peak_dbtp']:.2f} dBTP  dur {report['duration_s']:.3f}s  "
      f"clicks {report['clicks']['clicks']}  | m4a I {m4.get('I')} TP {m4.get('TP')}  | {len(placed)} effects")
