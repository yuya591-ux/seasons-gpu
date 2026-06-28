// 「実写の窓、夏の坂の町」。窓の外を丸ごと Flux 生成の実写画像にした“写真主役”の情景。
// 計算で作る低ポリ/シェーダーの景色ではなく、本物の写真の実写感を、窓枠＋ガラス＋わずかな視差で見せる。
// 実写の窓シリーズの第1作（晴れ・夏の昭和の住宅地）。良ければ夕/夜/四季/海へ量産する。

export default {
  id: 'photo-window-town',
  axes: { season: 'summer', weather: 'clear', time: 'noon' },
  label: '実写の窓、夏の坂の町',
  desc: '窓の外は、実写の昭和の住宅地。瓦屋根と電線、夏の緑、遠い里山。蝉時雨の午後。',
  status: 'ready',
  public: false, // ギャラリーから引退（実機FB: 実写の窓は商品レベルに届かず＝3Dの街に集中）。コードは保持・devでは表示可。
  render: 'photoWindow', // 実写の窓シェーダー（写真を主役に・src/shaders/photoWindow.js）
  intensityLabel: '明るさ',

  // 窓の外の実写画像（Flux生成）。photoWindow が uBg として表示する。本番は保存画像を出すだけ。
  bg: 'bg/photo-window-town.jpg',
  bgPrompt:
    'photorealistic real photograph view from a window of a quiet Japanese residential neighborhood in late summer afternoon, detailed low houses with tiled roofs, power lines and poles, lush green trees and a narrow sloping street, distant hazy hills, warm natural sunlight, nostalgic Showa atmosphere, ultra detailed, 35mm photo, no people, no text',

  // 色パレット（写真にそっと乗せる時間帯の色味＋グレード用）。夏の午後。
  palette: {
    early: {
      skyTop: '#86b2d6',
      skyMid: '#aecbe0',
      horizon: '#e8e2cc',
      sunGlow: '#fff3dc',
      dropTint: '#46603a',
    },
    late: {
      skyTop: '#8fb0cc',
      skyMid: '#bcd0dc',
      horizon: '#ecd8be',
      sunGlow: '#ffead0',
      dropTint: '#50643c',
    },
  },
  driftPeriod: 320,
  phenomena: {},

  // 音セット（すべて既存のCC素材を再利用・CREDITS.md 記録済み）。夏の午後＝蝉時雨と渡る風。
  sounds: [
    { id: 'semi', label: '蝉', src: 'audio/summer-clear-noon/aburazemi.mp3', gain: 0.4, loop: true },
    { id: 'wind', label: '風', src: 'audio/winter-snow-night/wind.mp3', gain: 0.08, loop: true },
  ],
}
