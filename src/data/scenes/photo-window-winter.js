// 「実写の窓、雪の里」。実写の窓シリーズ。窓の外は Flux 生成の実写・雪降る山里。
// 写真主役（photoWindow）。同じ器で bg・palette・音・季節を替えた量産例（外部AI生成の組み込み方針B）。
// 背景は開発時に Flux で生成→Real-ESRGAN 超解像→public/bg/ 保存。本番はAPIを叩かない。

export default {
  id: 'photo-window-winter',
  axes: { season: 'winter', weather: 'snow', time: 'noon' },
  label: '実写の窓、雪の里',
  desc: '窓の外は、実写の雪降る山里。瓦に積もる雪、霞む白い丘。しんと静かな風の音。',
  status: 'ready',
  render: 'photoWindow',
  intensityLabel: '明るさ',

  bg: 'bg/photo-window-winter.jpg',
  bgPrompt:
    'photorealistic photograph view from a window of a quiet Japanese mountain village in winter, fresh snow covering low tiled roofs and a narrow lane, bare trees and a few evergreens, soft overcast snowy light, gentle falling snow, distant white hills fading into haze, calm nostalgic Showa atmosphere, vertical composition, ultra detailed, sharp focus, high resolution, 35mm photo, no people, no text, no watermark',

  // 写真主役なので palette は写真にそっと色味を足すだけ（冬の淡く冷たい光）。
  palette: {
    early: {
      skyTop: '#b6c2ce',  // 雪曇りの淡い青灰
      skyMid: '#cacdd2',
      horizon: '#dee3e6', // 雪の地平の淡色
      sunGlow: '#eef2f5', // 冷たく白い光
      dropTint: '#8c99a2', // 影の冷たい差し色
    },
    late: {
      skyTop: '#a8b4c0',
      skyMid: '#bcc0c6',
      horizon: '#d2d8dc',
      sunGlow: '#e2e8ec',
      dropTint: '#808d96',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 音はCC0/既存の流用（雪夜の風）。出典は CREDITS.md に記録済み。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.4, loop: true },
  ],
}
