// 「本物の3D（ガウシアン・スプラット）」実証用の情景。
// 動画/写真から再構成した3Dをアプリ内のWebGLビューアで表示し、自由に見回せる。
// 本番は、あなたが撮った場所を学習（Brush）した .ply に差し替える。

export default {
  id: 'splat-demo',
  axes: { season: 'spring', weather: 'clear', time: 'noon' },
  label: '実証：本物の3D（ガウシアン）',
  desc: '写真から再構成した本物の3D。ドラッグで自由に見回せる（実証用）',
  status: 'ready',
  render: 'splat',
  splatUrl: 'splat/demo.splat', // public/ 配下

  // ギャラリーのサムネ用パレット（描画には使わない）
  palette: {
    early: { skyTop: '#33414f', skyMid: '#5a6b76', horizon: '#9aa3a0', sunGlow: '#e8e2d4', dropTint: '#2a2f33' },
    late: { skyTop: '#33414f', skyMid: '#5a6b76', horizon: '#9aa3a0', sunGlow: '#e8e2d4', dropTint: '#2a2f33' },
  },
  driftPeriod: 300,
  phenomena: {},
  sounds: [],
}
