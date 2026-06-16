// 「実写の窓、夕暮れの町」。実写の窓シリーズ第2作。窓の外は Flux 生成の実写・夕焼けの住宅地。
// 写真主役（photoWindow）。第1作と同じ器で、bg・palette・音・時間帯を替えただけの量産例。

export default {
  id: 'photo-window-dusk',
  axes: { season: 'summer', weather: 'clear', time: 'dusk' },
  label: '実写の窓、夕暮れの町',
  desc: '窓の外は、実写の茜の住宅地。灯り始めた窓、瓦屋根、夏の夕。ヒグラシのカナカナ。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-dusk.jpg',
  bgPrompt:
    'photorealistic real photograph view from a window of a quiet Japanese residential neighborhood at dusk, glowing orange and pink sunset sky, low tiled-roof houses, power lines and poles, a few warm window lights starting to glow, distant hazy hills, nostalgic Showa atmosphere, ultra detailed, 35mm photo, no people, no text',

  palette: {
    early: {
      skyTop: '#5a5a78',
      skyMid: '#9a7a82',
      horizon: '#e8b488',
      sunGlow: '#ffd8a8',
      dropTint: '#3e4a3a',
    },
    late: {
      skyTop: '#46465e',
      skyMid: '#7e5e68',
      horizon: '#d89a70',
      sunGlow: '#f6c094',
      dropTint: '#3a4034',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  sounds: [
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.42, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.08, loop: true },
  ],
}
