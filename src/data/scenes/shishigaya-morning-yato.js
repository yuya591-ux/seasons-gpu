// 窓辺シリーズ「鶴見・獅子ヶ谷の谷戸（朝）」。作者の出身地（横浜市鶴見区獅子ヶ谷）の
// 昭和後期〜平成初期の谷戸の風景を、丘の住宅の窓から見渡す画として再現する。
// 地形と佇まいの再現（実在の商標・固有意匠は模さない）: 市民の森の尾根／谷底の田んぼと
// せせらぎ／斜面に登る瓦屋根の住宅地／茅葺の横溝屋敷（主屋＋長屋門＋屋敷林）。

export default {
  id: 'shishigaya-morning-yato',
  axes: { season: 'summer', weather: 'clear', time: 'morning' },
  label: '朝の谷戸、鶴見・獅子ヶ谷',
  desc: '森の尾根に抱かれた谷戸。田んぼと茅葺の屋敷、坂の住宅地。出身の町の昭和の風景。',
  status: 'ready',
  render: 'shishigaya',
  intensityLabel: '朝靄',

  palette: {
    early: {
      skyTop: '#8db2d6',
      skyMid: '#c2d6e2',
      horizon: '#f1e2cc', // 夜明けの暖かな靄
      sunGlow: '#fff1d8',
      dropTint: '#2c4226', // 市民の森の深緑
    },
    late: {
      skyTop: '#9cbcde',
      skyMid: '#d0e0ea',
      horizon: '#eeded0',
      sunGlow: '#fff6e8',
      dropTint: '#334a2c',
    },
  },
  driftPeriod: 300,
  phenomena: {},

  // 谷戸の朝の気配: 渡る風をうっすら（既存のCC0素材を再利用）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.12, loop: true },
  ],
}
