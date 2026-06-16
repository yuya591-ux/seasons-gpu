// 「実写の窓、秋の紅葉」。実写の窓シリーズ。窓の外は Flux 生成の実写・紅葉に染まる住宅地。
// 写真主役（photoWindow）。同じ器で bg・palette・音・季節を替えた量産例（外部AI生成の組み込み方針B）。
// 背景は開発時に Flux で生成→Real-ESRGAN 超解像→public/bg/ 保存。本番はAPIを叩かない。

export default {
  id: 'photo-window-autumn',
  axes: { season: 'autumn', weather: 'clear', time: 'dusk' },
  label: '実写の窓、秋の紅葉',
  desc: '窓の外は、実写の紅葉に染まる坂の住宅地。茜色のもみじ、夕方の暖かい光。虫の音。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-autumn.jpg',
  bgPrompt:
    'photorealistic photograph view from a window of a quiet Japanese residential neighborhood in autumn, vivid red and orange maple foliage, low tiled-roof houses and a narrow sloping lane, warm late afternoon sunlight and light haze, distant hills in autumn colors, calm nostalgic Showa atmosphere, vertical composition, ultra detailed, sharp focus, high resolution, 35mm photo, no people, no text, no watermark',

  // 写真主役なので palette は写真にそっと色味を足すだけ（秋の夕方の暖かい光）。
  palette: {
    early: {
      skyTop: '#7e8c9a',  // 夕方の柔らかい青灰
      skyMid: '#b2a294',
      horizon: '#d8a868', // 茜の暖色
      sunGlow: '#ffcf8c', // 金色の夕光
      dropTint: '#9a5a38', // 紅葉の赤茶の差し色
    },
    late: {
      skyTop: '#6e7a88',
      skyMid: '#a08a7c',
      horizon: '#cc965c',
      sunGlow: '#f4bd78',
      dropTint: '#8a4e30',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 音はCC0/既存の流用（秋の虫の音）。出典は CREDITS.md に記録済み。
  sounds: [
    { id: 'crickets', label: '虫の音', src: 'audio/autumn-dusk-corner-room/crickets.mp3', gain: 0.45, loop: true },
  ],
}
