# Steam のストアの準備

レーン S のセッション S2 で作った (2026-10-20)。ゲームの中 (`src/`)・`tools/` には触らない (`docs/parallel.md` のレーン S の決まり)。包装 (Electron) は `desktop/`。

| 文書 | 中身 |
|---|---|
| [page-ja.md](page-ja.md) | ストアのページの下書き (日本語): 短い説明・長い説明・特徴・タグの案・中身の届け出に関わること・書いていないこと |
| [images.md](images.md) | 要る画像と大きさ・カプセルの決まり・スクリーンショットとトレーラーの案・選んでもらうこと |
| [images.md](images.md) の 5 | カプセルの案 (回 SO1)。撮る台本は `desktop/shots/shoot.mjs` |
| [steamworks.md](steamworks.md) | Steamworks に出すまでの手順と待ち時間 (ユーザーがすること・Claude がすること)、Playtest・Next Fest・値段・Steam Deck の確かめ・Steam Input |

決まり (大きさ・待ち時間・手数料) は、2026-10-20 に Steamworks の公式の文書で確かめた。出す前にもう一度見る。ゲームが変わったら、`page-ja.md` を実際のゲームと突き合わせる (入っていない仕組みは書かない。突き合わせた記録は `page-ja.md` の 8)。訳は用語集 (`docs/glossary/`) にそろえる。
