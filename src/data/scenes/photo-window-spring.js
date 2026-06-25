// 「実写の窓、春の朝」。実写の窓シリーズ第5作。窓の外は Flux 生成の実写・桜咲く春の住宅地の朝。
// 写真主役（photoWindow）。同じ器で bg・palette・音・時間帯を替えた量産例（外部AI生成の組み込み方針B）。
// 背景は開発時に Flux で生成→Real-ESRGAN 超解像→public/bg/ 保存。本番はAPIを叩かない。

export default {
  id: 'photo-window-spring',
  axes: { season: 'spring', weather: 'clear', time: 'morning' },
  label: '実写の窓、春の朝',
  desc: '窓の外は、実写の桜咲く春の住宅地の朝。やわらかな朝陽と霞。うぐいすと小川のせせらぎ。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-spring.jpg',
  bgPrompt:
    'photorealistic photograph view from a window of a quiet Japanese residential neighborhood on a spring morning, cherry blossom trees in soft pink full bloom, low tiled-roof houses and a narrow lane, gentle warm morning sunlight with light haze, distant green hills, calm nostalgic Showa atmosphere, vertical composition, ultra detailed, sharp focus, high resolution, 35mm photo, no people, no text, no watermark',

  // 写真主役なので palette は写真にそっと色味を足すだけ（春の朝のやわらかい光）。
  palette: {
    early: {
      skyTop: '#90a6c2',  // 朝の淡い青
      skyMid: '#bcb4bc',  // 霞んだ中空
      horizon: '#ecd6c4', // 地平の暖かい淡色
      sunGlow: '#ffe9cf', // やわらかい朝陽
      dropTint: '#7e9068', // 春の新緑の差し色
    },
    late: {
      skyTop: '#9ab0c8',
      skyMid: '#c6bcc0',
      horizon: '#f2dcca',
      sunGlow: '#fff0da',
      dropTint: '#86996e',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 音はCC0/既存の流用（うぐいす・小川・遠くの蛙）。出典は CREDITS.md に記録済み。
  sounds: [
    { id: 'uguisu', label: 'うぐいす', src: 'audio/shishigaya-morning-yato/uguisu.mp3', gain: 0.4, loop: true },
    { id: 'stream', label: 'せせらぎ', src: 'audio/shishigaya-morning-yato/stream.mp3', gain: 0.36, loop: true },
    { id: 'frogs', label: '遠くの蛙', src: 'audio/spring-dusk-corner-room/frogs.mp3', gain: 0.14, loop: true },
  ],
}
