// 「実写の窓、雪の夜」。実写の窓シリーズ。窓の外は Flux 生成の実写・雪の夜の住宅地（灯る窓・街灯・降る雪）。
// 写真主役（photoWindow）。同じ器で bg・palette・音・季節/時間帯を替えた量産例（手続き的な「雪夜の下町」の実写版）。

export default {
  id: 'photo-window-snow-night',
  axes: { season: 'winter', weather: 'snow', time: 'night' },
  label: '実写の窓、雪の夜',
  desc: '窓の外は、実写の雪の夜の路地。降る雪と灯る窓、街灯のあかり。しんと冷えた風だけ。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-snow-night.jpg',
  bgPrompt:
    'photorealistic real photograph view from a window of a quiet Japanese residential street on a snowy winter night, fresh snow on tiled roofs and a narrow lane, gentle falling snow, warm glowing house windows and a soft street lamp, deep indigo night sky, silhouettes of bare trees and power lines, distant town glow, nostalgic Showa atmosphere, 35mm night photo, no people, no text',

  palette: {
    early: {
      skyTop: '#141a30', // 雪夜の藍
      skyMid: '#22304a', // 中空のやや明るい紺
      horizon: '#3a4a62', // 地平・雪あかりの青灰
      sunGlow: '#d8bc8a', // 街灯・窓の暖色
      dropTint: '#26344e', // ガラスのくもり（雪夜の青）
    },
    late: {
      skyTop: '#0f1426',
      skyMid: '#1a2438',
      horizon: '#2e3c54',
      sunGlow: '#c2a274',
      dropTint: '#1c2840',
    },
  },
  driftPeriod: 340,
  phenomena: {},

  // 雪の夜はしんと静か。冷えた風だけをそっと。出典・ライセンスは CREDITS.md に全数記録。
  sounds: [
    { id: 'wind', label: '冬の風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.18, loop: true },
  ],
}
