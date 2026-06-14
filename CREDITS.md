# CREDITS — 使用素材の出典・ライセンス

このアプリで使う環境音などの素材は、ライセンスが明確なフリー素材（CC0 / パブリックドメイン最優先）
のみを使用し、出典・ライセンス・作者をここに**全数**記録する。ライセンス不明の素材は使わない。

## 音素材

すべて元は Ogg Vorbis。iOS/Safari でも再生できるよう **MP3 へ変換**して同梱している
（CC BY 素材は「変更点：MP3へ変換／ループ用に再生制御」を明記）。

### 情景「夏の雨、夕暮れ」 — `public/audio/summer-rain-dusk/`

| レイヤー | ファイル | 作品 / 作者 | ライセンス | 出典 |
| --- | --- | --- | --- | --- |
| 雨音 | `rain.mp3` | "Rain against the window" / Cori Samuel (cori) | パブリックドメイン | https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg |
| ヒグラシ | `higurashi.mp3` | "Tanna japonensis v01" / Σ64 | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ | https://commons.wikimedia.org/wiki/File:Tanna_japonensis_v01.ogg |
| 遠雷 | `thunder.mp3` | "Thunder" / Bidgee | CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/ | https://commons.wikimedia.org/wiki/File:Thunder.ogg |

- ヒグラシは実在種 *Tanna japonensis*（ヒグラシ／カナカナ）の本物の鳴き声。2011年、神奈川県川崎市で録音。
- 雷は 2007年、オーストラリア・ダーウィンで録音。
- 変更点（CC BY 素材）：Ogg→MP3 へ変換。アプリ内ではループ／ランダム間隔で再生。

### 情景「夏の晴れ、真昼」 — `public/audio/summer-clear-noon/`

| レイヤー | ファイル | 作品 / 作者 | ライセンス | 出典 |
| --- | --- | --- | --- | --- |
| 油蝉 | `aburazemi.mp3` | "Aburazemi 07z7315" / ISAKA Yoji (Cory) | CC BY 2.1 JP — https://creativecommons.org/licenses/by/2.1/jp/ | https://commons.wikimedia.org/wiki/File:Aburazemi_07z7315.ogg |

- 油蝉は実在種 *Graptopsaltria nigrofuscata*（アブラゼミ）の本物の鳴き声。2007年、神奈川県川崎市・東高根森林公園で録音。
- 変更点：Ogg→MP3 へ変換。アプリ内ではループ再生。

### 情景「夏の夕暮れ、海辺の窓」 — `public/audio/summer-dusk-seaside/`

| レイヤー | ファイル | 作品 / 作者 | ライセンス | 出典 |
| --- | --- | --- | --- | --- |
| 波 | `waves.mp3` | "Waves" / Dsw4 | パブリックドメイン | https://commons.wikimedia.org/wiki/File:Waves.ogg |

### 情景「冬の雪の夜／夏の朝（山）」 — `public/audio/winter-snow-night/`

| レイヤー | ファイル | 作品 / 作者 | ライセンス | 出典 |
| --- | --- | --- | --- | --- |
| 風 | `wind.mp3` | "Wind in Swedish pine forest at 25 mps" / W.carter | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ | https://commons.wikimedia.org/wiki/File:Wind_in_Swedish_pine_forest_at_25_mps.ogg |

- 波は 2008年秋、米ニューヨーク州オンタリオ湖畔で録音。
- 風は森を渡る風の録音。冬の雪の夜と、山あいの朝で使用（同じファイルを再利用）。
- 変更点：Ogg→MP3 へ変換。アプリ内ではループ再生。CC BY-SA 素材は同ライセンス継承。

## 写真（パノラマ）

| 用途 | ファイル | 作品 / 作者 | ライセンス | 出典 |
| --- | --- | --- | --- | --- |
| 立体パノラマの窓（実証用） | `public/pano/town-demo.jpg` | "Basel Martinsgasse Panorama" / DerMische | CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ | https://commons.wikimedia.org/wiki/File:Basel_Martinsgasse_Panorama.jpg |

- 変更点：表示用に 4096px 幅へ縮小。深度マップ `town-demo-depth.png` は元画像から AI（Depth-Anything V2）で生成した派生物。本番は本人撮影の写真に差し替える想定。CC BY-SA 素材は同ライセンス継承。

## 3D（ガウシアン・スプラット）

| 用途 | ファイル | 由来 | 扱い |
| --- | --- | --- | --- |
| 本物の3D（実証用） | `public/splat/demo-small.splat` | 3D Gaussian Splatting / Mip-NeRF360 の "garden" シーン。配布: https://huggingface.co/cakewalk/splat-data | **実証用プレースホルダ**。研究素材のため正式公開はしない前提。表示用に約73万splatへ間引き。本番は本人が撮影・学習した `.ply` に差し替える。 |

- 学習ツール: Brush（wgpu, Apache-2.0/MIT）をローカルで使用（リポジトリ外）。
- 表示ライブラリ: three.js（MIT）/ @mkkellogg/gaussian-splats-3d（MIT）。

## フォント

- 情景の描画は基本シェーダー計算。写真は「立体パノラマの窓」、3Dは上記でのみ使用。
- フォントは OS 標準（system-ui 等）のみ。同梱しない。
