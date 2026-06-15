// 「北寺尾の窓辺、立体の街（夜）」。本物の3D（Three.js）の坂の街を、窓から見下ろす夜景。
// 暗い palette で town3dViewer が自動的に夜モード（月明かり・灯る窓・ネオン・車のライト・月と星）になる。

export default {
  id: 'kitaterao-window-3d-night',
  axes: { season: 'summer', weather: 'clear', time: 'night' },
  label: '北寺尾の窓辺、立体の街（夜）',
  desc: '本物の3Dの坂の街を窓から見下ろす夜景。灯る窓・ネオン・車のライトが闇に瞬く。',
  status: 'ready',
  render: 'town3d',

  palette: {
    early: {
      skyTop: '#0d1228', // 深い藍の夜空
      skyMid: '#1c2444',
      horizon: '#33283f', // 地平に滲む街灯りの紫
      sunGlow: '#ffd79a', // 窓・灯りの暖色
      dropTint: '#141d18',
    },
    late: {
      skyTop: '#090d20',
      skyMid: '#161d3a',
      horizon: '#2a2236',
      sunGlow: '#ffcf90',
      dropTint: '#101610',
    },
  },
  driftPeriod: 320,
  phenomena: {},

  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.16, loop: true },
  ],
}
