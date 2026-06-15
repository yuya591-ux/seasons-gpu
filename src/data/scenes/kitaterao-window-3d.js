// 窓辺シリーズ「北寺尾の窓辺、立体の街」。フラグメントの平面画でなく、本物の3D（Three.js）で
// 低ポリ＋トゥーンの坂の街を組み、窓から見下ろす。建物・電柱（強い遠近）・木・雲・アドバルーンが
// 実体として立体配置され、スワイプで見回すと視差で奥行きが動く。平成初期の郷愁の街並み。

export default {
  id: 'kitaterao-window-3d',
  axes: { season: 'summer', weather: 'clear', time: 'dusk' },
  label: '北寺尾の窓辺、立体の街',
  desc: '本物の3Dで組んだ坂の街を、窓から見下ろす。電柱が遠近に伸び、雲が流れる立体の眺め。',
  status: 'ready',
  render: 'town3d', // Three.js ビューア（src/engine/town3dViewer.js）

  palette: {
    early: {
      skyTop: '#5e84bc', // 澄んだ午後の空
      skyMid: '#a8c4dc',
      horizon: '#f6dcb6', // 暖かな地平
      sunGlow: '#ffe6bc',
      dropTint: '#2e4428',
    },
    late: {
      skyTop: '#3e4a78',
      skyMid: '#7e7e9c',
      horizon: '#f0a878', // 夕焼け
      sunGlow: '#ffcf9a',
      dropTint: '#283a24',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 窓辺の風（既存のCC0素材を再利用）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.14, loop: true },
  ],
}
