# 戦争と財政の生データ

戦争疲弊が税収・年金・医療に効くかを調べるための生データです (`docs/research/war-fiscal.md`)。取得は `python3 data/fetch/fetch_warfiscal.py` (手で書き換えない。取得日・URL・SHA-256・大きさ・行数は `MANIFEST.json`)。加工は `python3 data/build/analyze_warfiscal.py` → `data/derived/warfiscal.json`。

大きい元のファイルは、使う列と行だけを取り出して gzip にした (gzip は mtime=0 で作るので、同じ入力からは同じバイト列になる)。取り出し方は `MANIFEST.json` の `note`・`columns`・`filter` に書いた。

## 取得したもの

| ファイル | 中身 | 出典 |
|---|---|---|
| `ucdp_prio_acd_261.csv.gz` | UCDP/PRIO Armed Conflict Dataset 26.1。1946〜2025 年の紛争・年 (2,816 行)。種類 (1 = 植民地など国家の外、2 = 国家間、3 = 国内、4 = 外国の兵が加わった国内)・強さ (1 = 戦闘の死者 25〜999 人、2 = 1,000 人以上)・当事国 (Gleditsch-Ward の番号。2nd は兵を出した支援国) | Davies, Pettersson & Öberg (2025), Journal of Peace Research; Gleditsch ほか (2002)。https://ucdp.uu.se/downloads/ (CC BY 4.0) |
| `ucdp_brd_conf_261.csv.gz` | UCDP Battle-Related Deaths 26.1 (紛争・年の戦闘の死者、1989〜2025 年。bd_best・bd_low・bd_high) | 同上 |
| `cow_intrastate_v41.csv.gz` | Correlates of War の国内戦争 4.1 (1816〜2014 年。種類・政府の側の国の番号・期間・双方の死者・介入した国) | Dixon & Sarkees (2016) A Guide to Intra-state Wars, CQ Press。https://correlatesofwar.org/ (出典を示せば使える) |
| `cow_nmc60.csv.gz` | Correlates of War の National Material Capabilities 6.0 (1816〜2016 年) から 6 列: 国・年・軍事費 milex (1913 年まで千英ポンド、1914 年から千米ドル)・兵員 milper (千人)・人口 tpop (千人) | Singer, Bremer & Stuckey (1972); Greig & Enterline (2021) NMC v6.0 |
| `imf_fpp.csv.gz` | IMF Public Finances in Modern History (FPP)。151 か国、1800〜2024 年。歳入 rev・歳出 exp・利払いを除く歳出 prim_exp・利払い ie・債務 d、すべて GDP 比 (%)。DataMapper の API から | Mauro, Romeu, Binder & Zaman (2015) "A modern history of fiscal prudence and profligacy", Journal of Monetary Economics 76。IMF の利用条件 (出典を示す) |
| `imf_world.csv.gz` | IMF World Revenue Longitudinal Data (WoRLD)。195 か国、1980〜2024 年。歳入 (G1)・税収 (G11)・贈与 (G13) の GDP 比。政府の範囲 sector (S13 = 一般政府、S1311MIXED = 中央政府) は国ごとに 1 つ | IMF Fiscal Affairs Department (2026)。SDMX の API (IMF.FAD,WORLD,3.0.1) |
| `imf_cofog.csv.gz` | IMF Government Finance Statistics の機能別の支出 (COFOG)。保健 (GF07)・社会保護 (GF10)・老齢 (GF1020。年金がほとんど)・防衛 (GF02)・支出の合計の GDP 比。一般政府 (S13)・中央政府 (S1311)・予算の中央政府 (S1311B)。1972 年〜 (多くの国は 1990 年代から) | IMF Statistics Department (2026)。SDMX の API (IMF.STA,GFS_COFOG,11.0.0) |
| `wdi_warfiscal.csv.gz` | 世界銀行 WDI (国だけ、1960〜2025 年): 政府の保健支出 ÷ GDP (SH.XPD.GHED.GD.ZS。WHO GHED、2000 年〜)・軍事費 ÷ GDP (MS.MIL.XPND.GD.ZS。SIPRI)・税収と歳入 (中央政府)・1 人あたり実質 GDP (2015 年の米ドル)・人口・消費者物価と GDP デフレーターの上昇率 | World Bank (CC BY 4.0) |
| `mpd2023.csv.gz` | Maddison Project Database 2023 から 1800 年以降の 1 人あたり実質 GDP (2011 年の購買力平価のドル) と人口 (千人) | Bolt & van Zanden (2024) "Maddison style estimates of the evolution of the world economy: A new 2023 update", Journal of Economic Surveys。doi:10.34894/INZBF2 (CC BY 4.0) |
| `owid_social-spending-oecd-longrun.csv` | 公的な社会支出 ÷ GDP の長期の系列 (1880〜1930 年は 10 年おき、1960 年から毎年) | Our World in Data。OECD SOCX・OECD (1985)・Lindert (2004) Growing Public をつないだもの (CC BY 4.0) |
| `owid_public-health-expenditure-share-gdp-owid.csv` | 公的な保健支出 ÷ GDP の長期の系列 (同じく 1960 年より前は 10 年おき) | Our World in Data (Lindert 2004・OECD・WHO をつないだもの。CC BY 4.0) |
| `countrycode_cow.csv`・`countrycode_gw.csv` | COW と Gleditsch-Ward の国の番号と国名 (国・年の行を、番号と名前の組ごとの最初と最後の年にまとめた)。国の番号と ISO3 の対応表は `analyze_warfiscal.py` に書いてあり、これはその照合の確認用 | Arel-Bundock, Enevoldsen & Yetman (2018) countrycode, JOSS 3(28) (GPL-3) |

## すでにあるものを使う (取り直さない)

| ファイル | 中身 |
|---|---|
| `data/raw/fiscal/JSTdatasetR6.xlsx` | Jordà–Schularick–Taylor Macrohistory Database R6 (18 か国 1870〜2020 年。中央政府の歳入・歳出・名目 GDP・実質 GDP・人口・物価・為替) |
| `data/raw/history/cow_interstate_v4.csv` | Correlates of War の国家間戦争 4.0 (参加国ごとの期間・戦闘の死者・結果) |
| `data/raw/history/cow_states2016.csv` | Correlates of War の国家の一覧 2016 |

## 取れなかったもの

- **UNU-WIDER Government Revenue Dataset (GRD)**: wider.unu.edu が 403 を返した (この環境から)。代わりに IMF WoRLD を使った (GRD と同じく 1980 年からの歳入・税収)。
- **OECD SOCX の年金 (老齢の現金給付)**: OECD の SDMX の窓口には届くが、COFOG の老齢 (GF1020) で同じ国の多くを覆えるので取っていない。
- **戦時中の年の、年金と保健の支出**: 1960 年より前の社会支出・保健支出は 10 年おきにしかない (Lindert)。第一次・第二次世界大戦の戦時中の年金と医療の動きは、JST の歳出から COW の軍事費を引いた「軍事費を除く歳出」(利払い・恩給を含む) でしか見られない。
