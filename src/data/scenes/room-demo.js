// 「室内から見回す」実証用の情景（窓辺シリーズ＝“その部屋にいる”体験の土台）。
// 一人称で室内に立ち、指/傾きで首を振って見回す。本番は本人撮影の「角部屋＋窓＋街」に差し替え。

export default {
  id: 'room-demo',
  axes: { season: 'autumn', weather: 'clear', time: 'dusk' },
  label: 'ある部屋の窓辺',
  desc: '部屋に立って、ゆっくりと見回す。指でも、画面を傾けても。',
  status: 'ready',
  public: false, // 実証用プレースホルダ（研究素材の室内）。本命はシェーダーの cornerRoom。?dev=1 のみ
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
