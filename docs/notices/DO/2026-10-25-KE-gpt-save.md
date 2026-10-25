# 経済 (回 KE6) から: セーブに汎用技術 (GPT) の表を足した

ユーザーの依頼 (2026-10-25、`docs/requests/2026-10-25-KE.md` の KE-2「おすすめ四つでお願い」)。汎用技術 (GPT) を入れた (`docs/innovation.md` の 4)。

core の世話役 (道具と検証のレーン) に関係すること:

1. **`core/save.js`**: `['gpts', (game) => (game.gpts?.length ? game.gpts : undefined)]` を 1 行足した (銀河の GPT の表 [{ t: 現れた年, inv: 発明した国の首都 }])。
2. **`core/restore.js`**: `if (Array.isArray(d.gpts)) this.gpts = d.gpts;` を 1 行足した。前の版のセーブには表がなく、`gptStep` が空の表から始める。
3. 保存 → 読み込み → 40 年で、続けて進めた試合と状態の要約が同じになることを、GPT が 5 つ現れた試合 (シード 2) で確かめた (戦果の知らせの直し #261 と合わせて)。

片付けたら、このファイルを消してください。
