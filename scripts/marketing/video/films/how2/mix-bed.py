#!/usr/bin/env python3
"""
MIXES VIDEO ONE WITHOUT A VOICE (until the recording exists).

    python3 films/how2/mix-bed.py <music.wav> <sfx-events.json> <sfx-dir> <out-dir>

audio/mix.py is built around a voice: it normalises it, ducks the music
under it and caps every sound effect against it. With no recording yet this
runs the same mixer with the voice held at silence (so the effects keep the
levels the kit calibrated them to, the signature cues still lift over the
bed, the end card still rides the music back up, and nothing is ducked).
`final_mix.m4a` in the out directory is what gets muxed under the picture.

When the real voice is installed, do NOT use this: use films/finish.sh,
which feeds the mixer the recording.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO = HERE.parents[2] / "audio"
sys.path.insert(0, str(AUDIO))

import numpy as np  # noqa: E402
import mix as M  # noqa: E402
from common import SR, write_wav  # noqa: E402

music_wav, events, sfx_dir, out = sys.argv[1:5]
out_dir = Path(out)
out_dir.mkdir(parents=True, exist_ok=True)

# the voice stays at silence: no gain, no ducking, nothing for the cap to measure against
M.voice_chain = lambda v, target_lufs=-16.0: (np.zeros_like(v), {"plr_in_db": 0, "plr_out_db": 0, "note": "no voice yet"})
real_lufs = M.integrated_lufs
M.integrated_lufs = lambda y, sr=SR, *a, **k: (-70.0 if not np.any(y) else real_lufs(y, sr, *a, **k))

silent = out_dir / "silence.wav"
write_wav(silent, np.zeros(SR), SR, 16)
plan = out_dir / "plan.json"
plan.write_text(json.dumps([{"i": 0, "src_start": 0.0, "src_end": 0.5, "dst_start": 0.0}]))

sys.argv = ["mix.py", "mix", "--voice", str(silent), "--plan", str(plan), "--music", music_wav,
            "--sfx-events", events, "--sfx-dir", sfx_dir,
            "--timeline", str(HERE / "timeline.json"), "--signature", str(HERE / "signature.json"), "--out", str(out_dir)]
# the timeline's own (empty) voice plan is replaced by the silent one above
tl = json.loads((HERE / "timeline.json").read_text())
tl["voice"] = {"plan": json.loads(plan.read_text()), "end": tl["voice"]["end"]}
tmp = out_dir / "timeline.silent.json"
tmp.write_text(json.dumps(tl))
sys.argv[sys.argv.index("--timeline") + 1] = str(tmp)
M.main()
