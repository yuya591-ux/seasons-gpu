// 窓辺シリーズ第一作「夏の夕暮れ、高台の下町」。
// 高台のアパートの窓から見下ろす、薄曇りの茜空とシルエットの街。日が落ちるほど窓に灯りが点る。
// 指スワイプで左右に見回せる。

export default {
  id: 'summer-dusk-downtown',
  axes: { season: 'summer', weather: 'cloudy', time: 'dusk' },
  label: '夏の夕暮れ、高台の下町',
  status: 'ready',
  render: 'windowTown',
  view: 'downtown',
  intensityLabel: '街の灯り',

  palette: {
    // 夕暮れ入り（茜が残る）
    early: {
      skyTop: '#3a3a5c', // 天頂の紫紺
      skyMid: '#8a6a7e', // 中空の藤
      horizon: '#d98a63', // 地平の茜
      sunGlow: '#ffb877', // 残照・窓の灯り
      dropTint: '#2a2433', // 建物のシルエット
    },
    // 暮れ際（藍に沈み、灯りが映える）
    late: {
      skyTop: '#1a1b36',
      skyMid: '#4a3a57',
      horizon: '#9c5a52',
      sunGlow: '#ffc98a',
      dropTint: '#15131f',
    },
  },

  driftPeriod: 300,

  phenomena: {
    town: { lights: 0.7 },
  },

  // ヒグラシ（既存の素材を再利用）。出典・ライセンスは CREDITS.md に記録済み。
  sounds: [
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.5, loop: true },
  ],
}
