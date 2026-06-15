// 窓辺シリーズの本命「高台の角部屋」。室内に立ち、窓から夕暮れの下町を見下ろす。
// 右へ見回すと、隣のマンションの壁が迫って街を遮る＝角部屋にいる手応え。
// 色5値は他情景と共通の名前で受け取り、ここでは空・残照・建物・窓あかりとして解釈する。

export default {
  id: 'autumn-dusk-corner-room',
  axes: { season: 'autumn', weather: 'cloudy', time: 'dusk' },
  label: '秋の夕暮れ、高台の角部屋',
  desc: '部屋の窓から見下ろす夕暮れの街。右を向くと隣の建物の壁。指や傾きで見回す。',
  status: 'ready',
  render: 'cornerRoom',
  lowRise: true,
  foliage: 'leaves', // 紅葉が窓の外を舞う
  intensityLabel: '街あかり', // 灯る窓の多さ

  palette: {
    early: {
      skyTop: '#2a2740',
      skyMid: '#6b5168',
      horizon: '#c87a52',
      sunGlow: '#f2b878',
      dropTint: '#4a3f4a',
    },
    late: {
      skyTop: '#1a1828',
      skyMid: '#43354a',
      horizon: '#8f4f3e',
      sunGlow: '#d99258',
      dropTint: '#332b36',
    },
  },
  driftPeriod: 280,
  phenomena: {},

  // 秋の夕暮れの気配: 草むらの虫の音（鈴を振るような秋の夜長の始まり）＋名残のヒグラシ＋渡る風。
  // すべてライセンス明確な素材（CREDITS.md に全数記録）。
  sounds: [
    { id: 'crickets', label: '虫の音', src: 'audio/autumn-dusk-corner-room/crickets.mp3', gain: 0.34, loop: true },
    { id: 'higurashi', label: 'ヒグラシ', src: 'audio/summer-rain-dusk/higurashi.mp3', gain: 0.3, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
  ],
}
