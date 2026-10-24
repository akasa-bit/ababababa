# 放っておかれても忠誠度は下がらない (星系の欄の札に 1 行)

回 SE5 (政治) から。ユーザーの決定で `NEGLECT_MAX` を 0 にした (放っておかれても忠誠度は下がらない)。

- `src/screen/panels-system.js` の 98 行あたりの札「放っておかれて N 年」を、`NEGLECT_MAX` が 0 なら出さないようにした (`if (NEGLECT_MAX && neglect > NEGLECT_GRACE)`。`docs/parallel.md` の 2 の 1 行)。
- 時代の課題や手引きに「視察団を送って関与を保つ」のような文があれば、合わなくなるので直してほしい (こちらで探した範囲では見つからなかった)。
