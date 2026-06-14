// 情景「夏・晴れ・昼・油蝉」。
// 抜けるような青空、ゆっくり湧く入道雲、地平の陽炎。真昼なので色の移ろいは控えめ
// （正午→午後の入りで、わずかに白むだけ）。

export default {
  id: 'summer-clear-noon',
  axes: { season: 'summer', weather: 'clear', time: 'noon' },
  label: '夏の晴れ、真昼',
  desc: '抜けるような青空と入道雲、地平の陽炎。油蝉のジリジリ',
  status: 'ready',
  render: 'clearSky',
  intensityLabel: '陽炎', // 設定スライダー（陽炎と雲の強さ）

  palette: {
    // 正午（最も青が濃い）。白とびを避けるため地平・雲は純白にしない。
    early: {
      skyTop: '#1f57b8', // 天頂の深い青
      skyMid: '#4f8fd6', // 中空
      horizon: '#a3c5e4', // 地平の水色（白くしすぎない）
      sunGlow: '#ffe6b8', // 陽射し（控えめに使う）
      dropTint: '#eef4fb', // 入道雲の明部（やや青みの白）
    },
    // 午後の入り（わずかに暖かく）
    late: {
      skyTop: '#2c63bd',
      skyMid: '#5e97d8',
      horizon: '#b2cfe6',
      sunGlow: '#ffdfa8',
      dropTint: '#e7eef6',
    },
  },

  driftPeriod: 320,

  phenomena: {
    haze: { intensity: 0.6 },
  },

  // 油蝉のループ。出典・ライセンスは CREDITS.md に記録。
  sounds: [
    { id: 'aburazemi', label: '油蝉', src: 'audio/summer-clear-noon/aburazemi.mp3', gain: 0.6, loop: true },
  ],
}
