// 窓辺シリーズ「夏の朝、山あいの朝」。重なる山の稜線に朝霧がたなびく。
export default {
  id: 'summer-morning-mountains',
  axes: { season: 'summer', weather: 'clear', time: 'morning' },
  label: '夏の朝、山あいの窓',
  status: 'ready',
  render: 'windowMountains',
  view: 'mountains',
  intensityLabel: '朝霧',

  palette: {
    early: {
      skyTop: '#5b86c8', // 朝の青
      skyMid: '#a9c4dd',
      horizon: '#e9d8c0', // 朝のもや
      sunGlow: '#fff0d0', // 朝陽
      dropTint: '#2f4a32', // 近い山の緑
    },
    late: {
      skyTop: '#6f97d2',
      skyMid: '#b8cfe2',
      horizon: '#f0e4d2',
      sunGlow: '#fff6e2',
      dropTint: '#37553a',
    },
  },
  driftPeriod: 320,
  phenomena: { mist: { amount: 0.5 } },

  // 風（CC BY-SA 4.0, W.carter）。CREDITS.md に記録。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.3, loop: true },
  ],
}
