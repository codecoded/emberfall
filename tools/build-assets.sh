#!/bin/sh
# Rebuilds every GLB in public/assets from the Blender scripts.
B="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
D="$(cd "$(dirname "$0")" && pwd)"
O="$D/../public/assets"
mkdir -p "$O"
for s in hero skeleton sorcerer merchant; do
  "$B" -b -P "$D/blender/humanoid.py" -- $s "$O/$s.glb" 2>&1 | grep -E "Error|Traceback|line [0-9]|EXPORTED|failed"
done
"$B" -b -P "$D/blender/creatures.py" -- "$O/creatures.glb" 2>&1 | grep -E "Error|Traceback|line [0-9]|EXPORTED|failed"
"$B" -b -P "$D/blender/props.py" -- "$O/props.glb" 2>&1 | grep -E "Error|Traceback|line [0-9]|EXPORTED|failed"
