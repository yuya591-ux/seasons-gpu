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
  public: false, // 評価で隔離推奨（2Dの抽象描画）。同じ谷戸は3D版 shishigaya-window-3d が上位互換。dev=1でのみ表示。
  render: 'shishigaya',
  intensityLabel: '朝靄',
  public: false, // 本物の3D版 shishigaya-window-3d に主役を譲り、ギャラリーからは隠す（?dev=1で確認可）

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

  // 谷戸の朝の気配: 渡る風＋谷を縫うせせらぎ＋時折ウグイス。すべてライセンス明確な素材（CREDITS.md）。
  sounds: [
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.10, loop: true },
    { id: 'stream', label: 'せせらぎ', src: 'audio/shishigaya-morning-yato/stream.mp3', gain: 0.28, loop: true },
    // ウグイスは鳴き交わすように、ゆらぎのある間隔でそっと（cueなし＝自然な高域を残す）。
    { id: 'uguisu', label: 'ウグイス', src: 'audio/shishigaya-morning-yato/uguisu.mp3', loop: false, interval: [7, 19], gain: 0.42 },
  ],
}
