// 角部屋シリーズ「春の夕暮れ」。淡い桜色の空、窓の外を花びらが舞う。
// cornerRoom 器＋foliage(花びら)を再利用（データ追加のみ）。

export default {
  id: 'spring-dusk-corner-room',
  axes: { season: 'spring', weather: 'clear', time: 'dusk' },
  label: '春の夕暮れ、高台の角部屋',
  desc: '桜色の夕空と、窓の外を舞う花びら。部屋から街を見下ろす。',
  status: 'ready',
  render: 'town3d',          // 立体の街エンジンへ載せ替え（見回しの正しさ・立体感）
  town3dKind: 'corner',
  town3dWeather: 'petals',   // 花びらが窓の外を舞う
  lowRise: true,
  foliage: 'petals',
  intensityLabel: '街あかり',

  palette: {
    early: {
      skyTop: '#3a3550',
      skyMid: '#7d6478',
      horizon: '#e8a8a0', // 桜色の夕暮れ
      sunGlow: '#ffd8d0',
      dropTint: '#4a4048',
    },
    late: {
      skyTop: '#2a2640',
      skyMid: '#5a4a5c',
      horizon: '#c87878',
      sunGlow: '#f0b8b0',
      dropTint: '#383038',
    },
  },
  driftPeriod: 280,
  phenomena: {},

  // 春の宵の気配: うぐいす＋渡る風（春の郷愁）。カエルの合唱は街の窓辺に合わず不快なため差し替え。CREDITS.md に全数記録。
  sounds: [
    { id: 'uguisu', label: 'うぐいす', src: 'audio/shishigaya-morning-yato/uguisu.mp3', gain: 0.3, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
  ],
}
