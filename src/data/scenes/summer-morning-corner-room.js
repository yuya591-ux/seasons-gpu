// 角部屋シリーズ「夏の朝」。やわらかな朝靄の光、眼下に目覚めはじめる街。
// ヒグラシは明け方にも鳴く。cornerRoom 器を再利用（データ追加のみ）。

export default {
  id: 'summer-morning-corner-room',
  axes: { season: 'summer', weather: 'cloudy', time: 'morning' },
  label: '夏の朝、高台の角部屋',
  desc: '朝靄にかすむ街を、部屋の窓から見下ろす。指や傾きで見回す。',
  status: 'ready',
  render: 'cornerRoom',
  lowRise: true,
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#9fb0c4', // 明け方の淡い青
      skyMid: '#c9c2be',
      horizon: '#e8d2b0', // 朝焼けの暖かみ
      sunGlow: '#fff0d8',
      dropTint: '#6b6a72', // 朝靄にかすむ建物
    },
    late: {
      skyTop: '#a8bcd0',
      skyMid: '#d6cfc6',
      horizon: '#f0dcb8',
      sunGlow: '#fff6e6',
      dropTint: '#7a7880',
    },
  },
  driftPeriod: 280,
  phenomena: {},

  sounds: [
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.35, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
  ],
}
