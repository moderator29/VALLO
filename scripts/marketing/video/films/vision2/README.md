# Video Two, "Vision and what's coming" (rebuilt 11 November 2026)

`--proj vision2`, vertical 1080x1920, one cut, about 88 s. The older
`films/vision` (3:37, both formats) is untouched.

| File | What it is |
|---|---|
| `main.js` | the whole film: one phone, the lifts, the containers, the cuts, the end card |
| `parts.js` | the opening frame's words, the rolling move-in total, the discs that fly into the end card |
| `chapters.js` | the chapter pill |
| `timeline.json` | the clock. **Provisional** until a recording is installed: laid out from the script by `films/provisional.mjs` |
| `signature.json`, `make-signature.py` | the payoff sounds lifted over the music; regenerate after the clock changes |

The script is `docs/marketing/voiceover/scripts/video-2-vision.txt` and the
recording brief is `docs/marketing/voiceover/VIDEO-2-ELEVENLABS.md`.

## Rebuild on the provisional clock

```
cd scripts/marketing/video
node films/provisional.mjs vision2 ../../../docs/marketing/voiceover/scripts/video-2-vision.txt --logo-line 22
python3 films/vision2/make-signature.py
```

`--logo-line 22` puts the end card's mark (and the music's logo hit) on
"Live now on the App Store and Google Play", not on the last line, because
the download call is the film's point. `films/install-voice.mjs` takes the
same flag for the real recording.

## Screens

The displays are built from `docs/marketing/source/` by
`node scripts/marketing/screens.mjs --only <ids>` (they are not committed).
This film uses: `v3-welcome v3-listing v3-listing-cost v3-listing-total v3-home
v3-stays v3-restaurant v3-circle v3-circle-explore v3-roommates v3-schools
v3-safety v3-roommates-2 v3-passport host-start assistant-caution-2`.

## Render, check, mix

```
node engine/render.mjs --proj vision2 --film mobile --fps 60 --scale 1 --ending live --out <dir>/vision2-mobile.mp4
node engine/render.mjs --proj vision2 --film mobile --check 8 --scale 0.5 --ending live --out <dir>/x.mp4
node films/layout-check.mjs vision2 mobile 0.5 > <dir>/faults.json
```

Sound: `audio/sfx.py` for the kit, `audio/music.py --timeline films/vision2/timeline.json`
for the bed. Until a voice exists, `films/vision2/mix-provisional.py` makes the
same master without it (the bed, the signature payoffs, every effect cue the
film registered, the end card riding up); `audio/mix.py` itself cannot run on
a silent file. When the recording is installed, use `films/finish.sh vision2
mobile <picture> <voice> <music.wav> <out>` instead.

Delivered picture: 60 fps, 1080x1920, x264 CRF 14 from the renderer, then one
CRF 18 pass (about 58 MB for 88 s) with the sound muxed in.
