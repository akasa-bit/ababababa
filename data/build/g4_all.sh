#!/bin/sh
# 遮蔽の Geant4 の計算を全部回す (docs/physics.md の 3)。4 コアで 2〜3 時間。結果は <作業場所>/*.json → data/derived/g4/ へ写す
# 使い方: data/build/g4_all.sh <Geant4 の入った python> <作業場所>
#   python は pip install geant4_pybind numpy (Geant4 11.4。初めて import したときに、約 2 GB のデータを落とす)
set -e
PY=$1; W=$2; D=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$W"; cd "$W"
python3 "$D/make_gcr_source.py" 0.95 gcr95.npz
python3 "$D/make_gcr_source.py" 0.9 gcr90.npz
python3 "$D/make_gcr_source.py" 0.0 gcr00.npz
# 横の宇宙線: 1 段目は線源の .npz から、2 段目からはふつうに継ぐ
gcr() { [ -f "$1_1.json" ] || "$PY" "$D/g4_shield.py" --events 4000 --source "$2" --out "$1_1" --seed 1; "$D/g4_stages.sh" "$PY" "$1" 3 4000; }
# 星間の気体 (前面) と、宇宙線 (横) を 4 本ずつ並べる
"$D/g4_stages.sh" "$PY" p95 12 50000 --ke 2066.6 > p95.log 2>&1 &
"$D/g4_stages.sh" "$PY" p90 12 50000 --ke 1214.2 > p90.log 2>&1 &
gcr g95 gcr95.npz > g95.log 2>&1 &
gcr g90 gcr90.npz > g90.log 2>&1 &
wait
# 確かめ: 物理の模型の違い (QBBC)・ヘリウムの重ね合わせ・先頭の陽子 (PSTAR と PDG)・止まった船の宇宙線 (MSL の実測)
"$D/g4_stages.sh" "$PY" p95q 12 50000 --ke 2066.6 --physlist QBBC > p95q.log 2>&1 &
"$D/g4_stages.sh" "$PY" a95 12 20000 --ke 8210.0 --particle alpha > a95.log 2>&1 &
[ -f v95.json ] || "$PY" "$D/g4_shield.py" --events 5000 --thick 700 --out v95 > v95.log 2>&1 &
[ -f g00.json ] || "$PY" "$D/g4_shield.py" --events 3000 --source gcr00.npz --thick 60 --probe 5 --out g00 > g00.log 2>&1 &
wait
# 惑星の地表と居住区 (止まった所): 銀河宇宙線 (gcr00) とフレアの高エネルギー陽子 (sep、ε = 2.13) を、大気と覆いの奥 2,700 g/cm² まで
python3 "$D/make_gcr_source.py" sep 2.13 sep.npz
[ -f s00_1.json ] || "$PY" "$D/g4_shield.py" --events 20000 --source sep.npz --out s00_1 --seed 1 > s00.log 2>&1
"$D/g4_stages.sh" "$PY" s00 9 20000 >> s00.log 2>&1 &
[ -f c00_1.json ] || "$PY" "$D/g4_shield.py" --events 4000 --source gcr00.npz --out c00_1 --seed 1 > c00.log 2>&1
"$D/g4_stages.sh" "$PY" c00 9 4000 >> c00.log 2>&1 &
wait
