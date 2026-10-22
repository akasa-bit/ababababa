// Steam Input の既定の設定 (B-085。desktop/controller.md の 2 の案 A) を、下の表から VDF に書き出す。
// ゲームはコントローラーに対応していない (キーボードとマウスだけ) ので、Steam Input がボタンをキーとマウスに置き換える。
// 形は Valve の例 (ExampleLocalizedConfiguration.vdf。desktop/steam-input/README.md の 1) と同じ controller_mappings。
// 使い方: node desktop/steam-input/make.mjs          → controller_neptune.vdf と action_manifest.vdf を書き直す
//         node desktop/steam-input/make.mjs --check  → 書き直さずに、ファイルが表と同じか・ゲームが受けるキーだけかを見る (CI の desktop)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'controller_neptune.vdf');
const MANIFEST = join(here, 'action_manifest.vdf');

// ゲームが受けるキー (src/screen/hotseat.js の keydown・src/screen/galaxy-view.js の Shift とホイール)。Steam のキーの名前 → ゲームでの働き
export const GAME_KEYS = {
  SPACE: '止める・動かす', ESCAPE: '選択を外す・星間マップへ', Z: '地図を左に回す', X: '地図を右に回す', R: '地図を傾ける', F: '地図を起こす',
  G: '星間マップ', S: '星系マップ', E: '帝国', LEFT_SHIFT: '押したままドラッグで艦隊を範囲で選ぶ', DELETE: '艦隊の指名を取り消す',
};
const MOUSE = { 'mouse_button LEFT': '選ぶ・押したまま動かすと地図を動かす', 'mouse_button RIGHT': '艦隊を動かす (経由地は右ドラッグ)', 'mouse_wheel SCROLL_UP': '拡大', 'mouse_wheel SCROLL_DOWN': '縮小' };

// [グループの id, 置き場所 (source), モード, { 入力: バインド }, 有効か]
// source と入力・モードの名前は Steam Deck (controller_neptune) のもので、Valve の例のファイルに出てくるものだけを使う。キーは 'key_press <名前>'、マウスは MOUSE の文字列
const k = (name) => `key_press ${name}`;
export const GROUPS = [
  [0, 'button_diamond', 'four_buttons', { button_a: k('SPACE'), button_b: k('ESCAPE'), button_x: k('S'), button_y: k('G') }, true],
  [1, 'dpad', 'dpad', { dpad_north: k('R'), dpad_south: k('F'), dpad_west: k('Z'), dpad_east: k('X') }, true],
  // 左スティック: 上下で拡大縮小 (ホイール)。地図を動かすキーはゲームにないので、動かすのは右トラックパッド + R2 のドラッグ
  [2, 'joystick', 'dpad', { dpad_north: 'mouse_wheel SCROLL_UP', dpad_south: 'mouse_wheel SCROLL_DOWN' }, true],
  // 右トラックパッド: マウス。押し込みで左クリック
  [4, 'right_trackpad', 'absolute_mouse', { click: 'mouse_button LEFT' }, true],
  [6, 'left_trigger', 'trigger', { click: 'mouse_button RIGHT' }, true],
  [7, 'right_trigger', 'trigger', { click: 'mouse_button LEFT' }, true],
  // L1・R1 = 回す、メニュー = 帝国、ビュー = Esc、背面の L4 = Shift (押したまま R2 でドラッグすると範囲選択)、R4 = 指名の取り消し
  [8, 'switch', 'switches', { left_bumper: k('Z'), right_bumper: k('X'), button_escape: k('E'), button_menu: k('ESCAPE'), button_back_left: k('LEFT_SHIFT'), button_back_right: k('DELETE') }, true],
  // 使わない: 右スティック・左トラックパッド・ジャイロ (モードの書き方を Valve の例で確かめられたものだけを使う。README の 2)
  [9, 'gyro', 'absolute_mouse', {}, false],
];

