// 情景「夏・晴れ・昼・油蝉」。
// 抜けるような青空、ゆっくり湧く入道雲、地平の陽炎。真昼なので色の移ろいは控えめ
// （正午→午後の入りで、わずかに白むだけ）。

export default {
  id: 'summer-clear-noon',
  axes: { season: 'summer', weather: 'clear', time: 'noon' },
  label: '夏の晴れ、真昼',
  status: 'ready',
  render: 'clearSky',
  intensityLabel: '陽炎', // 設定スライダー（陽炎と雲の強さ）

  palette: {
    // 正午（最も青が濃い）
    early: {
      skyTop: '#2f6fd0', // 天頂の青
      skyMid: '#6ea8e6', // 中空
      horizon: '#d6e6f2', // 地平の淡い水色
      sunGlow: '#fff4d8', // 陽射し
      dropTint: '#ffffff', // 入道雲の白
    },
    // 午後の入り（わずかに白み、暖かく）
    late: {
      skyTop: '#3f78cf',
      skyMid: '#84b3e6',
      horizon: '#e3e9ee',
      sunGlow: '#fff0cf',
      dropTint: '#f6f3ee',
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
