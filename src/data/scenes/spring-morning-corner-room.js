// 角部屋シリーズ「春の朝」。淡い桜色の朝空、窓の外を花びらが舞う。
// cornerRoom 器＋foliage(花びら)を再利用（データ追加のみ）。季節の偏り是正の春の一枚。

export default {
  id: 'spring-morning-corner-room',
  axes: { season: 'spring', weather: 'clear', time: 'morning' },
  label: '春の朝、高台の角部屋',
  desc: '夜明けの桜色の空と、窓の外を舞う花びら。澄んだ朝の街を見下ろす。',
  status: 'ready',
  render: 'cornerRoom',
  lowRise: true,
  foliage: 'petals', // 花びらが窓の外を舞う
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#7a92c0',
      skyMid: '#b4c8dc',
      horizon: '#f4d2c8', // 夜明けの桜色
      sunGlow: '#fff0e4',
      dropTint: '#8a98a6',
    },
    late: {
      skyTop: '#8fb0d8',
      skyMid: '#cadce8',
      horizon: '#ecdcd2',
      sunGlow: '#fff5ec',
      dropTint: '#a8b2bc',
    },
  },
  driftPeriod: 280,
  phenomena: {},

  // 春の朝の気配: うぐいすと渡る風をうっすら（既存のCC0/CC-BY素材を再利用。CREDITS.md記録済み）
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
    // ウグイスは春の朝の主役。ゆらぎのある間隔でそっと（cueなし＝自然な高域）。
    { id: 'uguisu', label: 'ウグイス', src: 'audio/shishigaya-morning-yato/uguisu.mp3', loop: false, interval: [6, 17], gain: 0.4 },
  ],
}
