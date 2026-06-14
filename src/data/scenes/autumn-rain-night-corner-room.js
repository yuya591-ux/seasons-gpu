// 角部屋シリーズ「秋の雨の夜」。窓ガラスを雨が流れ、眼下に夜の街あかりがにじむ。
// 時おり遠雷が空をほのかに照らす。右を向くと隣の建物の壁。cornerRoom 器を再利用（データ追加のみ）。

export default {
  id: 'autumn-rain-night-corner-room',
  axes: { season: 'autumn', weather: 'rain', time: 'night' },
  label: '秋の雨の夜、高台の角部屋',
  desc: '窓を流れる雨と、眼下の街あかり。時おり遠雷。指や傾きで見回す。',
  status: 'ready',
  render: 'cornerRoom',
  glass: 'rain', // 窓を流れる雨
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#0c0e22',
      skyMid: '#1a1830',
      horizon: '#3a2c3a', // 雲に映る街明かり
      sunGlow: '#ffd089', // 窓・街灯のあかり
      dropTint: '#100e18',
    },
    late: {
      skyTop: '#080a1a',
      skyMid: '#15131f',
      horizon: '#2e2330',
      sunGlow: '#ffd9a0',
      dropTint: '#0c0a12',
    },
  },
  driftPeriod: 300,
  phenomena: { rain: { intensity: 0.7 } },

  sounds: [
    { id: 'rain', label: '雨音', src: 'audio/summer-rain-dusk/rain.mp3', gain: 0.8, loop: true },
    { id: 'thunder', label: '遠雷', src: 'audio/summer-rain-dusk/thunder.mp3', gain: 0.45, loop: false, interval: [24, 58], cue: 'thunder' },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
  ],
}
