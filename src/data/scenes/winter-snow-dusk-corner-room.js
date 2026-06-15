// 角部屋シリーズ「冬の雪の夕暮れ」。雪が舞い、窓の桟と窓台に積もる。眼下に冷たい街あかり。
// cornerRoom 器＋glass(雪)を再利用（データ追加のみ）。

export default {
  id: 'winter-snow-dusk-corner-room',
  axes: { season: 'winter', weather: 'snow', time: 'dusk' },
  label: '冬の雪の夕暮れ、高台の角部屋',
  desc: '舞う雪と、窓の桟に積もる白。眼下に冷たい街あかり。指や傾きで見回す。',
  status: 'ready',
  render: 'cornerRoom',
  lowRise: true,
  glass: 'snow', // 窓に舞い、桟に積もる雪
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#3a4358', // 冷たい青灰の夕
      skyMid: '#6b7488',
      horizon: '#b0a8a8',
      sunGlow: '#ffe8d0', // 雪ごしの暖かい窓あかり
      dropTint: '#3e424e',
    },
    late: {
      skyTop: '#2a3346',
      skyMid: '#525a6e',
      horizon: '#8f8a92',
      sunGlow: '#ffe0c8',
      dropTint: '#2e323c',
    },
  },
  driftPeriod: 300,
  phenomena: { snow: { intensity: 0.6 } },

  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.3, loop: true },
  ],
}
