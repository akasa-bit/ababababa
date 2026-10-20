#!/bin/sh
# 段に分けて深くまで測る (data/build/g4_shield.py の面の線源)。使い方: g4_stages.sh <python> <出力の頭> <段の数> <事象の数> [g4_shield.py の引数 …]
# 2 段目からは、打つ面の手前に UP g/cm² (既定 100) の板を置く。1 段目は一番前の粒子から、2 段目からは前の段が書き出した面の粒子から打つ。済んだ段 (.json がある) は飛ばす
PY=$1; OUT=$2; NS=$3; EV=$4; shift 4
DIR=$(dirname "$0")
[ -f "${OUT}_1.json" ] || "$PY" "$DIR/g4_shield.py" --events "$EV" --out "${OUT}_1" --seed 1 "$@" || exit 1
i=2
while [ $i -le "$NS" ]; do
  [ -f "${OUT}_$i.json" ] || "$PY" "$DIR/g4_shield.py" --events "$EV" --out "${OUT}_$i" --seed $i --source "${OUT}_$((i-1)).npz" --upstream "${UP:-100}" "$@" || exit 1
  i=$((i+1))
done
