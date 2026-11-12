#!/usr/bin/env bash
# Renders, mixes and packs the November films in both formats.
#   render-all.sh <out-dir> [fps=60] [projects...]
# Needs: the displays (node screens.mjs), the SFX kit ($SFX_DIR), and a music
# bed per film at $MUSIC_DIR/<proj>/music.wav (audio/music.py --timeline
# films/<proj>/timeline.json). The voice is docs/marketing/voiceover/takes/<proj>.mp3.
set -euo pipefail
out=$1; fps=${2:-60}; shift $(( $# >= 2 ? 2 : 1 ))
projects=${*:-"how2 vision2 signup listing referral"}
HERE=$(cd "$(dirname "$0")" && pwd)
MK=$(cd "$HERE/../.." && pwd)
REPO=$(cd "$MK/../.." && pwd)
SCRATCH=/tmp/claude-0/-home-user-read-it-well/e877abda-8aaf-57c8-a7aa-c0953c2acde6/scratchpad
MUSIC_DIR=${MUSIC_DIR:-$SCRATCH/music}
mkdir -p "$out/picture" "$out/final"
for p in $projects; do
  for film in mobile desktop; do
    pic="$out/picture/$p-$film.mp4"
    if [ ! -s "$pic" ]; then
      (cd "$MK" && node video/engine/render.mjs --proj "$p" --film "$film" --ending live --fps "$fps" --scale 1 --out "$pic" 2>&1 | grep -v '^\[page\]' | tail -1)
    fi
  done
  python3 "$HERE/make-signatures.py" "$p" "$out/picture/sfx-$p-mobile.json"
  for film in mobile desktop; do
    bash "$HERE/finish.sh" "$p" "$film" "$out/picture/$p-$film.mp4" "$REPO/docs/marketing/voiceover/takes/$p.mp3" "$MUSIC_DIR/$p/music.wav" "$out/mix" >/dev/null
    ffmpeg -y -loglevel error -i "$out/mix/vallo-$p-$film.mp4" -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a copy -movflags +faststart "$out/final/vallo-$p-$film.mp4"
    echo "$out/final/vallo-$p-$film.mp4"
  done
done
