#!/usr/bin/env bash
# Render every room × fixture combination, encode for the web, and rebuild picker thumbnails.
#   PY=/path/to/bpy-venv/python blender/render_all.sh draft   # ~30 min, 600×400
#   PY=/path/to/bpy-venv/python blender/render_all.sh final   # ~4–5 h, 1200×800
# A combination whose EXRs already exist is skipped, so the script can be re-run to resume.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-python}
QUALITY=${1:-draft}
case "$QUALITY" in
  draft) RES="600 400"; SAMPLES=24 ;;
  final) RES="1200 800"; SAMPLES=64 ;;
  *) echo "usage: $0 draft|final" >&2; exit 1 ;;
esac
ROOMS=${ROOMS:-"living bedroom dining study"}
FIXTURES=${FIXTURES:-"recessed track ceiling cove"}

for room in $ROOMS; do
  for fx in $FIXTURES; do
    out="blender/out/$QUALITY/$room-$fx"
    if [[ -f "$out/${fx}_3000.exr" && -f "$out/base.exr" && -f "$out/${fx}_6000.exr" ]]; then
      echo "skip $room-$fx"
    else
      # shellcheck disable=SC2086
      $PY blender/render.py --room "$room" --fixture "$fx" --layers base,6000,3000 --res $RES --samples $SAMPLES --out "$out" \
        2>&1 | grep --line-buffered -E "WROTE|Error|Traceback" || true
    fi
    $PY blender/encode_layers.py "$out" "public/renders/$room-$fx" 2>&1 | grep -v CUEW || true
    echo "DONE $room-$fx"
  done
done
$PY scripts/make_thumbs.py
echo "ALL DONE ($QUALITY)"
