// 「立体パノラマの窓」実証用のサンプル情景。
// フリー素材の360°写真を見回し、簡易深度の視差で奥行きを出すデモ。
// 本番は、あなたが撮った写真＋AI推定の深度マップに差し替える想定。

export default {
  id: 'pano-demo',
  axes: { season: 'autumn', weather: 'clear', time: 'noon' },
  label: '実証：立体パノラマの窓',
  desc: '360°写真を見回す立体パノラマ（フリー素材・実証用）',
  status: 'ready',
  render: 'windowPano',
  pano: 'pano/town-demo.jpg', // public/ 配下
  intensityLabel: '立体感', // 視差の強さ

  // windowPano は色uniformを使わないが、ギャラリーのサムネ用にパレットを持つ。
  palette: {
    early: {
      skyTop: '#3f7fc8',
      skyMid: '#8fb8e0',
      horizon: '#cfe0ec',
      sunGlow: '#fff2d6',
      dropTint: '#2a4a64',
    },
    late: {
      skyTop: '#3f7fc8',
      skyMid: '#8fb8e0',
      horizon: '#cfe0ec',
      sunGlow: '#fff2d6',
      dropTint: '#2a4a64',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 港町なので波音（既存素材を再利用）
  sounds: [
    { id: 'waves', label: '波', src: 'audio/summer-dusk-seaside/waves.mp3', gain: 0.6, loop: true },
  ],
}
