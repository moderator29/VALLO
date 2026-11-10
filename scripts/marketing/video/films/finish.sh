#!/usr/bin/env bash
# Finishes one October film: the voice, the music bed and the film's sound
# cues mixed by audio/mix.py (-14 LUFS, -1 dBTP), then muxed with the picture.
#   finish.sh <how|vision> <mobile|desktop> <picture.mp4> <voice.mp3> <music.wav> <out-dir>
# The picture's sound cues are read from sfx-<proj>-<film>.json next to it.
set -euo pipefail
proj=$1 film=$2 picture=$3 voice=$4 music=$5 out=$6
HERE=$(cd "$(dirname "$0")" && pwd)
AUDIO=$(cd "$HERE/../../audio" && pwd)
SFX_DIR=${SFX_DIR:-/tmp/claude-0/-home-user-read-it-well/e877abda-8aaf-57c8-a7aa-c0953c2acde6/scratchpad/audio/out/sfx}
mkdir -p "$out"
mixdir="$out/$proj-$film-audio"
python3 "$AUDIO/mix.py" mix \
  --voice "$voice" \
  --timeline "$HERE/$proj/timeline.json" \
  --music "$music" \
  --sfx-events "$(dirname "$picture")/sfx-$proj-$film.json" \
  --sfx-dir "$SFX_DIR" \
  --signature "$HERE/$proj/signature.json" \
  --out "$mixdir" | tail -6
name="vallo-$proj-$film"
ffmpeg -y -loglevel error -i "$picture" -i "$mixdir/final_mix.m4a" -map 0:v -map 1:a -c:v copy -c:a copy -shortest -movflags +faststart "$out/$name.mp4"
echo "$out/$name.mp4"
