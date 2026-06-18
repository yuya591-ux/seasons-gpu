// 角部屋シリーズ「夏の朝」。やわらかな朝靄の光、眼下に目覚めはじめる街。
// ヒグラシは明け方にも鳴く。cornerRoom 器を再利用（データ追加のみ）。

export default {
  id: 'summer-morning-corner-room',
  axes: { season: 'summer', weather: 'cloudy', time: 'morning' },
  label: '夏の朝、高台の角部屋',
  desc: '朝靄にかすむ街を、部屋の窓から見下ろす。指や傾きで見回す。',
  status: 'ready',
  render: 'town3d',          // 立体の街エンジンへ載せ替え（見回しの正しさ・立体感）
  town3dKind: 'corner',
  lowRise: true,
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#8aa0ba', // 明け方の青を深め＝ミルク色の低コントラストを脱す（評価 美術-M1）
      skyMid: '#aeb9c2',
      horizon: '#e6c79a', // 朝焼けの暖かみ（彩度を上げ白っぽさを抜く）
      sunGlow: '#ffeccc',
      dropTint: '#62616a',
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
