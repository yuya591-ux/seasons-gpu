// 「室内から見回す」実証用の情景（窓辺シリーズ＝“その部屋にいる”体験の土台）。
// 一人称で室内に立ち、指/傾きで首を振って見回す。本番は本人撮影の「角部屋＋窓＋街」に差し替え。

export default {
  id: 'room-demo',
  axes: { season: 'autumn', weather: 'clear', time: 'dusk' },
  label: '実証：室内から見回す（窓辺の土台）',
  desc: '一人称で室内に立ち、指や傾きで首を振って見回す（本番＝あなたの部屋に）',
  status: 'ready',
  render: 'splat',
  splatUrl: 'splat/room.splat',
  splatMode: 'room', // 一人称・部屋モード

  palette: {
    early: { skyTop: '#4a4a5a', skyMid: '#7a7080', horizon: '#b0a090', sunGlow: '#e8dcc8', dropTint: '#3a3640' },
    late: { skyTop: '#4a4a5a', skyMid: '#7a7080', horizon: '#b0a090', sunGlow: '#e8dcc8', dropTint: '#3a3640' },
  },
  driftPeriod: 300,
  phenomena: {},
  sounds: [],
}
