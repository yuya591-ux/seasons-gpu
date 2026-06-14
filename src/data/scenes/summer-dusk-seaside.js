// 窓辺シリーズ「夏の夕暮れ、海辺の窓」。水平線に夕陽が落ち、波がきらめく。
export default {
  id: 'summer-dusk-seaside',
  axes: { season: 'summer', weather: 'clear', time: 'dusk' },
  label: '夏の夕暮れ、海辺の窓',
  desc: '水平線に落ちる夕陽と、きらめく波。波の音',
  status: 'ready',
  render: 'windowSea',
  view: 'sea',
  intensityLabel: '波のきらめき',

  palette: {
    early: {
      skyTop: '#2b2c54', // 夕暮れの紫紺
      skyMid: '#7a5f86',
      horizon: '#e0905f', // 夕陽の茜
      sunGlow: '#ffb070',
      dropTint: '#1f3a4a', // 海の深み
    },
    late: {
      skyTop: '#1d1e40',
      skyMid: '#5e4a6c',
      horizon: '#b86a4e',
      sunGlow: '#ff9a5a',
      dropTint: '#172d3b',
    },
  },
  driftPeriod: 300,
  phenomena: { waves: { intensity: 0.6 } },

  // 波（パブリックドメイン, Dsw4）。CREDITS.md に記録。
  sounds: [
    { id: 'waves', label: '波', src: 'audio/summer-dusk-seaside/waves.mp3', gain: 0.7, loop: true },
  ],
}
