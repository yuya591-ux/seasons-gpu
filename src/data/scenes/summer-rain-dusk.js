// 見本シーン「夏・雨・夕方・ヒグラシ」。
// 色は「静かな雨夕（くすみ）」。時間でじわじわ暮れていくため、
// 夕方(early)→暮れ際(late) の2キーフレームを持ち、描画側でゆっくり補間する。

export default {
  id: 'summer-rain-dusk',
  axes: { season: 'summer', weather: 'rain', time: 'dusk' },
  label: '夏の雨、夕暮れ',
  status: 'ready', // 'ready' | 'planned'

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

  // 音セット（レイヤー）。実体ファイルは次ステップで /public/audio に追加し CREDITS.md に記録する。
  sounds: [
    { id: 'rain', label: '雨音', src: 'audio/summer-rain-dusk/rain.ogg', gain: 0.8, loop: true },
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.ogg', gain: 0.5, loop: true },
    { id: 'thunder', label: '遠雷', src: 'audio/summer-rain-dusk/thunder.ogg', gain: 0.4, loop: true },
  ],
}
