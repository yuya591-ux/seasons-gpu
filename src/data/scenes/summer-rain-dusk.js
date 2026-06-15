// 見本シーン「夏・雨・夕方・ヒグラシ」。
// 色は「静かな雨夕（くすみ）」。時間でじわじわ暮れていくため、
// 夕方(early)→暮れ際(late) の2キーフレームを持ち、描画側でゆっくり補間する。

export default {
  id: 'summer-rain-dusk',
  axes: { season: 'summer', weather: 'rain', time: 'dusk' },
  label: '夏の雨、夕暮れ',
  desc: '窓ガラスを流れる雨と、にじむ夕焼け。雨音・ヒグラシ・遠雷',
  status: 'ready', // 'ready' | 'planned'
  render: 'rainGlass', // 描画タイプ（src/shaders/index.js）
  intensityLabel: '雨脚', // 設定スライダーの名前

  // ── 窓の外の背景画像（任意の格上げ層）──
  // シェーダーの雨（屈折・曇り・きらめき）は土台のまま、奥の「絵」だけ Flux 生成画像で底上げできる。
  // 画像は開発時に scripts/gen-bg.mjs で生成して public/bg/ に保存し、下の bg を有効化するだけ（本番はAPIを叩かない）。
  // 情景が「背景プロンプト」を携えることで、季節×天気×時間帯ごとの量産がしやすい。
  bgPrompt:
    'watercolor and soft realism blend, nostalgic Japanese countryside at dusk, glowing crimson and amber sunset sky, low silhouette of distant blurred rooftops and trees along the bottom, soft hazy rainy atmosphere, melancholic calm, muted dusty colors, painterly bokeh, no people, no text',
  // bg: 'bg/summer-rain-dusk.jpg', // ← 生成画像を保存したら有効化（雨粒がこの絵を屈折させる）

  // 色パレット（#rrggbb）。キーフレーム配列で持ち、将来は時刻でさらに細かく移ろわせられる。
  palette: {
    // 夕方の入り（まだ光が残る）
    early: {
      skyTop: '#34323f', // 天頂・鼠がかった紫
      skyMid: '#5b4a59', // 中空・灰みの赤紫
      horizon: '#9c6f63', // 地平・沈んだ橙茶
      sunGlow: '#c89a82', // 光芒・弱い光
      dropTint: '#d8c6b8', // 水滴のハイライト
    },
    // 暮れ際（沈んで暗く湿る）
    late: {
      skyTop: '#26242f',
      skyMid: '#443843',
      horizon: '#6f4f49',
      sunGlow: '#946b5b',
      dropTint: '#b9a89c',
    },
  },

  // 色の移ろいの速さ（1サイクルの秒数）。ゆっくり、ループ感の出ない長さ。
  driftPeriod: 300,

  // 現象設定（既定値。設定UIで雨脚は上書きできる）
  phenomena: {
    rain: { intensity: 0.65 },
  },

  // 音セット（レイヤー）。出典・ライセンスは CREDITS.md に全数記録。
  // 形式は iOS/Safari でも鳴るよう .mp3。遠雷はループせず、ランダム間隔で時々鳴らす。
  sounds: [
    { id: 'rain', label: '雨音', src: 'audio/summer-rain-dusk/rain.mp3', gain: 0.85, loop: true },
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.45, loop: true },
    { id: 'thunder', label: '遠雷', src: 'audio/summer-rain-dusk/thunder.mp3', gain: 0.5, loop: false, interval: [22, 55], cue: 'thunder' },
  ],
}
