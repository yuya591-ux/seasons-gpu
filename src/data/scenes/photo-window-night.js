// 「実写の窓、夜の町」。実写の窓シリーズ第3作。窓の外は Flux 生成の実写・夜の住宅地（灯る窓）。
// 写真主役（photoWindow）。同じ器で bg・palette・音・時間帯を替えた量産例。

export default {
  id: 'photo-window-night',
  axes: { season: 'summer', weather: 'clear', time: 'night' },
  label: '実写の窓、夜の町',
  desc: '窓の外は、実写の夜の住宅地。灯る窓と街灯、藍に沈む街。虫の音と渡る風。',
  status: 'ready',
  public: false, // ギャラリーから引退（実機FB: 実写の窓は商品レベルに届かず＝3Dの街に集中）。コードは保持・devでは表示可。
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-night.jpg',
  bgPrompt:
    'photorealistic real photograph view from a window of a quiet Japanese residential street at night, warm glowing house windows and a street lamp, deep blue night sky, silhouettes of tiled roofs and power lines, distant town glow, nostalgic Showa atmosphere, ultra detailed, 35mm night photo, no people, no text',

  palette: {
    early: {
      skyTop: '#171c30',
      skyMid: '#252c44',
      horizon: '#3c3848',
      sunGlow: '#c89a6a',
      dropTint: '#262b3c',
    },
    late: {
      skyTop: '#10131f',
      skyMid: '#191e2e',
      horizon: '#302a38',
      sunGlow: '#ad8158',
      dropTint: '#1c2030',
    },
  },
  driftPeriod: 320,
  phenomena: {},

  sounds: [
    { id: 'mushi', label: '虫の音', src: 'audio/autumn-dusk-corner-room/crickets.mp3', gain: 0.32, loop: true },
    { id: 'suzumushi', label: '鈴虫', src: 'audio/kitaterao-window-3d-night/suzumushi.mp3', gain: 0.22, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.08, loop: true },
  ],
}
