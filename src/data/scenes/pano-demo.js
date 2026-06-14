// 「立体パノラマの窓」実証用のサンプル情景。
// フリー素材の360°写真を見回し、簡易深度の視差で奥行きを出すデモ。
// 本番は、あなたが撮った写真＋AI推定の深度マップに差し替える想定。

export default {
  id: 'pano-demo',
  axes: { season: 'autumn', weather: 'clear', time: 'noon' },
  label: '実証：立体パノラマの窓',
  desc: '古い街路の360°写真を、AI深度の視差で立体的に見回す（実証用）',
  status: 'ready',
  render: 'windowPano',
  pano: 'pano/town-demo.jpg', // public/ 配下（地上目線の街路・4096px）
  panoDepth: 'pano/town-demo-depth.png', // AI推定の深度マップ
  intensityLabel: '立体感', // 視差の強さ

  // windowPano は色uniformを使わないが、ギャラリーのサムネ用にパレットを持つ。
  palette: {
    early: {
      skyTop: '#7e8aa0',
      skyMid: '#c2b39a',
      horizon: '#a89478',
      sunGlow: '#f0e6d2',
      dropTint: '#5a5046',
    },
    late: {
      skyTop: '#7e8aa0',
      skyMid: '#c2b39a',
      horizon: '#a89478',
      sunGlow: '#f0e6d2',
      dropTint: '#5a5046',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 静かな街路の気配として、風をごく控えめに（既存素材を再利用）
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.18, loop: true },
  ],
}
