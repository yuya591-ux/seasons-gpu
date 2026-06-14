// 窓辺シリーズ「夏の雨の夜、高台の下町」。窓ガラスを雨が流れ、夜の街に灯りがにじむ。
export default {
  id: 'summer-rain-night-downtown',
  axes: { season: 'summer', weather: 'rain', time: 'night' },
  label: '夏の雨の夜、高台の下町',
  desc: '窓を流れる雨と、夜の街明かり。雨音とヒグラシ',
  status: 'ready',
  render: 'windowTown',
  view: 'downtown',
  glass: 'rain', // 窓を流れる雨
  intensityLabel: '街の灯り',

  palette: {
    early: {
      skyTop: '#11142e',
      skyMid: '#2a2440',
      horizon: '#4a3a4e', // 夜の街明かり
      sunGlow: '#ffcf95',
      dropTint: '#14121f',
    },
    late: {
      skyTop: '#0d1026',
      skyMid: '#231e38',
      horizon: '#574150',
      sunGlow: '#ffd7a0',
      dropTint: '#100e19',
    },
  },
  driftPeriod: 300,
  phenomena: { rain: { intensity: 0.7 } },

  // 雨音＋ヒグラシ（既存素材を再利用）。CREDITS.md に記録済み。
  sounds: [
    { id: 'rain', label: '雨音', src: 'audio/summer-rain-dusk/rain.mp3', gain: 0.8, loop: true },
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.35, loop: true },
    { id: 'thunder', label: '遠雷', src: 'audio/summer-rain-dusk/thunder.mp3', gain: 0.45, loop: false, interval: [26, 60], cue: 'thunder' },
  ],
}
