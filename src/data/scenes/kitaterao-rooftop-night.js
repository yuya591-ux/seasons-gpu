// 番外「北寺尾の屋上、坂の街の夜」。昼の屋上(kitaterao-rooftop)と同じ開けた屋上から、
// 灯りの点る坂の住宅地・パチンコのネオン・街灯・月の夜を見渡す。平成初期の郷愁の夜景。
// render は共通の kitateraoRooftop（夜度 nightAmt が暗い palette で自動的に夜の灯りを灯す）。

export default {
  id: 'kitaterao-rooftop-night',
  axes: { season: 'summer', weather: 'clear', time: 'night' },
  label: '北寺尾の屋上、坂の街の夜',
  desc: '馴染みの屋上から見る、灯りの点る坂の住宅地とネオンの夜景。月と星の下で。',
  status: 'ready',
  render: 'kitateraoRooftop',
  lowRise: true,
  intensityLabel: '街あかり',
  panX: 3.0, // ほぼ360°見渡せる
  public: false, // 昼の屋上と同じ理由でギャラリーから隠す（?dev=1で確認可・将来は3Dの屋上で復活させたい）

  palette: {
    early: {
      skyTop: '#0f1430', // 深い藍の天頂
      skyMid: '#243056',
      horizon: '#5a4660', // 地平に滲む街灯りの紫
      sunGlow: '#ffd79a', // 窓・街灯の暖色（夜の灯り色として解釈）
      dropTint: '#161f1a', // 闇に沈む森
    },
    late: {
      skyTop: '#0a0e26',
      skyMid: '#1c2748',
      horizon: '#4a3a55',
      sunGlow: '#ffcf90',
      dropTint: '#121a15',
    },
  },
  driftPeriod: 320,
  phenomena: {},

  // 夜の屋上: 渡る風（既存のCC0素材を再利用）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.16, loop: true },
  ],
}
