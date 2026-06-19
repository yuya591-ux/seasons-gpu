// 窓辺シリーズ「冬の雪の夜、高台の下町」。窓ガラスに雪が舞い、深い夜の街に灯りがにじむ。
export default {
  id: 'winter-snow-night-downtown',
  axes: { season: 'winter', weather: 'snow', time: 'night' },
  label: '冬の雪の夜、高台の下町',
  desc: '窓に舞う雪と、夜の街の灯り。しんとした風',
  status: 'ready',
  public: false, // 評価で隔離/作り直し推奨（手続き的windowTownの抽象的な街並み）。dev=1でのみ表示。
  render: 'windowTown',
  view: 'downtown',
  glass: 'snow', // 窓に舞う雪
  intensityLabel: '街の灯り',

  palette: {
    early: {
      skyTop: '#0a0d22',
      skyMid: '#1a2138',
      horizon: '#2e3550', // 雪雲に映る街明かり
      sunGlow: '#ffd9a0', // 窓・街灯の暖色
      dropTint: '#0e1020',
    },
    late: {
      skyTop: '#080a1c',
      skyMid: '#151b30',
      horizon: '#363c58',
      sunGlow: '#ffe1ad',
      dropTint: '#0b0d18',
    },
  },
  driftPeriod: 320,
  phenomena: { snow: { amount: 0.7 } },

  // 風（CC BY-SA 4.0, W.carter）。CREDITS.md に記録。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.35, loop: true },
  ],
}
