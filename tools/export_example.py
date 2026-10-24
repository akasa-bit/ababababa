"""書き出した表 (tools/export.js) の分析の例 (回 DO6・B-072。docs/export.md の 4)。

現実のデータに使うのと同じ形の計算を、ゲームの表にかける例です。
  1. テイラー則: 政策金利 IRS を、物価の上がり方 INFL と景気のずれ (1 人あたり実質 GDP の伸び − 国の平均) に当てた最小二乗 (sna.csv・rates.csv)
  2. 国家間戦争の多さ: 国 100 年あたりの戦争の始まり (wars_part.csv)。目標 R29 (COW の 2.338) と同じ数え方
  3. 財政と国債: 一般政府の純貸出 ÷ GDP、国債 ÷ GDP の国ごとの中央値 (gfs.csv・balance.csv)
  4. 交易の開き具合: (輸出 + 輸入) ÷ GDP の中央値 (sna.csv)
  5. 政策の出来事の数 (policy.csv)

使い方: python3 tools/export_example.py <書き出したフォルダ>
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def main(folder):
    d = Path(folder)
    sna = pd.read_csv(d / 'sna.csv')
    rates = pd.read_csv(d / 'rates.csv')
    gfs = pd.read_csv(d / 'gfs.csv')
    bal = pd.read_csv(d / 'balance.csv')
    parts = pd.read_csv(d / 'wars_part.csv')
    policy = pd.read_csv(d / 'policy.csv')
    key = ['galaxy', 'country']
    # 小さな国 (人口 100 万人未満) は、伸びの率が大きく振れるので除く
    sna = sna[sna['POP'] >= 1].copy()
    df = sna.merge(rates, on=key + ['year']).merge(gfs, on=key + ['year']).merge(bal, on=key + ['year'])
    df = df.sort_values(key + ['year'])

    # 1. テイラー則 (Taylor 1993 の形): IRS = a + b × INFL + c × ずれ
    df['g'] = df.groupby(key)['B1GQ'].transform(lambda s: np.log(s.where(s > 0)).diff()) - df.groupby(key)['POP'].transform(lambda s: np.log(s).diff())
    df['gap'] = df['g'] - df.groupby(key)['g'].transform('mean')
    t = df.dropna(subset=['IRS', 'INFL', 'gap'])
    X = np.column_stack([np.ones(len(t)), t['INFL'], t['gap']])
    coef, *_ = np.linalg.lstsq(X, t['IRS'].to_numpy(), rcond=None)
    print(f'1. テイラー則 ({len(t)} 国・年): IRS = {coef[0]:.4f} + {coef[1]:.3f} × INFL + {coef[2]:.3f} × ずれ  (Taylor 1993 は 1.5 と 0.5)')

    # 2. 国 100 年あたりの戦争の始まり (国・年の数で割る)
    cy = len(sna)
    onsets = len(parts)
    print(f'2. 国家間戦争: 参加国ごとの始まり {onsets} / 国・年 {cy} = 国 100 年あたり {100 * onsets / max(1, cy):.2f}  (目標 R29 の現実 = 2.338)')

    # 3. 財政と国債 (国ごとの中央値の中央値)
    df['nlb'] = df['GNLB'] / df['B1GQ']
    df['debt'] = (df['S13_F3_L'] + df['S13_F4_L']) / df['B1GQ']
    per = df.groupby(key)[['nlb', 'debt']].median()
    print(f'3. 一般政府の純貸出 ÷ GDP の中央値 {per["nlb"].median():.4f}・国債と借り ÷ GDP の中央値 {per["debt"].median():.4f}')

    # 4. 交易の開き具合
    df['open'] = (df['P6'] + df['P7']) / df['B1GQ']
    print(f'4. (輸出 + 輸入) ÷ GDP の中央値 {df.groupby(key)["open"].median().median():.4f}')

    # 5. 政策の出来事
    print(f'5. 政策の出来事 {len(policy)} 件: ' + '・'.join(f'{k} {v}' for k, v in policy['policy'].value_counts().items()))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'export-out')
