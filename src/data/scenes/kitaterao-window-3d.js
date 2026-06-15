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
      skyTop: '#4a68a8', // 澄んだ午後の深い青
      skyMid: '#a4c0da',
      horizon: '#f8d09a', // 暖かな金の地平
      sunGlow: '#ffdca2',
      dropTint: '#2e4428',
    },
    late: {
      skyTop: '#36366a', // 紫紺へ沈む
      skyMid: '#8a6486',
      horizon: '#f4884e', // 燃える夕焼け
      sunGlow: '#ff9a50',
      dropTint: '#243420',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 窓辺の風（既存のCC0素材を再利用）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.14, loop: true },
  ],
}