const T = (n) => '\t'.repeat(n);
const kv = (n, a, b) => `${T(n)}"${a}"\t\t"${b}"`;
function vdf() {
  const L = ['"controller_mappings"', '{'];
  L.push(kv(1, 'version', '3'), kv(1, 'revision', '1'), kv(1, 'title', '#title'), kv(1, 'description', '#description'), kv(1, 'controller_type', 'controller_neptune'));
  L.push(`${T(1)}"localization"`, `${T(1)}{`);
  for (const [lang, title, desc] of [
    ['english', 'NoLongerUbiquitous (keyboard & mouse)', 'Right trackpad moves the cursor; R2 clicks and drags the map, L2 issues fleet orders. Left stick zooms; hold L4 while dragging for box selection. D-pad and bumpers rotate and tilt the map. A pauses, B goes back.'],
    ['japanese', 'NoLongerUbiquitous (キーボードとマウス)', '右トラックパッドでカーソル。R2 で選ぶ・押したまま動かすと地図が動く。L2 で艦隊を動かす。左スティックで拡大縮小、L4 を押したままドラッグで範囲選択。十字キーと L1・R1 で地図を回す・傾ける。A で止める、B で戻る。'],
  ]) L.push(`${T(2)}"${lang}"`, `${T(2)}{`, kv(3, 'title', title), kv(3, 'description', desc), `${T(2)}}`);
  L.push(`${T(1)}}`);
  for (const [id, , mode, inputs] of GROUPS) {
    L.push(`${T(1)}"group"`, `${T(1)}{`, kv(2, 'id', id), kv(2, 'mode', mode), `${T(2)}"inputs"`, `${T(2)}{`);
    for (const [input, binding] of Object.entries(inputs)) {
      L.push(`${T(3)}"${input}"`, `${T(3)}{`, `${T(4)}"activators"`, `${T(4)}{`, `${T(5)}"Full_Press"`, `${T(5)}{`, `${T(6)}"bindings"`, `${T(6)}{`, kv(7, 'binding', binding), `${T(6)}}`, `${T(5)}}`, `${T(4)}}`, `${T(3)}}`);
    }
    L.push(`${T(2)}}`, `${T(1)}}`);
  }
  L.push(`${T(1)}"preset"`, `${T(1)}{`, kv(2, 'id', '0'), kv(2, 'name', 'Default'), `${T(2)}"group_source_bindings"`, `${T(2)}{`);
  for (const [id, source, , , on] of GROUPS) L.push(kv(3, id, `${source} ${on ? 'active' : 'inactive'}`));
  L.push(`${T(2)}}`, `${T(1)}}`, `${T(1)}"settings"`, `${T(1)}{`, kv(2, 'left_trackpad_mode', '0'), kv(2, 'right_trackpad_mode', '0'), `${T(1)}}`, '}', '');
  return L.join('\n');
}

// Steamworks の「Custom Configuration (Bundled with Game)」が指すファイル (Action Manifest)。コントローラーの種類ごとに設定のファイルを指す。
// ゲームは Steam Input の API を使わないので、actions は空 (キーとマウスに置き換えるだけ)。Deck の設定を Xbox などにも使う (Steam が変換する)
const TYPES = ['controller_neptune', 'controller_steamcontroller_gordon', 'controller_xboxone', 'controller_xbox360', 'controller_ps4', 'controller_ps5', 'controller_switch_pro', 'controller_generic'];
function manifest() {
  const L = ['"Action Manifest"', '{', `${T(1)}"configurations"`, `${T(1)}{`];
  for (const t of TYPES) L.push(`${T(2)}"${t}"`, `${T(2)}{`, `${T(3)}"0"`, `${T(3)}{`, kv(4, 'path', 'controller_neptune.vdf'), `${T(3)}}`, `${T(2)}}`);
  L.push(`${T(1)}}`, `${T(1)}"actions"`, `${T(1)}{`, `${T(1)}}`, `${T(1)}"localization"`, `${T(1)}{`, `${T(1)}}`, '}', '');
  return L.join('\n');
}

// 確かめ: バインドはゲームが受けるキーとマウスだけ・グループの id がそろっている・置き場所が重ならない
function problems() {
  const out = [];
  const ids = new Set(), sources = new Set();
  for (const [id, source, , inputs] of GROUPS) {
    if (ids.has(id)) out.push(`グループの id ${id} が 2 つ`);
    if (sources.has(source)) out.push(`置き場所 ${source} が 2 つ`);
    ids.add(id); sources.add(source);
    for (const [input, b] of Object.entries(inputs)) {
      const key = /^key_press (\w+)$/.exec(b)?.[1];
      if (key ? !GAME_KEYS[key] : !MOUSE[b]) out.push(`${source}.${input} の ${b} はゲームが受けない`);
    }
  }
  return out;
}

const files = [[OUT, vdf()], [MANIFEST, manifest()]];
const bad = problems();
if (process.argv.includes('--check')) {
  for (const [f, text] of files) {
    let now = '';
    try { now = readFileSync(f, 'utf8'); } catch { /* ない */ }
    if (now !== text) bad.push(`${f.split(/[\\/]/).pop()} が表と違う (node desktop/steam-input/make.mjs で書き直す)`);
  }
} else if (!bad.length) for (const [f, text] of files) writeFileSync(f, text);
for (const b of bad) console.log(`問題: ${b}`);
console.log(bad.length ? 'Steam Input 不合格' : `Steam Input 合格 (グループ ${GROUPS.length}・バインド ${GROUPS.reduce((n, g) => n + Object.keys(g[3]).length, 0)})`);
process.exit(bad.length ? 1 : 0);
