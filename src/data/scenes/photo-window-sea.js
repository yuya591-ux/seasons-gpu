// 「実写の窓、夕暮れの海辺」。実写の窓シリーズ第4作。窓の外は Flux 生成の実写・夕の海辺の町。
// 写真主役（photoWindow）。同じ器で bg・palette・音・時間帯を替えた量産例。

export default {
  id: 'photo-window-sea',
  axes: { season: 'summer', weather: 'clear', time: 'dusk' },
  label: '実写の窓、夕暮れの海辺',
  desc: '窓の外は、実写の夕の海辺。金色に光る水平線、瓦屋根の港町。波とカモメ。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-sea.jpg',
  bgPrompt:
    'photorealistic real photograph view from a window of a calm Japanese seaside town at dusk, distant sea and horizon, small coastal houses with tiled roofs in the foreground, soft golden evening light on the water, gentle haze, nostalgic atmosphere, ultra detailed, 35mm photo, no people, no text',

  palette: {
    early: {
      skyTop: '#5e6a86',
      skyMid: '#9a8a86',
      horizon: '#e6c290',
      sunGlow: '#ffdca6',
      dropTint: '#3a4a4e',
    },
    late: {
      skyTop: '#4a5070',
      skyMid: '#846e70',
      horizon: '#dca878',
      sunGlow: '#f6c594',
      dropTint: '#34424a',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  sounds: [
    { id: 'waves', label: '波', src: 'audio/summer-dusk-seaside/waves.mp3', gain: 0.5, loop: true },
    { id: 'gulls', label: 'カモメ', src: 'audio/summer-dusk-seaside/gulls.mp3', gain: 0.3, loop: true },
  ],
}
